import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { PATCH as editPatch } from '../../src/app/api/admin/orders/[id]/edit/route.js';
import { setMockSession } from '../setup-mocks.js';
import { makeBranch, makeCategory, makeCustomer, makeProduct, makeUser, resetTestDb, sessionFor, stock, testPrisma } from '../helpers/factories.js';

const request = (id: string, body: unknown) => editPatch(new Request(`http://test/api/admin/orders/${id}/edit`, {
  method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
}), { params: Promise.resolve({ id }) });

describe('order edit transaction', () => {
  let branchId = '';
  let productId = '';
  let orderId = '';
  let manager: Awaited<ReturnType<typeof makeUser>>;

  beforeAll(async () => {
    await resetTestDb();
    branchId = (await makeBranch('Edit Branch')).id;
    manager = await makeUser('BRANCH_MANAGER', [branchId]);
    const category = await makeCategory();
    productId = (await makeProduct(category.id, 100)).id;
    await stock(branchId, productId, 10);
    const customer = await makeCustomer();
    const order = await testPrisma().order.create({
      data: {
        orderNumber: `ORD-EDIT-${Date.now()}`,
        orderSource: 'WHATSAPP',
        customerId: customer.id,
        guestName: 'قبل',
        guestPhone: customer.phone,
        deliveryAddress: 'العنوان قبل',
        branchId,
        paymentMethod: 'COD',
        paymentStatus: 'PENDING',
        orderStatus: 'PENDING',
        subtotal: 200,
        totalAmount: 228,
        items: { create: [{ productId, unitPrice: 100, quantity: 2, totalPrice: 200 }] },
      },
    });
    orderId = order.id;
    setMockSession(sessionFor(manager));
  });

  afterAll(async () => { setMockSession(null); });

  it('recalculates totals, adjusts stock, increments version, and audits atomically', async () => {
    const response = await request(orderId, {
      expectedVersion: 0,
      guestName: 'بعد',
      guestPhone: '01099999999',
      deliveryAddress: 'العنوان بعد',
      notes: 'تعديل admin',
      discountAmount: 20,
      items: [{ productId, quantity: 3 }],
    });
    expect(response.status).toBe(200);
    const body = await response.json() as { success: boolean; order: { editVersion: number; totalAmount: number; subtotal: number; discountAmount: number }; totals: { vat: number } };
    expect(body.success).toBe(true);
    expect(body.order.editVersion).toBe(1);
    expect(Number(body.order.subtotal)).toBe(300);
    expect(Number(body.order.discountAmount)).toBe(20);
    expect(Number(body.order.totalAmount)).toBe(349.2);
    const inventory = await testPrisma().branchInventory.findUniqueOrThrow({ where: { branchId_productId: { branchId, productId } } });
    expect(inventory.stockQuantity).toBe(9);
    const audit = await testPrisma().auditLog.findFirst({ where: { entityId: orderId, action: 'order.edited' } });
    expect(audit).not.toBeNull();
  });

  it('rejects a stale edit without changing stock', async () => {
    const response = await request(orderId, { expectedVersion: 0, guestPhone: '01099999999', deliveryAddress: 'x', items: [{ productId, quantity: 1 }] });
    expect(response.status).toBe(409);
    const inventory = await testPrisma().branchInventory.findUniqueOrThrow({ where: { branchId_productId: { branchId, productId } } });
    expect(inventory.stockQuantity).toBe(9);
  });
});
