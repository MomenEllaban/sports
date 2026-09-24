import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { testPrisma, resetTestDb, makeBranch, makeUser, makeCategory, makeProduct, stock, sessionFor, makeCustomer, openTestShift } from '../helpers/factories.js';
import { setMockSession } from '../setup-mocks.js';
import {
  requestReturn, approveReturn, rejectReturn, cancelReturn, receiveReturn,
  executeRefund, recordManualRefund,
} from '../../src/lib/returns/service.js';

async function seedPolicy(db: ReturnType<typeof testPrisma>) {
  const rows: Array<[string, unknown]> = [
    ['returns.enabled', true],
    ['returns.windowDays', 14],
    ['returns.nonReturnableCategories', []],
    ['returns.reasons', ['SIZE_ISSUE', 'DEFECTIVE', 'WRONG_ITEM', 'NOT_AS_DESCRIBED', 'CHANGED_MIND', 'OTHER']],
    ['returns.requirePhotoForReasons', []],
    ['returns.refundDeliveryFee', 'FULL_RETURN_OR_OUR_FAULT'],
    ['returns.restockingFeePct', 0],
    ['returns.cashRefundManagerThreshold', 500],
    ['returns.autoApproveMaxValue', 1000],
    ['returns.allowedRefundMethods', ['CASH', 'ORIGINAL_GATEWAY', 'INSTAPAY', 'VODAFONE', 'BANK_TRANSFER']],
    ['returns.slaHours', 72],
    ['returns.receiveBranchDefault', 'SALE_BRANCH'],
    ['loyalty.allowNegativeOnReturn', true],
    ['coupons.restoreOnFullReturn', false],
    ['loyalty.earnPerEgp', 10],
    ['loyalty.redeemRate', 1],
    ['loyalty.maxRedeemPct', 20],
    ['discount.maxTotalPct', 30],
    ['discount.stacking', { allowCouponLoyalty: true, allowCouponPin: false }],
    ['vat.rate', 0.14],
  ];
  for (const [key, value] of rows) {
    await db.setting.upsert({ where: { key }, create: { key, value: JSON.stringify(value) }, update: { value: JSON.stringify(value) } });
  }
  const { clearSettingsCache } = await import('../../src/lib/settings.js');
  clearSettingsCache();
}

