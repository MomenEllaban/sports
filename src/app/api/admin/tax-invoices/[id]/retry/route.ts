import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { num } from '@/lib/pricing';
import { requireRole } from '@/lib/auth/guards';
import { buildEtaReceipt } from '@/lib/eta';
import { getVatRate } from '@/lib/settings';
import { captureError } from '@/lib/monitor';

/**
 * Retry an INVALID tax invoice (T14): rebuild the receipt payload from the
 * linked order/sale (with real GS1 codes) and re-submit. Updates the row.
 */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { error } = await requireRole('SUPER_ADMIN', 'FINANCE');
    if (error) return error;
    const { id } = await params;
    const inv = await prisma.taxInvoice.findUnique({
      where: { id },
      include: {
        order: { include: { items: { include: { product: true } } } },
        sale: { include: { items: { include: { product: true } } } },
      },
    });
    if (!inv) return NextResponse.json({ success: false, error: 'الفاتورة غير موجودة' }, { status: 404 });
    if (inv.status !== 'INVALID') {
      return NextResponse.json({ success: false, error: 'إعادة المحاولة للحالات الفاشلة فقط' }, { status: 409 });
    }
    const vatRate = await getVatRate();
    const lines = inv.order
      ? inv.order.items.map((i) => ({
          name: i.product.nameAr,
          code: i.product.gs1Code || i.product.sku,
          quantity: i.quantity,
          unitPrice: num(i.unitPrice),
          totalPrice: num(i.totalPrice),
          vatAmount: Math.round(num(i.totalPrice) * vatRate * 100) / 100,
        }))
      : (inv.sale
        ? inv.sale.items.map((i) => ({
            name: i.product.nameAr,
            code: i.product.gs1Code || i.product.sku,
            quantity: i.quantity,
            unitPrice: num(i.unitPrice),
            totalPrice: num(i.totalPrice),
            vatAmount: Math.round(num(i.totalPrice) * vatRate * 100) / 100,
          }))
        : []);
    if (lines.length === 0) return NextResponse.json({ success: false, error: 'لا أصناف مرتبطة' }, { status: 400 });
    const receipt = await buildEtaReceipt({
      branchId: inv.branchId,
      orderId: inv.orderId || undefined,
      saleId: inv.saleId || undefined,
      invoiceNumber: inv.invoiceNumber,
      totalAmount: num(inv.totalAmount),
      vatAmount: num(inv.vatAmount),
      items: lines,
    });
    const updated = await prisma.taxInvoice.update({
      where: { id },
      data: { etaUuid: receipt.etaUuid, qrCodeData: receipt.qrCodeDataUrl, status: receipt.status, etaResponseText: receipt.message },
    });
    return NextResponse.json({ success: true, status: updated.status, message: receipt.message });
  } catch (e) {
    captureError('admin/tax-invoices/[id]/retry', e);
    return NextResponse.json({ success: false, error: 'تعذر إعادة المحاولة' }, { status: 500 });
  }
}
