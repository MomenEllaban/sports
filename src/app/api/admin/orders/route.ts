import { captureError } from '@/lib/monitor';
import { apiError } from '@/lib/api-response';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireRole } from '@/lib/auth/guards';
import { canAccessBranch } from '@/lib/auth/branch-scope';
import { computeTotals, num } from '@/lib/pricing';
import { decrementStock, InsufficientStockError } from '@/lib/inventory/service';
import { makeInvoiceSnapshot } from '@/lib/invoices/snapshot';

const genOrderNumber = () => `ORD-2026-${Math.floor(100000 + Math.random() * 900000)}`;

export async function POST(req: Request) {
  try {
    const { error, session } = await requireRole('SUPER_ADMIN', 'BRANCH_MANAGER');
    if (error) return error;

    const body = await req.json();
    const {
      guestName,
      guestPhone,
      deliveryAddress,
      paymentMethod = 'COD',
      orderSource = 'WHATSAPP',
      branchId,
      notes,
      items,
    } = body;

    if (!guestPhone || !deliveryAddress || !branchId || !items || items.length === 0) {
      return apiError('VALIDATION_ERROR', 'الموبايل، العنوان، الفرع، والمنتجات مطلوبة', 400);
    }

    const branch = await prisma.branch.findFirst({ where: { id: branchId, isActive: true } });
    if (!branch) {
      return apiError('VALIDATION_ERROR', 'الفرع غير صالح', 400);
    }
    if (!canAccessBranch(session, branchId)) {
      return apiError('FORBIDDEN', 'لا تملك صلاحية إنشاء طلب في هذا الفرع', 403);
    }

    // Validate item shape first so we can load all products in one query.
    const requested: Array<{ productId: string; quantity: number }> = [];
    for (const item of items) {
      if (typeof item.quantity !== 'number' || !Number.isInteger(item.quantity) || item.quantity <= 0) {
        return apiError('VALIDATION_ERROR', 'كمية غير صالحة في الطلب', 400);
      }
      if (typeof item.productId !== 'string' || !item.productId) {
        return apiError('VALIDATION_ERROR', 'صنف غير صالح في الطلب', 400);
      }
      requested.push({ productId: item.productId, quantity: item.quantity });
    }

    // T06/T09: server recomputes from DB; client prices ignored.
    const products = await prisma.product.findMany({
      where: { id: { in: [...new Set(requested.map((r) => r.productId))] } },
    });
    const byId = new Map(products.map((p) => [p.id, p]));

    const orderItemsData: Array<{ productId: string; unitPrice: number; quantity: number; totalPrice: number }> = [];
    for (const line of requested) {
      const product = byId.get(line.productId);
      if (!product || !product.isActive) {
        return apiError('VALIDATION_ERROR', 'صنف غير موجود أو موقوف', 400);
      }
      const price = num(product.price);
      orderItemsData.push({
        productId: product.id,
        unitPrice: price,
        quantity: line.quantity,
        totalPrice: price * line.quantity,
      });
    }

    // T09: central pricing (exclusive VAT).
    const totals = computeTotals({ lines: orderItemsData });

    // ONE transaction: stock + logs + order. Numbers retried on collision (T07).
    let order: { id: string; orderNumber: string } | null = null;
    let lastErr: unknown = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      const orderNumber = genOrderNumber();
      try {
        order = await prisma.$transaction(async (tx) => {
          for (const line of orderItemsData) {
            await decrementStock(tx, {
              branchId,
              productId: line.productId,
              quantity: line.quantity,
              type: 'SALE',
              referenceId: orderNumber,
            });
          }
          const created = await tx.order.create({
            data: {
              orderNumber,
              orderSource: orderSource as 'WHATSAPP' | 'ONLINE' | 'POS',
              guestName: guestName || null,
              guestPhone: String(guestPhone).trim(),
              deliveryAddress: String(deliveryAddress).trim(),
              branchId,
              paymentMethod: paymentMethod as 'COD' | 'PAYMOB' | 'FAWRY' | 'INSTAPAY' | 'VODAFONE_CASH' | 'KASHIER' | 'CASH' | 'CARD',
              subtotal: totals.subtotal,
              taxAmount: totals.vat,
              deliveryFee: 0,
              deliveryZone: 'MANUAL',
              totalAmount: totals.total,
              paymentStatus: 'PENDING',
              notes: notes || null,
              items: { create: orderItemsData },
            },
          });
          await tx.taxInvoice.create({
            data: {
              invoiceNumber: orderNumber,
              orderId: created.id,
              branchId,
              totalAmount: totals.total,
              vatAmount: totals.vat,
              status: 'SUBMITTED',
              snapshotSource: 'ISSUED',
              snapshot: makeInvoiceSnapshot({
                invoiceNumber: orderNumber,
                source: 'ORDER',
                sourceId: created.id,
                createdAt: new Date(),
                branch: { id: branch.id, name: branch.name, nameEn: branch.nameEn },
                customer: { name: guestName || null, phone: String(guestPhone).trim() },
                paymentMethod: String(paymentMethod),
                subtotal: totals.subtotal,
                discount: 0,
                vat: totals.vat,
                deliveryFee: 0,
                total: totals.total,
                lines: orderItemsData.map((line) => {
                  const product = byId.get(line.productId);
                  return { productId: line.productId, nameAr: product?.nameAr || 'منتج رياضي', nameEn: product?.nameEn || 'Sports product', sku: product?.sku || line.productId, barcode: product?.barcode || null, quantity: line.quantity, unitPrice: line.unitPrice, totalPrice: line.totalPrice };
                }),
              }),
            },
          });
          return { id: created.id, orderNumber };
        }, { maxWait: 10000, timeout: 20000 });
        lastErr = null;
        break;
      } catch (e) {
        lastErr = e;
        if ((e as { code?: string }).code === 'P2002') continue;
        if (e instanceof InsufficientStockError) {
          return NextResponse.json(
            {
              success: false,
              error: 'المخزون لا يكفي',
              items: [{ productId: e.productId, available: e.available }],
            },
            { status: 400 }
          );
        }
        throw e;
      }
    }
    if (lastErr || !order) {
      throw lastErr || new Error('Order failed');
    }

    const created = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    return NextResponse.json({ success: true, order: created });
  } catch (e) {
    captureError('api/admin/orders', e);
    return apiError('INTERNAL_ERROR', 'فشل في إنشاء الطلب', 500);
  }
}
