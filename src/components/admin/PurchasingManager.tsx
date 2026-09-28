'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { usePathname, useRouter } from '@/i18n/routing';
import { Plus, Search, PackageSearch } from 'lucide-react';
import { Modal, StatusBadge, ActionButton, apiFetch } from './ui';
import { useToast } from '@/components/Toast';
import { inputCls, Button, NumberField } from '@/components/ui/foundation';
import Pagination from './Pagination';
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
  page,
  totalPages,
  statusFilter,
  selectedSupplierId,
}: {
  suppliers: SupplierOpt[];
  branches: BranchOpt[];
  purchaseOrders: PoRow[];
  totalCount: number;
  page: number;
  totalPages: number;
  statusFilter: string;
  selectedSupplierId: string;
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
  const buildUrl = (next: { page?: number; status?: string; supplierId?: string }) => {
    const params = new URLSearchParams();
    const status = next.status !== undefined ? next.status : statusFilter;
    const supplier = next.supplierId !== undefined ? next.supplierId : selectedSupplierId;
    if (status) params.set('status', status);
    if (supplier) params.set('supplierId', supplier);
    if ((next.page ?? 1) > 1) params.set('page', String(next.page ?? 1));
    const qs = params.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  };

  const navigate = (next: { page?: number; status?: string; supplierId?: string }) =>
    router.push(buildUrl({ page: 1, ...next }));

  const statusBtn = (value: string, active: boolean) =>
    `min-h-[44px] px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
      active
        ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
        : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200'
    }`;

  const total = lines.reduce((sum, line) => sum + line.quantityOrdered * line.unitCost, 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => navigate({ status: '' })} className={statusBtn('', statusFilter === '')}>
            {L('الكل', 'All')} ({totalCount})
          </button>
          {STATUS_FILTERS.map((value) => (
            <button key={value} onClick={() => navigate({ status: value })} className={statusBtn(value, statusFilter === value)}>
              {t(`status_${value}`)}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="sr-only" htmlFor="po-supplier">{L('تصفية حسب المورد', 'Filter by supplier')}</label>
          <select
            id="po-supplier"
            value={selectedSupplierId}
            onChange={(e) => navigate({ supplierId: e.target.value })}
            className="min-h-[44px] rounded-xl border border-slate-700 bg-slate-900 px-2 text-xs text-slate-200"
          >
            <option value="">{L('كل الموردين', 'All suppliers')}</option>
            {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <Button onClick={() => setShowNew(true)} variant="primary">
            <Plus className="w-4 h-4" />
            {t('newPurchaseOrder')}
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        {purchaseOrders.length === 0 && <div className="text-center text-xs text-slate-500 py-8">{t('noData')}</div>}
        {purchaseOrders.map((po) => (
          <div key={po.id} className="p-4 rounded-2xl bg-slate-900 border border-slate-800 text-xs space-y-2">
            <div className="flex flex-wrap justify-between items-center gap-2">
              <span className="font-extrabold text-amber-400">{po.poNumber}</span>
              <StatusBadge value={po.status} />
            </div>
            <div className="text-slate-300">{L('المورد', 'Supplier')}: {po.supplier.name}</div>
            <div className="text-slate-400">
              {po.items.map((i) => `${pName(i.product)} (${i.quantityReceived}/${i.quantityOrdered})`).join(isAr ? '، ' : ', ')}
            </div>
            <div className="flex flex-wrap justify-between items-center gap-2 pt-1">
              <span className="font-black text-slate-100">{money(po.totalAmount)}</span>
              <div className="flex flex-wrap gap-2">
                {po.status === 'DRAFT' && (
                  <ActionButton
                    onAction={async () => { await apiFetch(`/api/admin/purchase-orders/${po.id}`, 'PATCH', { action: 'confirm' }); router.refresh(); }}
                    confirmMessage={isAr ? `تأكيد أمر التوريد ${po.poNumber}؟` : `Confirm PO ${po.poNumber}?`}
                    className="min-h-[44px] px-4 py-2 rounded-xl bg-blue-600/20 border border-blue-500/40 text-blue-300 font-bold text-xs"
                  >
                    {isAr ? 'تأكيد المسودة' : 'Confirm draft'}
                  </ActionButton>
                )}
                {po.status === 'SUBMITTED' && (
                  <ActionButton
                    onAction={async () => { await apiFetch(`/api/admin/purchase-orders/${po.id}`, 'PATCH', { action: 'cancel' }); router.refresh(); }}
                    confirmMessage={isAr ? `إلغاء أمر التوريد ${po.poNumber}؟` : `Cancel PO ${po.poNumber}?`}
                    className="min-h-[44px] px-4 py-2 rounded-xl bg-rose-600/20 hover:bg-rose-700 border border-rose-500/40 text-rose-400 hover:text-white font-bold text-xs"
                  >
                    {t('status_CANCELLED')}
                  </ActionButton>
                )}
                {/* Receiving and supplier returns are owned by the GRN and returns
                    pages. This page used to embed a second copy of both flows,
                    which let the same order be received through two different
                    forms with different validation. */}
                {(po.status === 'SUBMITTED' || po.status === 'PARTIALLY_RECEIVED') && (
                  <a
                    href={`${pathname}/../receiving`}
                    className="min-h-[44px] inline-flex items-center px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 font-bold text-xs"
                  >
                    {L('الاستلام من صفحة الاستلام', 'Receive on the GRN page')}
                  </a>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {totalCount > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <span className="text-[11px] font-bold text-slate-400">
            {L(`${totalCount} أمر توريد`, `${totalCount} purchase orders`)}
          </span>
          {totalPages > 1 && (
            <Pagination
              page={page}
              totalPages={totalPages}
              onPageChange={(next) => router.push(buildUrl({ page: next }))}
            />
          )}
        </div>
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
