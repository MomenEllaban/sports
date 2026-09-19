import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { testPrisma, resetTestDb, makeBranch, makeUser, sessionFor } from '../helpers/factories.js';
import { setMockSession } from '../setup-mocks.js';
import { GET as usersGet } from '../../src/app/api/admin/users/route.js';
import { PATCH as usersPatch } from '../../src/app/api/admin/users/[id]/route.js';
import { POST as expensesPost } from '../../src/app/api/admin/expenses/route.js';
import { POST as productsPost } from '../../src/app/api/admin/products/route.js';
import { GET as posProducts } from '../../src/app/api/pos/products/route.js';

const req = (body?: unknown, method = 'POST') =>
  new Request('http://t/x', {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });

describe('RBAC enforcement (T04)', () => {
  let branchId = '';
  let adminId = '';

  beforeAll(async () => {
    await resetTestDb();
    const b = await makeBranch('RBAC Branch');
    branchId = b.id;
    const admin = await makeUser('SUPER_ADMIN', [branchId]);
    adminId = admin.id;
  }, 180000);

  afterAll(async () => {
    setMockSession(null);
    await testPrisma().$disconnect();
  });

  it('anonymous users get 401 on admin routes', async () => {
    setMockSession(null);
    expect((await usersGet()).status).toBe(401);
    expect((await expensesPost(req({}))).status).toBe(401);
  });

  it('STAFF cannot list users or create expenses (403), FINANCE can create expenses', async () => {
    const staff = await makeUser('STAFF', [branchId]);
    setMockSession(sessionFor(staff));
    expect((await usersGet()).status).toBe(403);
    expect((await expensesPost(req({}))).status).toBe(403);

    const fin = await makeUser('FINANCE', [branchId]);
    setMockSession(sessionFor(fin));
    // passes auth, fails validation (400) — proves FINANCE is allowed
    expect((await expensesPost(req({}))).status).toBe(400);
  });

  it('BRANCH_MANAGER cannot touch users (403) but can create products (past auth)', async () => {
    const bm = await makeUser('BRANCH_MANAGER', [branchId]);
    setMockSession(sessionFor(bm));
    expect((await usersGet()).status).toBe(403);
    // passes auth, fails validation (400) — proves BRANCH_MANAGER is allowed
    expect((await productsPost(req({}))).status).toBe(400);
  });

  it('CASHIER is blocked from expenses (403) but allowed on POS (200)', async () => {
    const c = await makeUser('CASHIER', [branchId]);
    setMockSession(sessionFor(c));
    expect((await expensesPost(req({}))).status).toBe(403);
    expect((await posProducts()).status).toBe(200);
  });

  it('SUPER_ADMIN cannot change their own role (403) nor deactivate self', async () => {
    const admin = await testPrisma().user.findUniqueOrThrow({ where: { id: adminId } });
    setMockSession(sessionFor(admin));
    const r1 = await usersPatch(req({ role: 'STAFF' }), { params: Promise.resolve({ id: adminId }) });
    expect(r1.status).toBe(403);
    const r2 = await usersPatch(req({ isActive: false }), { params: Promise.resolve({ id: adminId }) });
    expect(r2.status).toBe(403);
  });

  it('SUPER_ADMIN can list users (200)', async () => {
    const admin = await testPrisma().user.findUniqueOrThrow({ where: { id: adminId } });
    setMockSession(sessionFor(admin));
    const res = await usersGet();
    expect(res.status).toBe(200);
  });
});
