import React from 'react';
import { getLocale } from 'next-intl/server';
import { prisma } from '@/lib/db';
import { num } from '@/lib/pricing';
import { requirePageRole } from '@/lib/auth/require-page';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  PieChart,
  Building2,
  Receipt,
  FileSpreadsheet,
  Percent,
} from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function AdminAccountingPnlPage() {
  await requirePageRole('SUPER_ADMIN', 'FINANCE');
  const isAr = (await getLocale()) === 'ar';
  const L = (ar: string, en: string) => (isAr ? ar : en);
  const currencyLabel = L('ج.م', 'EGP');

  const [orders, sales, expenses, branches] = await Promise.all([
    prisma.order.findMany({
      where: { paymentStatus: 'PAID' },
      include: {
        items: {
          include: {
            product: { select: { costPrice: true } },
          },
        },
        branch: { select: { id: true, name: true, nameEn: true } },
      },
    }),
    prisma.sale.findMany({
      where: { paymentStatus: 'PAID' },
      include: {
        items: {
          include: {
            product: { select: { costPrice: true } },
          },
        },
        branch: { select: { id: true, name: true, nameEn: true } },
      },
    }),
    prisma.expense.findMany({
      include: {
        branch: { select: { id: true, name: true, nameEn: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.branch.findMany({
      where: { isActive: true },
      select: { id: true, name: true, nameEn: true },
      orderBy: { name: 'asc' },
    }),
  ]);

  // Calculations
  const onlineRevenue = orders.reduce((sum, o) => sum + num(o.totalAmount), 0);
  const posRevenue = sales.reduce((sum, s) => sum + num(s.totalAmount), 0);
  const totalRevenue = onlineRevenue + posRevenue;

  // COGS calculation
  let totalCogs = 0;
  for (const o of orders) {
    for (const item of o.items) {
      const itemCost = num(item.product.costPrice) * item.quantity;
      totalCogs += itemCost;
    }
  }
  for (const s of sales) {
    for (const item of s.items) {
      const itemCost = num(item.product.costPrice) * item.quantity;
      totalCogs += itemCost;
    }
  }

  const grossProfit = totalRevenue - totalCogs;
  const grossMargin = totalRevenue > 0 ? ((grossProfit / totalRevenue) * 100).toFixed(1) : '0.0';

  // Expenses grouped by category
  const expensesByCategory: Record<string, number> = {};
  let totalExpenses = 0;
  for (const exp of expenses) {
    const amt = num(exp.amount);
    totalExpenses += amt;
    const cat = exp.category || 'OTHER';
    expensesByCategory[cat] = (expensesByCategory[cat] || 0) + amt;
  }

  const netProfit = grossProfit - totalExpenses;
  const netMargin = totalRevenue > 0 ? ((netProfit / totalRevenue) * 100).toFixed(1) : '0.0';

  // Per branch breakdown
  const branchBreakdown = branches.map((branch) => {
    const branchSales = sales.filter((s) => s.branchId === branch.id);
    const branchOrders = orders.filter((o) => o.branchId === branch.id);
    const rev =
      branchSales.reduce((sum, s) => sum + num(s.totalAmount), 0) +
      branchOrders.reduce((sum, o) => sum + num(o.totalAmount), 0);

    let cogs = 0;
    for (const s of branchSales) {
      for (const item of s.items) {
        cogs += num(item.product.costPrice) * item.quantity;
      }
    }
    for (const o of branchOrders) {
      for (const item of o.items) {
        cogs += num(item.product.costPrice) * item.quantity;
      }
    }

    const exp = expenses
      .filter((e) => e.branchId === branch.id)
      .reduce((sum, e) => sum + num(e.amount), 0);

    const gross = rev - cogs;
    const net = gross - exp;
    const margin = rev > 0 ? ((net / rev) * 100).toFixed(1) : '0.0';

    return {
      id: branch.id,
      name: isAr ? branch.name : (branch.nameEn || branch.name),
      revenue: rev,
      cogs,
      grossProfit: gross,
      expenses: exp,
      netProfit: net,
      margin,
    };
  });

  const categoryLabels: Record<string, { ar: string; en: string }> = {
    RENT: { ar: 'الإيجارات والمقار', en: 'Rent & Facilities' },
    SALARIES: { ar: 'المرتبات والأجور', en: 'Salaries & Wages' },
    UTILITIES: { ar: 'المرافق (كهرباء ومياه وإنترنت)', en: 'Utilities & Telecom' },
    MARKETING: { ar: 'التسويق والإعلانات', en: 'Marketing & Ads' },
    MAINTENANCE: { ar: 'الصيانة والتجهيزات', en: 'Maintenance & Repairs' },
    SHIPPING: { ar: 'الشحن والتوصيل', en: 'Logistics & Shipping' },
    PACKAGING: { ar: 'التعبئة والتغليف', en: 'Packaging & Bags' },
    OTHER: { ar: 'مصروفات تشغيلية أخرى', en: 'Other Operating Expenses' },
  };

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-black text-slate-100">
            <PieChart className="w-6 h-6 text-emerald-400" />
            {L('قائمة الأرباح والخسائر (P&L Income Statement)', 'Profit & Loss Statement (P&L)')}
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            {L(
              'البيان المالي الشامل: الإيرادات، تكلفة البضاعة المباعة (COGS)، المصروفات التشغيلية، وصافي الربح المحقق.',
              'Comprehensive financial summary: Gross revenue, COGS, operating expenses, and net profit margins.'
            )}
          </p>
        </div>
      </div>

      {/* Top Level KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="glass-panel p-4 rounded-2xl border border-slate-800 space-y-1">
          <p className="text-xs text-slate-400 font-semibold">{L('إجمالي الإيرادات', 'Total Revenue')}</p>
          <p className="text-2xl font-black text-slate-100">
            {totalRevenue.toLocaleString()} <span className="text-xs font-normal text-slate-500">{currencyLabel}</span>
          </p>
          <p className="text-[10px] text-slate-500">
            {L('POS:', 'POS:')} {posRevenue.toLocaleString()} | {L('أونلاين:', 'Online:')} {onlineRevenue.toLocaleString()}
          </p>
        </div>

        <div className="glass-panel p-4 rounded-2xl border border-slate-800 space-y-1">
          <p className="text-xs text-slate-400 font-semibold">{L('تكلفة البضاعة المباعة (COGS)', 'Cost of Goods Sold')}</p>
          <p className="text-2xl font-black text-amber-400">
            {totalCogs.toLocaleString()} <span className="text-xs font-normal text-slate-500">{currencyLabel}</span>
          </p>
          <p className="text-[10px] text-slate-500">{L('تكلفة التوريد الأصلية', 'Direct unit purchase cost')}</p>
        </div>

        <div className="glass-panel p-4 rounded-2xl border border-slate-800 space-y-1">
          <p className="text-xs text-slate-400 font-semibold flex items-center justify-between">
            <span>{L('إجمالي الربح (Gross Profit)', 'Gross Profit')}</span>
            <span className="text-xs font-bold text-emerald-400">{grossMargin}%</span>
          </p>
          <p className="text-2xl font-black text-emerald-400">
            {grossProfit.toLocaleString()} <span className="text-xs font-normal text-slate-500">{currencyLabel}</span>
          </p>
          <p className="text-[10px] text-slate-500">{L('قبل خصم المصروفات', 'Revenue minus COGS')}</p>
        </div>

        <div
          className={`glass-panel p-4 rounded-2xl border ${
            netProfit >= 0 ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-rose-500/30 bg-rose-500/5'
          } space-y-1`}
        >
          <p className="text-xs font-semibold flex items-center justify-between">
            <span className={netProfit >= 0 ? 'text-emerald-300' : 'text-rose-300'}>
              {L('صافي الربح النهائي (Net Profit)', 'Net Profit')}
            </span>
            <span className={`text-xs font-black ${netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {netMargin}%
            </span>
          </p>
          <p className={`text-2xl font-black ${netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {netProfit.toLocaleString()} <span className="text-xs font-normal text-slate-500">{currencyLabel}</span>
          </p>
          <p className="text-[10px] text-slate-400">
            {netProfit >= 0 ? L('أرباح تشغيلية صافية', 'Positive net margin') : L('عجز تشغيلي', 'Operating deficit')}
          </p>
        </div>
      </div>

      {/* Main Income Statement Table */}
      <div className="glass-panel rounded-3xl border border-slate-800 overflow-hidden p-6 space-y-6">
        <h2 className="text-sm font-extrabold text-slate-100 flex items-center gap-2 border-b border-slate-800 pb-3">
          <FileSpreadsheet className="w-4 h-4 text-blue-400" />
          {L('تفصيل بنود قائمة الدخل', 'Income Statement Line Items')}
        </h2>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <tbody className="divide-y divide-slate-800/80">
              {/* Revenue */}
              <tr className="bg-slate-900/60 font-bold">
                <td className="py-3 px-4 text-slate-200">{L('1. الإيرادات التشغيلية (Operating Revenue)', '1. Operating Revenue')}</td>
                <td className="py-3 px-4 text-end text-slate-200 font-mono text-sm">{totalRevenue.toLocaleString()} {currencyLabel}</td>
                <td className="py-3 px-4 text-end text-slate-400 font-mono">100.0%</td>
              </tr>
              <tr className="text-slate-400">
                <td className="py-2 px-8">{L('— مبيعات نقاط البيع بالفروع (POS Sales)', '— In-store POS Sales')}</td>
                <td className="py-2 px-4 text-end font-mono">{posRevenue.toLocaleString()} {currencyLabel}</td>
                <td className="py-2 px-4 text-end font-mono">
                  {totalRevenue > 0 ? ((posRevenue / totalRevenue) * 100).toFixed(1) : 0}%
                </td>
              </tr>
              <tr className="text-slate-400">
                <td className="py-2 px-8">{L('— مبيعات المتجر الإلكتروني (Online Orders)', '— E-Commerce Orders')}</td>
                <td className="py-2 px-4 text-end font-mono">{onlineRevenue.toLocaleString()} {currencyLabel}</td>
                <td className="py-2 px-4 text-end font-mono">
                  {totalRevenue > 0 ? ((onlineRevenue / totalRevenue) * 100).toFixed(1) : 0}%
                </td>
              </tr>

              {/* COGS */}
              <tr className="bg-slate-900/60 font-bold">
                <td className="py-3 px-4 text-slate-200">{L('2. تكلفة المبيعات (Cost of Goods Sold - COGS)', '2. Cost of Goods Sold')}</td>
                <td className="py-3 px-4 text-end text-amber-400 font-mono text-sm">({totalCogs.toLocaleString()}) {currencyLabel}</td>
                <td className="py-3 px-4 text-end text-slate-400 font-mono">
                  {totalRevenue > 0 ? ((totalCogs / totalRevenue) * 100).toFixed(1) : 0}%
                </td>
              </tr>

              {/* Gross Profit */}
              <tr className="bg-emerald-950/20 font-black border-y border-emerald-500/20">
                <td className="py-3.5 px-4 text-emerald-400 text-sm">{L('إجمالي الربح التجاري (Gross Profit)', 'Gross Profit')}</td>
                <td className="py-3.5 px-4 text-end text-emerald-400 font-mono text-base font-black">
                  {grossProfit.toLocaleString()} {currencyLabel}
                </td>
                <td className="py-3.5 px-4 text-end text-emerald-400 font-mono text-sm">{grossMargin}%</td>
              </tr>

              {/* Expenses */}
              <tr className="bg-slate-900/60 font-bold">
                <td className="py-3 px-4 text-slate-200">{L('3. المصروفات التشغيلية (Operating Expenses)', '3. Operating Expenses')}</td>
                <td className="py-3 px-4 text-end text-rose-400 font-mono text-sm">({totalExpenses.toLocaleString()}) {currencyLabel}</td>
                <td className="py-3 px-4 text-end text-slate-400 font-mono">
                  {totalRevenue > 0 ? ((totalExpenses / totalRevenue) * 100).toFixed(1) : 0}%
                </td>
              </tr>
              {Object.entries(expensesByCategory).map(([cat, amt]) => {
                const label = categoryLabels[cat] || { ar: cat, en: cat };
                return (
                  <tr key={cat} className="text-slate-400">
                    <td className="py-2 px-8">— {isAr ? label.ar : label.en}</td>
                    <td className="py-2 px-4 text-end font-mono text-rose-400/90">{amt.toLocaleString()} {currencyLabel}</td>
                    <td className="py-2 px-4 text-end font-mono">
                      {totalRevenue > 0 ? ((amt / totalRevenue) * 100).toFixed(1) : 0}%
                    </td>
                  </tr>
                );
              })}

              {/* Net Profit */}
              <tr
                className={`font-black text-sm border-t-2 ${
                  netProfit >= 0
                    ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                    : 'bg-rose-950/40 border-rose-500/40 text-rose-300'
                }`}
              >
                <td className="py-4 px-4 font-black">
                  {L('صافي الربح التشغيلي النهائي (Net Operating Profit)', 'Net Operating Profit')}
                </td>
                <td className="py-4 px-4 text-end font-mono text-lg font-black">
                  {netProfit.toLocaleString()} {currencyLabel}
                </td>
                <td className="py-4 px-4 text-end font-mono text-base font-black">{netMargin}%</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Per Branch Performance Breakdown */}
      <div className="glass-panel rounded-3xl border border-slate-800 overflow-hidden p-6 space-y-4">
        <h2 className="text-sm font-extrabold text-slate-100 flex items-center gap-2 border-b border-slate-800 pb-3">
          <Building2 className="w-4 h-4 text-purple-400" />
          {L('تحليل الأرباح والخسائر حسب الفروع', 'P&L Breakdown by Branch')}
        </h2>

        <div className="overflow-x-auto">
          <table className="w-full text-xs min-w-[680px]">
            <thead className="bg-slate-950/60 text-slate-400 border-b border-slate-800">
              <tr>
                <th className="py-2.5 px-4 text-start font-semibold">{L('الفرع', 'Branch')}</th>
                <th className="py-2.5 px-4 text-end font-semibold">{L('الإيراد', 'Revenue')}</th>
                <th className="py-2.5 px-4 text-end font-semibold">{L('تكلفة البضاعة', 'COGS')}</th>
                <th className="py-2.5 px-4 text-end font-semibold">{L('إجمالي الربح', 'Gross Profit')}</th>
                <th className="py-2.5 px-4 text-end font-semibold">{L('المصروفات', 'Expenses')}</th>
                <th className="py-2.5 px-4 text-end font-semibold">{L('صافي الربح', 'Net Profit')}</th>
                <th className="py-2.5 px-4 text-end font-semibold">{L('الهامش %', 'Margin %')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {branchBreakdown.map((b) => (
                <tr key={b.id} className="hover:bg-slate-900/40">
                  <td className="py-3 px-4 font-bold text-slate-200">{b.name}</td>
                  <td className="py-3 px-4 text-end font-mono text-slate-300">{b.revenue.toLocaleString()} {currencyLabel}</td>
                  <td className="py-3 px-4 text-end font-mono text-amber-400">{b.cogs.toLocaleString()} {currencyLabel}</td>
                  <td className="py-3 px-4 text-end font-mono text-emerald-400 font-bold">{b.grossProfit.toLocaleString()} {currencyLabel}</td>
                  <td className="py-3 px-4 text-end font-mono text-rose-400">{b.expenses.toLocaleString()} {currencyLabel}</td>
                  <td
                    className={`py-3 px-4 text-end font-mono font-black ${
                      b.netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {b.netProfit.toLocaleString()} {currencyLabel}
                  </td>
                  <td className="py-3 px-4 text-end font-mono font-bold text-slate-300">{b.margin}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
