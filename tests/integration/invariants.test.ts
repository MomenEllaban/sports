import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { testPrisma, resetTestDb, makeBranch, makeCategory, makeProduct, stock, makeCustomer } from '../helpers/factories.js';
import { runChecks } from '../../src/lib/invariants.js';

describe('invariant checker vs corrupted test DB (T11, RED first)', () => {
  beforeAll(async () => {
    await resetTestDb();
    const db = testPrisma();
    const b = await makeBranch('Corrupt Branch');
    const cat = await makeCategory();
    const p = await makeProduct(cat.id, 100);
    await stock(b.id, p.id, 10);

    // 1. negative stock
    await db.branchInventory.update({
      where: { branchId_productId: { branchId: b.id, productId: p.id } },
      data: { stockQuantity: -3 },
    });
    // 2. broken log chain
    await db.inventoryLog.create({
      data: { branchId: b.id, productId: p.id, type: 'ADJUSTMENT', changeQuantity: 5, previousQuantity: 0, newQuantity: 999 },
    });
    // 3. order with wrong total
    const cust = await makeCustomer();
    await db.order.create({
      data: {
        orderNumber: 'ORD-CORRUPT-1', orderSource: 'ONLINE', customerId: cust.id,
        guestPhone: cust.phone, deliveryAddress: 'x', branchId: b.id,
        subtotal: 100, taxAmount: 14, totalAmount: 9999,
        items: { create: [{ productId: p.id, unitPrice: 100, quantity: 1, totalPrice: 100 }] },
      },
    });
    // 4. sale with wrong total
    const cashier = await db.user.create({
      data: { name: 'u', email: 'cashier-corrupt@sports-champions.local', passwordHash: 'x', role: 'CASHIER' as never },
    });
    await db.sale.create({
      data: {
        saleNumber: 'POS-CORRUPT-1', branchId: b.id, cashierId: cashier.id,
        subtotal: 100, taxAmount: 14, totalAmount: 1,
        paymentMethod: 'CASH' as never,
        items: { create: [{ productId: p.id, unitPrice: 100, quantity: 1, totalPrice: 100 }] },
      },
    });
    // 5. cancelled order without RETURN log
    await db.order.create({
      data: {
        orderNumber: 'ORD-CORRUPT-2', orderSource: 'ONLINE', guestPhone: '01000009999',
        deliveryAddress: 'x', branchId: b.id, orderStatus: 'CANCELLED',
        subtotal: 0, totalAmount: 0, paymentMethod: 'COD' as never,
      },
    });
  }, 180000);

  afterAll(async () => {
    await testPrisma().$disconnect();
  });

  it('flags every planted corruption', async () => {
    const findings = await runChecks(testPrisma());
    const joined = findings.join('\n');
    expect(joined).toMatch(/NEGATIVE_STOCK/);
    expect(joined).toMatch(/LOG_CHAIN_BROKEN/);
    expect(joined).toMatch(/ORDER_TOTALS_MISMATCH/);
    expect(joined).toMatch(/SALE_TOTALS_MISMATCH/);
    expect(joined).toMatch(/CLOSED_WITHOUT_RETURN_LOG/);
  });

  it('clean database reports clean', async () => {
    await resetTestDb();
    expect(await runChecks(testPrisma())).toEqual([]);
  });
});
