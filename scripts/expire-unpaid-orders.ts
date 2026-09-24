/**
 * pnpm orders:expire (F1) — cancel unpaid electronic orders past the
 * `orders.unpaidExpiryHours` window with atomic restock (transitionOrder),
 * then report stuck gateway orders (paymentRef set, still PENDING > 1h)
 * as an in-app notification for manual reconciliation.
 */
import { PrismaClient, PaymentMethod } from '@prisma/client';
import { transitionOrder, OrderTransitionError } from '../src/lib/orders/status.js';

const ELECTRONIC: PaymentMethod[] = ['PAYMOB', 'FAWRY', 'KASHIER', 'INSTAPAY', 'VODAFONE_CASH'];

async function main() {
  const db = new PrismaClient();
  try {
    const hoursRow = await db.setting.findUnique({ where: { key: 'orders.unpaidExpiryHours' } });
    let hours = 48;
    try {
      const v = hoursRow ? JSON.parse(hoursRow.value) : null;
      const n = v !== null && typeof v === 'object' && 'v' in v ? (v as { v: unknown }).v : v;
      if (typeof n === 'number' && n > 0) hours = n;
    } catch { /* keep default */ }
    const cutoff = new Date(Date.now() - hours * 3600_000);
    // T02: Fawry references die at the gateway after 24h — expire them sooner.
    const fawryCutoff = new Date(Date.now() - 24 * 3600_000);

    const expired = await db.order.findMany({
      where: {
        orderStatus: { in: ['PENDING', 'CONFIRMED'] },
        paymentStatus: 'PENDING',
        OR: [
          { paymentMethod: { in: ELECTRONIC.filter((m) => m !== 'FAWRY') }, createdAt: { lt: cutoff } },
          { paymentMethod: 'FAWRY', createdAt: { lt: fawryCutoff } },
        ],
      },
      select: { id: true, orderNumber: true },
    });
    let cancelled = 0;
    for (const o of expired) {
      try {
        await transitionOrder(o.id, 'CANCELLED');
        cancelled++;
      } catch (e) {
        if (e instanceof OrderTransitionError) continue;
        throw e;
      }
    }

    // Reconciliation: gateway-touched but still PENDING over an hour old.
    const stuck = await db.order.findMany({
      where: {
        paymentStatus: 'PENDING',
        paymentRef: { not: null },
        createdAt: { lt: new Date(Date.now() - 3600_000) },
      },
      select: { orderNumber: true, paymentMethod: true, totalAmount: true },
      take: 50,
    });
    if (stuck.length > 0) {
      await db.notification.create({
        data: {
          type: 'NEW_ORDER',
          titleAr: `تسوية دفع: ${stuck.length} طلبات عالقة`,
          titleEn: `Payment reconciliation: ${stuck.length} stuck orders`,
          messageAr: stuck.map((s) => `${s.orderNumber} (${s.paymentMethod} ${s.totalAmount})`).join('، '),
          messageEn: stuck.map((s) => s.orderNumber).join(', '),
        },
      });
    }
    console.log(`orders:expire done — cancelled ${cancelled}/${expired.length}, stuck ${stuck.length}.`);
  } finally {
    await db.$disconnect();
  }
}

main().catch((e) => {
  console.error('orders:expire failed:', e);
  process.exit(1);
});
