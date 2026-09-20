import type { PrismaClient } from '@prisma/client';
import { num } from './pricing.js';

/**
 * READ-ONLY invariant checker core (T11). Takes any PrismaClient (app or test DB).
 * Returns finding strings; empty = clean. NEVER writes.
 */
export async function runChecks(db: PrismaClient): Promise<string[]> {
  const findings: string[] = [];

  const neg = await db.branchInventory.findMany({ where: { stockQuantity: { lt: 0 } } });
  if (neg.length > 0) {
    findings.push(`NEGATIVE_STOCK: ${neg.length} rows`);
  }

  const badChain = await db.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM "InventoryLog" WHERE "newQuantity" != "previousQuantity" + "changeQuantity" LIMIT 20`;
  if (badChain.length > 0) {
    findings.push(`LOG_CHAIN_BROKEN: ${badChain.length} logs where new != previous + change`);
  }

  const orders = await db.order.findMany({ include: { items: true } });
  let orderBad = 0;
  for (const o of orders) {
    const sub = num(o.items.reduce((s, i) => s + num(i.unitPrice) * i.quantity, 0));
    const expected = num(sub - num(o.discountAmount) + num(o.taxAmount) + num(o.deliveryFee));
    if (Math.abs(expected - num(o.totalAmount)) > 0.011) orderBad++;
  }
  if (orderBad > 0) findings.push(`ORDER_TOTALS_MISMATCH: ${orderBad}/${orders.length} orders`);

  const sales = await db.sale.findMany({ include: { items: true } });
  let saleBad = 0;
  for (const s of sales) {
    const sub = num(s.items.reduce((x, i) => x + num(i.unitPrice) * i.quantity, 0));
    const expected = num(sub - num(s.discountAmount) + num(s.taxAmount));
    if (Math.abs(expected - num(s.totalAmount)) > 0.011) saleBad++;
  }
  if (saleBad > 0) findings.push(`SALE_TOTALS_MISMATCH: ${saleBad}/${sales.length} sales`);

  const closed = await db.order.findMany({
    where: { orderStatus: { in: ['CANCELLED', 'RETURNED'] } },
    select: { id: true, orderNumber: true },
  });
  let missingReturn = 0;
  for (const o of closed) {
    const n = await db.inventoryLog.count({ where: { referenceId: o.orderNumber, type: 'RETURN' } });
    if (n === 0) missingReturn++;
  }
  if (missingReturn > 0) findings.push(`CLOSED_WITHOUT_RETURN_LOG: ${missingReturn}/${closed.length} orders`);

  const dup: Array<{ n: string }> = await db.$queryRaw`
    SELECT "orderNumber" AS n FROM "Order" GROUP BY "orderNumber" HAVING COUNT(*) > 1
    UNION ALL
    SELECT "saleNumber" AS n FROM "Sale" GROUP BY "saleNumber" HAVING COUNT(*) > 1
    UNION ALL
    SELECT "sku" AS n FROM "Product" GROUP BY "sku" HAVING COUNT(*) > 1`;
  if (dup.length > 0) findings.push(`DUPLICATE_NUMBERS: ${dup.map((d) => d.n).join(', ')}`);

  return findings;
}
