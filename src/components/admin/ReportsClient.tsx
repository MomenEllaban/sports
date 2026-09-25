'use client';

import React, { useEffect, useState } from 'react';
import { useLocale } from 'next-intl';
import { Download, Award, Layers, Users, Truck, Skull } from 'lucide-react';
import { DataTable, Button } from '@/components/ui/foundation';
import { apiRequest } from '@/lib/client-api';

interface Summary {
  productProfit: Array<{ id: string; nameAr: string; qty: number; revenue: number; cost: number; profit: number }>;
  branchProfit: Array<{ id: string; name: string; revenue: number; orders: number; sales: number }>;
  cashierPerf: Array<{ id: string; name: string; revenue: number; sales: number; discount: number }>;
  deadStock: Array<{ productId: string; nameAr: string; branch: string; qty: number; value: number }>;
  deadDays: number;
  shipping: Array<{ provider: string; total: number; delivered: number; returned: number; cod: number }>;
}

function csv(name: string, headers: string[], rows: Array<Array<string | number>>) {
  const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  const content = '\uFEFF' + [headers.map(esc).join(','), ...rows.map((r) => r.map(esc).join(','))].join('\n');
  const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `${name}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ReportsClient({ branches }: { branches: Array<{ id: string; name: string }> }) {
  const locale = useLocale();
  const isAr = locale === 'ar';
  const [from, setFrom] = useState(() => new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10));
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [branch, setBranch] = useState('');
  const [data, setData] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const p = new URLSearchParams({ from, to });
      if (branch) p.set('branch', branch);
      const data = await apiRequest<Summary>(`/api/admin/reports/summary?${p}`, { errorKey: 'admin:reports:summary' });
      setData(data);
    } catch {
      setError('تعذر الاتصال');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-6">
      {/* Filters */}
      <form onSubmit={(e) => { e.preventDefault(); load(); }} className="bg-slate-900/60 border border-slate-800 rounded-card p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2 text-xs">
        <div>
          <label htmlFor="rep-from" className="block font-bold text-slate-400 mb-1">{isAr ? 'من' : 'From'}</label>
          <input id="rep-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-full min-h-[44px] p-2.5 rounded-xl bg-slate-900 border border-slate-700" />
        </div>
        <div>
          <label htmlFor="rep-to" className="block font-bold text-slate-400 mb-1">{isAr ? 'إلى' : 'To'}</label>
          <input id="rep-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-full min-h-[44px] p-2.5 rounded-xl bg-slate-900 border border-slate-700" />
        </div>
        <div>
          <label htmlFor="rep-branch" className="block font-bold text-slate-400 mb-1">{isAr ? 'الفرع' : 'Branch'}</label>
          <select id="rep-branch" value={branch} onChange={(e) => setBranch(e.target.value)} className="w-full min-h-[44px] p-2.5 rounded-xl bg-slate-900 border border-slate-700">
            <option value="">{isAr ? 'كل الفروع' : 'All Branches'}</option>
            {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>
        <div className="col-span-2 md:col-span-2 flex items-end">
          <Button type="submit" variant="primary" disabled={loading} className="w-full">
            {loading ? '...' : (isAr ? 'عرض التقرير' : 'View Report')}
          </Button>
        </div>
      </form>

      {error && <p role="alert" className="text-xs font-bold text-rose-400">{error}</p>}
      {loading && <p className="text-xs text-slate-500">{isAr ? 'جاري بناء التقرير...' : 'Generating report...'}</p>}

      {data && (
        <>
          <section className="space-y-3">
            <div className="flex justify-between items-center">
              <h3 className="font-extrabold text-sm flex items-center gap-2"><Award className="w-4 h-4 text-amber-400" /> {isAr ? 'ربحية المنتجات' : 'Product Profitability'}</h3>
              <button onClick={() => csv('product-profit', ['product', 'qty', 'revenue', 'cost', 'profit'], data.productProfit.map((p) => [p.nameAr, p.qty, p.revenue, p.cost, p.profit]))} className="min-h-[44px] px-3 rounded-xl bg-slate-800 text-[11px] font-bold flex items-center gap-1">
                <Download className="w-3.5 h-3.5" /> CSV
              </button>
            </div>
            <DataTable
              rows={data.productProfit.slice(0, 10).map((p) => ({ ...p }))}
              emptyTitle={isAr ? 'لا مبيعات في الفترة' : 'No sales in period'}
              columns={[
                { key: 'nameAr', header: isAr ? 'المنتج' : 'Product', render: (r) => <span className="font-bold">{r.nameAr}</span> },
                { key: 'qty', header: isAr ? 'الكمية' : 'Qty', render: (r) => r.qty },
                { key: 'revenue', header: isAr ? 'الإيراد' : 'Revenue', render: (r) => r.revenue.toLocaleString() },
                { key: 'profit', header: isAr ? 'الربح' : 'Profit', render: (r) => <span className={`font-black ${r.profit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{r.profit.toLocaleString()}</span> },
              ]}
            />
          </section>

          <section className="space-y-3">
            <h3 className="font-extrabold text-sm flex items-center gap-2"><Layers className="w-4 h-4 text-blue-400" /> {isAr ? 'ربحية الفروع' : 'Branch Profitability'}</h3>
            <div className="grid sm:grid-cols-2 gap-3">
              {data.branchProfit.map((b) => (
                <div key={b.id} className="p-4 rounded-2xl bg-slate-900 border border-slate-800 text-xs space-y-1">
                  <div className="font-black text-slate-100">{b.name}</div>
                  <div className="flex justify-between text-slate-400"><span>{isAr ? 'الإيراد:' : 'Revenue:'}</span><span className="font-bold text-emerald-400">{b.revenue.toLocaleString()} {isAr ? 'ج.م' : 'EGP'}</span></div>
                  <div className="flex justify-between text-slate-400"><span>{isAr ? 'طلبات/فواتير:' : 'Orders/Sales:'}</span><span>{b.orders}/{b.sales}</span></div>
                </div>
              ))}
            </div>
          </section>

          <section className="space-y-3">
            <div className="flex justify-between items-center">
              <h3 className="font-extrabold text-sm flex items-center gap-2"><Users className="w-4 h-4 text-purple-400" /> {isAr ? 'أداء الكاشير' : 'Cashier Performance'}</h3>
              <button onClick={() => csv('cashier-perf', ['cashier', 'sales', 'revenue', 'discount'], data.cashierPerf.map((c) => [c.name, c.sales, c.revenue, c.discount]))} className="min-h-[44px] px-3 rounded-xl bg-slate-800 text-[11px] font-bold flex items-center gap-1">
                <Download className="w-3.5 h-3.5" /> CSV
              </button>
            </div>
            <DataTable
              rows={data.cashierPerf.map((c) => ({ ...c }))}
              emptyTitle={isAr ? 'لا مبيعات كاشير في الفترة' : 'No cashier sales in period'}
              columns={[
                { key: 'name', header: isAr ? 'الكاشير' : 'Cashier', render: (r) => <span className="font-bold">{r.name}</span> },
                { key: 'sales', header: isAr ? 'فواتير' : 'Invoices', render: (r) => r.sales },
                { key: 'revenue', header: isAr ? 'الإيراد' : 'Revenue', render: (r) => r.revenue.toLocaleString() },
                { key: 'discount', header: isAr ? 'خصومات' : 'Discounts', render: (r) => <span className="text-amber-400">{r.discount.toLocaleString()}</span> },
              ]}
            />
          </section>

          <section className="space-y-3">
            <h3 className="font-extrabold text-sm flex items-center gap-2"><Truck className="w-4 h-4 text-teal-400" /> {isAr ? 'أداء الشحن' : 'Shipping Performance'}</h3>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {data.shipping.map((s) => (
                <div key={s.provider} className="p-4 rounded-2xl bg-slate-900 border border-slate-800 text-xs space-y-1">
                  <div className="font-black text-slate-100">{s.provider}</div>
                  <div className="flex justify-between text-slate-400"><span>{isAr ? 'شحنات:' : 'Shipments:'}</span><span>{s.total}</span></div>
                  <div className="flex justify-between text-slate-400"><span>{isAr ? 'تم تسليمها:' : 'Delivered:'}</span><span className="text-emerald-400 font-bold">{s.delivered}</span></div>
                  <div className="flex justify-between text-slate-400"><span>{isAr ? 'مرتجع:' : 'Returned:'}</span><span className="text-rose-400 font-bold">{s.returned}</span></div>
                  <div className="flex justify-between text-slate-400"><span>COD:</span><span>{s.cod.toLocaleString()}</span></div>
                </div>
              ))}
              {data.shipping.length === 0 && <p className="text-xs text-slate-500">{isAr ? 'لا شحنات في الفترة.' : 'No shipments in period.'}</p>}
            </div>
          </section>

          <section className="space-y-3">
            <div className="flex justify-between items-center">
              <h3 className="font-extrabold text-sm flex items-center gap-2"><Skull className="w-4 h-4 text-slate-400" /> {isAr ? `الأصناف الميتة (بلا بيع ${data.deadDays} يوم)` : `Dead Stock (0 sales in ${data.deadDays} days)`}</h3>
              <button onClick={() => csv('dead-stock', ['product', 'branch', 'qty', 'cost-value'], data.deadStock.map((d) => [d.nameAr, d.branch, d.qty, d.value]))} className="min-h-[44px] px-3 rounded-xl bg-slate-800 text-[11px] font-bold flex items-center gap-1">
                <Download className="w-3.5 h-3.5" /> CSV
              </button>
            </div>
            <DataTable
              rows={data.deadStock.slice(0, 15).map((d) => ({ id: `${d.productId}`, ...d }))}
              emptyTitle={isAr ? 'لا أصناف ميتة — المخزون يتحرك' : 'No dead stock — inventory moving well'}
              columns={[
                { key: 'nameAr', header: isAr ? 'الصنف' : 'Item', render: (r) => <span className="font-bold">{r.nameAr}</span> },
                { key: 'branch', header: isAr ? 'الفرع' : 'Branch', render: (r) => r.branch },
                { key: 'qty', header: isAr ? 'الكمية' : 'Qty', render: (r) => r.qty },
                { key: 'value', header: isAr ? 'القيمة (تكلفة)' : 'Cost Value', render: (r) => <span className="text-rose-400 font-bold">{r.value.toLocaleString()}</span> },
              ]}
            />
          </section>
        </>
      )}
    </div>
  );
}
