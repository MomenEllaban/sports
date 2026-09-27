'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useLocale } from 'next-intl';
import { apiFetch } from './ui';
import { Button } from '@/components/ui/foundation';
import Pagination from './Pagination';

type NamedRef = { id: string; nameAr: string; nameEn: string };
type Line = {
  id: string;
  productId: string;
  skuSnapshot: string;
  nameArSnapshot: string;
  nameEnSnapshot: string;
  expectedQuantity: number;
  countedQuantity: number | null;
  varianceQuantity: number | null;
  reasonCode: string | null;
  notes: string | null;
  unitCost: number | string;
  status: string;
  product: { id: string; category: { id: string; nameAr: string; nameEn: string } | null; brand: { id: string; nameAr: string; nameEn: string } | null } | null;
};
type Session = {
  id: string;
  stocktakeNumber: string;
  branchId: string;
  status: string;
  notes: string | null;
  createdAt: string;
  startedAt?: string;
  branch: { id: string; name: string; nameEn: string | null };
  _count: { lines: number };
};
type Summary = {
  lineCount: number;
  countedLineCount: number;
  varianceLineCount: number;
  varianceQuantity: number;
  varianceValue?: number;
};
type Report = { session: Session; lines: Line[]; summary: Summary };
type Dirty = { id: string; countedQuantity: number | null; reasonCode: string | null; notes: string | null };

const PAGE_SIZE = 25;

/** Reason codes must match the `StocktakeReason` enum used by the API. */
const REASONS: Array<{ value: string; ar: string; en: string }> = [
  { value: 'DAMAGE', ar: 'تالف', en: 'Damaged' },
  { value: 'THEFT', ar: 'فاقد/سرقة', en: 'Missing' },
  { value: 'EXPIRY', ar: 'منتهي الصلاحية', en: 'Expired' },
  { value: 'MISCOUNT', ar: 'خطأ في العد', en: 'Miscount' },
  { value: 'RECEIVING_ERROR', ar: 'خطأ في الاستلام', en: 'Receiving error' },
  { value: 'OTHER', ar: 'أخرى', en: 'Other' },
];

