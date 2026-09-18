'use client';

import React, { useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { useRouter } from '@/i18n/routing';
import { Plus } from 'lucide-react';
import { Modal, StatusBadge, ActionButton, apiFetch } from './ui';

interface SupplierOpt { id: string; name: string; code: string }
interface BranchOpt { id: string; name: string; nameEn: string }
interface ProductOpt { id: string; nameAr: string; nameEn: string }
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
  const isAr = locale === 'ar';
  const [showNew, setShowNew] = useState(false);
  const [receiving, setReceiving] = useState<PoRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [supplierId, setSupplierId] = useState(suppliers[0]?.id || '');
  const [branchId, setBranchId] = useState(branches[0]?.id || '');
  const [lines, setLines] = useState<Array<{ productId: string; quantityOrdered: number; unitCost: number }>>([
    { productId: products[0]?.id || '', quantityOrdered: 10, unitCost: 0 },
  ]);
  const [receiveQty, setReceiveQty] = useState<Record<string, number>>({});

  const pName = (p: ProductOpt) => (isAr ? p.nameAr : p.nameEn);
  const inputCls = 'w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-slate-100 text-xs focus:outline-none focus:border-blue-500';

  const submitPo = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFormError('');
    try {
      await apiFetch('/api/admin/purchase-orders', 'POST', { supplierId, branchId, items: lines });
      setShowNew(false);
      router.refresh();
    } catch {
      setFormError(t('operationFailed'));
    } finally {
      setSaving(false);
    }
  };

  const submitReceive = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!receiving) return;
    setSaving(true);
    setFormError('');
    try {
      const received = receiving.items.map((i) => ({ itemId: i.id, quantity: receiveQty[i.id] ?? 0 }));
      await apiFetch(`/api/admin/purchase-orders/${receiving.id}/receive`, 'POST', { received });
      setReceiving(null);
      setReceiveQty({});
      router.refresh();
    } catch {
      setFormError(t('operationFailed'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => setShowNew(true)} className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-blue-600/25 transition-all">
          <Plus className="w-4 h-4" />
          {t('newPurchaseOrder')}
        </button>
      </div>

      <div className="space-y-3">
        {purchaseOrders.length === 0 && <div className="text-center text-xs text-slate-500 py-8">{t('noData')}</div>}
        {purchaseOrders.map((po) => (
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
                {po.status !== 'RECEIVED' && po.status !== 'CANCELLED' && (
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
                {po.status === 'SUBMITTED' && (
                  <ActionButton
                    onAction={async () => { await apiFetch(`/api/admin/purchase-orders/${po.id}`, 'PATCH', {}); router.refresh(); }}
                    confirmMessage={isAr ? `إلغاء أمر التوريد ${po.poNumber}؟` : `Cancel PO ${po.poNumber}?`}
                    className="px-4 py-2 rounded-xl bg-rose-600/20 hover:bg-rose-600 border border-rose-500/40 text-rose-400 hover:text-white font-bold text-xs"
                  >
                    {t('status_CANCELLED')}
                  </ActionButton>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {showNew && (
        <Modal title={t('newPurchaseOrder')} onClose={() => setShowNew(false)}>
          <form onSubmit={submitPo} className="space-y-3 text-xs">
            {formError && <div role="alert" className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400">{formError}</div>}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-400 mb-1">{isAr ? 'المورد *' : 'Supplier *'}</label>
                <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)} className={inputCls}>
                  {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-400 mb-1">{isAr ? 'الفرع المستلِم *' : 'Receiving Branch *'}</label>
                <select value={branchId} onChange={(e) => setBranchId(e.target.value)} className={inputCls}>
                  {branches.map((b) => <option key={b.id} value={b.id}>{isAr ? b.name : b.nameEn}</option>)}
                </select>
              </div>
            </div>
            {lines.map((line, idx) => (
              <div key={idx} className="grid grid-cols-12 gap-2 items-end">
                <div className="col-span-6">
                  {idx === 0 && <label className="block text-[11px] font-bold text-slate-400 mb-1">{isAr ? 'المنتج' : 'Product'}</label>}
                  <select value={line.productId} onChange={(e) => setLines(lines.map((l, i) => (i === idx ? { ...l, productId: e.target.value } : l)))} className={`${inputCls}`}>
                    {products.map((p) => <option key={p.id} value={p.id}>{pName(p)}</option>)}
                  </select>
                </div>
                <div className="col-span-3">
                  {idx === 0 && <label className="block text-[11px] font-bold text-slate-400 mb-1">{isAr ? 'الكمية' : 'Qty'}</label>}
                  <input type="number" min="1" value={line.quantityOrdered} onChange={(e) => setLines(lines.map((l, i) => (i === idx ? { ...l, quantityOrdered: Number(e.target.value) } : l)))} className={inputCls} placeholder={isAr ? 'الكمية' : 'Qty'} />
                </div>
                <div className="col-span-3">
                  {idx === 0 && <label className="block text-[11px] font-bold text-slate-400 mb-1">{isAr ? 'التكلفة (ج.م)' : 'Unit Cost'}</label>}
                  <input type="number" min="0" value={line.unitCost} onChange={(e) => setLines(lines.map((l, i) => (i === idx ? { ...l, unitCost: Number(e.target.value) } : l)))} className={inputCls} placeholder={isAr ? 'سعر الوحدة' : 'Unit cost'} />
                </div>
              </div>
            ))}
            <button type="button" onClick={() => setLines([...lines, { productId: products[0]?.id || '', quantityOrdered: 10, unitCost: 0 }])} className="text-blue-400 font-bold hover:underline">
              + {isAr ? 'إضافة صنف' : 'Add item'}
            </button>
            <button type="submit" disabled={saving} className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white font-extrabold transition-all">
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
                <input
                  type="number" min="0" max={i.quantityOrdered - i.quantityReceived}
                  value={receiveQty[i.id] ?? 0}
                  onChange={(e) => setReceiveQty({ ...receiveQty, [i.id]: Number(e.target.value) })}
                  className="w-24 p-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-100"
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
