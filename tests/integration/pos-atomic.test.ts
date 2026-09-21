import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { testPrisma, resetTestDb, makeBranch, makeUser, makeCategory, makeProduct, stock, sessionFor, openTestShift } from '../helpers/factories.js';
import { setMockSession } from '../setup-mocks.js';
import { POST as posSale } from '../../src/app/api/pos/sale/route.js';
import { POST as orderCreate } from '../../src/app/api/orders/create/route.js';

const saleReq = (body: unknown) =>
  new Request('http://t/api/pos/sale', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

describe('atomic inventory and idempotent sync (T07, RED first)', () => {
  let branchId = '';
  let productId = '';
  let cashier: Awaited<ReturnType<typeof makeUser>>;

  beforeAll(async () => {
    await resetTestDb();
    const b = await makeBranch('Atomic Branch');
    branchId = b.id;
    cashier = await makeUser('CASHIER', [branchId]);
    await testPrisma().user.update({ where: { id: cashier.id }, data: { branchId } });
    const cat = await makeCategory();
    const p = await makeProduct(cat.id, 200);
    productId = p.id;
    await stock(branchId, productId, 1);
    await openTestShift(branchId, cashier.id);
    setMockSession(sessionFor(cashier));
  }, 180000);

  afterAll(async () => {
    setMockSession(null);
    await testPrisma().$disconnect();
  });

  it('parallel sales on the last unit: exactly one wins, stock never negative', async () => {
    const db = testPrisma();
    const body = { paymentMethod: 'CASH', items: [{ productId, quantity: 1 }] };
    const results = await Promise.allSettled([posSale(saleReq(body)), posSale(saleReq(body))]);
    const statuses = results.map((r) => (r.status === 'fulfilled' ? r.value.status : -1));
    expect(statuses.sort()).toEqual([200, 400]);
    const inv = await db.branchInventory.findUniqueOrThrow({
      where: { branchId_productId: { branchId, productId } },
    });
    expect(inv.stockQuantity).toBe(0);
    const sales = await db.sale.count();
    expect(sales).toBe(1);
  });

  it('duplicate clientSaleId creates one sale and returns the original', async () => {
    const db = testPrisma();
    await stock(branchId, productId, 5);
    const body = { paymentMethod: 'CASH', clientSaleId: 'idem-test-001', items: [{ productId, quantity: 1 }] };
    const r1 = await posSale(saleReq(body));
    expect(r1.status).toBe(200);
    const b1 = await r1.json();
    const r2 = await posSale(saleReq(body));
    expect(r2.status).toBe(200);
    const b2 = await r2.json();
    expect(b2.saleNumber).toBe(b1.saleNumber);
    expect(b2.idempotentReplay).toBe(true);
    expect(await db.sale.count()).toBe(2); // 1 from previous test + this one
    const inv = await db.branchInventory.findUniqueOrThrow({
      where: { branchId_productId: { branchId, productId } },
    });
    expect(inv.stockQuantity).toBe(4); // decremented exactly once
  });

  it('parallel sales get unique numbers', async () => {
    const db = testPrisma();
    await stock(branchId, productId, 10);
    const bodies = [1, 2, 3].map((i) => ({
      paymentMethod: 'CASH', clientSaleId: `uniq-test-00${i}`, items: [{ productId, quantity: 1 }],
    }));
    const results = await Promise.all(bodies.map((b) => posSale(saleReq(b))));
    expect(results.map((r) => r.status)).toEqual([200, 200, 200]);
    const numbers = await db.sale.findMany({ select: { saleNumber: true } });
    expect(new Set(numbers.map((s) => s.saleNumber)).size).toBe(numbers.length);
  });

  it('mid-transaction failure leaves stock unchanged', async () => {
    const db = testPrisma();
    await stock(branchId, productId, 7);
    const { decrementStock } = await import('../../src/lib/inventory/service.js');
    await expect(
      db.$transaction(async (tx) => {
        await decrementStock(tx, { branchId, productId, quantity: 3, type: 'SALE', referenceId: 'tx-fail-test' });
        throw new Error('injected failure');
      })
    ).rejects.toThrow('injected failure');
    const inv = await db.branchInventory.findUniqueOrThrow({
      where: { branchId_productId: { branchId, productId } },
    });
    expect(inv.stockQuantity).toBe(7);
    expect(await db.inventoryLog.count({ where: { referenceId: 'tx-fail-test' } })).toBe(0);
  });

  it('online checkout rejects insufficient stock with item payload', async () => {
    const res = await orderCreate(
      new Request('http://t/api/orders/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: '01000009999',
          name: 'Online Test',
          address: 'test address',
          fulfillmentType: 'DELIVERY',
          paymentMethod: 'COD',
          items: [{ productId, quantity: 999 }],
        }),
      })
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(Array.isArray(body.items)).toBe(true);
    expect(body.items[0].productId).toBe(productId);
    expect(typeof body.items[0].available).toBe('number');
  });
});
