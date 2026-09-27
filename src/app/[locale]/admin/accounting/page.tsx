import React from 'react';
import { getLocale } from 'next-intl/server';
import { prisma } from '@/lib/db';
import { num } from '@/lib/pricing';
import { requirePageRole } from '@/lib/auth/require-page';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  ShieldCheck,
  AlertTriangle,
  Wallet,
  ArrowRight,
} from 'lucide-react';
import { Link } from '@/i18n/routing';

export const dynamic = 'force-dynamic';

export default async function AdminAccountingPage() {
  await requirePageRole('SUPER_ADMIN', 'FINANCE');
  const isAr = (await getLocale()) === 'ar';
  const L = (ar: string, en: string) => (isAr ? ar : en);
  const currencyLabel = L('ج.م', 'EGP');

  // Fetch aggregated data only — no full table dumps on the overview
  const [orders, sales, expenses, taxInvoices, supplierPayments] = await Promise.all([
    prisma.order.findMany({ where: { paymentStatus: 'PAID' }, select: { totalAmount: true, taxAmount: true, paymentMethod: true } }),
    prisma.sale.findMany({ where: { paymentStatus: 'PAID' }, select: { totalAmount: true, taxAmount: true } }),
    prisma.expense.findMany({ select: { amount: true, createdAt: true } }),
    prisma.taxInvoice.findMany({ select: { status: true, vatAmount: true, totalAmount: true } }),
    prisma.supplierPayment.findMany({ select: { amount: true } }),
  ]);

  // Revenue
  const onlineRevenue = orders.reduce((s, o) => s + num(o.totalAmount), 0);
  const posRevenue = sales.reduce((s, s2) => s + num(s2.totalAmount), 0);
  const totalRevenue = onlineRevenue + posRevenue;

  // VAT
  const vatOnline = orders.reduce((s, o) => s + num(o.taxAmount), 0);
  const vatPos = sales.reduce((s, s2) => s + num(s2.taxAmount), 0);
  const totalVat = vatOnline + vatPos;

  // Expenses
  const totalExpenses = expenses.reduce((s, e) => s + num(e.amount), 0);
  const netProfit = totalRevenue - totalExpenses;
  const profitMargin = totalRevenue > 0 ? ((netProfit / totalRevenue) * 100).toFixed(1) : '0.0';

  // COD
  const codPaid = orders.filter((o) => o.paymentMethod === 'COD').reduce((s, o) => s + num(o.totalAmount), 0);

  // ETA — enum values: SUBMITTED | VALID | INVALID
  const etaAccepted = taxInvoices.filter((t) => t.status === 'VALID').length;
  const etaFailed = taxInvoices.filter((t) => t.status === 'INVALID').length;
  const etaVatAccepted = taxInvoices.filter((t) => t.status === 'VALID').reduce((s, t) => s + num(t.vatAmount), 0);

  // Supplier payments
  const totalPaidToSuppliers = supplierPayments.reduce((s, p) => s + num(p.amount), 0);

  const kpis = [
    {
      label: L('إجمالي المبيعات', 'Total revenue'),
      value: `${totalRevenue.toLocaleString()} ${currencyLabel}`,
      sub: L(`أونلاين ${onlineRevenue.toLocaleString()} + كاشير ${posRevenue.toLocaleString()}`, `Online ${onlineRevenue.toLocaleString()} + POS ${posRevenue.toLocaleString()}`),
      color: 'text-emerald-400',
      bgColor: 'border-emerald-500/20',
      icon: TrendingUp,
      href: '/admin/accounting/pnl',
    },
    {
      label: L('صافي الربح التقديري', 'Estimated net profit'),
      value: `${netProfit.toLocaleString()} ${currencyLabel}`,
      sub: L(`هامش الربح ${profitMargin}%`, `Margin ${profitMargin}%`),
      color: netProfit >= 0 ? 'text-blue-400' : 'text-rose-400',
      bgColor: netProfit >= 0 ? 'border-blue-500/20' : 'border-rose-500/20',
      icon: DollarSign,
      href: '/admin/accounting/pnl',
    },
    {
      label: L('إجمالي المصروفات', 'Total expenses'),
      value: `${totalExpenses.toLocaleString()} ${currencyLabel}`,
      sub: L(`${expenses.length} قيد مصروف`, `${expenses.length} expense entries`),
      color: 'text-rose-400',
      bgColor: 'border-rose-500/20',
      icon: TrendingDown,
      href: '/admin/accounting/expenses',
    },
    {
      label: L('ضريبة القيمة المضافة (14%)', 'VAT collected (14%)'),
      value: `${totalVat.toLocaleString()} ${currencyLabel}`,
      sub: L(`${etaAccepted} فاتورة مُقبلة من ETA`, `${etaAccepted} invoices validated by ETA`),
      color: 'text-amber-400',
      bgColor: 'border-amber-500/20',
      icon: ShieldCheck,
      href: '/admin/accounting/eta',
    },
    {
      label: L('الخزينة — COD مُحصَّل', 'COD collected'),
      value: `${codPaid.toLocaleString()} ${currencyLabel}`,
      sub: L('دفع عند الاستلام', 'Cash on delivery'),
      color: 'text-cyan-400',
      bgColor: 'border-cyan-500/20',
      icon: Wallet,
      href: '/admin/accounting/treasury',
    },
    {
      label: L('مدفوع للموردين', 'Paid to suppliers'),
      value: `${totalPaidToSuppliers.toLocaleString()} ${currencyLabel}`,
      sub: L(`${supplierPayments.length} دفعة مسجلة`, `${supplierPayments.length} payments recorded`),
      color: 'text-violet-400',
      bgColor: 'border-violet-500/20',
      icon: DollarSign,
      href: '/admin/accounting/receivables',
    },
  ];

  return (
    <>
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-100 flex items-center gap-2">
            <DollarSign className="w-6 h-6 text-emerald-400" />
            {L('نظرة مالية شاملة', 'Financial overview')}
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            {L('ملخص الأداء المالي للمتجر — للتفاصيل اختر التبويب المناسب أعلاه', 'Financial performance summary — select a tab above for details')}
          </p>
        </div>
        {etaFailed > 0 && (
          <Link
            href="/admin/accounting/eta"
            className="inline-flex items-center gap-2 rounded-xl border border-rose-500/40 bg-rose-500/10 px-3.5 py-2 text-xs font-bold text-rose-300 hover:bg-rose-500/20 transition-colors"
          >
            <AlertTriangle className="w-4 h-4" />
            {etaFailed} {L('فاتورة ضريبية فاشلة — إصلاح الآن', 'ETA invoices failed — fix now')}
          </Link>
        )}
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <Link
              key={kpi.label}
              href={kpi.href}
              className={`glass-panel group relative rounded-2xl border ${kpi.bgColor} p-5 space-y-3 transition-all hover:scale-[1.01] hover:shadow-lg hover:shadow-slate-900/50`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-400">{kpi.label}</span>
                <Icon className={`w-5 h-5 ${kpi.color}`} />
              </div>
              <p className={`text-2xl font-black ${kpi.color}`}>{kpi.value}</p>
              <div className="flex items-center justify-between">
                <p className="text-[11px] text-slate-500">{kpi.sub}</p>
                <ArrowRight className="w-3.5 h-3.5 text-slate-600 group-hover:text-slate-400 transition-colors rtl-flip" />
              </div>
            </Link>
          );
        })}
      </div>

      {/* Quick Links */}
      <div className="glass-panel rounded-2xl border border-slate-800 p-5">
        <h2 className="text-sm font-extrabold text-slate-200 mb-4">{L('الإجراءات السريعة', 'Quick actions')}</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { href: '/admin/accounting/pnl',        icon: TrendingUp,  label: L('الأرباح والخسائر', 'P&L report'),       color: 'text-emerald-400' },
            { href: '/admin/accounting/expenses',    icon: TrendingDown, label: L('المصروفات', 'Expenses'),             color: 'text-rose-400' },
            { href: '/admin/accounting/treasury',    icon: Wallet,      label: L('الخزينة', 'Treasury'),               color: 'text-cyan-400' },
            { href: '/admin/accounting/receivables', icon: DollarSign,  label: L('الذمم', 'Receivables'),              color: 'text-violet-400' },
            { href: '/admin/accounting/eta',         icon: ShieldCheck, label: L('ضرائب ETA', 'ETA taxes'),            color: 'text-amber-400' },
            { href: '/admin/expenses',               icon: DollarSign,  label: L('إضافة مصروف', 'Add expense'),        color: 'text-blue-400' },
          ].map((link) => {
            const Icon = link.icon;
            return (
              <Link
                key={link.href}
                href={link.href}
                className="flex flex-col items-center gap-2 rounded-xl border border-slate-700/60 bg-slate-800/40 p-4 text-center text-xs font-bold text-slate-300 hover:bg-slate-800 hover:text-slate-100 transition-colors"
              >
                <Icon className={`w-5 h-5 ${link.color}`} />
                <span>{link.label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </>
  );
}
