import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  testPrisma,
  resetTestDb,
  makeBranch,
  makeUser,
  makeCategory,
  makeProduct,
  stock,
  sessionFor,
} from '../helpers/factories.js';
import { setMockSession } from '../setup-mocks.js';
import { POST as orderPost } from '../../src/app/api/admin/orders/route.js';
import { PATCH as orderPatch } from '../../src/app/api/admin/orders/[id]/route.js';

const post = (body: unknown) =>
  orderPost(
    new Request('http://t/api/admin/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  );

const patch = (id: string, body: unknown) =>
  orderPatch(
    new Request('http://t/api/admin/orders/x', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id }) }
  );

const stockOf = async (branchId: string, productId: string) =>
  (await testPrisma().branchInventory.findUniqueOrThrow({
    where: { branchId_productId: { branchId, productId } },
  })).stockQuantity;

describe('admin manual orders reserve stock (T07)', () => {
  let branchId = '';
  let productId = '';
  let manager: Awaited<ReturnType<typeof makeUser>>;

  beforeAll(async () => {
    await resetTestDb();
    const b = await makeBranch('Admin Order Branch');
    branchId = b.id;
    manager = await makeUser('BRANCH_MANAGER', [branchId]);
    const cat = await makeCategory();
    const p = await makeProduct(cat.id, 100);
    productId = p.id;
    await stock(branchId, productId, 5);
    setMockSession(sessionFor(manager));
  }, 180000);

  afterAll(async () => {
    setMockSession(null);
    await testPrisma().$disconnect();
  });

  it('creating a manual order decrements branch stock with a SALE log', async () => {
    const res = await post({
      guestPhone: '01000000001',
      deliveryAddress: 'test address',
      branchId,
      items: [{ productId, quantity: 2 }],
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { order: { id: string; orderNumber: string } };
    expect(await stockOf(branchId, productId)).toBe(3);

    const logs = await testPrisma().inventoryLog.findMany({
      where: { referenceId: body.order.orderNumber, type: 'SALE' },
    });
    expect(logs.length).toBe(1);
    expect(logs[0].changeQuantity).toBe(-2);

    // Cancel restores the reserved stock exactly once.
    expect((await patch(body.order.id, { orderStatus: 'CANCELLED' })).status).toBe(200);
    expect(await stockOf(branchId, productId)).toBe(5);
  });

  it('rejects an order that exceeds available stock without changing stock', async () => {
    const res = await post({
      guestPhone: '01000000002',
      deliveryAddress: 'test address',
      branchId,
      items: [{ productId, quantity: 99 }],
    });
    expect(res.status).toBe(400);
    expect(await stockOf(branchId, productId)).toBe(5);
  });

  it('rejects an order with no stock row at all', async () => {
    const cat = await makeCategory();
    const p = await makeProduct(cat.id, 50);
    const res = await post({
      guestPhone: '01000000003',
      deliveryAddress: 'test address',
      branchId,
      items: [{ productId: p.id, quantity: 1 }],
    });
    expect(res.status).toBe(400);
  });
});
