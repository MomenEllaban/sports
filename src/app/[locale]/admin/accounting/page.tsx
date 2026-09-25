import React from 'react';
import { getLocale } from 'next-intl/server';
import ExpensesManager from '@/components/admin/ExpensesManager';
import EtaRetryButton from '@/components/admin/EtaRetryButton';
import { StatusBadge } from '@/components/admin/ui';
import { prisma } from '@/lib/db';
import { num } from '@/lib/pricing';
import { DollarSign, ShieldCheck } from 'lucide-react';
import { requirePageRole } from '@/lib/auth/require-page';

export const dynamic = 'force-dynamic';

export default async function AdminAccountingPage() {
  await requirePageRole('SUPER_ADMIN', 'FINANCE');
  const isAr = (await getLocale()) === 'ar';
  const L = (ar: string, en: string) => (isAr ? ar : en);
  const currencyLabel = L('ج.م', 'EGP');
  const [orders, sales, expenses, branches, taxInvoices, gs1Missing] = await Promise.all([
    prisma.order.findMany({ where: { paymentStatus: 'PAID' } }),
    prisma.sale.findMany({ where: { paymentStatus: 'PAID' } }),
    prisma.expense.findMany({ orderBy: { createdAt: 'desc' }, include: { branch: true } }),
    prisma.branch.findMany({ select: { id: true, name: true, nameEn: true } }),
    prisma.taxInvoice.findMany({ take: 10, orderBy: { createdAt: 'desc' } }),
    prisma.product.count({ where: { isActive: true, gs1Code: null } }),
  ]);

  const totalOnlineRevenue = orders.reduce((acc, o) => acc + num(o.totalAmount), 0);  const totalPosRevenue = sales.reduce((acc, s) => acc + num(s.totalAmount), 0);
  const totalGrossRevenue = totalOnlineRevenue + totalPosRevenue;
  const totalVatCollected = orders.reduce((acc, o) => acc + num(o.taxAmount), 0) + sales.reduce((acc, s) => acc + num(s.taxAmount), 0);
  const totalExpensesAmount = expenses.reduce((acc, e) => acc + num(e.amount), 0);
  const netProfit = totalGrossRevenue - totalExpensesAmount;

  const codOrders = orders.filter((o) => o.paymentMethod === 'COD');
  const codCollected = codOrders.filter((o) => o.paymentStatus === 'PAID').reduce((s, o) => s + num(o.totalAmount), 0);
  const codPending = codOrders.filter((o) => o.paymentStatus !== 'PAID').reduce((s, o) => s + num(o.totalAmount), 0);
  const invalidCount = taxInvoices.filter((t) => t.status === 'INVALID').length;

  return (
    <>
          <div className="flex justify-between items-center border-b border-slate-800 pb-4">
            <div>
              <h1 className="text-2xl font-black text-slate-100 flex items-center gap-2">
                <DollarSign className="w-6 h-6 text-emerald-400" />
                {L('الحسابات والإقرارات الضريبية (P&L & ETA)', 'Accounting & Tax Reports (P&L & ETA)')}
              </h1>
              <p className="text-xs text-slate-400 mt-0.5">{L('متابعة الأرباح والخسائر، ضريبة القيمة المضافة 14%، وإصدارات الإيصالات الإلكترونية', 'Track profit and loss, 14% VAT, and electronic receipt submissions.')}</p>
            </div>
          </div>

          {/* Financial Overview Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-2 animate-fade-up">
              <div className="text-xs text-slate-400">{L('إجمالي المبيعات الشاملة', 'Total sales')}</div>
              <div className="text-2xl font-black text-slate-100">{totalGrossRevenue.toLocaleString()} {currencyLabel}</div>
              <div className="text-[11px] text-blue-400">{L('Online + POS الكاشير', 'Online + POS')}</div>
            </div>

            <div className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-2 animate-fade-up">
              <div className="text-xs text-slate-400">{L('إجمالي ضريبة 14% المستحقة', 'Total VAT due (14%)')}</div>
              <div className="text-2xl font-black text-amber-400">{totalVatCollected.toLocaleString()} {currencyLabel}</div>
              <div className="text-[11px] text-slate-400">{L('مصلحة الضرائب المصرية', 'Egyptian Tax Authority')}</div>
            </div>

            <div className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-2 animate-fade-up">
              <div className="text-xs text-slate-400">{L('مصروفات التشغيل للفروع', 'Branch operating expenses')}</div>
              <div className="text-2xl font-black text-rose-400">{totalExpensesAmount.toLocaleString()} {currencyLabel}</div>
              <div className="text-[11px] text-slate-400">{L('صافي الربح التقريبي', 'Estimated net profit')}: {netProfit.toLocaleString()} {currencyLabel}</div>
            </div>

            <div className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-2 animate-fade-up">
              <div className="text-xs text-slate-400">{L('تسويات الدفع عند الاستلام (COD)', 'Cash-on-delivery settlements')}</div>
              <div className="text-2xl font-black text-emerald-400">{codCollected.toLocaleString()} {currencyLabel}</div>
              <div className="text-[11px] text-amber-400">{L('معلق لدى المناديب', 'Held by couriers')}: {codPending.toLocaleString()} {currencyLabel}</div>
            </div>
          </div>

          <div className="glass-panel p-6 rounded-3xl border border-slate-800 space-y-4 animate-fade-up">
            <ExpensesManager
              expenses={expenses.map((e) => ({ ...e, amount: num(e.amount) }))}
              branches={branches}
            />
          </div>

          {/* ETA E-Invoices Submission Log */}
          <div className="glass-panel p-6 rounded-3xl border border-slate-800 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="font-extrabold text-sm text-slate-100 flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
                {L('سجل إرسالات الإيصالات الإلكترونية لضرائب مصر (ETA Submission Log)', 'ETA electronic receipt submission log')}
              </h3>
              {invalidCount > 0 && (
                <span className="px-3 py-1 rounded-full bg-rose-500/15 border border-rose-500/40 text-rose-300 text-[11px] font-bold">
                  {invalidCount} {L('فاشلة — أعد المحاولة من الجدول', 'failed — retry from the table')}
                </span>
              )}
              {gs1Missing > 0 && (
                <span className="px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/40 text-amber-300 text-[11px] font-bold">
                  {gs1Missing} {L('صنف بلا GS1 — لن تُقبل في production', 'items without GS1 — rejected in production')}
                </span>
              )}
            </div>

            <div className="app-scrollbar app-scrollbar-horizontal overflow-x-auto">
              <table className="w-full min-w-[720px] text-xs text-start">
                <thead className="text-slate-400 bg-slate-950 border-b border-slate-800">
                  <tr>
                    <th className="p-3">{L('رقم الفاتورة/الإيصال', 'Invoice/receipt no.')}</th>
                    <th className="p-3">{L('كود ETA UUID', 'ETA UUID')}</th>
                    <th className="p-3">{L('المبلغ الكلي', 'Total amount')}</th>
                    <th className="p-3">{L('الضريبة 14%', 'VAT 14%')}</th>
                    <th className="p-3">{L('حالة الضرائب', 'Tax status')}</th>
                    <th className="p-3">{L('تاريخ الإصدار', 'Issued at')}</th>
                    <th className="p-3">{L('إجراء', 'Action')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {taxInvoices.map((tax) => (
                    <tr key={tax.id} className="hover:bg-slate-900/50">
                      <td className="p-3 font-bold text-amber-400">{tax.invoiceNumber}</td>
                      <td className="p-3 font-mono text-[11px] text-slate-400">{tax.etaUuid}</td>
                      <td className="p-3 font-black text-slate-100">{num(tax.totalAmount).toLocaleString()} {currencyLabel}</td>
                      <td className="p-3 text-emerald-400">{num(tax.vatAmount).toLocaleString()} {currencyLabel}</td>
                      <td className="p-3"><StatusBadge value={tax.status} /></td>
                      <td className="p-3 text-slate-400">{tax.createdAt.toLocaleString(isAr ? 'ar-EG' : 'en-GB')}</td>
                      <td className="p-3">{tax.status === 'INVALID' && <EtaRetryButton id={tax.id} />}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
  );
}
