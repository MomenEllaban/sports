'use client';

import React from 'react';
import { Download, Filter, ChevronLeft, ChevronRight } from 'lucide-react';
import { useLocale } from 'next-intl';
import { usePathname, useRouter } from '@/i18n/routing';
import { Button } from '@/components/ui/foundation';
import type { ReportRow, ReportType } from '@/lib/reports/data';

type Props = {
  type: ReportType;
  rows: ReportRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  branches: Array<{ id: string; name: string; nameEn: string | null }>;
  filters: { from: string; to: string; branch: string; q: string };
};

function money(value: number) { return value.toLocaleString(undefined, { maximumFractionDigits: 2 }); }

export default function ReportTableClient({ type, rows, total, page, pageSize, totalPages, branches, filters }: Props) {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname() || `/admin/reports/${type}`;
  const isAr = locale === 'ar';
  const [from, setFrom] = React.useState(filters.from);
  const [to, setTo] = React.useState(filters.to);
  const [branch, setBranch] = React.useState(filters.branch);
  const [q, setQ] = React.useState(filters.q);

  const navigate = (next: Record<string, string>) => {
    const params = new URLSearchParams();
    const merged = { from, to, branch, q, ...next };
    Object.entries(merged).forEach(([key, value]) => { if (value) params.set(key, value); });
    router.push(`${pathname}?${params.toString()}`);
  };
  const exportUrl = () => {
    const params = new URLSearchParams({ from, to, pageSize: String(pageSize), ...(branch ? { branch } : {}), ...(q ? { q } : {}) });
    return `/api/admin/reports/${type}/export?${params.toString()}`;
  };

  return <div className="space-y-4">
    <form onSubmit={(event) => { event.preventDefault(); navigate({ page: '1' }); }} className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-6 gap-3 text-xs">
      <div><label className="block font-bold text-slate-400 mb-1" htmlFor={`${type}-from`}>{isAr ? 'من' : 'From'}</label><input id={`${type}-from`} type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="min-h-[44px] w-full rounded-xl border border-slate-700 bg-slate-900 px-2" /></div>
      <div><label className="block font-bold text-slate-400 mb-1" htmlFor={`${type}-to`}>{isAr ? 'إلى' : 'To'}</label><input id={`${type}-to`} type="date" value={to} onChange={(e) => setTo(e.target.value)} className="min-h-[44px] w-full rounded-xl border border-slate-700 bg-slate-900 px-2" /></div>
      <div><label className="block font-bold text-slate-400 mb-1" htmlFor={`${type}-branch`}>{isAr ? 'الفرع' : 'Branch'}</label><select id={`${type}-branch`} value={branch} onChange={(e) => setBranch(e.target.value)} className="min-h-[44px] w-full rounded-xl border border-slate-700 bg-slate-900 px-2"><option value="">{isAr ? 'كل الفروع' : 'All branches'}</option>{branches.map((item) => <option key={item.id} value={item.id}>{isAr ? item.name : item.nameEn || item.name}</option>)}</select></div>
      <div className="xl:col-span-2"><label className="block font-bold text-slate-400 mb-1" htmlFor={`${type}-q`}>{isAr ? 'بحث بالاسم/الباركود/SKU' : 'Search name/barcode/SKU'}</label><input id={`${type}-q`} value={q} onChange={(e) => setQ(e.target.value)} className="min-h-[44px] w-full rounded-xl border border-slate-700 bg-slate-900 px-2" /></div>
      <div className="flex items-end gap-2"><Button type="submit" variant="primary" className="flex-1"><Filter className="w-4 h-4" />{isAr ? 'تطبيق' : 'Apply'}</Button><a href={exportUrl()} className="inline-flex min-h-[44px] items-center gap-1 rounded-xl border border-slate-700 px-3 font-bold text-slate-200 hover:bg-slate-800" title={isAr ? 'تصدير بنفس الفلاتر' : 'Export with filters'}><Download className="w-4 h-4" /> CSV</a></div>
    </form>
    <div className="flex items-center justify-between text-xs text-slate-400"><span>{isAr ? `${total} نتيجة` : `${total} results`}</span><span>{isAr ? `صفحة ${page} من ${totalPages}` : `Page ${page} of ${totalPages}`}</span></div>
    <div className="app-scrollbar app-scrollbar-horizontal overflow-x-auto rounded-2xl border border-slate-800"><table className="w-full min-w-[1050px] text-xs text-start"><thead className="bg-slate-950 text-slate-400"><tr><th className="p-3">{isAr ? 'الصنف/المجموعة' : 'Item/Group'}</th><th className="p-3">SKU</th><th className="p-3">{isAr ? 'الباركود' : 'Barcode'}</th><th className="p-3">{isAr ? 'التصنيف' : 'Category'}</th><th className="p-3">{isAr ? 'الماركة' : 'Brand'}</th><th className="p-3">{isAr ? 'سعر الشراء' : 'Buy price'}</th><th className="p-3">{isAr ? 'سعر البيع' : 'Sell price'}</th><th className="p-3">{isAr ? 'الكمية' : 'Quantity'}</th><th className="p-3">{isAr ? 'الإيراد/القيمة' : 'Revenue/Value'}</th><th className="p-3">{isAr ? 'الربح' : 'Profit'}</th><th className="p-3">{isAr ? 'الفرع' : 'Branch'}</th></tr></thead><tbody className="divide-y divide-slate-800">{rows.map((row) => <tr key={row.id} className="hover:bg-slate-900/60"><td className="p-3"><div className="font-bold text-slate-100">{isAr ? row.nameAr : row.nameEn}</div>{row.status && <span className="text-[10px] text-amber-300">{row.status}</span>}</td><td className="p-3 font-mono text-blue-300" dir="ltr">{row.sku}</td><td className="p-3" dir="ltr">{row.barcode || '—'}</td><td className="p-3">{isAr ? row.category : row.categoryEn}</td><td className="p-3">{isAr ? row.brand : row.brandEn}</td><td className="p-3">{money(row.buyPrice)}</td><td className="p-3">{money(row.sellPrice)}</td><td className="p-3 font-bold">{row.quantity}</td><td className="p-3">{money(row.revenue || row.cost)}</td><td className={`p-3 font-black ${row.profit < 0 ? 'text-rose-300' : 'text-emerald-300'}`}>{money(row.profit)}</td><td className="p-3">{isAr ? row.branchName : row.branchNameEn}{Object.keys(row.branchQuantities).length > 1 && <div className="text-[10px] text-slate-500">{Object.entries(isAr ? row.branchQuantities : row.branchQuantitiesEn).map(([name, qty]) => `${name}: ${qty}`).join(isAr ? '، ' : ', ')}</div>}</td></tr>)}{rows.length === 0 && <tr><td colSpan={11} className="p-10 text-center text-slate-500">{isAr ? 'لا توجد نتائج' : 'No results'}</td></tr>}</tbody></table></div>
    <div className="flex justify-end gap-2"><button type="button" disabled={page <= 1} onClick={() => navigate({ page: String(page - 1) })} className="min-h-[44px] rounded-xl border border-slate-700 px-3 disabled:opacity-40"><ChevronRight className="w-4 h-4 inline" /></button><button type="button" disabled={page >= totalPages} onClick={() => navigate({ page: String(page + 1) })} className="min-h-[44px] rounded-xl border border-slate-700 px-3 disabled:opacity-40"><ChevronLeft className="w-4 h-4 inline" /></button></div>
  </div>;
}
