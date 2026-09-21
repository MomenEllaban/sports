import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { testPrisma, resetTestDb, makeBranch, makeUser, makeCategory, makeProduct, stock, sessionFor, openTestShift, makeCustomer } from '../helpers/factories.js';
import { setMockSession } from '../setup-mocks.js';
import { POST as posSale } from '../../src/app/api/pos/sale/route.js';
import { POST as orderCreate } from '../../src/app/api/orders/create/route.js';

const saleReq = (body: unknown) =>
  new Request('http://t/api/pos/sale', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

describe('unified discount pipeline T16', () => {
  let branchId = '';
  let productId = '';
  let cashier: Awaited<ReturnType<typeof makeUser>>;

  beforeAll(async () => {
    await resetTestDb();
    const b = await makeBranch('Discount Branch');
    branchId = b.id;
    cashier = await makeUser('CASHIER', [branchId]);
    await testPrisma().user.update({ where: { id: cashier.id }, data: { branchId } });
    await openTestShift(branchId, cashier.id);
    const cat = await makeCategory();
    const p = await makeProduct(cat.id, 1000);
    productId = p.id;
    await stock(branchId, productId, 50);
    setMockSession(sessionFor(cashier));
  }, 180000);

  afterAll(async () => {
    setMockSession(null);
    await testPrisma().$disconnect();
  });

  it('single-use coupon race: exactly one order wins', async () => {
    const db = testPrisma();
    await db.coupon.create({ data: { code: 'ONCE10', kind: 'PERCENT', value: 10, usageLimit: 1, isActive: true } });
    const mkOrder = () =>
      orderCreate(new Request('http://t/api/orders/create', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: '01000900001', name: 'Race', address: 'addr', fulfillmentType: 'PICKUP',
          paymentMethod: 'COD', couponCode: 'ONCE10', items: [{ productId, quantity: 1 }],
        }),
      }));
    const [r1, r2] = await Promise.all([mkOrder(), mkOrder()]);
    const statuses = [r1.status, r2.status].sort();
    expect(statuses).toEqual([200, 400]);
    expect(await db.couponUse.count({ where: { coupon: { code: 'ONCE10' } } })).toBe(1);
  });

  it('loyalty overdraft race: balance never negative', async () => {
    const db = testPrisma();
    const cust = await makeCustomer('01000900002');
    await db.customer.update({ where: { id: cust.id }, data: { loyaltyPoints: 50 } });
    const mk = () =>
      posSale(saleReq({ paymentMethod: 'CASH', customerId: cust.id, loyaltyPoints: 50, items: [{ productId, quantity: 1 }] }));
    const [r1, r2] = await Promise.all([mk(), mk()]);
    expect([r1.status, r2.status].sort()).toEqual([200, 400]);
    const after = await db.customer.findUniqueOrThrow({ where: { id: cust.id } });
    expect(after.loyaltyPoints).toBeGreaterThanOrEqual(0);
  });

  it('POS sale records coupon + loyalty attribution', async () => {
    const db = testPrisma();
    await db.coupon.create({ data: { code: 'POS5', kind: 'FIXED', value: 50, isActive: true } });
    const cust = await makeCustomer('01000900003');
    await db.customer.update({ where: { id: cust.id }, data: { loyaltyPoints: 100 } });
    const res = await posSale(saleReq({
      paymentMethod: 'CASH', customerId: cust.id, couponCode: 'POS5', loyaltyPoints: 100,
      items: [{ productId, quantity: 1 }],
    }));
    expect(res.status).toBe(200);
    const body = await res.json();
    const sale = await db.sale.findUniqueOrThrow({ where: { id: body.saleId } });
    expect(sale.couponCode).toBe('POS5');
    expect(Number(sale.couponDiscount)).toBe(50);
    expect(Number(sale.loyaltyRedeemed)).toBeGreaterThan(0);
  });

  it('invalid/expired coupon rejected without touching stock', async () => {
    const db = testPrisma();
    await db.coupon.create({ data: { code: 'DEAD', kind: 'PERCENT', value: 10, isActive: false } });
    const before = (await db.branchInventory.findUniqueOrThrow({ where: { branchId_productId: { branchId, productId } } })).stockQuantity;
    const res = await orderCreate(new Request('http://t/api/orders/create', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone: '01000900004', name: 'Bad', address: 'addr', fulfillmentType: 'PICKUP',
        paymentMethod: 'COD', couponCode: 'DEAD', items: [{ productId, quantity: 1 }],
      }),
    }));
    expect(res.status).toBe(404);
    const after = (await db.branchInventory.findUniqueOrThrow({ where: { branchId_productId: { branchId, productId } } })).stockQuantity;
    expect(after).toBe(before);
  });
});
