/**
 * pnpm eta:retry (T14) — re-submit all INVALID tax invoices (bounded batch).
 * Run hourly via cron; each retry rebuilds payload with current GS1 codes.
 */
import { PrismaClient } from '@prisma/client';

async function main() {
  const { buildEtaReceipt } = await import('../src/lib/eta.js');
  const { num } = await import('../src/lib/pricing.js');
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
  } finally {
    await db.$disconnect();
  }
}

main().catch((e) => {
  console.error('eta:retry failed:', e);
  process.exit(1);
});
