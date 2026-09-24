import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { POST as createPo } from '../../src/app/api/admin/purchase-orders/route.js';
import { PATCH as updatePo } from '../../src/app/api/admin/purchase-orders/[id]/route.js';
import { POST as receivePo } from '../../src/app/api/admin/purchase-orders/[id]/receive/route.js';
import { setMockSession } from '../setup-mocks.js';
import { makeBranch, makeCategory, makeProduct, makeUser, resetTestDb, sessionFor, testPrisma } from '../helpers/factories.js';

const request = (url: string, body: unknown) => new Request(`http://test${url}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
const patch = (id: string, body: unknown) => updatePo(new Request(`http://test/api/admin/purchase-orders/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }), { params: Promise.resolve({ id }) });
const receive = (id: string, body: unknown) => receivePo(request(`/api/admin/purchase-orders/${id}/receive`, body), { params: Promise.resolve({ id }) });

describe('purchase order draft and validation workflow', () => {
  let branchId = '';
  let productId = '';
  let supplierId = '';
  let manager: Awaited<ReturnType<typeof makeUser>>;

  beforeAll(async () => {
    await resetTestDb();
    branchId = (await makeBranch('PO Branch')).id;
    const category = await makeCategory();
    productId = (await makeProduct(category.id, 100)).id;
    const supplier = await testPrisma().supplier.create({ data: { code: `SUP-${Date.now()}`, name: 'Supplier Test' } });
    supplierId = supplier.id;
    manager = await makeUser('BRANCH_MANAGER', [branchId]);
    setMockSession(sessionFor(manager));
  });
  afterAll(() => setMockSession(null));

  it('rejects duplicate lines before creating a PO', async () => {
    const response = await createPo(request('/api/admin/purchase-orders', { intent: 'confirm', supplierId, branchId, items: [{ productId, quantityOrdered: 1, unitCost: 100 }, { productId, quantityOrdered: 2, unitCost: 100 }] }));
    expect(response.status).toBe(400);
    expect(await testPrisma().purchaseOrder.count()).toBe(0);
  });

  it('creates a draft, then confirms it, and blocks receiving a draft', async () => {
    const draftResponse = await createPo(request('/api/admin/purchase-orders', { intent: 'draft', supplierId, branchId, notes: 'draft', items: [{ productId, quantityOrdered: 2, unitCost: 80 }] }));
    expect(draftResponse.status).toBe(200);
    const draft = await draftResponse.json() as { purchaseOrder: { id: string; status: string } };
    expect(draft.purchaseOrder.status).toBe('DRAFT');
    const blocked = await receive(draft.purchaseOrder.id, { received: [{ itemId: 'not-used', quantity: 1 }] });
    expect(blocked.status).toBe(409);
    const confirmed = await patch(draft.purchaseOrder.id, { action: 'confirm' });
    expect(confirmed.status).toBe(200);
    const row = await testPrisma().purchaseOrder.findUniqueOrThrow({ where: { id: draft.purchaseOrder.id } });
    expect(row.status).toBe('SUBMITTED');
  });

  it('rejects a branch outside the manager scope', async () => {
    const other = await makeBranch('Other Branch');
    const response = await createPo(request('/api/admin/purchase-orders', { intent: 'confirm', supplierId, branchId: other.id, items: [{ productId, quantityOrdered: 1, unitCost: 80 }] }));
    expect(response.status).toBe(403);
  });
});
