import React from 'react';
import { getLocale } from 'next-intl/server';
import { prisma } from '@/lib/db';
import { num } from '@/lib/pricing';
import { Wallet, Inbox, Clock3, RotateCcw } from 'lucide-react';
import { Link } from '@/i18n/routing';

export default async function ActionQueuesSection() {
  const isAr = (await getLocale()) === 'ar';
  const L = (ar: string, en: string) => (isAr ? ar : en);
  const [pendingPay, receiptsToReview, openShifts, pendingReturns] = await Promise.all([
    prisma.order.aggregate({
      where: { paymentStatus: 'PENDING', orderStatus: { notIn: ['CANCELLED', 'RETURNED'] } },
      _sum: { totalAmount: true },
      _count: true,
    }),
    prisma.order.count({ where: { receiptImage: { not: null }, paymentStatus: 'PENDING' } }),
    prisma.shift.count({ where: { status: 'OPEN' } }),
    prisma.returnRequest.count({ where: { status: { in: ['REQUESTED', 'RECEIVED', 'REFUND_PENDING'] } } }),
  ]);

  const pendingAmount = num(pendingPay._sum.totalAmount);
  const hasItems = pendingPay._count > 0 || receiptsToReview > 0 || openShifts > 0 || pendingReturns > 0;

  if (!hasItems) return null;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      {pendingPay._count > 0 && (
        <Link href="/admin/orders" className="min-h-[44px] p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center gap-2 text-xs font-bold text-amber-300 hover:bg-amber-500/20">
          <Wallet className="w-4 h-4" />
          {pendingPay._count} {L('طلب معلق الدفع', 'orders pending payment')} ({pendingAmount.toLocaleString()} {L('ج.م', 'EGP')})
        </Link>
      )}
      {receiptsToReview > 0 && (
        <Link href="/admin/orders" className="min-h-[44px] p-4 rounded-2xl bg-purple-500/10 border border-purple-500/30 flex items-center gap-2 text-xs font-bold text-purple-300 hover:bg-purple-500/20">
          <Inbox className="w-4 h-4" />
          {receiptsToReview} {L('إيصال تحويل بانتظار المراجعة', 'transfer receipts awaiting review')}
        </Link>
      )}
      {openShifts > 0 && (
        <Link href="/admin/shifts" className="min-h-[44px] p-4 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center gap-2 text-xs font-bold text-cyan-300 hover:bg-cyan-500/20">
          <Clock3 className="w-4 h-4" />
          {openShifts} {L('وردية مفتوحة الآن', 'open shifts now')}
        </Link>
      )}
      {pendingReturns > 0 && (
        <Link href="/admin/returns" className="min-h-[44px] p-4 rounded-2xl bg-orange-500/10 border border-orange-500/30 flex items-center gap-2 text-xs font-bold text-orange-300 hover:bg-orange-500/20">
          <RotateCcw className="w-4 h-4" />
          {pendingReturns} {L('مرتجع بانتظار إجراء (استلام / استرداد)', 'returns awaiting action (receive / refund)')}
        </Link>
      )}
    </div>
  );
}
