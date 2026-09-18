'use client';

import React, { useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { useRouter } from '@/i18n/routing';
import { ArrowLeftRight } from 'lucide-react';
import { Modal, StatusBadge, ActionButton, apiFetch } from './ui';

interface BranchOpt { id: string; name: string; nameEn: string }
interface ProductOpt { id: string; nameAr: string; nameEn: string }
interface TransferRow {
  id: string;
  transferNumber: string;
  status: string;
  notes: string | null;
  createdAt: string;
  fromBranch: BranchOpt;
  toBranch: BranchOpt;
  items: Array<{ id: string; quantity: number; product: ProductOpt }>;
}

export default function TransfersManager({
  branches,
  products,
  transfers,
}: {
  branches: BranchOpt[];
  products: ProductOpt[];
  transfers: TransferRow[];
}) {
  const t = useTranslations('admin');
  const locale = useLocale();
  const router = useRouter();
  const isAr = locale === 'ar';
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [fromBranchId, setFromBranchId] = useState(branches[0]?.id || '');
  const [toBranchId, setToBranchId] = useState(branches[1]?.id || branches[0]?.id || '');
  const [lines, setLines] = useState<Array<{ productId: string; quantity: number }>>([{ productId: products[0]?.id || '', quantity: 1 }]);

  const bName = (b: BranchOpt) => (isAr ? b.name : b.nameEn);
  const pName = (p: ProductOpt) => (isAr ? p.nameAr : p.nameEn);
  const inputCls = 'w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-slate-100 text-xs focus:outline-none focus:border-amber-500';

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFormError('');
    try {
      await apiFetch('/api/admin/transfers', 'POST', { fromBranchId, toBranchId, items: lines });
      setShowModal(false);
      setLines([{ productId: products[0]?.id || '', quantity: 1 }]);
      router.refresh();
    } catch {
      setFormError(t('operationFailed'));
    } finally {
      setSaving(false);
    }
  };

  const decide = async (id: string, action: 'approve' | 'reject') => {
    await apiFetch(`/api/admin/transfers/${id}`, 'POST', { action });
    router.refresh();
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => setShowModal(true)} className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-2 shadow-lg shadow-amber-500/20 transition-all">
          <ArrowLeftRight className="w-4 h-4" />
          {t('newTransfer')}
        </button>
      </div>

      <div className="space-y-3">
        {transfers.length === 0 && <div className="text-center text-xs text-slate-500 py-8">{t('noData')}</div>}
        {transfers.map((tr) => (
          <div key={tr.id} className="p-4 rounded-2xl bg-slate-900 border border-slate-800 text-xs space-y-2">
            <div className="flex flex-wrap justify-between items-center gap-2">
              <span className="font-extrabold text-amber-400">{tr.transferNumber}</span>
              <StatusBadge value={tr.status} />
            </div>
            <div className="text-slate-300">
              {bName(tr.fromBranch)} ← {bName(tr.toBranch)}
            </div>
            <div className="text-slate-400">
              {tr.items.map((i) => `${pName(i.product)} x${i.quantity}`).join('، ')}
            </div>
            {tr.status === 'PENDING' && (
              <div className="flex gap-2 pt-1">
                <ActionButton
                  onAction={() => decide(tr.id, 'approve')}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs"
                >
                  {t('status_APPROVED')}
                </ActionButton>
                <ActionButton
                  onAction={() => decide(tr.id, 'reject')}
                  className="px-4 py-2 rounded-xl bg-rose-600/20 hover:bg-rose-600 border border-rose-500/40 text-rose-400 hover:text-white font-bold text-xs"
                >
                  {t('status_REJECTED')}
                </ActionButton>
              </div>
            )}
          </div>
        ))}
      </div>

      {showModal && (
        <Modal title={t('newTransfer')} onClose={() => setShowModal(false)}>
          <form onSubmit={submit} className="space-y-3 text-xs">
            {formError && <div role="alert" className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400">{formError}</div>}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-400 mb-1">
                  {isAr ? 'الفرع المصدر (من) *' : 'From Branch *'}
                </label>
                <select value={fromBranchId} onChange={(e) => setFromBranchId(e.target.value)} className={inputCls}>
                  {branches.map((b) => <option key={b.id} value={b.id}>{bName(b)}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-400 mb-1">
                  {isAr ? 'الفرع المستلم (إلى) *' : 'To Branch *'}
                </label>
                <select value={toBranchId} onChange={(e) => setToBranchId(e.target.value)} className={inputCls}>
                  {branches.map((b) => <option key={b.id} value={b.id}>{bName(b)}</option>)}
                </select>
              </div>
            </div>
            {lines.map((line, idx) => (
              <div key={idx}>
                <label className="block text-[11px] font-bold text-slate-400 mb-1">
                  {isAr ? `المنتج والكمية المحولة (#${idx + 1}) *` : `Item & Qty (#${idx + 1}) *`}
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <select
                    value={line.productId}
                    onChange={(e) => {
                      const copy = [...lines];
                      copy[idx].productId = e.target.value;
                      setLines(copy);
                    }}
                    className={`${inputCls} col-span-2`}
                  >
                    {products.map((p) => <option key={p.id} value={p.id}>{pName(p)}</option>)}
                  </select>
                  <input
                    type="number"
                    min={1}
                    value={line.quantity}
                    placeholder={isAr ? 'الكمية' : 'Qty'}
                    onChange={(e) => {
                      const copy = [...lines];
                      copy[idx].quantity = Number(e.target.value);
                      setLines(copy);
                    }}
                    className={inputCls}
                  />
                </div>
              </div>
            ))}
            <button type="button" onClick={() => setLines([...lines, { productId: products[0]?.id || '', quantity: 1 }])} className="text-blue-400 font-bold hover:underline">
              + {isAr ? 'إضافة صنف' : 'Add item'}
            </button>
            <button type="submit" disabled={saving} className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-slate-950 font-extrabold transition-all">
              {saving ? t('loading') : t('confirm')}
            </button>
          </form>
        </Modal>
      )}
    </div>
  );
}
