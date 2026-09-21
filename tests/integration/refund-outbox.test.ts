import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { testPrisma, resetTestDb, makeBranch, makeUser, makeCategory, makeProduct, stock, sessionFor, makeCustomer } from '../helpers/factories.js';
import { setMockSession } from '../setup-mocks.js';
import { POST as refundOrder } from '../../src/app/api/admin/orders/[id]/refund/route.js';
import { requestRefund, processRefund } from '../../src/lib/refunds/service.js';

const body = (b: unknown) =>
  new Request('http://t/api/x', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) });

async function makeDeliveredOrder(db: ReturnType<typeof testPrisma>, branchId: string, productId: string, paymentMethod: 'COD' | 'PAYMOB' = 'COD', n = 1) {
  const cust = await makeCustomer(`0100990${String(1000 + n)}`);
  const order = await db.order.create({
    data: {
      orderNumber: `ORD-RF-${n}-${Date.now() % 100000}`,
      orderSource: 'ONLINE',
      customerId: cust.id,
      guestPhone: cust.phone,
      guestName: 'Refund Test',
      deliveryAddress: 'addr',
      branchId,
      paymentMethod: paymentMethod as never,
      paymentStatus: 'PAID',
      orderStatus: 'DELIVERED',
      subtotal: 1000,
      taxAmount: 140,
      totalAmount: 1140,
      items: { create: [{ productId, unitPrice: 1000, quantity: 1, totalPrice: 1000 }] },
    },
  });
  return order;
}

describe('refund outbox T10', () => {
  let branchId = '';
  let productId = '';
  let manager: Awaited<ReturnType<typeof makeUser>>;

  beforeAll(async () => {
    await resetTestDb();
    const b = await makeBranch('Refund Branch');
    branchId = b.id;
    manager = await makeUser('BRANCH_MANAGER', [branchId]);
    const cat = await makeCategory();
    const p = await makeProduct(cat.id, 1000);
    productId = p.id;
    await stock(branchId, productId, 10);
    setMockSession(sessionFor(manager));
  }, 180000);

  afterAll(async () => {
    setMockSession(null);
    await testPrisma().$disconnect();
  });

  it('COD refund: restock + SUCCEEDED in one flow', async () => {
    const db = testPrisma();
    const order = await makeDeliveredOrder(db, branchId, productId, 'COD', 1);
    const before = (await db.branchInventory.findUniqueOrThrow({ where: { branchId_productId: { branchId, productId } } })).stockQuantity;
    const res = await refundOrder(body({ reason: 'عيب' }), { params: Promise.resolve({ id: order.id }) });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.result.ok).toBe(true);
    const after = await db.branchInventory.findUniqueOrThrow({ where: { branchId_productId: { branchId, productId } } });
    expect(after.stockQuantity).toBe(before + 1); // restocked exactly once
    const ord = await db.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(ord.orderStatus).toBe('RETURNED');
    expect(ord.paymentStatus).toBe('REFUNDED');
  });

  it('parallel refund requests: exactly one wins (no double restock)', async () => {
    const db = testPrisma();
    const order = await makeDeliveredOrder(db, branchId, productId, 'COD', 2);
    const before = (await db.branchInventory.findUniqueOrThrow({ where: { branchId_productId: { branchId, productId } } })).stockQuantity;
    const results = await Promise.allSettled([
      requestRefund(order.id, manager.id, 'r1'),
      requestRefund(order.id, manager.id, 'r2'),
    ]);
    const ok = results.filter((r) => r.status === 'fulfilled').length;
    expect(ok).toBe(1);
    expect(await db.refundRequest.count({ where: { orderId: order.id } })).toBe(1);
    const after = (await db.branchInventory.findUniqueOrThrow({ where: { branchId_productId: { branchId, productId } } })).stockQuantity;
    expect(after).toBe(before + 1);
  });

  it('non-delivered orders cannot be refunded', async () => {
    const db = testPrisma();
    const cust = await makeCustomer('01009909999');
    const order = await db.order.create({
      data: {
        orderNumber: `ORD-RF-P-${Date.now() % 100000}`,
        guestPhone: cust.phone,
        deliveryAddress: 'addr',
        branchId,
        paymentMethod: 'COD',
        paymentStatus: 'PENDING',
        orderStatus: 'CONFIRMED',
        subtotal: 100,
        totalAmount: 114,
        items: { create: [{ productId, unitPrice: 100, quantity: 1, totalPrice: 100 }] },
      },
    });
    const res = await refundOrder(body({}), { params: Promise.resolve({ id: order.id }) });
    expect(res.status).toBe(400);
  });

  it('PAYMOB refund with mocked gateway succeeds; failure stays retryable', async () => {
    const db = testPrisma();
    // Ready gateway config (test-only values; network is stubbed below).
    for (const [k, v] of [['paymob.apiKey', 'test-key-abc'], ['paymob.integrationId', '999'], ['paymob.iframeId', '888']]) {
      await db.setting.upsert({ where: { key: k }, create: { key: k, value: JSON.stringify(v) }, update: { value: JSON.stringify(v) } });
    }
    const { clearSettingsCache } = await import('../../src/lib/settings.js');
    clearSettingsCache();
    const okOrder = await makeDeliveredOrder(db, branchId, productId, 'PAYMOB', 3);
    await db.order.update({ where: { id: okOrder.id }, data: { paymentRef: 'PAYMOB-999' } });
    // Mock myself: processRefund takes fetch — call service directly with stub.
    const req = await requestRefund(okOrder.id, manager.id, 'test');
    const goodFetch = (async (url: unknown) => {
      const u = String(url);
      if (u.endsWith('/auth/tokens')) return new Response(JSON.stringify({ token: 't' }), { status: 200 });
      return new Response(JSON.stringify({}), { status: 200 });
    }) as typeof fetch;
    const ok = await processRefund(req.id, goodFetch);
    expect(ok.ok).toBe(true);
    const badOrder = await makeDeliveredOrder(db, branchId, productId, 'PAYMOB', 4);
    await db.order.update({ where: { id: badOrder.id }, data: { paymentRef: 'PAYMOB-1000' } });
    const req2 = await requestRefund(badOrder.id, manager.id, 'test');
    const badFetch = (async () => new Response('x', { status: 500 })) as typeof fetch;
    const bad = await processRefund(req2.id, badFetch);
    expect(bad.ok).toBe(false);
    const row = await db.refundRequest.findUniqueOrThrow({ where: { id: req2.id } });
    expect(row.status).toBe('FAILED');
    // Retry with good gateway recovers.
    const retry = await processRefund(req2.id, goodFetch);
    expect(retry.ok).toBe(true);
  });
});
