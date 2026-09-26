'use client';

import React from 'react';
import { useLocale } from 'next-intl';
import {
  Wallet,
  ArrowDownRight,
  ArrowUpRight,
  Store,
  Clock,
  CheckCircle,
  AlertTriangle,
} from 'lucide-react';
import { StatusBadge } from './ui';

interface ShiftCashInfo {
  id: string;
  shiftNumber: string;
  branchName: string;
  cashierName: string;
  startingCash: number;
  actualCash: number | null;
  cashDifference: number | null;
  status: string;
  openedAt: string;
  closedAt: string | null;
}

interface TreasuryTransaction {
  id: string;
  type: 'INFLOW' | 'OUTFLOW';
  category: string;
  amount: number;
  branchName: string;
  date: string;
  reference: string;
  notes: string | null;
}

export default function TreasuryManager({
  totalCashInTill,
  totalCodCollected,
  totalCodPending,
  totalExpensesDisbursed,
  totalCustomerReceipts,
  recentShifts,
  recentTransactions,
}: {
  totalCashInTill: number;
  totalCodCollected: number;
  totalCodPending: number;
  totalExpensesDisbursed: number;
  totalCustomerReceipts: number;
  recentShifts: ShiftCashInfo[];
  recentTransactions: TreasuryTransaction[];
}) {
  const locale = useLocale();
  const isAr = locale === 'ar';
  const L = (ar: string, en: string) => (isAr ? ar : en);
  const currencyLabel = L('ج.م', 'EGP');

  const netLiquidity = totalCustomerReceipts + totalCodCollected - totalExpensesDisbursed;

  return (
    <div className="space-y-6">
      {/* Treasury KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-2">
          <div className="text-xs text-slate-400">{L('سيولة الخزينة الصافية المحققة', 'Net Realized Liquidity')}</div>
          <div className="text-2xl font-black text-emerald-400">
            {netLiquidity.toLocaleString()} {currencyLabel}
          </div>
          <div className="text-[11px] text-slate-500">
            {L('المقبوضات + COD المحصل - المصروفات', 'Receipts + Collected COD - Expenses')}
          </div>
        </div>

        <div className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-2">
          <div className="text-xs text-slate-400">{L('نقدية درج الكاشير النشطة', 'Active Till Cash')}</div>
          <div className="text-2xl font-black text-sky-400">
            {totalCashInTill.toLocaleString()} {currencyLabel}
          </div>
          <div className="text-[11px] text-slate-500">
            {L('نقدية العهدة في الورديات الحالية', 'Current open shift drawer balances')}
          </div>
        </div>

        <div className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-2">
          <div className="text-xs text-slate-400">{L('COD محصل لدى المناديب', 'COD with Couriers')}</div>
          <div className="text-2xl font-black text-amber-400">
            {totalCodPending.toLocaleString()} {currencyLabel}
          </div>
          <div className="text-[11px] text-slate-500">
            {L('بانتظار التسوية والتوريد للخزينة', 'Pending settlement to treasury')}
          </div>
        </div>

        <div className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-2">
          <div className="text-xs text-slate-400">{L('مصروفات التشغيل المنصرفة', 'Operating Expenses Paid')}</div>
          <div className="text-2xl font-black text-rose-400">
            {totalExpensesDisbursed.toLocaleString()} {currencyLabel}
          </div>
          <div className="text-[11px] text-slate-500">
            {L('إجمالي المدفوعات المسجلة بالفروع', 'Total branch cash outflows')}
          </div>
        </div>
      </div>

      {/* Cash Drawers per Shift */}
      <div className="glass-panel p-6 rounded-3xl border border-slate-800 space-y-4">
        <div className="flex justify-between items-center border-b border-slate-800 pb-3">
          <div>
            <h3 className="font-extrabold text-sm text-slate-100 flex items-center gap-2">
              <Store className="w-4 h-4 text-blue-400" />
              {L('موقف أدراج الكاشير والخزائن الفرعية', 'Branch Cash Drawer Status')}
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {L('تتبع عهدة البداية، النقدية الفعلية، وفروق الدرج عند الإغلاق', 'Opening float, closing cash, and drawer variances.')}
            </p>
          </div>
        </div>

        <div className="app-scrollbar app-scrollbar-horizontal overflow-x-auto">
          <table className="w-full min-w-[700px] text-xs text-start">
            <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
              <tr>
                <th className="p-3">{L('رقم الوردية', 'Shift No.')}</th>
                <th className="p-3">{L('الفرع', 'Branch')}</th>
                <th className="p-3">{L('أمين الخزينة / الكاشير', 'Cashier')}</th>
                <th className="p-3">{L('عهدة البداية', 'Opening Float')}</th>
                <th className="p-3">{L('النقدية الفعلية', 'Actual Cash')}</th>
                <th className="p-3">{L('فرق الدرج', 'Variance')}</th>
                <th className="p-3">{L('الحالة', 'Status')}</th>
                <th className="p-3">{L('تاريخ الفتح', 'Opened At')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {recentShifts.map((s) => (
                <tr key={s.id} className="hover:bg-slate-900/50">
                  <td className="p-3 font-mono font-bold text-sky-400">{s.shiftNumber}</td>
                  <td className="p-3 font-semibold text-slate-200">{s.branchName}</td>
                  <td className="p-3 text-slate-300">{s.cashierName}</td>
                  <td className="p-3 font-bold text-slate-200">
                    {s.startingCash.toLocaleString()} {currencyLabel}
                  </td>
                  <td className="p-3 font-bold text-slate-100">
                    {s.actualCash !== null ? `${s.actualCash.toLocaleString()} ${currencyLabel}` : '—'}
                  </td>
                  <td className="p-3 font-black">
                    {s.cashDifference !== null ? (
                      <span className={s.cashDifference < 0 ? 'text-rose-400' : s.cashDifference > 0 ? 'text-emerald-400' : 'text-slate-400'}>
                        {s.cashDifference > 0 ? `+${s.cashDifference}` : s.cashDifference} {currencyLabel}
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="p-3">
                    <StatusBadge value={s.status} />
                  </td>
                  <td className="p-3 text-slate-400">
                    {new Date(s.openedAt).toLocaleString(isAr ? 'ar-EG' : 'en-US')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent Cash Flow Ledger */}
      <div className="glass-panel p-6 rounded-3xl border border-slate-800 space-y-4">
        <div className="flex justify-between items-center border-b border-slate-800 pb-3">
          <div>
            <h3 className="font-extrabold text-sm text-slate-100 flex items-center gap-2">
              <Wallet className="w-4 h-4 text-emerald-400" />
              {L('سجل الحركات النقدية الحديثة (Cash Flow Trail)', 'Recent Cash Flow Trail')}
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {L('التدفقات الداخلة والخارجة المسجلة من الفواتير وسندات القبض والمصروفات', 'Inflows & outflows from customer receipts, COD, and expenses.')}
            </p>
          </div>
        </div>

        <div className="app-scrollbar app-scrollbar-horizontal overflow-x-auto">
          <table className="w-full min-w-[700px] text-xs text-start">
            <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
              <tr>
                <th className="p-3">{L('التاريخ', 'Date')}</th>
                <th className="p-3">{L('النوع', 'Type')}</th>
                <th className="p-3">{L('البند / التصنيف', 'Category')}</th>
                <th className="p-3">{L('الفرع', 'Branch')}</th>
                <th className="p-3">{L('المبلغ', 'Amount')}</th>
                <th className="p-3">{L('المرجع', 'Reference')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {recentTransactions.map((tx) => (
                <tr key={tx.id} className="hover:bg-slate-900/50">
                  <td className="p-3 text-slate-400">
                    {new Date(tx.date).toLocaleDateString(isAr ? 'ar-EG' : 'en-US')}
                  </td>
                  <td className="p-3">
                    {tx.type === 'INFLOW' ? (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold text-[10px] flex items-center gap-1 w-fit">
                        <ArrowDownRight className="w-3 h-3" />
                        {L('وارد (إيراد)', 'Inflow')}
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-400 font-bold text-[10px] flex items-center gap-1 w-fit">
                        <ArrowUpRight className="w-3 h-3" />
                        {L('صادر (مصروف)', 'Outflow')}
                      </span>
                    )}
                  </td>
                  <td className="p-3 font-semibold text-slate-200">{tx.category}</td>
                  <td className="p-3 text-slate-300">{tx.branchName}</td>
                  <td className={`p-3 font-black ${tx.type === 'INFLOW' ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {tx.type === 'INFLOW' ? '+' : '-'}{Number(tx.amount).toLocaleString()} {currencyLabel}
                  </td>
                  <td className="p-3 font-mono text-slate-400">{tx.reference}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
