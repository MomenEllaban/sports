import { NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireRole } from '@/lib/auth/guards';
import { canAccessBranch } from '@/lib/auth/branch-scope';
import { num } from '@/lib/pricing';

const invoiceInclude = {
  branch: { select: { id: true, name: true, nameEn: true } },
  order: {
    include: {
      customer: { select: { name: true, phone: true } },
      items: { include: { product: { select: { id: true, nameAr: true, nameEn: true, sku: true, barcode: true } } } },
    },
  },
  sale: {
    include: {
      customer: { select: { name: true, phone: true } },
      items: { include: { product: { select: { id: true, nameAr: true, nameEn: true, sku: true, barcode: true } } } },
    },
  },
} as const;

type InvoiceWithSource = Prisma.TaxInvoiceGetPayload<{ include: typeof invoiceInclude }>;

function legacySnapshot(invoice: InvoiceWithSource) {
  const source = invoice.order || invoice.sale;
  if (!source) return null;
  const items = source.items.map((item) => ({
    productId: item.productId,
    nameAr: item.product?.nameAr || 'منتج رياضي',
    nameEn: item.product?.nameEn || 'Sports product',
    sku: item.product?.sku || item.productId,
    barcode: item.product?.barcode || null,
    quantity: item.quantity,
    unitPrice: num(item.unitPrice),
    totalPrice: num(item.totalPrice),
  }));
  return {
    invoiceNumber: invoice.invoiceNumber,
    source: invoice.order ? 'ORDER' : 'SALE',
    sourceId: source.id,
    createdAt: invoice.createdAt.toISOString(),
    branch: invoice.branch,
    customer: source.customer || null,
    cashier: invoice.sale ? { id: invoice.sale.cashierId } : null,
    paymentMethod: source.paymentMethod,
    subtotal: num(source.subtotal),
    discount: num(source.discountAmount),
    vat: num(invoice.vatAmount),
    deliveryFee: invoice.order ? num(invoice.order.deliveryFee) : 0,
    total: num(invoice.totalAmount),
    lines: items,
    qrCodeData: invoice.qrCodeData,
    etaUuid: invoice.etaUuid,
  };
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { error, session } = await requireRole('SUPER_ADMIN', 'BRANCH_MANAGER');
    if (error) return error;
    const { id } = await params;
    const invoice = await prisma.taxInvoice.findUnique({ where: { id }, include: invoiceInclude });
    if (!invoice) return NextResponse.json({ success: false, error: 'الفاتورة غير موجودة' }, { status: 404 });
    if (!canAccessBranch(session, invoice.branchId)) return NextResponse.json({ success: false, error: 'الفاتورة خارج نطاق فروعك' }, { status: 403 });
    const snapshot = invoice.snapshot || legacySnapshot(invoice);
    return NextResponse.json({
      success: true,
      invoice: {
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        status: invoice.status,
        snapshot,
        legacy: !invoice.snapshot,
        reprintCount: invoice.reprintCount,
        createdAt: invoice.createdAt,
      },
    });
  } catch (error) {
    console.error('Admin invoice read error:', error);
    return NextResponse.json({ success: false, error: 'تعذر تحميل الفاتورة' }, { status: 500 });
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { error, session } = await requireRole('SUPER_ADMIN', 'BRANCH_MANAGER');
    if (error) return error;
    const { id } = await params;
    const body = await req.json() as { requestId?: unknown; locale?: unknown; reason?: unknown };
    const requestId = typeof body.requestId === 'string' ? body.requestId.trim() : '';
    if (!requestId || requestId.length < 8 || requestId.length > 120) {
      return NextResponse.json({ success: false, error: 'requestId غير صالح' }, { status: 400 });
    }
    const locale = body.locale === 'en' ? 'en' : 'ar';
    const reason = typeof body.reason === 'string' ? body.reason.trim().slice(0, 500) : null;

    const existing = await prisma.invoiceReprint.findUnique({ where: { requestId }, include: { taxInvoice: true } });
    if (existing) {
      if (existing.taxInvoiceId !== id) return NextResponse.json({ success: false, error: 'requestId مستخدم لفاتورة أخرى' }, { status: 409 });
      return NextResponse.json({ success: true, idempotent: true, copyNumber: existing.copyNumber, invoiceId: id, createdAt: existing.createdAt });
    }

    const invoice = await prisma.taxInvoice.findUnique({ where: { id }, include: invoiceInclude });
    if (!invoice) return NextResponse.json({ success: false, error: 'الفاتورة غير موجودة' }, { status: 404 });
    if (!canAccessBranch(session, invoice.branchId)) return NextResponse.json({ success: false, error: 'الفاتورة خارج نطاق فروعك' }, { status: 403 });

    const copyNumber = invoice.reprintCount + 1;
    const result = await prisma.$transaction(async (tx) => {
      const updated = await tx.taxInvoice.updateMany({
        where: { id, reprintCount: invoice.reprintCount },
        data: { reprintCount: { increment: 1 }, lastReprintedAt: new Date() },
      });
      if (updated.count !== 1) throw new Error('STALE_REPRINT');
      const reprint = await tx.invoiceReprint.create({
        data: { taxInvoiceId: id, requestId, copyNumber, locale, reason, printedById: session?.user?.id || null },
      });
      await tx.auditLog.create({
        data: {
          actorId: session?.user?.id || null,
          action: 'invoice.reprinted',
          entity: 'TaxInvoice',
          entityId: id,
          branchId: invoice.branchId,
          metadata: JSON.stringify({ requestId, copyNumber, locale, reason }),
        },
      });
      return reprint;
    });

    return NextResponse.json({
      success: true,
      copyNumber: result.copyNumber,
      createdAt: result.createdAt,
      invoiceId: id,
      legacy: !invoice.snapshot,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'STALE_REPRINT') {
      return NextResponse.json({ success: false, error: 'تم إعادة طباعة الفاتورة من جهاز آخر؛ حدّث الصفحة' }, { status: 409 });
    }
    if ((error as { code?: string }).code === 'P2002') {
      return NextResponse.json({ success: false, error: 'requestId مستخدم مسبقاً' }, { status: 409 });
    }
    console.error('Admin invoice reprint error:', error);
    return NextResponse.json({ success: false, error: 'تعذر تسجيل إعادة الطباعة' }, { status: 500 });
  }
}
