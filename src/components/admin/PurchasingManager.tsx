'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { usePathname, useRouter, Link } from '@/i18n/routing';
import { Plus, Search, PackageSearch, X, ShoppingBag, Clock, Truck, CheckCircle2 } from 'lucide-react';
import { Modal, StatusBadge, ActionButton, apiFetch } from './ui';
import { useToast } from '@/components/Toast';
import { inputCls, Button, NumberField } from '@/components/ui/foundation';
import { TablePager, TABLE_PAGE_SIZE } from './tablePaging';
import { getClientErrorMessage } from '@/lib/client-api';

interface SupplierOpt { id: string; name: string; code: string }
interface BranchOpt { id: string; name: string; nameEn: string }
interface ProductOpt { id: string; nameAr: string; nameEn: string; sku: string; barcode: string | null; costPrice: number }
interface PoRow {
  id: string;
  poNumber: string;
  status: string;
  totalAmount: number;
  createdAt: string;
  supplier: { id: string; name: string };
  branch: BranchOpt;
  items: Array<{ id: string; quantityOrdered: number; quantityReceived: number; unitCost: number; product: ProductOpt }>;
}

/** A line keeps the label it was picked with, so the row survives the picker closing. */
interface PoLine {
  productId: string;
  label: string;
  sku: string;
  quantityOrdered: number;
  unitCost: number;
}

const STATUS_FILTERS = ['DRAFT', 'SUBMITTED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED'] as const;

