import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import bcrypt from 'bcryptjs';
import { testPrisma, resetTestDb, makeBranch, makeUser, makeCategory, makeProduct, stock, sessionFor, openTestShift } from '../helpers/factories.js';
import { setMockSession } from '../setup-mocks.js';
import { POST as posSale } from '../../src/app/api/pos/sale/route.js';

const saleReq = (body: unknown) =>
  new Request('http://t/api/pos/sale', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

describe('server-authoritative pricing and discounts (T06, RED first)', () => {
  let branchId = '';
  let productId = '';
  let cashier: Awaited<ReturnType<typeof makeUser>>;
  let manager: Awaited<ReturnType<typeof makeUser>>;

  beforeAll(async () => {
    await resetTestDb();
    const b = await makeBranch('Discount Branch');
    branchId = b.id;
    cashier = await makeUser('CASHIER', [branchId]);
    manager = await makeUser('BRANCH_MANAGER', [branchId]);
    const db = testPrisma();
    await db.user.update({ where: { id: cashier.id }, data: { branchId } });
    await db.user.update({
      where: { id: manager.id },
      data: { branchId, managerPinHash: await bcrypt.hash('2468', 4) },
    });
    const cat = await makeCategory();
    const p = await makeProduct(cat.id, 500);
    productId = p.id;
    await stock(branchId, productId, 50);
    await openTestShift(branchId, cashier.id);
    await openTestShift(branchId, manager.id);
  }, 180000);

  afterAll(async () => {
    setMockSession(null);
    await testPrisma().$disconnect();
  });

  const asCashier = () => setMockSession(sessionFor(cashier));

  it('tampered client price is ignored (server recomputes from DB)', async () => {
    asCashier();
    const res = await posSale(saleReq({
      paymentMethod: 'CASH',
      items: [{ productId, quantity: 1, unitPrice: 1 }],
    }));
    expect(res.status).toBe(200);
    const body = await res.json();
    // DB price 500, no discount: subtotal 500 + 14% = 570
    expect(body.totalAmount).toBe(570);
    expect(body.subtotal).toBe(500);
  });

  it('discount over threshold without approval is rejected', async () => {
    asCashier();
    const res = await posSale(saleReq({
      paymentMethod: 'CASH', discountAmount: 150, items: [{ productId, quantity: 1 }],
    }));
    expect(res.status).toBe(422);
  });

  it('discount under threshold passes without approval', async () => {
    asCashier();
    const res = await posSale(saleReq({
      paymentMethod: 'CASH', discountAmount: 50, items: [{ productId, quantity: 1 }],
    }));
    expect(res.status).toBe(200);
  });

  it('valid manager PIN approves and records approver', async () => {
    asCashier();
    const res = await posSale(saleReq({
      paymentMethod: 'CASH', discountAmount: 150, managerPin: '2468', items: [{ productId, quantity: 1 }],
    }));
    expect(res.status).toBe(200);
    const body = await res.json();
    const sale = await testPrisma().sale.findUniqueOrThrow({ where: { id: body.saleId } });
    expect(sale.approvedById).toBe(manager.id);
    expect(Number(sale.discountAmount)).toBe(150);
  });

  it('BRANCH_MANAGER session needs no PIN and is recorded as approver', async () => {
    setMockSession(sessionFor(manager));
    const res = await posSale(saleReq({
      paymentMethod: 'CASH', discountAmount: 150, branchId, items: [{ productId, quantity: 1 }],
    }));
    expect(res.status).toBe(200);
    const body = await res.json();
    const sale = await testPrisma().sale.findUniqueOrThrow({ where: { id: body.saleId } });
    expect(sale.approvedById).toBe(manager.id);
  });

  it('wrong PINs lock out further attempts', async () => {
    asCashier();
    for (let i = 0; i < 5; i++) {
      const r = await posSale(saleReq({
        paymentMethod: 'CASH', discountAmount: 150, managerPin: '0000', items: [{ productId, quantity: 1 }],
      }));
      expect([400, 422, 423, 429]).toContain(r.status);
    }
    const locked = await posSale(saleReq({
      paymentMethod: 'CASH', discountAmount: 150, managerPin: '2468', items: [{ productId, quantity: 1 }],
    }));
    expect([423, 429]).toContain(locked.status);
  });

  it('negative/NaN/huge discounts and bad quantities are rejected', async () => {
    asCashier();
    for (const bad of [
      { discountAmount: -5, items: [{ productId, quantity: 1 }] },
      { discountAmount: 'abc', items: [{ productId, quantity: 1 }] },
      { discountAmount: 1000000, items: [{ productId, quantity: 1 }] },
      { discountAmount: 0, items: [{ productId, quantity: 0 }] },
      { discountAmount: 0, items: [{ productId, quantity: -2 }] },
      { discountAmount: 0, items: [{ productId, quantity: 1.5 }] },
    ]) {
      const res = await posSale(saleReq({ paymentMethod: 'CASH', ...bad }));
      expect(res.status).toBeGreaterThanOrEqual(400);
    }
  });
});
