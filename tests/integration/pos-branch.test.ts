import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { testPrisma, resetTestDb, makeBranch, makeUser, makeCategory, makeProduct, stock, sessionFor } from '../helpers/factories.js';
import { setMockSession } from '../setup-mocks.js';
import { POST as posSale } from '../../src/app/api/pos/sale/route.js';
import { GET as posProducts } from '../../src/app/api/pos/products/route.js';

const saleReq = (body: unknown) =>
  new Request('http://t/api/pos/sale', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

describe('POS session identity and branch (T05, RED first)', () => {
  let mainId = '';
  let smouhaId = '';
  let productId = '';

  beforeAll(async () => {
    await resetTestDb();
    const main = await makeBranch('Main Branch');
    const sm = await makeBranch('Smouha Branch');
    mainId = main.id;
    smouhaId = sm.id;
    const cat = await makeCategory();
    const p = await makeProduct(cat.id, 100);
    productId = p.id;
    await stock(mainId, productId, 10);
    await stock(smouhaId, productId, 10);
  }, 180000);

  afterAll(async () => {
    setMockSession(null);
    await testPrisma().$disconnect();
  });

  it('Samouha cashier sale decrements Samouha only and records session cashierId', async () => {
    const db = testPrisma();
    const cashier = await db.user.update({
      where: { email: (await makeUser('CASHIER', [smouhaId])).email },
      data: { branchId: smouhaId },
    });
    setMockSession(sessionFor({ ...cashier, branchIds: [smouhaId] }));
    const res = await posSale(saleReq({ paymentMethod: 'CASH', items: [{ productId, quantity: 2 }] }));
    expect(res.status).toBe(200);
    const body = await res.json();
    const sale = await db.sale.findUniqueOrThrow({ where: { id: body.saleId ?? undefined } }).catch(() =>
      db.sale.findFirst({ where: { saleNumber: body.saleNumber } })
    );
    expect(sale?.cashierId).toBe(cashier.id);
    expect(sale?.branchId).toBe(smouhaId);
    const mainInv = await db.branchInventory.findUniqueOrThrow({
      where: { branchId_productId: { branchId: mainId, productId } },
    });
    const smInv = await db.branchInventory.findUniqueOrThrow({
      where: { branchId_productId: { branchId: smouhaId, productId } },
    });
    expect(mainInv.stockQuantity).toBe(10);
    expect(smInv.stockQuantity).toBe(8);
  });

  it('cashier attempting another branch gets 403', async () => {
    const db = testPrisma();
    const cashier = await makeUser('CASHIER', [smouhaId]);
    await db.user.update({ where: { id: cashier.id }, data: { branchId: smouhaId } });
    setMockSession(sessionFor({ ...cashier, branchId: smouhaId, branchIds: [smouhaId] }));
    const res = await posSale(saleReq({ paymentMethod: 'CASH', branchId: mainId, items: [{ productId, quantity: 1 }] }));
    expect(res.status).toBe(403);
  });

  it('products endpoint returns the session branch stock', async () => {
    const db = testPrisma();
    const cashier = await makeUser('CASHIER', [smouhaId]);
    await db.user.update({ where: { id: cashier.id }, data: { branchId: smouhaId } });
    setMockSession(sessionFor({ ...cashier, branchId: smouhaId, branchIds: [smouhaId] }));
    const res = await posProducts(new Request(`http://t/api/pos/products?branchId=${smouhaId}`));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.branch?.id).toBe(smouhaId);
  });
});
