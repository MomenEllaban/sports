/**
 * pnpm eta:retry (T14 + T-RMA) — re-submit all INVALID tax invoices plus
 * PENDING_ETA return credit notes (bounded batches). Run hourly via cron.
 */
import { PrismaClient } from '@prisma/client';

async function main() {
  const { buildEtaReceipt, submitEtaCreditNote } = await import('../src/lib/eta.js');
  const { num, money } = await import('../src/lib/pricing.js');
  const { getVatRate } = await import('../src/lib/settings.js');
  const db = new PrismaClient();
  try {
    const vatRate = await getVatRate();
    const invalid = await db.taxInvoice.findMany({
      where: { status: 'INVALID' },
      take: 50,
      include: {
        order: { include: { items: { include: { product: true } } } },
        sale: { include: { items: { include: { product: true } } } },
      },
    });
    let fixed = 0;
    for (const inv of invalid) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const items = ((inv.order?.items || inv.sale?.items || []) as any[]).map((i) => ({
          name: i.product.nameAr,
          code: i.product.gs1Code || i.product.sku,
          quantity: i.quantity,
          unitPrice: num(i.unitPrice),
          totalPrice: num(i.totalPrice),
          vatAmount: Math.round(num(i.totalPrice) * vatRate * 100) / 100,
        }));
        if (items.length === 0) continue;
        const receipt = await buildEtaReceipt({
          branchId: inv.branchId,
          orderId: inv.orderId || undefined,
          saleId: inv.saleId || undefined,
          invoiceNumber: inv.invoiceNumber,
          totalAmount: num(inv.totalAmount),
          vatAmount: num(inv.vatAmount),
          items,
        });
        const updated = await db.taxInvoice.update({
          where: { id: inv.id },
          data: { etaUuid: receipt.etaUuid, qrCodeData: receipt.qrCodeDataUrl, status: receipt.status, etaResponseText: receipt.message },
        });
        if (updated.status !== 'INVALID') fixed++;
      } catch {
        /* keep INVALID for the next run */
      }
    }
    console.log(`eta:retry done — ${fixed}/${invalid.length} recovered.`);
    // T-RMA: flush PENDING_ETA return credit notes.
    const pendingEta = await db.returnRequest.findMany({
      where: { etaStatus: 'PENDING_ETA' },
      take: 50,
      include: { items: true, refunds: { select: { amount: true } } },
    });
    let etaFixed = 0;
    for (const r of pendingEta) {
      try {
        const amount = r.refunds.reduce((s, f) => s + num(f.amount), 0);
        const res = await submitEtaCreditNote({
          branchId: r.branchId,
          invoiceNumber: r.returnNumber,
          totalAmount: amount,
          vatAmount: money((amount * vatRate) / (1 + vatRate)),
          items: r.items.map((i) => ({
            name: 'مرتجع',
            quantity: i.quantity,
            unitPrice: 0,
            totalPrice: num(i.refundAmount),
            vatAmount: 0,
          })),
        });
        if (res.ok) {
          await db.returnRequest.update({ where: { id: r.id }, data: { etaStatus: 'SENT' } });
          etaFixed++;
        }
      } catch {
        /* keep PENDING_ETA for the next run */
      }
    }
    console.log(`eta:retry returns done — ${etaFixed}/${pendingEta.length} sent.`);
  } finally {
    await db.$disconnect();
  }
}

main().catch((e) => {
  console.error('eta:retry failed:', e);
  process.exit(1);
});
