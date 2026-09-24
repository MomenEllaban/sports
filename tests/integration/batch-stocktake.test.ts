import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { POST as createSession } from '../../src/app/api/admin/stocktakes/route.js';
import { PATCH as saveLines } from '../../src/app/api/admin/stocktakes/[id]/lines/route.js';
import { POST as approveSession } from '../../src/app/api/admin/stocktakes/[id]/approve/route.js';
import { setMockSession } from '../setup-mocks.js';
import { makeBranch, makeCategory, makeProduct, makeUser, resetTestDb, sessionFor, stock, testPrisma } from '../helpers/factories.js';

const request = (url: string, method: string, body: unknown) => new Request(`http://test${url}`, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

describe('batch stocktake', () => {
  let branchId = ''; let productIds: string[] = []; let manager: Awaited<ReturnType<typeof makeUser>>;
  beforeAll(async () => {
    await resetTestDb(); branchId = (await makeBranch('Stocktake Branch')).id; const category = await makeCategory();
    productIds = [(await makeProduct(category.id, 100)).id, (await makeProduct(category.id, 200)).id];
    for (const productId of productIds) await stock(branchId, productId, 5);
    manager = await makeUser('BRANCH_MANAGER', [branchId]); setMockSession(sessionFor(manager));
  });
  afterAll(() => setMockSession(null));

  it('creates a multi-line draft without changing stock', async () => {
    const response = await createSession(request('/api/admin/stocktakes', 'POST', { branchId, productIds, notes: 'جرد شهري' }));
    expect(response.status).toBe(200); const body = await response.json() as { stocktake: { id: string; status: string; lines: Array<{ expectedQuantity: number }> } };
    expect(body.stocktake.status).toBe('DRAFT'); expect(body.stocktake.lines).toHaveLength(2);
    for (const productId of productIds) expect((await testPrisma().branchInventory.findUniqueOrThrow({ where: { branchId_productId: { branchId, productId } } })).stockQuantity).toBe(5);
    const sessionId = body.stocktake.id;
    const lines = await testPrisma().stocktakeLine.findMany({ where: { sessionId }, orderBy: { productId: 'asc' } });
    const save = await saveLines(request(`/api/admin/stocktakes/${sessionId}/lines`, 'PATCH', { lines: lines.map((line, index) => ({ id: line.id, countedQuantity: index === 0 ? 4 : 7, reasonCode: index === 0 ? 'DAMAGE' : 'CYCLE_COUNT', notes: index === 0 ? 'تالف' : null })) }), { params: Promise.resolve({ id: sessionId }) });
    expect(save.status).toBe(200);
    const approve = await approveSession(request(`/api/admin/stocktakes/${sessionId}/approve`, 'POST', {}), { params: Promise.resolve({ id: sessionId }) });
    expect(approve.status).toBe(200);
    const after = await testPrisma().stocktakeSession.findUniqueOrThrow({ where: { id: sessionId }, include: { lines: true } });
    expect(after.status).toBe('APPROVED'); expect(after.lines.every((line) => line.status === 'APPLIED')).toBe(true);
    const first = await testPrisma().branchInventory.findUniqueOrThrow({ where: { branchId_productId: { branchId, productId: productIds[0] } } }); const second = await testPrisma().branchInventory.findUniqueOrThrow({ where: { branchId_productId: { branchId, productId: productIds[1] } } });
    expect(first.stockQuantity).toBe(4); expect(second.stockQuantity).toBe(7);
    expect(await testPrisma().inventoryLog.count({ where: { referenceId: after.stocktakeNumber } })).toBe(2);
    const replay = await approveSession(request(`/api/admin/stocktakes/${sessionId}/approve`, 'POST', {}), { params: Promise.resolve({ id: sessionId }) });
    expect(replay.status).toBe(409);
  });
});