describe('unified returns service (T-RMA)', () => {
  let branchId = '';
  let productId = '';
  let product2Id = '';
  let manager: Awaited<ReturnType<typeof makeUser>>;
  let cashier: Awaited<ReturnType<typeof makeUser>>;

  beforeAll(async () => {
    await resetTestDb();
    const db = testPrisma();
    const b = await makeBranch('RMA Branch');
    branchId = b.id;
    manager = await makeUser('BRANCH_MANAGER', [branchId]);
    cashier = await makeUser('CASHIER', [branchId]);
    await db.user.update({ where: { id: cashier.id }, data: { branchId } });
    await openTestShift(branchId, cashier.id);
    const cat = await makeCategory();
    productId = (await makeProduct(cat.id, 1000)).id;
    product2Id = (await makeProduct(cat.id, 500)).id;
    await stock(branchId, productId, 20);
    await stock(branchId, product2Id, 20);
    await seedPolicy(db);
    setMockSession(sessionFor(manager));
  }, 180000);

  afterAll(async () => {
    setMockSession(null);
    await testPrisma().$disconnect();
  });

  async function makeOrder(n: number, qty = 1, paymentMethod: 'COD' | 'PAYMOB' = 'COD') {
    const db = testPrisma();
    const cust = await makeCustomer(`0100900${String(2000 + n)}`);
    return db.order.create({
      data: {
        orderNumber: `ORD-RMA-${n}-${Date.now() % 100000}`,
        orderSource: 'ONLINE',
        customerId: cust.id,
        guestPhone: cust.phone,
        guestName: 'RMA',
        deliveryAddress: 'addr',
        branchId,
        deliveryFee: 0,
        paymentMethod: paymentMethod as never,
        paymentStatus: 'PAID',
        orderStatus: 'DELIVERED',
        subtotal: 1000 * qty,
        taxAmount: Math.round(1000 * qty * 0.14 * 100) / 100,
        totalAmount: Math.round(1000 * qty * 1.14 * 100) / 100,
        items: { create: [{ productId, unitPrice: 1000, quantity: qty, totalPrice: 1000 * qty }] },
      },
    });
  }

  it('full lifecycle: request→approve→receive→payout with restock + loyalty revoke', async () => {
    const db = testPrisma();
    const order = await makeOrder(1);
    const cust = await db.customer.findUniqueOrThrow({ where: { id: order.customerId! } });
    await db.customer.update({ where: { id: cust.id }, data: { loyaltyPoints: 200 } });
    const before = (await db.branchInventory.findUniqueOrThrow({ where: { branchId_productId: { branchId, productId } } })).stockQuantity;

    const { request } = await requestReturn({
      orderId: order.id, channel: 'ADMIN',
      items: [{ refId: (await db.orderItem.findFirstOrThrow({ where: { orderId: order.id } })).id, productId, quantity: 1, reasonCode: 'SIZE_ISSUE' }],
      actorId: manager.id,
    });
    expect(request.status).toBe('REQUESTED');
    expect(request.returnNumber.startsWith('RTN-')).toBe(true);

    await approveReturn(request.id, manager.id);
    const fresh = await db.returnRequest.findUniqueOrThrow({ where: { id: request.id }, include: { items: true } });
    const { quote, fullReturn } = await receiveReturn(request.id, manager.id,
      fresh.items.map((ri) => ({ returnItemId: ri.id, condition: 'GOOD', disposition: 'RESTOCK' })),
      { refundMethod: 'CASH' });
    expect(fullReturn).toBe(true);
    expect(quote.total).toBe(1140);

    const after = await db.branchInventory.findUniqueOrThrow({ where: { branchId_productId: { branchId, productId } } });
    expect(after.stockQuantity).toBe(before + 1);
    const ord = await db.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(ord.returnStatus).toBe('FULL');
    expect(ord.orderStatus).toBe('RETURNED');

    const refundRow = await db.refund.findFirstOrThrow({ where: { returnId: request.id } });
    // CASH without shift link → attach open shift then execute.
    await db.refund.update({ where: { id: refundRow.id }, data: {} });
    const exec = await executeRefund(refundRow.id);
    // No shift attached and cashier unknown → MANUAL_REQUIRED path.
    expect(exec.ok).toBe(false);
    const manual = await recordManualRefund(refundRow.id, manager.id, 'CASH-DRAWER-1');
    expect(manual.status).toBe('DONE');
    const paid = await db.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(paid.paymentStatus).toBe('REFUNDED');
    // Loyalty revoked: earned on 1140 ≈ 114 → 200-114 = 86.
    const custAfter = await db.customer.findUniqueOrThrow({ where: { id: cust.id } });
    expect(custAfter.loyaltyPoints).toBe(86);
  });

  it('partial return keeps DELIVERED + PARTIAL; second closes to FULL', async () => {
    const db = testPrisma();
    const order = await makeOrder(2, 3);
    const item = await db.orderItem.findFirstOrThrow({ where: { orderId: order.id } });
    const r1 = await requestReturn({
      orderId: order.id, channel: 'ADMIN',
      items: [{ refId: item.id, productId, quantity: 1, reasonCode: 'CHANGED_MIND' }],
      actorId: manager.id,
    });
    await approveReturn(r1.request.id, manager.id);
    const f1 = await db.returnRequest.findUniqueOrThrow({ where: { id: r1.request.id }, include: { items: true } });
    await receiveReturn(r1.request.id, manager.id, f1.items.map((ri) => ({ returnItemId: ri.id, condition: 'GOOD', disposition: 'RESTOCK' })), { refundMethod: 'CASH' });
    let ord = await db.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(ord.returnStatus).toBe('PARTIAL');
    expect(ord.orderStatus).toBe('DELIVERED');

    const r2 = await requestReturn({
      orderId: order.id, channel: 'ADMIN',
      items: [{ refId: item.id, productId, quantity: 2, reasonCode: 'CHANGED_MIND' }],
      actorId: manager.id,
    });
    await approveReturn(r2.request.id, manager.id);
    const f2 = await db.returnRequest.findUniqueOrThrow({ where: { id: r2.request.id }, include: { items: true } });
    const res = await receiveReturn(r2.request.id, manager.id, f2.items.map((ri) => ({ returnItemId: ri.id, condition: 'GOOD', disposition: 'RESTOCK' })), { refundMethod: 'CASH' });
    expect(res.fullReturn).toBe(true);
    ord = await db.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(ord.returnStatus).toBe('FULL');
    expect(ord.orderStatus).toBe('RETURNED');
  });

  it('over-return rejected (sequential and parallel)', async () => {
    const db = testPrisma();
    const order = await makeOrder(3, 1);
    const item = await db.orderItem.findFirstOrThrow({ where: { orderId: order.id } });
    await expect(requestReturn({
      orderId: order.id, channel: 'ADMIN',
      items: [{ refId: item.id, productId, quantity: 2, reasonCode: 'OTHER' }],
      actorId: manager.id,
    })).rejects.toMatchObject({ status: 400 });

    const mk = () => requestReturn({
      orderId: order.id, channel: 'ADMIN',
      items: [{ refId: item.id, productId, quantity: 1, reasonCode: 'OTHER' }],
      actorId: manager.id,
    });
    const results = await Promise.allSettled([mk(), mk()]);
    const ok = results.filter((r) => r.status === 'fulfilled').length;
    expect(ok).toBe(1);
  });

  it('double receive is exactly-once (no double restock)', async () => {
    const db = testPrisma();
    const order = await makeOrder(4, 1);
    const item = await db.orderItem.findFirstOrThrow({ where: { orderId: order.id } });
    const before = (await db.branchInventory.findUniqueOrThrow({ where: { branchId_productId: { branchId, productId } } })).stockQuantity;
    const { request } = await requestReturn({
      orderId: order.id, channel: 'ADMIN',
      items: [{ refId: item.id, productId, quantity: 1, reasonCode: 'OTHER' }],
      actorId: manager.id,
    });
    await approveReturn(request.id, manager.id);
    const fresh = await db.returnRequest.findUniqueOrThrow({ where: { id: request.id }, include: { items: true } });
    const lines = fresh.items.map((ri) => ({ returnItemId: ri.id, condition: 'GOOD', disposition: 'RESTOCK' }));
    const results = await Promise.allSettled([
      receiveReturn(request.id, manager.id, lines, { refundMethod: 'CASH' }),
      receiveReturn(request.id, manager.id, lines, { refundMethod: 'CASH' }),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled').length).toBe(1);
    const after = (await db.branchInventory.findUniqueOrThrow({ where: { branchId_productId: { branchId, productId } } })).stockQuantity;
    expect(after).toBe(before + 1);
  });

  it('DAMAGED disposition logs without sellable stock; INSPECT parks', async () => {
    const db = testPrisma();
    const order = await makeOrder(5, 1);
    const item = await db.orderItem.findFirstOrThrow({ where: { orderId: order.id } });
    const before = (await db.branchInventory.findUniqueOrThrow({ where: { branchId_productId: { branchId, productId } } })).stockQuantity;
    const { request } = await requestReturn({
      orderId: order.id, channel: 'ADMIN',
      items: [{ refId: item.id, productId, quantity: 1, reasonCode: 'DEFECTIVE', images: ['http://x/y.jpg'] }],
      actorId: manager.id,
    });
    await approveReturn(request.id, manager.id);
    const fresh = await db.returnRequest.findUniqueOrThrow({ where: { id: request.id }, include: { items: true } });
    expect(fresh.items[0].disposition).toBe('DAMAGED'); // smart default
    await receiveReturn(request.id, manager.id, [{ returnItemId: fresh.items[0].id, condition: 'DEFECTIVE', disposition: 'DAMAGED' }], { refundMethod: 'CASH' });
    const after = (await db.branchInventory.findUniqueOrThrow({ where: { branchId_productId: { branchId, productId } } })).stockQuantity;
    expect(after).toBe(before); // no sellable restock
    const logs = await db.inventoryLog.count({ where: { referenceId: request.returnNumber, type: 'RETURN' } });
    expect(logs).toBe(1); // visible zero-change log
  });

  it('reject/cancel guards; idempotent replay by clientRequestId', async () => {
    const db = testPrisma();
    const order = await makeOrder(6, 1);
    const item = await db.orderItem.findFirstOrThrow({ where: { orderId: order.id } });
    const base = {
      orderId: order.id, channel: 'ADMIN',
      items: [{ refId: item.id, productId, quantity: 1, reasonCode: 'OTHER' }],
      actorId: manager.id, clientRequestId: `idem-${Date.now()}`,
    };
    const first = await requestReturn(base);
    expect(first.replay).toBe(false);
    const second = await requestReturn(base);
    expect(second.replay).toBe(true);
    expect(second.request.id).toBe(first.request.id);
    await rejectReturn(first.request.id, manager.id, 'خارج السياسة');
    await expect(approveReturn(first.request.id, manager.id)).rejects.toMatchObject({ status: 409 });
    await expect(cancelReturn(first.request.id, manager.id)).rejects.toMatchObject({ status: 409 });

    const order2 = await makeOrder(7, 1);
    const item2 = await db.orderItem.findFirstOrThrow({ where: { orderId: order2.id } });
    const c = await requestReturn({ orderId: order2.id, channel: 'ADMIN', items: [{ refId: item2.id, productId, quantity: 1, reasonCode: 'OTHER' }], actorId: manager.id });
    await cancelReturn(c.request.id, manager.id);
    const cancelled = await db.returnRequest.findUniqueOrThrow({ where: { id: c.request.id } });
    expect(cancelled.status).toBe('CANCELLED');
  });

  it('gateway payout success/fail/manual via HTTP mock (PAYMOB order)', async () => {
    const db = testPrisma();
    await db.setting.upsert({
      where: { key: 'paymob.apiKey' },
      create: { key: 'paymob.apiKey', value: JSON.stringify('test-key-abc') },
      update: { value: JSON.stringify('test-key-abc') },
    });
    await db.setting.upsert({
      where: { key: 'paymob.integrationId' },
      create: { key: 'paymob.integrationId', value: JSON.stringify('999') },
      update: { value: JSON.stringify('999') },
    });
    await db.setting.upsert({
      where: { key: 'paymob.iframeId' },
      create: { key: 'paymob.iframeId', value: JSON.stringify('888') },
      update: { value: JSON.stringify('888') },
    });
    const { clearSettingsCache } = await import('../../src/lib/settings.js');
    clearSettingsCache();
    const order = await makeOrder(8, 1, 'PAYMOB');
    await db.order.update({ where: { id: order.id }, data: { paymentRef: 'PAYMOB-4242' } });
    const item = await db.orderItem.findFirstOrThrow({ where: { orderId: order.id } });
    const { request } = await requestReturn({
      orderId: order.id, channel: 'ADMIN',
      items: [{ refId: item.id, productId, quantity: 1, reasonCode: 'WRONG_ITEM' }],
      actorId: manager.id,
    });
    await approveReturn(request.id, manager.id);
    const fresh = await db.returnRequest.findUniqueOrThrow({ where: { id: request.id }, include: { items: true } });
    await receiveReturn(request.id, manager.id, fresh.items.map((ri) => ({ returnItemId: ri.id, condition: 'GOOD', disposition: 'RESTOCK' })), { refundMethod: 'ORIGINAL_GATEWAY' });
    const refundRow = await db.refund.findFirstOrThrow({ where: { returnId: request.id } });

    const good = (async (url: unknown) => {
      const u = String(url);
      if (u.endsWith('/auth/tokens')) return new Response(JSON.stringify({ token: 't' }), { status: 200 });
      return new Response(JSON.stringify({}), { status: 200 });
    }) as typeof fetch;
    const ok = await executeRefund(refundRow.id, good);
    expect(ok.ok).toBe(true);
    // Replay is single-flight guarded.
    await expect(executeRefund(refundRow.id, good)).rejects.toMatchObject({ status: 409 });
    const done = await db.refund.findUniqueOrThrow({ where: { id: refundRow.id } });
    expect(done.status).toBe('DONE');
    expect((await db.order.findUniqueOrThrow({ where: { id: order.id } })).paymentStatus).toBe('REFUNDED');

    // Failure → FAILED → manual record closes it.
    const order2 = await makeOrder(9, 1, 'PAYMOB');
    await db.order.update({ where: { id: order2.id }, data: { paymentRef: 'PAYMOB-4343' } });
    const item2 = await db.orderItem.findFirstOrThrow({ where: { orderId: order2.id } });
    const r2 = await requestReturn({
      orderId: order2.id, channel: 'ADMIN',
      items: [{ refId: item2.id, productId, quantity: 1, reasonCode: 'OTHER' }],
      actorId: manager.id,
    });
    await approveReturn(r2.request.id, manager.id);
    const f2 = await db.returnRequest.findUniqueOrThrow({ where: { id: r2.request.id }, include: { items: true } });
    await receiveReturn(r2.request.id, manager.id, f2.items.map((ri) => ({ returnItemId: ri.id, condition: 'GOOD', disposition: 'RESTOCK' })), { refundMethod: 'ORIGINAL_GATEWAY' });
    const rr2 = await db.refund.findFirstOrThrow({ where: { returnId: r2.request.id } });
    const bad = (async () => new Response('x', { status: 500 })) as typeof fetch;
    const failed = await executeRefund(rr2.id, bad);
    expect(failed.ok).toBe(false);
    expect((await db.refund.findUniqueOrThrow({ where: { id: rr2.id } })).status).toBe('FAILED');
    const closed = await recordManualRefund(rr2.id, manager.id, 'BANK-TRX-1', 'http://x/proof.jpg');
    expect(closed.status).toBe('DONE');
  });

  it('legacy backfill converts RETURNED without moving stock', async () => {
    const db = testPrisma();
    const order = await makeOrder(10, 1);
    await db.order.update({ where: { id: order.id }, data: { orderStatus: 'RETURNED' } });
    const before = (await db.branchInventory.findUniqueOrThrow({ where: { branchId_productId: { branchId, productId } } })).stockQuantity;
    const { backfillLegacy } = await import('../../src/lib/returns/service.js');
    const res = await backfillLegacy();
    expect(res.created).toBeGreaterThanOrEqual(1);
    const ord = await db.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(ord.returnStatus).toBe('FULL');
    const after = (await db.branchInventory.findUniqueOrThrow({ where: { branchId_productId: { branchId, productId } } })).stockQuantity;
    expect(after).toBe(before); // no stock movement
    // Idempotent rerun creates nothing new.
    const res2 = await backfillLegacy();
    const again = await db.returnRequest.count({ where: { orderId: order.id } });
    expect(again).toBe(1);
    void res2;
  });

  it('RBAC: cashier blocked from admin returns, anonymous blocked', async () => {
    const { GET } = await import('../../src/app/api/admin/returns/route.js');
    setMockSession(sessionFor(cashier));
    expect((await GET(new Request('http://t/x'))).status).toBe(403);
    setMockSession(null);
    expect((await GET(new Request('http://t/x'))).status).toBe(401);
    setMockSession(sessionFor(manager));
  });
});
