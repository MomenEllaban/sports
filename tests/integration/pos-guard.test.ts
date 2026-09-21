import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { testPrisma, resetTestDb, makeBranch, makeUser, makeCategory, makeProduct, stock, sessionFor, openTestShift } from '../helpers/factories.js';
import { setMockSession } from '../setup-mocks.js';
import { GET as posProducts } from '../../src/app/api/pos/products/route.js';
import { POST as posSale } from '../../src/app/api/pos/sale/route.js';
import { GET as posCustomer } from '../../src/app/api/pos/customer/route.js';

const anon = () => setMockSession(null);
const asRole = (u: { id: string; name: string; email: string; role: string; branchIds: string[] }) =>
  setMockSession({ user: { id: u.id, name: u.name, email: u.email, role: u.role, branchIds: u.branchIds } });

describe('POS protection (T03, RED first)', () => {
  let branchId = '';
  let productId = '';

  beforeAll(async () => {
    await resetTestDb();
    const b = await makeBranch('POS Branch');
    branchId = b.id;
    const cashier = await makeUser('CASHIER', [branchId]);
    void cashier;
    const cat = await makeCategory();
    const p = await makeProduct(cat.id, 100);
    productId = p.id;
    await stock(branchId, productId, 10);
  }, 180000);

  afterAll(async () => {
    anon();
    await testPrisma().$disconnect();
  });

  it('anonymous GET /api/pos/products is rejected (401)', async () => {
    anon();
    const res = await posProducts(new Request('http://t/api/pos/products'));
    expect(res.status).toBe(401);
  });

  it('anonymous POST /api/pos/sale is rejected (401)', async () => {
    anon();
    const res = await posSale(new Request('http://t/api/pos/sale', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paymentMethod: 'CASH', items: [{ productId, quantity: 1 }] }),
    }));
    expect(res.status).toBe(401);
  });

  it('anonymous GET /api/pos/customer is rejected (401)', async () => {
    anon();
    const res = await posCustomer(new Request('http://t/api/pos/customer?phone=01000000001'));
    expect(res.status).toBe(401);
  });

  it('STAFF and FINANCE get 403 on POS sale', async () => {
    for (const role of ['STAFF', 'FINANCE'] as const) {
      const u = await makeUser(role, [branchId]);
      asRole(u);
      const res = await posSale(new Request('http://t/api/pos/sale', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentMethod: 'CASH', items: [{ productId, quantity: 1 }] }),
      }));
      expect(res.status).toBe(403);
    }
  });

  it('CASHIER can list products and sell', async () => {
    const u = await makeUser('CASHIER', [branchId]);
    await testPrisma().user.update({ where: { id: u.id }, data: { branchId } });
    await openTestShift(branchId, u.id);
    asRole(u);
    const list = await posProducts(new Request('http://t/api/pos/products'));
    expect(list.status).toBe(200);
    const sale = await posSale(new Request('http://t/api/pos/sale', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paymentMethod: 'CASH', items: [{ productId, quantity: 1 }] }),
    }));
    if (sale.status !== 200) {
      console.log('SALE DEBUG:', sale.status, await sale.clone().json().catch(() => null));
    }
    expect(sale.status).toBe(200);
  });
});