export default function StocktakeClient({
  branches,
  categories,
  brands,
  sessions: initialSessions,
}: {
  branches: Array<{ id: string; name: string; nameEn: string }>;
  categories: NamedRef[];
  brands: NamedRef[];
  sessions: Session[];
}) {
  const locale = useLocale();
  const isAr = locale === 'ar';
  const L = (ar: string, en: string) => (isAr ? ar : en);

  const [sessions, setSessions] = useState(initialSessions);
  const [branchId, setBranchId] = useState(branches[0]?.id || '');
  const [selectedId, setSelectedId] = useState(initialSessions[0]?.id || '');
  const [report, setReport] = useState<Report | null>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [dirty, setDirty] = useState<Record<string, Dirty>>({});

  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [brand, setBrand] = useState('');
  const [onlyVariance, setOnlyVariance] = useState(false);
  const [onlyUncounted, setOnlyUncounted] = useState(false);
  const [page, setPage] = useState(1);

  const [scopeCategoryId, setScopeCategoryId] = useState('');
  const [scopeBrandId, setScopeBrandId] = useState('');
  const [onlyStocked, setOnlyStocked] = useState(true);
  const [scopePreview, setScopePreview] = useState<number | null>(null);
  const [notes, setNotes] = useState('');

  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const statusLabels: Record<string, string> = {
    DRAFT: L('مسودة', 'Draft'),
    APPROVED: L('معتمد', 'Approved'),
    CANCELLED: L('ملغي', 'Cancelled'),
  };

  const load = async (id: string) => {
    if (!id) return;
    setLoading(true);
    setError('');
    try {
      const data = (await apiFetch(`/api/admin/stocktakes/${id}`, 'GET')) as Report;
      setSelectedId(id);
      setReport(data);
      setLines(data.lines);
      setNotes(data.session.notes || '');
      setDirty({});
      setPage(1);
    } catch (err) {
      setError(err instanceof Error ? err.message : L('تعذر تحميل الجلسة', 'Unable to load session'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedId && !report) void load(selectedId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  // Branch-scoped preview: how many lines a new session would open with.
  useEffect(() => {
    if (!branchId) {
      setScopePreview(null);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => {
      void (async () => {
        try {
          const data = (await apiFetch('/api/admin/stocktakes', 'PUT', {
            branchId,
            categoryId: scopeCategoryId || undefined,
            brandId: scopeBrandId || undefined,
            onlyStockedItems: onlyStocked,
          })) as { lineCount: number };
          if (!controller.signal.aborted) setScopePreview(data.lineCount);
        } catch {
          if (!controller.signal.aborted) setScopePreview(null);
        }
      })();
    }, 250);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [branchId, scopeCategoryId, scopeBrandId, onlyStocked]);

  const create = async () => {
    if (!branchId) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const data = (await apiFetch('/api/admin/stocktakes', 'POST', {
        branchId,
        categoryId: scopeCategoryId || undefined,
        brandId: scopeBrandId || undefined,
        onlyStockedItems: onlyStocked,
        notes,
      })) as { stocktake: Session };
      setSessions((current) => [data.stocktake, ...current]);
      setReport(null);
      await load(data.stocktake.id);
      setNotes('');
      setMessage(L('تم إنشاء جلسة الجرد', 'Stocktake session created'));
    } catch (err) {
      setError(err instanceof Error ? err.message : L('تعذر إنشاء الجلسة', 'Unable to create session'));
    } finally {
      setBusy(false);
    }
  };

  const updateLine = (id: string, patch: Partial<Line>) => {
    setLines((current) => current.map((line) => (line.id === id ? { ...line, ...patch } : line)));
    setDirty((current) => {
      const current2 = current[id];
      const next: Dirty = {
        id,
        countedQuantity: patch.countedQuantity !== undefined ? patch.countedQuantity : (current2?.countedQuantity ?? null),
        reasonCode: patch.reasonCode !== undefined ? patch.reasonCode : (current2?.reasonCode ?? null),
        notes: patch.notes !== undefined ? patch.notes : (current2?.notes ?? null),
      };
      return { ...current, [id]: next };
    });
  };

  const dirtyCount = Object.keys(dirty).length;

  const saveDraft = async () => {
    if (!selectedId) return;
    const payload = Object.values(dirty);
    if (payload.length === 0) {
      setMessage(L('لا توجد تغييرات للحفظ', 'Nothing to save'));
      return;
    }
    setBusy(true);
    setError('');
    try {
      await apiFetch(`/api/admin/stocktakes/${selectedId}/lines`, 'PATCH', { lines: payload });
      // Re-read so expected quantities, status and the server-side summary are
      // the source of truth rather than the locally patched rows.
      await load(selectedId);
      setMessage(L('تم حفظ المسودة', 'Draft saved'));
    } catch (err) {
      setError(err instanceof Error ? err.message : L('فشل حفظ المسودة', 'Draft save failed'));
    } finally {
      setBusy(false);
    }
  };

  const uncountedCount = lines.filter((line) => line.countedQuantity === null).length;
  const approve = async () => {
    if (!selectedId) return;
    if (dirtyCount > 0) {
      setError(L('احفظ المسودة أولًا قبل الاعتماد', 'Save the draft before approving'));
      return;
    }
    if (uncountedCount > 0) {
      setError(
        L(
          `تبقى ${uncountedCount} صنف دون عد. اضبط العد على "الفعلي" أو استخدم تصفية "غير المعدود" للوصول إليه.`,
          `${uncountedCount} items are still uncounted. Set a counted quantity or use the "uncounted" filter to reach them.`,
        ),
      );
      return;
    }
    if (!window.confirm(L('سيتم اعتماد الجرد وتطبيق كل الفروقات على المخزون. هل تريد المتابعة؟', 'Approving applies every variance to stock. Continue?'))) {
      return;
    }
    setBusy(true);
    setError('');
    try {
      await apiFetch(`/api/admin/stocktakes/${selectedId}/approve`, 'POST', {});
      setMessage(L('تم اعتماد الجرد وتطبيق الفروقات', 'Stocktake approved and applied'));
      await load(selectedId);
    } catch (err) {
      setError(err instanceof Error ? err.message : L('فشل الاعتماد', 'Approval failed'));
    } finally {
      setBusy(false);
    }
  };

  // Filtering runs off `line.product`, which the report already ships, so this
  // no longer scans the product catalogue for every line (previously O(n*m)).
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return lines.filter((line) => {
      if (term) {
        const haystack = [line.skuSnapshot, line.nameArSnapshot, line.nameEnSnapshot];
        if (!haystack.some((value) => value.toLowerCase().includes(term))) return false;
      }
      if (category && line.product?.category?.id !== category) return false;
      if (brand && line.product?.brand?.id !== brand) return false;
      if (onlyVariance && (line.varianceQuantity || 0) === 0) return false;
      if (onlyUncounted && line.countedQuantity !== null) return false;
      return true;
    });
  }, [lines, search, category, brand, onlyVariance, onlyUncounted]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pagedRows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  /** Quotes every cell and neutralises spreadsheet formula injection. */
  const csvCell = (value: unknown) => {
    const raw = value === null || value === undefined ? '' : String(value);
    const safe = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
    return `"${safe.replace(/"/g, '""')}"`;
  };

  const exportReport = () => {
    if (!report) return;
    const header = ['sku', 'name_ar', 'name_en', 'expected', 'counted', 'variance', 'reason', 'notes', 'status'];
    const content =
      '﻿' +
      [
        header.map(csvCell).join(','),
        // The whole session is exported, not just the visible page.
        ...report.lines.map((line) =>
          [
            line.skuSnapshot,
            line.nameArSnapshot,
            line.nameEnSnapshot,
            line.expectedQuantity,
            line.countedQuantity,
            line.varianceQuantity,
            line.reasonCode,
            line.notes,
            line.status,
          ]
            .map(csvCell)
            .join(','),
        ),
      ].join('\n');
    const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `${report.session.stocktakeNumber}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const isDraft = report?.session.status === 'DRAFT';
  const progress = report && report.summary.lineCount > 0
    ? Math.round((report.summary.countedLineCount / report.summary.lineCount) * 100)
    : 0;

  return (
    <div className="space-y-4">
      {/* ---- Session creation ------------------------------------------------ */}
      <section className="grid grid-cols-1 gap-3 rounded-2xl border border-slate-800 bg-slate-900/60 p-4 lg:grid-cols-4">
        <div>
          <label htmlFor="stk-branch" className="mb-1 block text-[11px] font-bold text-slate-400">
            {L('الفرع', 'Branch')}
          </label>
          <select
            id="stk-branch"
            value={branchId}
            onChange={(e) => setBranchId(e.target.value)}
            className="min-h-[44px] w-full rounded-xl border border-slate-700 bg-slate-950 px-2 text-xs"
          >
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {isAr ? branch.name : branch.nameEn}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="stk-cat" className="mb-1 block text-[11px] font-bold text-slate-400">
            {L('التصنيف', 'Category')}
          </label>
          <select
            id="stk-cat"
            value={scopeCategoryId}
            onChange={(e) => setScopeCategoryId(e.target.value)}
            className="min-h-[44px] w-full rounded-xl border border-slate-700 bg-slate-950 px-2 text-xs"
          >
            <option value="">{L('كل التصنيفات', 'All categories')}</option>
            {categories.map((item) => (
              <option key={item.id} value={item.id}>
                {isAr ? item.nameAr : item.nameEn}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="stk-brand" className="mb-1 block text-[11px] font-bold text-slate-400">
            {L('الماركة', 'Brand')}
          </label>
          <select
            id="stk-brand"
            value={scopeBrandId}
            onChange={(e) => setScopeBrandId(e.target.value)}
            className="min-h-[44px] w-full rounded-xl border border-slate-700 bg-slate-950 px-2 text-xs"
          >
            <option value="">{L('كل الماركات', 'All brands')}</option>
            {brands.map((item) => (
              <option key={item.id} value={item.id}>
                {isAr ? item.nameAr : item.nameEn}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="stk-notes" className="mb-1 block text-[11px] font-bold text-slate-400">
            {L('ملاحظات الجلسة', 'Session notes')}
          </label>
          <input
            id="stk-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="min-h-[44px] w-full rounded-xl border border-slate-700 bg-slate-950 px-2 text-xs"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 lg:col-span-4">
          <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-300">
            <input
              type="checkbox"
              checked={onlyStocked}
              onChange={(e) => setOnlyStocked(e.target.checked)}
              className="h-4 w-4 rounded border-slate-600 bg-slate-900"
            />
            {L('الأصناف المخزونة فقط', 'Only items with stock')}
          </label>
          <Button onClick={create} disabled={busy || !branchId || scopePreview === 0} variant="primary">
            {busy ? L('جاري الإنشاء...', 'Creating...') : L('إنشاء جلسة جرد', 'Create stocktake session')}
          </Button>
          {scopePreview !== null && (
            <span className="text-xs text-slate-400">
              {L(
                `سيتم فتح ${scopePreview} سطر.`,
                `This will open ${scopePreview} line${scopePreview === 1 ? '' : 's'}.`,
              )}
            </span>
          )}
        </div>
      </section>

      {/* ---- Session picker ------------------------------------------------- */}
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-[260px] flex-1">
          <label htmlFor="stk-session" className="mb-1 block text-[11px] font-bold text-slate-400">
            {L('جلسات الجرد', 'Stocktake sessions')}
          </label>
          <select
            id="stk-session"
            value={selectedId}
            onChange={(e) => void load(e.target.value)}
            className="min-h-[44px] w-full rounded-xl border border-slate-700 bg-slate-950 px-2 text-xs"
          >
            <option value="">{L('اختر جلسة', 'Choose session')}</option>
            {sessions.map((item) => (
              <option key={item.id} value={item.id}>
                {item.stocktakeNumber} — {isAr ? item.branch.name : item.branch.nameEn} —{' '}
                {statusLabels[item.status] || item.status}
              </option>
            ))}
          </select>
        </div>
        {report && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex min-h-[44px] items-center rounded-xl border border-slate-700 px-3 text-xs text-slate-300">
              {L('الأسطر', 'Lines')}: {report.summary.lineCount} · {L('الفروقات', 'Variance')}:{' '}
              <span className={report.summary.varianceQuantity === 0 ? 'text-slate-300' : 'text-amber-400'}>
                {report.summary.varianceQuantity > 0 ? '+' : ''}
                {report.summary.varianceQuantity}
              </span>
            </span>
            <button
              onClick={exportReport}
              className="min-h-[44px] rounded-xl border border-slate-700 px-3 text-xs font-bold text-slate-200 transition-colors hover:bg-slate-800"
            >
              {L('تصدير CSV', 'Export CSV')}
            </button>
          </div>
        )}
      </div>

      {message && (
        <p role="status" className="status-success rounded-xl border p-3 text-xs font-bold">
          {message}
        </p>
      )}
      {error && (
        <p role="alert" className="status-danger rounded-xl border p-3 text-xs font-bold">
          {error}
        </p>
      )}

      {!selectedId && !loading && (
        <p className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 text-center text-xs text-slate-500">
          {L('اختر جلسة الجرد لعرض أسطرها، أو أنشئ جلسة جديدة.', 'Choose a session to view its lines, or create a new one.')}
        </p>
      )}

      {loading && (
        <p className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 text-center text-xs text-slate-500">
          {L('جاري التحميل...', 'Loading...')}
        </p>
      )}

      {report && !loading && (
        <>
          {/* ---- Progress + actions ------------------------------------- */}
          <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-800 bg-slate-900/60 p-3">
            <div className="min-w-[180px] flex-1">
              <div className="mb-1 flex items-center justify-between text-[11px] font-bold text-slate-400">
                <span>
                  {L('التقدم', 'Progress')}: {report.summary.countedLineCount} / {report.summary.lineCount}
                </span>
                <span>{progress}%</span>
              </div>
              <div
                role="progressbar"
                aria-valuenow={progress}
                aria-valuemin={0}
                aria-valuemax={100}
                className="h-2 w-full overflow-hidden rounded-full bg-slate-800"
              >
                <div
                  className={progress === 100 ? 'h-full bg-emerald-500' : 'h-full bg-blue-500'}
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
            {isDraft ? (
              <div className="flex flex-wrap items-center gap-2">
                <Button onClick={saveDraft} disabled={busy || dirtyCount === 0} variant="secondary">
                  {busy
                    ? L('جاري الحفظ...', 'Saving...')
                    : L(
                        dirtyCount > 0 ? `حفظ ${dirtyCount} تعديل` : L('حفظ المسودة', 'Save draft'),
                        dirtyCount > 0 ? `Save ${dirtyCount} change${dirtyCount === 1 ? '' : 's'}` : 'Save draft',
                      )}
                </Button>
                <Button onClick={approve} disabled={busy || lines.length === 0} variant="primary">
                  {L('اعتماد وتطبيق الفروقات', 'Approve & apply')}
                </Button>
              </div>
            ) : (
              <span className="inline-flex min-h-[44px] items-center rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 text-xs font-bold text-emerald-400">
                {L('معتمد ومقفل', 'Approved & locked')}
              </span>
            )}
          </div>

          {/* ---- Filters ------------------------------------------------ */}
          <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-800 bg-slate-900/60 p-3">
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder={L('بحث بالاسم أو SKU', 'Search name or SKU')}
              aria-label={L('بحث في أسطر الجرد', 'Search stocktake lines')}
              className="min-h-[44px] flex-1 rounded-xl border border-slate-700 bg-slate-950 px-2 text-xs"
            />
            <select
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                setPage(1);
              }}
              aria-label={L('تصفية بالتصنيف', 'Filter by category')}
              className="min-h-[44px] rounded-xl border border-slate-700 bg-slate-950 px-2 text-xs"
            >
              <option value="">{L('كل التصنيفات', 'All categories')}</option>
              {categories.map((item) => (
                <option key={item.id} value={item.id}>
                  {isAr ? item.nameAr : item.nameEn}
                </option>
              ))}
            </select>
            <select
              value={brand}
              onChange={(e) => {
                setBrand(e.target.value);
                setPage(1);
              }}
              aria-label={L('تصفية بالماركة', 'Filter by brand')}
              className="min-h-[44px] rounded-xl border border-slate-700 bg-slate-950 px-2 text-xs"
            >
              <option value="">{L('كل الماركات', 'All brands')}</option>
              {brands.map((item) => (
                <option key={item.id} value={item.id}>
                  {isAr ? item.nameAr : item.nameEn}
                </option>
              ))}
            </select>
            <label className="flex cursor-pointer items-center gap-1.5 text-xs text-slate-300">
              <input
                type="checkbox"
                checked={onlyVariance}
                onChange={(e) => {
                  setOnlyVariance(e.target.checked);
                  setPage(1);
                }}
                className="h-4 w-4 rounded border-slate-600 bg-slate-900"
              />
              {L('الفروقات فقط', 'Variances only')}
            </label>
            <label className="flex cursor-pointer items-center gap-1.5 text-xs text-slate-300">
              <input
                type="checkbox"
                checked={onlyUncounted}
                onChange={(e) => {
                  setOnlyUncounted(e.target.checked);
                  setPage(1);
                }}
                className="h-4 w-4 rounded border-slate-600 bg-slate-900"
              />
              {L('غير المعدود', 'Uncounted')}
            </label>
          </div>

          {/* ---- Lines table ------------------------------------------- */}
          <div className="app-scrollbar app-scrollbar-horizontal overflow-x-auto rounded-2xl border border-slate-800">
            <table className="w-full min-w-[1040px] text-xs text-start">
              <thead className="bg-slate-950 text-slate-400">
                <tr>
                  <th className="p-3">SKU</th>
                  <th className="p-3">{L('الصنف', 'Item')}</th>
                  <th className="p-3">{L('التصنيف', 'Category')}</th>
                  <th className="p-3 text-end">{L('الكمية بالنظام', 'System qty')}</th>
                  <th className="p-3 text-end">{L('الكمية الفعلية', 'Counted qty')}</th>
                  <th className="p-3 text-end">{L('الفرق', 'Variance')}</th>
                  <th className="p-3">{L('السبب', 'Reason')}</th>
                  <th className="p-3">{L('ملاحظة', 'Note')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {pagedRows.map((line) => {
                  const counted = line.countedQuantity;
                  const variance = counted === null ? null : counted - line.expectedQuantity;
                  return (
                    <tr key={line.id} className={counted === null ? 'bg-slate-900/30' : undefined}>
                      <td className="p-3 font-mono text-blue-300">{line.skuSnapshot}</td>
                      <td className="p-3 font-bold text-slate-100">
                        {isAr ? line.nameArSnapshot : line.nameEnSnapshot}
                      </td>
                      <td className="p-3 text-slate-400">
                        {line.product?.category ? (isAr ? line.product.category.nameAr : line.product.category.nameEn) : '—'}
                      </td>
                      <td className="p-3 text-end text-slate-300">{line.expectedQuantity}</td>
                      <td className="p-3 text-end">
                        <input
                          type="number"
                          min="0"
                          step="1"
                          inputMode="numeric"
                          aria-label={`${L('الكمية الفعلية', 'Counted qty')} ${line.skuSnapshot}`}
                          className="w-24 rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-end text-xs text-slate-100"
                          value={counted ?? ''}
                          placeholder="—"
                          disabled={!isDraft}
                          onChange={(e) => {
                            const raw = e.target.value;
                            const next = raw === '' ? null : Number(raw);
                            updateLine(line.id, {
                              countedQuantity: next,
                              varianceQuantity: next === null ? null : next - line.expectedQuantity,
                            });
                          }}
                        />
                      </td>
                      <td
                        className={`p-3 text-end font-bold ${
                          variance === null
                            ? 'text-slate-600'
                            : variance === 0
                              ? 'text-slate-400'
                              : variance > 0
                                ? 'text-emerald-400'
                                : 'text-rose-400'
                        }`}
                      >
                        {variance === null ? '—' : variance > 0 ? `+${variance}` : variance}
                      </td>
                      <td className="p-3">
                        {isDraft ? (
                          <select
                            aria-label={`${L('السبب', 'Reason')} ${line.skuSnapshot}`}
                            className="min-h-[36px] w-full rounded-lg border border-slate-700 bg-slate-950 px-2 text-[11px]"
                            value={line.reasonCode || ''}
                            onChange={(e) => updateLine(line.id, { reasonCode: e.target.value || null })}
                          >
                            <option value="">—</option>
                            {REASONS.map((reason) => (
                              <option key={reason.value} value={reason.value}>
                                {isAr ? reason.ar : reason.en}
                              </option>
                            ))}
                          </select>
                        ) : (
                          (REASONS.find((r) => r.value === line.reasonCode)
                            ? isAr
                              ? REASONS.find((r) => r.value === line.reasonCode)!.ar
                              : REASONS.find((r) => r.value === line.reasonCode)!.en
                            : '—')
                        )}
                      </td>
                      <td className="p-3">
                        <input
                          type="text"
                          aria-label={`${L('ملاحظة', 'Note')} ${line.skuSnapshot}`}
                          className="w-full min-w-[140px] rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-[11px]"
                          value={line.notes || ''}
                          disabled={!isDraft}
                          onChange={(e) => updateLine(line.id, { notes: e.target.value || null })}
                        />
                      </td>
                    </tr>
                  );
                })}
                {pagedRows.length === 0 && (
                  <tr>
                    <td colSpan={8} className="p-10 text-center text-xs text-slate-500">
                      {L('لا توجد أسطر مطابقة', 'No matching lines')}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {filtered.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <span className="text-[11px] font-bold text-slate-400">
                {L(`${filtered.length} سطر`, `${filtered.length} line${filtered.length === 1 ? '' : 's'}`)}
              </span>
              <Pagination page={safePage} totalPages={totalPages} onPageChange={setPage} />
            </div>
          )}
        </>
      )}
    </div>
  );
}