export default function PurchasingManager({
  suppliers,
  branches,
  purchaseOrders,
  totalCount,
  totalAll,
  statusCounts,
  page,
  totalPages,
  statusFilter,
  selectedSupplierId,
  poQuery = '',
}: {
  suppliers: { id: string; name: string; code: string }[];
  branches: { id: string; name: string; nameEn: string | null }[];
  purchaseOrders: PoRow[];
  totalCount: number;
  /** Unfiltered total, so the "All" chip is not the status-filtered count. */
  totalAll: number;
  /** Per-status totals within the current supplier and search scope. */
  statusCounts: Record<string, number>;
  page: number;
  totalPages: number;
  statusFilter: string;
  selectedSupplierId: string;
  poQuery?: string;
}) {

  const t = useTranslations('admin');
  const locale = useLocale();
  const pathname = usePathname() || '';
  const router = useRouter();
  const { toast } = useToast();
  const isAr = locale === 'ar';
  const L = useCallback((ar: string, en: string) => (isAr ? ar : en), [isAr]);
  const money = (v: number) => `${v.toLocaleString()} ${L('ج.م', 'EGP')}`;

  const [showNew, setShowNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [supplierId, setSupplierId] = useState(suppliers[0]?.id || '');
  const [branchId, setBranchId] = useState(branches[0]?.id || '');
  const [lines, setLines] = useState<PoLine[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const [poNotes, setPoNotes] = useState('');
  // Seeded from the URL so the box matches the list after a reload or a
  // bookmarked search, and typed into locally between submits.
  const [q, setQ] = useState(poQuery);

  const [matches, setMatches] = useState<ProductOpt[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const searchSeq = useRef(0);

  const resetPoForm = useCallback(() => {
    setLines([]);
    setProductSearch('');
    setMatches([]);
    setPoNotes('');
    setFormError('');
  }, []);

  // Debounced typeahead. The page no longer ships the whole catalogue, so the
  // picker asks the server for a short list as the user types.
  useEffect(() => {
    const term = productSearch.trim();
    if (term.length < 2) {
      setMatches([]);
      setSearchError('');
      setSearching(false);
      return;
    }
    const seq = ++searchSeq.current;
    const timer = setTimeout(() => {
      setSearching(true);
      void (async () => {
        try {
          const data = (await apiFetch(
            `/api/admin/purchasing/products?query=${encodeURIComponent(term)}`,
            'GET',
          )) as { products: ProductOpt[] };
          if (seq === searchSeq.current) {
            setMatches(data.products ?? []);
            setSearchError('');
          }
        } catch (err) {
          if (seq === searchSeq.current) {
            setMatches([]);
            setSearchError(getClientErrorMessage(err, L('فشل البحث عن الأصناف', 'Product search failed')));
          }
        } finally {
          if (seq === searchSeq.current) setSearching(false);
        }
      })();
    }, 250);
    return () => clearTimeout(timer);
  }, [productSearch, L]);

  const pName = (p: { nameAr: string; nameEn: string }) => (isAr ? p.nameAr : p.nameEn);

  const addProduct = (product: ProductOpt) => {
    if (lines.some((line) => line.productId === product.id)) {
      setFormError(L('هذا الصنف مضاف بالفعل', 'This product is already added'));
      return;
    }
    setLines([
      ...lines,
      {
        productId: product.id,
        label: pName(product),
        sku: product.sku,
        quantityOrdered: 1,
        unitCost: product.costPrice,
      },
    ]);
    setProductSearch('');
    setMatches([]);
    setFormError('');
  };

  const submitPo = async (intent: 'draft' | 'confirm') => {
    if (!supplierId || !branchId || lines.length === 0) {
      setFormError(L('اختر المورد والفرع وأضف صنفًا واحدًا على الأقل', 'Choose supplier, branch, and at least one item'));
      return;
    }
    setSaving(true);
    setFormError('');
    try {
      await apiFetch('/api/admin/purchase-orders', 'POST', {
        intent,
        supplierId,
        branchId,
        notes: poNotes,
        items: lines.map((line) => ({
          productId: line.productId,
          quantityOrdered: line.quantityOrdered,
          unitCost: line.unitCost,
        })),
      });
      setShowNew(false);
      resetPoForm();
      toast(t('operationSuccess'), 'success');
      router.refresh();
    } catch (err: unknown) {
      const msg = getClientErrorMessage(err, t('operationFailed'));
      setFormError(msg);
      toast(msg, 'error');
    } finally {
      setSaving(false);
    }
  };

  /** One builder for every navigation, so filters survive a page change. */
  const buildUrl = (next: { page?: number; status?: string; supplierId?: string; q?: string }) => {
    const params = new URLSearchParams();
    const status = next.status !== undefined ? next.status : statusFilter;
    const supplier = next.supplierId !== undefined ? next.supplierId : selectedSupplierId;
    const q = next.q !== undefined ? next.q : poQuery;
    if (status) params.set('status', status);
    if (supplier) params.set('supplierId', supplier);
    if (q) params.set('q', q);
    if ((next.page ?? 1) > 1) params.set('page', String(next.page ?? 1));
    const qs = params.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  };

  const navigate = (next: { page?: number; status?: string; supplierId?: string; q?: string }) =>
    router.push(buildUrl({ page: 1, ...next }));

  // `aria-pressed` is not decoration: these are toggles for one filter slot, so
  // a screen reader has to be able to tell the active chip from the rest.
  const statusBtn = (value: string, active: boolean) =>
    `min-h-[44px] px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
      active
        ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
        : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200'
    }`;

  const total = lines.reduce((sum, line) => sum + line.quantityOrdered * line.unitCost, 0);

  const awaitingReceivingCount = (statusCounts['SUBMITTED'] ?? 0) + (statusCounts['PARTIALLY_RECEIVED'] ?? 0);
  const draftCount = statusCounts['DRAFT'] ?? 0;
  const receivedCount = statusCounts['RECEIVED'] ?? 0;

  return (
    <div className="space-y-6">
      {/* Executive Operational KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="p-4 rounded-2xl border border-slate-800 bg-slate-950/60 backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400">{L('إجمالي أوامر الشراء', 'Total POs')}</span>
            <div className="w-8 h-8 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
              <ShoppingBag className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-black text-slate-100">{totalAll.toLocaleString()}</div>
        </div>

        <div className="p-4 rounded-2xl border border-slate-800 bg-slate-950/60 backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400">{L('مسودات بانتظار التأكيد', 'Drafts pending')}</span>
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-black text-amber-300">{draftCount.toLocaleString()}</div>
        </div>

        <div className="p-4 rounded-2xl border border-slate-800 bg-slate-950/60 backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400">{L('شحنات قيد الاستلام', 'Awaiting receiving')}</span>
            <div className="w-8 h-8 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
              <Truck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-black text-cyan-300">{awaitingReceivingCount.toLocaleString()}</div>
        </div>

        <div className="p-4 rounded-2xl border border-slate-800 bg-slate-950/60 backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400">{L('أوامر مكتملة ومستلمة', 'Fully received')}</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-black text-emerald-300">{receivedCount.toLocaleString()}</div>
        </div>
      </div>

      {/* Main Filter & Action Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-2xl border border-slate-800/80 bg-slate-950/40">
        <div className="flex flex-wrap items-center gap-1.5" role="toolbar" aria-label={L('تصفية حسب الحالة', 'Filter by status')}>
          <button aria-pressed={statusFilter === ''} onClick={() => navigate({ status: '' })} className={statusBtn('', statusFilter === '')}>
            {L('الكل', 'All')} ({statusFilter ? totalAll : totalCount})
          </button>
          {STATUS_FILTERS.map((value) => (
            <button key={value} aria-pressed={statusFilter === value} onClick={() => navigate({ status: value })} className={statusBtn(value, statusFilter === value)}>
              {t(`status_${value}`)} ({statusCounts[value] ?? 0})
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Submits on Enter rather than on every keystroke: the list is server
              paginated, so each keystroke would be a round trip. */}
          <form
            onSubmit={(e) => { e.preventDefault(); navigate({ q: q.trim() }); }}
            className="relative"
            role="search"
          >
            <label className="sr-only" htmlFor="po-search">{L('ابحث برقم أمر التوريد', 'Search by PO number')}</label>
            <Search className="w-4 h-4 text-slate-500 absolute start-3 top-1/2 -translate-y-1/2" aria-hidden="true" />
            <input
              id="po-search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={L('رقم أمر التوريد', 'PO number')}
              autoComplete="off"
              className="min-h-[44px] w-48 rounded-xl border border-slate-700/80 bg-slate-900/90 ps-9 pe-8 text-xs text-slate-200 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none transition-colors"
            />
            {poQuery && (
              <button
                type="button"
                onClick={() => { setQ(''); navigate({ q: '' }); }}
                aria-label={L('مسح البحث', 'Clear search')}
                title={L('مسح البحث', 'Clear search')}
                className="absolute end-1.5 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-slate-200"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </form>
          <label className="sr-only" htmlFor="po-supplier">{L('تصفية حسب المورد', 'Filter by supplier')}</label>
          <select
            id="po-supplier"
            value={selectedSupplierId}
            onChange={(e) => navigate({ supplierId: e.target.value })}
            className="min-h-[44px] rounded-xl border border-slate-700/80 bg-slate-900/90 px-3 text-xs text-slate-200 focus:border-blue-500 focus:outline-none transition-colors"
          >
            <option value="">{L('كل الموردين', 'All suppliers')}</option>
            {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <Button onClick={() => setShowNew(true)} variant="primary" className="shadow-lg shadow-blue-500/25">
            <Plus className="w-4 h-4" />
            {t('newPurchaseOrder')}
          </Button>
        </div>
      </div>

      <div className="space-y-3.5">
        {purchaseOrders.length === 0 && (
          <div className="text-center text-xs text-slate-400 py-12 space-y-3 rounded-2xl border border-dashed border-slate-800 bg-slate-950/30">
            <div className="w-12 h-12 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center mx-auto text-slate-500">
              <PackageSearch className="w-6 h-6" />
            </div>
            <p className="font-bold text-slate-300">
              {statusFilter || poQuery ? L('لا توجد أوامر توريد مطابقة للفلاتر الحالية', 'No purchase orders match the current filters') : t('noData')}
            </p>
            {(statusFilter || poQuery) && (
              <button
                onClick={() => navigate({ status: '', q: '', supplierId: '' })}
                className="min-h-[44px] px-5 py-2 rounded-xl border border-slate-700 bg-slate-800 text-slate-200 font-bold hover:bg-slate-700 transition-colors shadow-sm"
              >
                {L('مسح كل الفلاتر', 'Clear all filters')}
              </button>
            )}
          </div>
        )}

        {purchaseOrders.map((po) => {
          const totalOrdered = po.items.reduce((sum, item) => sum + item.quantityOrdered, 0);
          const totalReceived = po.items.reduce((sum, item) => sum + item.quantityReceived, 0);
          const pctReceived = totalOrdered > 0 ? Math.min(100, Math.round((totalReceived / totalOrdered) * 100)) : 0;

          return (
            <div
              key={po.id}
              className="p-5 rounded-2xl bg-slate-900/90 hover:bg-slate-900 border border-slate-800/80 hover:border-slate-700 text-xs space-y-3 transition-all duration-200 shadow-sm"
            >
              <div className="flex flex-wrap justify-between items-center gap-2">
                <div className="flex items-center gap-2.5">
                  <span className="font-extrabold text-amber-400 text-sm tracking-wide font-mono bg-amber-400/10 px-2.5 py-1 rounded-lg border border-amber-400/20">
                    {po.poNumber}
                  </span>
                  <StatusBadge value={po.status} />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-base font-black text-slate-100">{money(po.totalAmount)}</span>
                </div>
              </div>

              {/* Crucial metadata for scanning */}
              <div className="flex flex-wrap items-center gap-x-6 gap-y-1.5 text-slate-400 border-t border-slate-800/60 pt-2.5">
                <span className="inline-flex items-center gap-1.5">
                  <span className="text-slate-500">{L('المورد', 'Supplier')}:</span>
                  <span className="text-slate-200 font-bold">{po.supplier.name}</span>
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="text-slate-500">{L('الفرع', 'Branch')}:</span>
                  <span className="text-slate-200 font-bold">{isAr ? po.branch?.name || '—' : po.branch?.nameEn || '—'}</span>
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="text-slate-500">{L('التاريخ', 'Date')}:</span>
                  <span className="text-slate-200 font-bold">{new Date(po.createdAt).toLocaleDateString(isAr ? 'ar-EG' : 'en-GB')}</span>
                </span>
              </div>

              {/* Items & Fulfillment Progress */}
              <div className="bg-slate-950/60 rounded-xl p-3 border border-slate-800/60 space-y-2">
                <div className="flex flex-wrap justify-between items-center text-[11px] gap-2">
                  <span className="font-bold text-slate-400">{L('أصناف الطلب', 'Order items')}</span>
                  {totalOrdered > 0 && (
                    <span className="text-slate-400 font-medium">
                      {L(`استلام ${totalReceived} من ${totalOrdered} قطعة (${pctReceived}%)`, `Received ${totalReceived} of ${totalOrdered} units (${pctReceived}%)`)}
                    </span>
                  )}
                </div>

                {totalOrdered > 0 && (
                  <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-500 ${
                        pctReceived === 100
                          ? 'bg-emerald-400'
                          : pctReceived > 0
                            ? 'bg-cyan-400'
                            : 'bg-slate-700'
                      }`}
                      style={{ width: `${pctReceived}%` }}
                    />
                  </div>
                )}

                <ul className="space-y-1 text-slate-400 pt-1">
                  {po.items.slice(0, 4).map((i) => (
                    <li key={i.id} className="flex flex-wrap items-baseline justify-between gap-2 text-[11px]">
                      <span className="text-slate-300 font-medium">{pName(i.product)}</span>
                      <span className="font-mono text-slate-400">
                        {L(`مستلم ${i.quantityReceived} من ${i.quantityOrdered}`, `received ${i.quantityReceived} of ${i.quantityOrdered}`)}
                      </span>
                    </li>
                  ))}
                  {po.items.length > 4 && (
                    <li className="text-[11px] font-bold text-slate-500 pt-0.5">
                      {L(`+ ${po.items.length - 4} صنف آخر`, `+ ${po.items.length - 4} more items`)}
                    </li>
                  )}
                </ul>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap justify-end items-center gap-2 pt-1 border-t border-slate-800/40">
                {po.status === 'DRAFT' && (
                  <ActionButton
                    onAction={async () => { await apiFetch(`/api/admin/purchase-orders/${po.id}`, 'PATCH', { action: 'confirm' }); router.refresh(); }}
                    confirmMessage={isAr ? `تأكيد أمر التوريد ${po.poNumber}؟` : `Confirm PO ${po.poNumber}?`}
                    className="min-h-[44px] px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md shadow-blue-600/20 transition-all"
                  >
                    {isAr ? 'تأكيد المسودة' : 'Confirm draft'}
                  </ActionButton>
                )}
                {po.status === 'SUBMITTED' && (
                  <ActionButton
                    onAction={async () => { await apiFetch(`/api/admin/purchase-orders/${po.id}`, 'PATCH', { action: 'cancel' }); router.refresh(); }}
                    confirmMessage={isAr ? `إلغاء أمر التوريد ${po.poNumber}؟` : `Cancel PO ${po.poNumber}?`}
                    className="min-h-[44px] px-4 py-2 rounded-xl bg-rose-600/15 hover:bg-rose-600/30 border border-rose-500/30 text-rose-400 font-bold text-xs transition-colors"
                  >
                    {t('status_CANCELLED')}
                  </ActionButton>
                )}
                {(po.status === 'SUBMITTED' || po.status === 'PARTIALLY_RECEIVED') && (
                  <Link
                    href="/admin/purchasing/receiving"
                    className="min-h-[44px] inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 hover:text-white font-bold text-xs transition-colors"
                  >
                    <Truck className="w-3.5 h-3.5 text-cyan-400" />
                    <span>{L('الاستلام من صفحة الاستلام', 'Receive on the GRN page')}</span>
                  </Link>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {totalCount > 0 && (
        <TablePager
          page={page}
          totalPages={totalPages}
          total={totalCount}
          pageSize={TABLE_PAGE_SIZE}
          onPageChange={(next) => router.push(buildUrl({ page: next }))}
        />
      )}

      {showNew && (
        <Modal title={t('newPurchaseOrder')} onClose={() => setShowNew(false)}>
          <form onSubmit={(event) => { event.preventDefault(); void submitPo('confirm'); }} className="space-y-4 text-xs">
            {formError && <div role="alert" className="status-danger rounded-xl border p-3 font-bold">{formError}</div>}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-400 mb-1">{L('المورد *', 'Supplier *')}</label>
                <select required value={supplierId} onChange={(e) => setSupplierId(e.target.value)} className={inputCls}>
                  {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-400 mb-1">{L('الفرع المستلِم *', 'Receiving Branch *')}</label>
                <select required value={branchId} onChange={(e) => setBranchId(e.target.value)} className={inputCls}>
                  {branches.map((b) => <option key={b.id} value={b.id}>{isAr ? b.name : b.nameEn}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label htmlFor="po-product-search" className="block text-[11px] font-bold text-slate-400 mb-1">
                {L('ابحث عن صنف بالاسم أو SKU أو الباركود', 'Search product by name, SKU, or barcode')}
              </label>
              <div className="relative">
                <Search className="w-4 h-4 text-slate-500 absolute start-3 top-1/2 -translate-y-1/2" aria-hidden="true" />
                <input
                  id="po-product-search"
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  placeholder={L('اكتب حرفين على الأقل ثم اختر الصنف...', 'Type at least two characters...')}
                  className={`${inputCls} ps-9`}
                  autoComplete="off"
                />
              </div>
              {searchError && <p role="alert" className="mt-1.5 text-[11px] font-bold text-rose-400">{searchError}</p>}
              <div className="app-scrollbar mt-2 max-h-40 overflow-y-auto space-y-1" role="listbox" aria-label={L('نتائج الأصناف', 'Product results')}>
                {searching && <p className="px-2 py-1.5 text-[11px] text-slate-500">{t('loading')}</p>}
                {!searching && productSearch.trim().length >= 2 && matches.length === 0 && (
                  <p className="px-2 py-1.5 text-[11px] text-slate-500 flex items-center gap-1.5">
                    <PackageSearch className="w-3.5 h-3.5" aria-hidden="true" />
                    {L('لا توجد أصناف مطابقة', 'No matching products')}
                  </p>
                )}
                {!searching && matches.map((product) => (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() => addProduct(product)}
                    className="w-full min-h-[44px] flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950 px-3 text-start hover:border-blue-500/50"
                    role="option"
                    aria-selected={lines.some((line) => line.productId === product.id)}
                  >
                    <span className="font-bold text-slate-200">{pName(product)}</span>
                    <span className="text-[10px] text-slate-500" dir="ltr">{product.sku}{product.barcode ? ` · ${product.barcode}` : ''}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              {lines.map((line, idx) => (
                <div key={line.productId} className="rounded-xl border border-slate-800 bg-slate-950 p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-slate-200">{line.label} <span className="text-[10px] text-slate-500" dir="ltr">{line.sku}</span></span>
                    <button
                      type="button"
                      onClick={() => setLines(lines.filter((_, i) => i !== idx))}
                      className="min-h-[44px] px-2 text-rose-300"
                      aria-label={L('حذف الصنف', 'Remove item')}
                    >
                      ×
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <NumberField
                      min={1} step={1}
                      value={line.quantityOrdered}
                      onChange={(value) => setLines(lines.map((item, i) => (i === idx ? { ...item, quantityOrdered: value } : item)))}
                      placeholder={L('الكمية', 'Qty')}
                    />
                    <NumberField
                      min={0} step={0.01}
                      value={line.unitCost}
                      onChange={(value) => setLines(lines.map((item, i) => (i === idx ? { ...item, unitCost: value } : item)))}
                      placeholder={L('التكلفة', 'Cost')}
                    />
                  </div>
                  <div className="text-[11px] text-slate-400">
                    {L('إجمالي السطر', 'Line total')}: {(line.quantityOrdered * line.unitCost).toFixed(2)} {L('ج.م', 'EGP')}
                  </div>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between rounded-xl border border-blue-500/30 bg-blue-500/10 p-3 font-bold text-blue-200">
              <span>{L('إجمالي الأمر', 'PO total')}</span>
              <span>{total.toFixed(2)} {L('ج.م', 'EGP')}</span>
            </div>
            <div>
              <label htmlFor="po-notes" className="block text-[11px] font-bold text-slate-400 mb-1">{L('ملاحظات', 'Notes')}</label>
              <textarea id="po-notes" rows={2} value={poNotes} onChange={(e) => setPoNotes(e.target.value)} className={`${inputCls} resize-none`} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button type="button" disabled={saving} onClick={() => void submitPo('draft')} className="min-h-[44px] rounded-xl border border-slate-600 text-slate-200 font-bold hover:bg-slate-800 disabled:opacity-60">
                {L('حفظ كمسودة', 'Save draft')}
              </button>
              <button type="submit" disabled={saving} className="min-h-[44px] rounded-xl bg-blue-600 text-white font-extrabold hover:bg-blue-500 disabled:opacity-60">
                {saving ? t('loading') : (isAr ? 'تأكيد الأمر' : 'Confirm PO')}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
