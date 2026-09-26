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
import { GET as overview } from '../../src/app/api/admin/inventory/route.js';
import { GET as stockList } from '../../src/app/api/admin/inventory/stock/route.js';
import { GET as movementList } from '../../src/app/api/admin/inventory/movements/route.js';
import { GET as alertList } from '../../src/app/api/admin/inventory/alerts/route.js';

const call = async (pending: Response | Promise<Response>) => {
  const res = await pending;
  return { status: res.status, body: (await res.json()) as Record<string, unknown> };
};

const overviewOf = (query = '') => call(overview(new Request(`http://t/api/admin/inventory${query}`)));
const stockRows = (query = '') =>
  call(stockList(new Request(`http://t/api/admin/inventory/stock${query}`)));
const movementRows = (query = '') =>
  call(movementList(new Request(`http://t/api/admin/inventory/movements${query}`)));
const alertRows = (query = '') =>
  call(alertList(new Request(`http://t/api/admin/inventory/alerts${query}`)));

interface OverviewBody {
  branches: number;
  totalSkus: number;
  totalQuantity: number;
  lowStockCount: number;
  outOfStockCount: number;
  stockValue: number;
  pendingTransfers: number;
}

describe('inventory reads are branch-scoped', () => {
  let alpha = '';
  let beta = '';
  let productA = '';
  let productB = '';
  let manager: { id: string; name: string; email: string; role: string; branchIds: string[] };
  let unassigned: { id: string; name: string; email: string; role: string; branchIds: string[] };
  let finance: { id: string; name: string; email: string; role: string; branchIds: string[] };
  let admin: { id: string; name: string; email: string; role: string; branchIds: string[] };

  beforeAll(async () => {
    await resetTestDb();
    alpha = (await makeBranch('Alpha')).id;
    beta = (await makeBranch('Beta')).id;
    const cat = await makeCategory();
    const a = await makeProduct(cat.id, 100);
    const b = await makeProduct(cat.id, 200);
    productA = a.id;
    productB = b.id;
    // Alpha: 10 + 5 units of two SKUs. Beta: 3 units of one SKU.
    await stock(alpha, productA, 10);
    await stock(alpha, productB, 5);
    await stock(beta, productA, 3);
    // Reorder points are pinned so the low-stock count is deterministic:
    // productA is below its point, productB is above its own.
    await testPrisma().branchInventory.update({
      where: { branchId_productId: { branchId: alpha, productId: productA } },
      data: { reorderPoint: 20 },
    });
    await testPrisma().branchInventory.update({
      where: { branchId_productId: { branchId: alpha, productId: productB } },
      data: { reorderPoint: 2 },
    });

    manager = await makeUser('BRANCH_MANAGER', [alpha]);
    unassigned = await makeUser('BRANCH_MANAGER', []);
    finance = await makeUser('FINANCE', []);
    admin = await makeUser('SUPER_ADMIN', []);
  }, 180000);

  afterAll(async () => {
    setMockSession(null);
    await testPrisma().$disconnect();
  });

  it('a branch manager only ever sees their own branch totals', async () => {
    setMockSession(sessionFor(manager));

    const res = await overviewOf();
    expect(res.status).toBe(200);
    const body = res.body as unknown as OverviewBody;

    expect(body.branches).toBe(1);
    expect(body.totalQuantity).toBe(15);
    expect(body.stockValue).toBe(10 * 60 + 5 * 60);
    // productA is under its reorder point, productB is not.
    expect(body.lowStockCount).toBe(1);
    expect(body.totalSkus).toBe(2);

    const rows = await stockRows();
    expect(rows.status).toBe(200);
    const list = rows.body as unknown as { rows: { branchId: string }[]; total: number };
    expect(list.total).toBe(2);
    expect(new Set(list.rows.map((r) => r.branchId))).toEqual(new Set([alpha]));

    // Beta's balances are invisible, including under a search term.
    const searched = await stockRows(`?q=${encodeURIComponent('Beta')}`);
    expect((searched.body as unknown as { total: number }).total).toBe(0);
  });

  it('a manager without any branch assignment sees nothing at all', async () => {
    setMockSession(sessionFor(unassigned));

    const res = await overviewOf();
    expect(res.status).toBe(200);
    const body = res.body as unknown as OverviewBody;
    expect(body.branches).toBe(0);
    expect(body.totalQuantity).toBe(0);
    expect(body.totalSkus).toBe(0);
    expect(body.lowStockCount).toBe(0);
    expect(body.outOfStockCount).toBe(0);
    expect(body.stockValue).toBe(0);

    for (const page of [stockRows(), movementRows(), alertRows()]) {
      const { status, body: pageBody } = await page;
      expect(status).toBe(200);
      expect((pageBody as unknown as { total: number }).total).toBe(0);
    }
  });

  it('finance and super admin read every branch', async () => {
    setMockSession(sessionFor(finance));
    const financeBody = (await overviewOf()).body as unknown as OverviewBody;
    expect(financeBody.branches).toBe(2);
    expect(financeBody.totalQuantity).toBe(18);

    setMockSession(sessionFor(admin));
    const adminBody = (await overviewOf()).body as unknown as OverviewBody;
    expect(adminBody.branches).toBe(2);
    expect(adminBody.totalQuantity).toBe(18);
    expect(adminBody.totalSkus).toBe(2);
  });

  it('filtering by a branch outside the assignment is a 403, not a silent widening', async () => {
    setMockSession(sessionFor(manager));

    for (const { status, body } of [await overviewOf(`?branchId=${beta}`), await stockRows(`?branchId=${beta}`)]) {
      expect(status).toBe(403);
      expect((body as unknown as { error: { code: string } }).error.code).toBe('FORBIDDEN');
    }
  });

  it('filtering by an assigned branch narrows the totals to that branch', async () => {
    setMockSession(sessionFor(manager));

    const body = (await overviewOf(`?branchId=${alpha}`)).body as unknown as OverviewBody;
    expect(body.branches).toBe(1);
    expect(body.totalQuantity).toBe(15);
    expect(body.totalSkus).toBe(2);
  });
});
