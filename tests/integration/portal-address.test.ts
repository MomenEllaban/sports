import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { testPrisma, resetTestDb, makeBranch, makeCategory, makeProduct, stock, makeCustomer } from '../helpers/factories.js';
import { POST as orderCreate } from '../../src/app/api/orders/create/route.js';

const mk = (body: unknown) =>
  orderCreate(new Request('http://t/api/orders/create', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  }));

describe('portal addresses in checkout T09', () => {
  let branchId = '';
  let productId = '';

  beforeAll(async () => {
    await resetTestDb();
    branchId = (await makeBranch('Addr Branch')).id;
    const cat = await makeCategory();
    productId = (await makeProduct(cat.id, 200)).id;
    await stock(branchId, productId, 10);
  }, 180000);

  afterAll(async () => {
    await testPrisma().$disconnect();
  });

  it('saved address is used and snapshotted; foreign address rejected', async () => {
    const db = testPrisma();
    const cust = await makeCustomer('01000700001');
    const addr = await db.address.create({
      data: { customerId: cust.id, title: 'Home', street: 'Street 5', building: 'B2', city: 'Alexandria', governorate: 'Alexandria' },
    });
    const other = await makeCustomer('01000700002');

    const ok = await mk({
      phone: cust.phone, name: 'A', fulfillmentType: 'DELIVERY',
      addressId: addr.id, paymentMethod: 'COD', items: [{ productId, quantity: 1 }],
    });
    expect(ok.status).toBe(200);
    const order = await db.order.findUniqueOrThrow({ where: { orderNumber: (await ok.json()).orderNumber } });
    expect(order.addressId).toBe(addr.id);
    expect(order.deliveryAddress).toContain('Street 5');

    const foreign = await mk({
      phone: other.phone, name: 'B', fulfillmentType: 'DELIVERY',
      addressId: addr.id, paymentMethod: 'COD', items: [{ productId, quantity: 1 }],
    });
    expect(foreign.status).toBe(400);
  });
});
