import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { testPrisma, resetTestDb, makeBranch, makeUser, makeCategory, makeProduct, stock, sessionFor } from '../helpers/factories.js';
import { setMockSession } from '../setup-mocks.js';
import { POST as adjust } from '../../src/app/api/admin/inventory/adjust/route.js';
import { POST as poReturn } from '../../src/app/api/admin/purchase-orders/[id]/return/route.js';
import { POST as paySupplier } from '../../src/app/api/admin/supplier-payments/route.js';

const post = (fn: (r: Request, c: never) => Promise<Response>, body: unknown, params?: { id: string }) =>
  fn(new Request('http://t/x', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }), { params: Promise.resolve(params || {}) } as never);

describe('stocktake + supplier returns T13', () => {
  let branchId = '';
  let productId = '';
  let poId = '';

  beforeAll(async () => {
    await resetTestDb();
    const b = await makeBranch('Count Branch');
    branchId = b.id;
    const manager = await makeUser('BRANCH_MANAGER', [branchId]);
    const cat = await makeCategory();
    productId = (await makeProduct(cat.id, 100)).id;
    await stock(branchId, productId, 10);
    const db = testPrisma();
    const supplier = await db.supplier.create({ data: { code: 'SUP-T13', name: 'Test Supplier' } });
    const po = await db.purchaseOrder.create({
      data: {
        poNumber: 'PO-T13-1', supplierId: supplier.id, branchId, status: 'RECEIVED',
        totalAmount: 1000, createdById: manager.id,
        items: { create: [{ productId, unitCost: 50, quantityOrdered: 10, quantityReceived: 10 }] },
      },
    });
    poId = po.id;
    setMockSession(sessionFor(manager));
  }, 180000);

  afterAll(async () => {
    setMockSession(null);
    await testPrisma().$disconnect();
  });

  it('adjust up/down with reason; reason mandatory', async () => {
    const noReason = await post(adjust, { branchId, productId, countedQty: 12 });
    expect(noReason.status).toBe(400);
    const up = await post(adjust, { branchId, productId, countedQty: 12, reason: 'جرد' });
    expect(up.status).toBe(200);
    expect((await up.json()).next).toBe(12);
    const down = await post(adjust, { branchId, productId, countedQty: 7, reason: 'تالف' });
    expect(down.status).toBe(200);
    const inv = await testPrisma().branchInventory.findUniqueOrThrow({ where: { branchId_productId: { branchId, productId } } });
    expect(inv.stockQuantity).toBe(7);
    const logs = await testPrisma().inventoryLog.count({ where: { referenceId: 'STOCKTAKE' } });
    expect(logs).toBe(2);
  });

  it('supplier return decrements stock and received qty', async () => {
    const db = testPrisma();
    const before = (await db.branchInventory.findUniqueOrThrow({ where: { branchId_productId: { branchId, productId } } })).stockQuantity;
    const res = await post(poReturn, { productId, quantity: 2, reason: 'تالف' }, { id: poId });
    expect(res.status).toBe(200);
    const after = (await db.branchInventory.findUniqueOrThrow({ where: { branchId_productId: { branchId, productId } } })).stockQuantity;
    expect(after).toBe(before - 2);
    const over = await post(poReturn, { productId, quantity: 99, reason: 'x' }, { id: poId });
    expect(over.status).toBe(400);
  });

  it('supplier payment recorded with validation', async () => {
    const db = testPrisma();
    const supplier = await db.supplier.findFirstOrThrow({ where: { code: 'SUP-T13' } });
    const bad = await post(paySupplier, { supplierId: supplier.id, amount: -5 });
    expect(bad.status).toBe(400);
    const ok = await post(paySupplier, { supplierId: supplier.id, amount: 500, method: 'BANK', reference: 'TRX1' });
    expect(ok.status).toBe(200);
    expect(await db.supplierPayment.count({ where: { supplierId: supplier.id } })).toBe(1);
  });
});
