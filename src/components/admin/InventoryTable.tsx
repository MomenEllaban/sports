'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { getClientErrorMessage } from '@/lib/client-api';
import { apiFetch } from './ui';
import { inputCls, Pagination, Button } from '@/components/ui/foundation';

type View = 'stock' | 'movements' | 'alerts';

interface Column {
  key: string;
  label: string;
  align?: 'start' | 'center' | 'end';
  render?: (row: Record<string, unknown>) => React.ReactNode;
}

interface ListResponse {
  rows: Array<Record<string, unknown>>;
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

const MOVEMENT_TYPES = [
  'SALE',
  'RETURN',
  'RESTOCK',
  'ADJUSTMENT',
  'SALE_RETURN',
  'PURCHASE',
  'PURCHASE_RETURN',
  'TRANSFER_OUT',
  'TRANSFER_IN',
  'CYCLE_COUNT',
  'OPENING',
];

const STOCK_STATES = [
  { value: '', key: 'allStock' },
  { value: '1', key: 'inStock' },
  { value: '2', key: 'atOrBelowReorder' },
  { value: '3', key: 'outOfStock' },
];

const PAGE_SIZE = 25;

const number = (v: unknown) => (typeof v === 'number' ? v.toLocaleString('en-GB') : String(v ?? '—'));

/**
 * Shared server-paginated table for the inventory read endpoints. Filtering,
 * sorting, searching and paging all happen in the database, so this component
 * never holds a whole table in memory or recomputes a total in the browser.
 */
export default function InventoryTable({
  view,
  branches,
  showAdjust = false,
}: {
  view: View;
  branches: Array<{ id: string; name: string; nameEn: string }>;
  showAdjust?: boolean;
}) {
  const t = useTranslations('admin');
  const locale = useLocale();
  const isAr = locale === 'ar';
  const L = (ar: string, en: string) => (isAr ? ar : en);

  const [data, setData] = useState<ListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
  const [branchId, setBranchId] = useState('');
  const [type, setType] = useState('');
  const [stockState, setStockState] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
      if (query) params.set('q', query);
      if (branchId) params.set('branchId', branchId);
      if (view === 'movements') {
        if (type) params.set('type', type);
        if (from) params.set('from', from);
        if (to) params.set('to', to);
      }
      if (view === 'stock' && stockState) params.set('stockState', stockState);
      const res = await apiFetch<ListResponse>(`/api/admin/inventory/${view}?${params.toString()}`, 'GET');
      setData(res);
    } catch (e) {
      setError(getClientErrorMessage(e, t('operationFailed')));
    } finally {
      setLoading(false);
    }
  }, [page, query, branchId, type, stockState, from, to, view, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const resetPaging = () => setPage(1);

  const columns: Column[] =
    view === 'stock'
      ? [
          { key: 'sku', label: L('الكود', 'SKU') },
          {
            key: 'nameAr',
            label: L('الصنف', 'Item'),
            render: (r) => (
              <>
                <span className="font-bold text-slate-100">{isAr ? String(r.nameAr) : String(r.nameEn)}</span>
                {r.size || r.color ? (
                  <span className="text-slate-500"> · {[r.size, r.color].filter(Boolean).join(' / ')}</span>
                ) : null}
              </>
            ),
          },
          { key: 'categoryAr', label: L('التصنيف', 'Category'), render: (r) => (isAr ? String(r.categoryAr) : String(r.categoryEn)) },
          { key: 'branchName', label: L('الفرع', 'Branch'), render: (r) => (isAr ? String(r.branchName) : String(r.branchNameEn)) },
          { key: 'stockQuantity', label: L('الرصيد', 'On hand'), align: 'center', render: (r) => <span className="font-extrabold text-slate-100">{number(r.stockQuantity)}</span> },
          { key: 'reorderPoint', label: L('حد الطلب', 'Reorder point'), align: 'center' },
          {
            key: 'stockValue',
            label: L('قيمة المخزون', 'Stock value'),
            align: 'end',
            render: (r) => <span className="font-bold text-slate-300">{number(r.stockValue)}</span>,
          },
        ]
      : view === 'alerts'
        ? [
            { key: 'sku', label: L('الكود', 'SKU') },
            {
              key: 'nameAr',
              label: L('الصنف', 'Item'),
              render: (r) => <span className="font-bold text-slate-100">{isAr ? String(r.nameAr) : String(r.nameEn)}</span>,
            },
            { key: 'branchName', label: L('الفرع', 'Branch'), render: (r) => (isAr ? String(r.branchName) : String(r.branchNameEn)) },
            {
              key: 'stockQuantity',
              label: L('الرصيد', 'On hand'),
              align: 'center',
              render: (r) => (
                <span className={`font-extrabold ${r.isOut ? 'text-rose-400' : 'text-amber-400'}`}>{number(r.stockQuantity)}</span>
              ),
            },
            { key: 'reorderPoint', label: L('حد الطلب', 'Reorder point'), align: 'center' },
            { key: 'suggestedQuantity', label: L('الكمية المقترحة', 'Suggested qty'), align: 'center', render: (r) => <span className="font-bold text-emerald-400">{number(r.suggestedQuantity)}</span> },
            { key: 'shortfallValue', label: L('قيمة العجز', 'Shortfall value'), align: 'end', render: (r) => number(r.shortfallValue) },
          ]
        : [
            { key: 'createdAt', label: L('التاريخ', 'Date'), render: (r) => new Date(String(r.createdAt)).toLocaleString(isAr ? 'ar-EG' : 'en-GB') },
            { key: 'type', label: L('نوع الحركة', 'Type'), render: (r) => <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-400 font-bold text-[10px]">{String(r.type)}</span> },
            { key: 'sku', label: L('الكود', 'SKU') },
            {
              key: 'nameAr',
              label: L('الصنف', 'Item'),
              render: (r) => <span className="font-bold text-slate-100">{isAr ? String(r.nameAr) : String(r.nameEn)}</span>,
            },
            { key: 'branchName', label: L('الفرع', 'Branch'), render: (r) => (isAr ? String(r.branchName) : String(r.branchNameEn)) },
            {
              key: 'changeQuantity',
              label: L('التغيير', 'Change'),
              align: 'center',
              render: (r) => (
                <span className={`font-extrabold ${Number(r.changeQuantity) < 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                  {Number(r.changeQuantity) > 0 ? '+' : ''}
                  {number(r.changeQuantity)}
                </span>
              ),
            },
            { key: 'newQuantity', label: L('الرصيد الجديد', 'New balance'), align: 'center', render: (r) => <span className="font-bold text-slate-200">{number(r.newQuantity)}</span> },
            { key: 'referenceId', label: L('المرجع', 'Reference'), render: (r) => String(r.referenceId ?? '—') },
          ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              setQuery(q.trim());
              resetPaging();
            }
          }}
          onBlur={() => {
            setQuery(q.trim());
            resetPaging();
          }}
          placeholder={L('ابحث بالكود أو الاسم أو المرجع', 'Search by SKU, name or reference')}
          aria-label={L('بحث', 'Search')}
          className={`${inputCls} max-w-[280px]`}
        />
        {branches.length > 1 && (
          <select
            value={branchId}
            onChange={(e) => {
              setBranchId(e.target.value);
              resetPaging();
            }}
            aria-label={L('الفرع', 'Branch')}
            className={`${inputCls} max-w-[200px]`}
          >
            <option value="">{L('كل فروعي', 'All my branches')}</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {isAr ? b.name : b.nameEn}
              </option>
            ))}
          </select>
        )}
        {view === 'stock' && (
          <select
            value={stockState}
            onChange={(e) => {
              setStockState(e.target.value);
              resetPaging();
            }}
            aria-label={L('حالة المخزون', 'Stock state')}
            className={`${inputCls} max-w-[200px]`}
          >
            {STOCK_STATES.map((s) => (
              <option key={s.key} value={s.value}>
                {t(s.key)}
              </option>
            ))}
          </select>
        )}
        {view === 'movements' && (
          <>
            <select
              value={type}
              onChange={(e) => {
                setType(e.target.value);
                resetPaging();
              }}
              aria-label={L('نوع الحركة', 'Movement type')}
              className={`${inputCls} max-w-[190px]`}
            >
              <option value="">{L('كل الأنواع', 'All types')}</option>
              {MOVEMENT_TYPES.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
            <input
              type="date"
              value={from}
              max={to || undefined}
              onChange={(e) => {
                setFrom(e.target.value);
                resetPaging();
              }}
              aria-label={L('من تاريخ', 'From date')}
              className={`${inputCls} max-w-[160px]`}
            />
            <input
              type="date"
              value={to}
              min={from || undefined}
              onChange={(e) => {
                setTo(e.target.value);
                resetPaging();
              }}
              aria-label={L('إلى تاريخ', 'To date')}
              className={`${inputCls} max-w-[160px]`}
            />
          </>
        )}
        {showAdjust && (
          <Button variant="ghost" onClick={() => window.location.assign('/admin/inventory/count')}>
            {L('جرد وتسوية', 'Stocktake & reconcile')}
          </Button>
        )}
      </div>

      {error && (
        <div role="alert" className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs">
          {error}
        </div>
      )}

      <div className="app-scrollbar app-scrollbar-horizontal overflow-x-auto">
        <table className="w-full min-w-[720px] text-xs" aria-busy={loading}>
          <thead className="text-slate-400 bg-slate-950 border-b border-slate-800">
            <tr>
              {columns.map((c) => (
                <th key={c.key} className={`pb-2 ${c.align === 'center' ? 'text-center' : c.align === 'end' ? 'text-end' : 'text-start'}`}>
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {data?.rows.map((row) => (
              <tr key={String(row.id)} className="hover:bg-slate-900/50">
                {columns.map((c) => (
                  <td
                    key={c.key}
                    className={`py-2.5 ${c.align === 'center' ? 'text-center' : c.align === 'end' ? 'text-end' : 'text-start'}`}
                  >
                    {c.render ? c.render(row) : String(row[c.key] ?? '—')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!loading && (data?.rows.length ?? 0) === 0 && (
        <div className="text-center text-xs text-slate-500 py-8">{t('noData')}</div>
      )}

      {data && data.total > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-[11px] font-bold text-slate-400">
            {isAr ? `${data.total} سجل` : `${data.total} records`} · {isAr ? `صفحة ${data.page} من ${data.pageCount}` : `page ${data.page} of ${data.pageCount}`}
          </span>
          <Pagination page={data.page} totalPages={data.pageCount} onPageChange={setPage} />
        </div>
      )}
    </div>
  );
}
