import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { GET, PATCH, POST } from '../../src/app/api/admin/reports/reorder/route.js';
import { setMockSession } from '../setup-mocks.js';
import { makeBranch, makeCategory, makeProduct, makeUser, resetTestDb, sessionFor, stock, testPrisma } from '../helpers/factories.js';

const req = (method: string, body?: unknown) => new Request('http://test/api/admin/reports/reorder', { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });

describe('reorder shortage workflow', () => {
  let branchId = ''; let productId = ''; let inventoryId = ''; let manager: Awaited<ReturnType<typeof makeUser>>;
  beforeAll(async () => {
    await resetTestDb();
    branchId = (await makeBranch('Reorder Branch')).id;
    const category = await makeCategory(); productId = (await makeProduct(category.id, 100)).id;
    await stock(branchId, productId, 2);
    inventoryId = (await testPrisma().branchInventory.findUniqueOrThrow({ where: { branchId_productId: { branchId, productId } } })).id;
    await testPrisma().branchInventory.update({ where: { id: inventoryId }, data: { reorderPoint: 5, reorderQuantity: 10 } });
    manager = await makeUser('BRANCH_MANAGER', [branchId]); setMockSession(sessionFor(manager));
  });
  afterAll(() => setMockSession(null));

  it('lists low stock and persists requestedBy/date/note/supplier', async () => {
    const list = await GET(req('GET'));
    expect(list.status).toBe(200); const listBody = await list.json() as { rows: Array<{ inventoryId: string; suggestedQuantity: number }> };
    expect(listBody.rows[0].inventoryId).toBe(inventoryId); expect(listBody.rows[0].suggestedQuantity).toBe(13);
    const supplier = await testPrisma().supplier.create({ data: { code: `SUP-R-${Date.now()}`, name: 'Reorder Supplier' } });
    const response = await POST(req('POST', { items: [{ branchInventoryId: inventoryId, supplierId: supplier.id, quantity: 13 }], note: 'طلب دوري' }));
    expect(response.status).toBe(200);
    const record = await testPrisma().reorderRequest.findFirstOrThrow({ where: { branchInventoryId: inventoryId } });
    expect(record.requestedById).toBe(manager.id); expect(record.note).toBe('طلب دوري'); expect(record.supplierId).toBe(supplier.id); expect(record.requestedAt).toBeInstanceOf(Date);
  });

  it('updates the per-branch reorder policy', async () => {
    const response = await PATCH(req('PATCH', { branchInventoryId: inventoryId, reorderPoint: 8, reorderQuantity: 20 }));
    expect(response.status).toBe(200);
    const row = await testPrisma().branchInventory.findUniqueOrThrow({ where: { id: inventoryId } });
    expect(row.reorderPoint).toBe(8); expect(row.reorderQuantity).toBe(20);
  });
});
