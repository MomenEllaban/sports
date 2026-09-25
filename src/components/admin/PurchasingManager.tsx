'use client';

import React, { useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { useRouter } from '@/i18n/routing';
import { Plus } from 'lucide-react';
import { Modal, StatusBadge, ActionButton, apiFetch } from './ui';
import { useToast } from '@/components/Toast';
import { inputCls, Button, NumberField } from '@/components/ui/foundation';
import Pagination from './Pagination';

interface SupplierOpt { id: string; name: string; code: string }
interface BranchOpt { id: string; name: string; nameEn: string }
interface ProductOpt { id: string; nameAr: string; nameEn: string; sku: string; barcode: string | null; costPrice: number }
interface PoRow {
  id: string;
  poNumber: string;
  status: string;
  totalAmount: number;
  supplier: { name: string };
  branch: BranchOpt;
  items: Array<{ id: string; quantityOrdered: number; quantityReceived: number; unitCost: number; product: ProductOpt }>;
}

export default function PurchasingManager({
  suppliers,
  branches,
  products,
  purchaseOrders,
}: {
  suppliers: SupplierOpt[];
  branches: BranchOpt[];
  products: ProductOpt[];
  purchaseOrders: PoRow[];
}) {
  const t = useTranslations('admin');
  const locale = useLocale();
  const router = useRouter();
  const { toast } = useToast();
  const isAr = locale === 'ar';
  const [showNew, setShowNew] = useState(false);
  const [receiving, setReceiving] = useState<PoRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [supplierId, setSupplierId] = useState(suppliers[0]?.id || '');
  const [branchId, setBranchId] = useState(branches[0]?.id || '');
  const [lines, setLines] = useState<Array<{ productId: string; quantityOrdered: number; unitCost: number }>>([]);
  const [productSearch, setProductSearch] = useState('');
  const [poNotes, setPoNotes] = useState('');
  const [receiveQty, setReceiveQty] = useState<Record<string, number>>({});
  // T13: supplier return modal state.
  const [returning, setReturning] = useState<PoRow | null>(null);
  const [returnItemId, setReturnItemId] = useState('');
  const [returnQty, setReturnQty] = useState(1);
  const [returnReason, setReturnReason] = useState('');
  const [returnError, setReturnError] = useState('');

  const [page, setPage] = useState(1);
  const PAGE_SIZE = 8;
  const totalPages = Math.max(1, Math.ceil(purchaseOrders.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pagedPOs = purchaseOrders.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const pName = (p: ProductOpt) => (isAr ? p.nameAr : p.nameEn);

  const addProduct = (product: ProductOpt) => {
    if (lines.some((line) => line.productId === product.id)) {
      setFormError(isAr ? 'هذا الصنف مضاف بالفعل' : 'This product is already added');
      return;
    }
    setLines([...lines, { productId: product.id, quantityOrdered: 1, unitCost: product.costPrice }]);
    setProductSearch('');
    setFormError('');
  };

  const resetPoForm = () => {
    setLines([]);
    setProductSearch('');
    setPoNotes('');
    setFormError('');
  };

  const submitPo = async (intent: 'draft' | 'confirm') => {
    if (!supplierId || !branchId || lines.length === 0) {
      setFormError(isAr ? 'اختر المورد والفرع وأضف صنفًا واحدًا على الأقل' : 'Choose supplier, branch, and at least one item');
      return;
    }
    setSaving(true);
    setFormError('');
    try {
      await apiFetch('/api/admin/purchase-orders', 'POST', { intent, supplierId, branchId, notes: poNotes, items: lines });
      setShowNew(false);
      resetPoForm();
      toast(t('operationSuccess'), 'success');
      router.refresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t('operationFailed');
      setFormError(msg);
      toast(msg, 'error');
    } finally {
      setSaving(false);
    }
  };

  const submitReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!returning || !returnItemId || returnQty < 1 || !returnReason.trim()) return;
    setSaving(true);
    setReturnError('');
    try {
      const item = returning.items.find((i) => i.id === returnItemId);
      await apiFetch(`/api/admin/purchase-orders/${returning.id}/return`, 'POST', {
        productId: item?.product.id,
        quantity: returnQty,
        reason: returnReason.trim(),
      });
      setReturning(null);
      setReturnReason('');
      toast(t('operationSuccess'), 'success');
      router.refresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t('operationFailed');
      setReturnError(msg);
    } finally {
      setSaving(false);
    }
  };

  const submitReceive = async (e: React.FormEvent) => {    e.preventDefault();
    if (!receiving) return;
    setSaving(true);
    setFormError('');
    try {
      const received = receiving.items.map((i) => ({ itemId: i.id, quantity: receiveQty[i.id] ?? 0 }));
      await apiFetch(`/api/admin/purchase-orders/${receiving.id}/receive`, 'POST', { received });
      setReceiving(null);
      setReceiveQty({});
      toast(t('operationSuccess'), 'success');
      router.refresh();
    } catch {
      const msg = t('operationFailed');
      setFormError(msg);
      toast(msg, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setShowNew(true)} variant="primary">
          <Plus className="w-4 h-4" />
          {t('newPurchaseOrder')}
        </Button>
      </div>

      <div className="space-y-3">
        {purchaseOrders.length === 0 && <div className="text-center text-xs text-slate-500 py-8">{t('noData')}</div>}
        {pagedPOs.map((po) => (
          <div key={po.id} className="p-4 rounded-2xl bg-slate-900 border border-slate-800 text-xs space-y-2">
            <div className="flex flex-wrap justify-between items-center gap-2">
              <span className="font-extrabold text-amber-400">{po.poNumber}</span>
              <StatusBadge value={po.status} />
            </div>
            <div className="text-slate-300">{isAr ? 'المورد' : 'Supplier'}: {po.supplier.name}</div>
            <div className="text-slate-400">
              {po.items.map((i) => `${pName(i.product)} (${i.quantityReceived}/${i.quantityOrdered})`).join('، ')}
            </div>
            <div className="flex justify-between items-center pt-1">
              <span className="font-black text-slate-100">{po.totalAmount.toLocaleString()} {isAr ? 'ج.م' : 'EGP'}</span>
              <div className="flex gap-2">
                {po.status === 'SUBMITTED' && (
                  <button
                    onClick={() => {
                      const init: Record<string, number> = {};
                      po.items.forEach((i) => { init[i.id] = i.quantityOrdered - i.quantityReceived; });
                      setReceiveQty(init);
                      setReceiving(po);
                    }}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition-all"
                  >
                    {isAr ? 'استلام بضاعة' : 'Receive goods'}
                  </button>
                )}
                {po.status === 'DRAFT' && (
                  <ActionButton
                    onAction={async () => { await apiFetch(`/api/admin/purchase-orders/${po.id}`, 'PATCH', { action: 'confirm' }); router.refresh(); }}
                    confirmMessage={isAr ? `تأكيد أمر التوريد ${po.poNumber}؟` : `Confirm PO ${po.poNumber}?`}
                    className="px-4 py-2 rounded-xl bg-blue-600/20 border border-blue-500/40 text-blue-300 font-bold text-xs"
                  >
                    {isAr ? 'تأكيد المسودة' : 'Confirm draft'}
                  </ActionButton>
                )}
                {po.status === 'SUBMITTED' && (
                  <ActionButton
                    onAction={async () => { await apiFetch(`/api/admin/purchase-orders/${po.id}`, 'PATCH', {}); router.refresh(); }}
                    confirmMessage={isAr ? `إلغاء أمر التوريد ${po.poNumber}؟` : `Cancel PO ${po.poNumber}?`}
                    className="px-4 py-2 rounded-xl bg-rose-600/20 hover:bg-rose-600 border border-rose-500/40 text-rose-400 hover:text-white font-bold text-xs"
                  >
                    {t('status_CANCELLED')}
                  </ActionButton>
                )}
                {po.status === 'RECEIVED' && po.items.some((i) => i.quantityReceived > 0) && (
                  <button
                    onClick={() => {
                      setReturning(po);
                      const first = po.items.find((i) => i.quantityReceived > 0);
                      setReturnItemId(first?.id || '');
                      setReturnQty(1);
                      setReturnReason('');
                      setReturnError('');
                    }}
                    className="min-h-[44px] px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 font-bold text-xs"
                  >
                    {isAr ? 'مرتجع مورد' : 'Supplier return'}
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {purchaseOrders.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <span className="text-[11px] font-bold text-slate-400">
            {isAr ? `${purchaseOrders.length} أمر توريد` : `${purchaseOrders.length} purchase orders`}
          </span>
          <Pagination page={safePage} totalPages={totalPages} onPageChange={setPage} />
        </div>
      )}

      {showNew && (
        <Modal title={t('newPurchaseOrder')} onClose={() => setShowNew(false)}>
          <form onSubmit={(event) => { event.preventDefault(); void submitPo('confirm'); }} className="space-y-4 text-xs">
            {formError && <div role="alert" className="status-danger rounded-xl border p-3 font-bold">{formError}</div>}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-400 mb-1">{isAr ? 'المورد *' : 'Supplier *'}</label>
                <select required value={supplierId} onChange={(e) => setSupplierId(e.target.value)} className={inputCls}>
                  {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-400 mb-1">{isAr ? 'الفرع المستلِم *' : 'Receiving Branch *'}</label>
                <select required value={branchId} onChange={(e) => setBranchId(e.target.value)} className={inputCls}>
                  {branches.map((b) => <option key={b.id} value={b.id}>{isAr ? b.name : b.nameEn}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-400 mb-1">{isAr ? 'ابحث عن صنف بالاسم أو SKU أو الباركود' : 'Search product by name, SKU, or barcode'}</label>
              <input value={productSearch} onChange={(e) => setProductSearch(e.target.value)} placeholder={isAr ? 'اكتب ثم اختر الصنف...' : 'Type then choose a product...'} className={inputCls} />
              <div className="app-scrollbar mt-2 max-h-40 overflow-y-auto space-y-1" role="listbox" aria-label={isAr ? 'نتائج الأصناف' : 'Product results'}>
                {products.filter((product) => {
                  const term = productSearch.trim().toLowerCase();
                  return !term || [product.nameAr, product.nameEn, product.sku, product.barcode || ''].some((value) => value.toLowerCase().includes(term));
                }).slice(0, 12).map((product) => <button key={product.id} type="button" onClick={() => addProduct(product)} className="w-full min-h-[44px] flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950 px-3 text-start hover:border-blue-500/50" role="option" aria-selected={lines.some((line) => line.productId === product.id)}><span className="font-bold text-slate-200">{pName(product)}</span><span className="text-[10px] text-slate-500" dir="ltr">{product.sku}{product.barcode ? ` · ${product.barcode}` : ''}</span></button>)}
              </div>
            </div>
            <div className="space-y-2">
              {lines.map((line, idx) => {
                const product = products.find((item) => item.id === line.productId);
                const selected = new Set(lines.filter((_, i) => i !== idx).map((item) => item.productId));
                return <div key={`${line.productId}-${idx}`} className="rounded-xl border border-slate-800 bg-slate-950 p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2"><span className="font-bold text-slate-200">{product ? pName(product) : line.productId}</span><button type="button" onClick={() => setLines(lines.filter((_, i) => i !== idx))} className="min-h-[44px] px-2 text-rose-300" aria-label={isAr ? 'حذف الصنف' : 'Remove item'}>×</button></div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2"><select value={line.productId} onChange={(e) => setLines(lines.map((item, i) => i === idx ? { ...item, productId: e.target.value, unitCost: products.find((p) => p.id === e.target.value)?.costPrice ?? item.unitCost } : item))} className={inputCls}>{products.filter((item) => !selected.has(item.id)).map((item) => <option key={item.id} value={item.id}>{pName(item)} — {item.sku}</option>)}</select><div className="grid grid-cols-2 gap-2"><NumberField min={1} step={1} value={line.quantityOrdered} onChange={(value) => setLines(lines.map((item, i) => i === idx ? { ...item, quantityOrdered: value } : item))} placeholder={isAr ? 'الكمية' : 'Qty'} /><NumberField min={0} step={0.01} value={line.unitCost} onChange={(value) => setLines(lines.map((item, i) => i === idx ? { ...item, unitCost: value } : item))} placeholder={isAr ? 'التكلفة' : 'Cost'} /></div></div>
                  <div className="text-[11px] text-slate-400">{isAr ? 'إجمالي السطر' : 'Line total'}: {(line.quantityOrdered * line.unitCost).toFixed(2)} {isAr ? 'ج.م' : 'EGP'}</div>
                </div>;
              })}
            </div>
            <div className="flex items-center justify-between rounded-xl border border-blue-500/30 bg-blue-500/10 p-3 font-bold text-blue-200"><span>{isAr ? 'إجمالي الأمر' : 'PO total'}</span><span>{lines.reduce((sum, line) => sum + line.quantityOrdered * line.unitCost, 0).toFixed(2)} {isAr ? 'ج.م' : 'EGP'}</span></div>
            <div><label className="block text-[11px] font-bold text-slate-400 mb-1">{isAr ? 'ملاحظات' : 'Notes'}</label><textarea rows={2} value={poNotes} onChange={(e) => setPoNotes(e.target.value)} className={`${inputCls} resize-none`} /></div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2"><button type="button" disabled={saving} onClick={() => void submitPo('draft')} className="min-h-[44px] rounded-xl border border-slate-600 text-slate-200 font-bold hover:bg-slate-800 disabled:opacity-60">{isAr ? 'حفظ كمسودة' : 'Save draft'}</button><button type="submit" disabled={saving} className="min-h-[44px] rounded-xl bg-blue-600 text-white font-extrabold hover:bg-blue-500 disabled:opacity-60">{saving ? t('loading') : (isAr ? 'تأكيد الأمر' : 'Confirm PO')}</button></div>
          </form>
        </Modal>
      )}

      {returning && (
        <Modal title={`${isAr ? 'مرتجع مورد' : 'Supplier return'} - ${returning.poNumber}`} onClose={() => setReturning(null)}>
          <form onSubmit={submitReturn} className="space-y-3 text-xs">
            {returnError && <div role="alert" className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400">{returnError}</div>}
            <div>
              <label htmlFor="ret-item" className="block text-[11px] font-bold text-slate-400 mb-1">{isAr ? 'الصنف *' : 'Item *'}</label>
              <select id="ret-item" value={returnItemId} onChange={(e) => setReturnItemId(e.target.value)} className={inputCls}>
                {returning.items.filter((i) => i.quantityReceived > 0).map((i) => (
                  <option key={i.id} value={i.id}>{pName(i.product)} ({isAr ? 'المستلم' : 'received'}: {i.quantityReceived})</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="ret-qty" className="block text-[11px] font-bold text-slate-400 mb-1">{isAr ? 'الكمية المرتجعة *' : 'Return qty *'}</label>
              <NumberField id="ret-qty" min={1} step={1} value={returnQty} onChange={setReturnQty} />
            </div>
            <div>
              <label htmlFor="ret-reason" className="block text-[11px] font-bold text-slate-400 mb-1">{isAr ? 'سبب الإرجاع (إجباري) *' : 'Reason (required) *'}</label>
              <input id="ret-reason" value={returnReason} onChange={(e) => setReturnReason(e.target.value)} placeholder={isAr ? 'مثال: تالف...' : 'e.g. damaged...'} className={inputCls} />
            </div>
            <button type="submit" disabled={saving} className="w-full min-h-[44px] py-3 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-60 text-white font-extrabold transition-all">
              {saving ? t('loading') : t('confirm')}
            </button>
          </form>
        </Modal>
      )}

      {receiving && (
        <Modal title={`${isAr ? 'استلام بضاعة' : 'Receive goods'} - ${receiving.poNumber}`} onClose={() => setReceiving(null)}>
          <form onSubmit={submitReceive} className="space-y-3 text-xs">
            {formError && <div role="alert" className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400">{formError}</div>}
            {receiving.items.map((i) => (
              <div key={i.id} className="flex justify-between items-center gap-3 p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                <span className="font-bold text-slate-200">{pName(i.product)} <span className="text-slate-500">({i.quantityReceived}/{i.quantityOrdered})</span></span>
                <NumberField
                  min={0} max={i.quantityOrdered - i.quantityReceived} step={1}
                  value={receiveQty[i.id] ?? 0}
                  onChange={(v) => setReceiveQty({ ...receiveQty, [i.id]: v })}
                  inputClassName="w-24"
                />
              </div>
            ))}
            <button type="submit" disabled={saving} className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white font-extrabold transition-all">
              {saving ? t('loading') : t('confirm')}
            </button>
          </form>
        </Modal>
      )}
    </div>
  );
}
