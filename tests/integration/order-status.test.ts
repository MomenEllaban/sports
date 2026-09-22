import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { testPrisma, resetTestDb, makeBranch, makeUser, makeCategory, makeProduct, stock, makeCustomer, sessionFor } from '../helpers/factories.js';
import { setMockSession } from '../setup-mocks.js';
import { PATCH as orderPatch } from '../../src/app/api/admin/orders/[id]/route.js';

const patch = (id: string, body: unknown) =>
  orderPatch(
    new Request('http://t/api/admin/orders/x', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id }) }
  );

describe('order state machine and restock (T08, RED first)', () => {
  let branchId = '';
  let productId = '';
  let manager: Awaited<ReturnType<typeof makeUser>>;

  async function makeOrder(status: 'PENDING' | 'CONFIRMED' | 'SHIPPED' | 'DELIVERED' = 'PENDING', qty = 2) {
    const db = testPrisma();
    const cust = await makeCustomer();
    return db.order.create({
      data: {
        orderNumber: `ORD-T08-${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
        orderSource: 'ONLINE',
        customerId: cust.id,
        guestPhone: cust.phone,
        deliveryAddress: 'test',
        branchId,
        paymentMethod: 'COD',
        orderStatus: status,
        subtotal: 200,
        totalAmount: 228,
        items: { create: [{ productId, unitPrice: 100, quantity: qty, totalPrice: 100 * qty }] },
      },
    });
  }

  beforeAll(async () => {
    await resetTestDb();
    const b = await makeBranch('State Branch');
    branchId = b.id;
    manager = await makeUser('BRANCH_MANAGER', [branchId]);
    await testPrisma().user.update({ where: { id: manager.id }, data: { branchId } });
    const cat = await makeCategory();
    const p = await makeProduct(cat.id, 100);
    productId = p.id;
    await stock(branchId, productId, 20);
    setMockSession(sessionFor(manager));
  }, 180000);

  afterAll(async () => {
    setMockSession(null);
    await testPrisma().$disconnect();
  });

  it('cancel restocks the correct branch with RETURN logs', async () => {
    const db = testPrisma();
    const order = await makeOrder('CONFIRMED', 2);
    const res = await patch(order.id, { orderStatus: 'CANCELLED' });
    expect(res.status).toBe(200);
    const inv = await db.branchInventory.findUniqueOrThrow({
      where: { branchId_productId: { branchId, productId } },
    });
    expect(inv.stockQuantity).toBe(22);
    const logs = await db.inventoryLog.findMany({
      where: { referenceId: order.orderNumber, type: 'RETURN' },
    });
    expect(logs.length).toBe(1);
    expect(logs[0].changeQuantity).toBe(2);
    expect(logs[0].branchId).toBe(branchId);
    expect(logs[0].createdById).toBe(manager.id);
  });

  it('repeat cancel is rejected and does not double-restock', async () => {
    const db = testPrisma();
    const order = await makeOrder('PENDING', 1);
    const before = (await db.branchInventory.findUniqueOrThrow({
      where: { branchId_productId: { branchId, productId } },
    })).stockQuantity;
    expect((await patch(order.id, { orderStatus: 'CANCELLED' })).status).toBe(200);
    const r2 = await patch(order.id, { orderStatus: 'CANCELLED' });
    expect(r2.status).toBe(400);
    const after = (await db.branchInventory.findUniqueOrThrow({
      where: { branchId_productId: { branchId, productId } },
    })).stockQuantity;
    expect(after).toBe(before + 1);
    expect(await db.inventoryLog.count({ where: { referenceId: order.orderNumber, type: 'RETURN' } })).toBe(1);
  });

  it('parallel cancels: exactly one wins', async () => {
    const db = testPrisma();
    const order = await makeOrder('CONFIRMED', 1);
    const before = (await db.branchInventory.findUniqueOrThrow({
      where: { branchId_productId: { branchId, productId } },
    })).stockQuantity;
    const results = await Promise.all([
      patch(order.id, { orderStatus: 'CANCELLED' }),
      patch(order.id, { orderStatus: 'CANCELLED' }),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 400]);
    const after = (await db.branchInventory.findUniqueOrThrow({
      where: { branchId_productId: { branchId, productId } },
    })).stockQuantity;
    expect(after).toBe(before + 1);
  });

  it('invalid transition DELIVERED -> PENDING is rejected', async () => {
    const order = await makeOrder('DELIVERED', 1);
    const res = await patch(order.id, { orderStatus: 'PENDING' });
    expect(res.status).toBe(400);
  });

  it('SHIPPED -> DELIVERED does not restock; direct RETURNED is closed (use RMA)', async () => {
    const db = testPrisma();
    const order = await makeOrder('SHIPPED', 1);
    const before = (await db.branchInventory.findUniqueOrThrow({
      where: { branchId_productId: { branchId, productId } },
    })).stockQuantity;
    expect((await patch(order.id, { orderStatus: 'DELIVERED' })).status).toBe(200);
    const mid = (await db.branchInventory.findUniqueOrThrow({
      where: { branchId_productId: { branchId, productId } },
    })).stockQuantity;
    expect(mid).toBe(before);
    // T-RMA single path: direct RETURNED flips are rejected; stock untouched.
    const res = await patch(order.id, { orderStatus: 'RETURNED' });
    expect(res.status).toBe(400);
    const after = (await db.branchInventory.findUniqueOrThrow({
      where: { branchId_productId: { branchId, productId } },
    })).stockQuantity;
    expect(after).toBe(before);
  });
});
