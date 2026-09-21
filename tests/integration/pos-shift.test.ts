import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { testPrisma, resetTestDb, makeBranch, makeUser, makeCategory, makeProduct, stock, sessionFor, openTestShift } from '../helpers/factories.js';
import { setMockSession } from '../setup-mocks.js';
import { POST as posSale } from '../../src/app/api/pos/sale/route.js';
import { GET as getShift, POST as openShiftApi } from '../../src/app/api/pos/shifts/route.js';
import { GET as previewClose, POST as closeShiftApi } from '../../src/app/api/pos/shifts/[id]/route.js';
import { openShift, closeShift } from '../../src/lib/shifts/service.js';

const req = (body: unknown) =>
  new Request('http://t/api/pos/shifts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
const saleReq = (body: unknown) =>
  new Request('http://t/api/pos/sale', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

describe('cashier shifts T05', () => {
  let branchId = '';
  let productId = '';
  let cashier: Awaited<ReturnType<typeof makeUser>>;

  beforeAll(async () => {
    await resetTestDb();
    const b = await makeBranch('Shift Branch');
    branchId = b.id;
    cashier = await makeUser('CASHIER', [branchId]);
    await testPrisma().user.update({ where: { id: cashier.id }, data: { branchId } });
    const cat = await makeCategory();
    const p = await makeProduct(cat.id, 100);
    productId = p.id;
    await stock(branchId, productId, 20);
    setMockSession(sessionFor(cashier));
  }, 180000);

  afterAll(async () => {
    setMockSession(null);
    await testPrisma().$disconnect();
  });

  it('sale without an open shift is refused (422)', async () => {
    const res = await posSale(saleReq({ paymentMethod: 'CASH', items: [{ productId, quantity: 1 }] }));
    expect(res.status).toBe(422);
  });

  it('open shift via API, then sale succeeds and carries shiftId', async () => {
    const opened = await openShiftApi(req({ openingFloat: 500 }));
    expect(opened.status).toBe(200);
    const ob = await opened.json();
    expect(ob.shift.id).toBeTruthy();
    const status = await getShift();
    expect((await status.json()).shift.id).toBe(ob.shift.id);

    const res = await posSale(saleReq({ paymentMethod: 'CASH', items: [{ productId, quantity: 1 }] }));
    expect(res.status).toBe(200);
    const sale = await testPrisma().sale.findUniqueOrThrow({ where: { id: (await res.json()).saleId } });
    expect(sale.shiftId).toBe(ob.shift.id);
  });

  it('second open while one is open -> 409', async () => {
    const res = await openShiftApi(req({ openingFloat: 100 }));
    expect(res.status).toBe(409);
  });

  it('close preview reflects cash sales; shortage over tolerance needs a note', async () => {
    const db = testPrisma();
    const shift = await db.shift.findFirstOrThrow({ where: { cashierId: cashier.id, status: 'OPEN' } });
    const prev = await previewClose(new Request('http://t/x'), { params: Promise.resolve({ id: shift.id }) });
    expect(prev.status).toBe(200);
    // 1 cash sale of 100 + 14% = 114; expected = 500 + 114
    expect((await prev.json()).expected).toBe(614);

    // Force a big shortage: actual far below expected, no note -> 422.
    const noNote = await closeShiftApi(req({ actualCash: 100 }), { params: Promise.resolve({ id: shift.id }) });
    expect(noNote.status).toBe(422);
  });

  it('close with note succeeds; double close -> 409', async () => {
    const db = testPrisma();
    const shift = await db.shift.findFirstOrThrow({ where: { cashierId: cashier.id, status: 'OPEN' } });
    const ok = await closeShiftApi(req({ actualCash: 600, closeNote: 'فرق جرد معتمد' }), { params: Promise.resolve({ id: shift.id }) });
    expect(ok.status).toBe(200);
    const body = await ok.json();
    expect(body.difference).toBe(-14);
    const again = await closeShiftApi(req({ actualCash: 600 }), { params: Promise.resolve({ id: shift.id }) });
    expect(again.status).toBe(409);
  });

  it('offline sale attributes to the captured shift even after it closed', async () => {
    const db = testPrisma();
    const closed = await db.shift.findFirstOrThrow({ where: { cashierId: cashier.id, status: 'CLOSED' } });
    const fresh = await openTestShift(branchId, cashier.id, 0);
    void fresh;
    const res = await posSale(saleReq({ paymentMethod: 'CASH', shiftId: closed.id, items: [{ productId, quantity: 1 }] }));
    expect(res.status).toBe(200);
    const sale = await db.sale.findUniqueOrThrow({ where: { id: (await res.json()).saleId } });
    expect(sale.shiftId).toBe(closed.id);
  });

  it('service-level: negative float rejected, unknown shift close 404', async () => {
    await expect(openShift({ branchId, cashierId: cashier.id, openingFloat: -5 })).rejects.toMatchObject({ status: 400 });
    await expect(closeShift({ shiftId: 'nope', cashierId: cashier.id, actualCash: 0, maxShortage: 50 })).rejects.toMatchObject({ status: 404 });
  });
});
