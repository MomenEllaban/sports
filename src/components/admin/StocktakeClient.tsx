'use client';

import React, { useEffect, useState } from 'react';
import { useLocale } from 'next-intl';
import { useRouter } from '@/i18n/routing';
import { ClipboardCheck } from 'lucide-react';
import { apiFetch } from '@/components/admin/ui';
import { useToast } from '@/components/Toast';
import { Stepper, ConfirmDialog } from '@/components/ui/foundation';

interface Branch { id: string; name: string }
interface Product { id: string; nameAr: string; sku: string }

/** Stocktake wizard (T13): branch → product → counted qty + mandatory reason → confirm. */
export default function StocktakeClient({ branches, products }: { branches: Branch[]; products: Product[] }) {
  const locale = useLocale();
  const router = useRouter();
  const { toast } = useToast();
  const isAr = locale === 'ar';
  const [branchId, setBranchId] = useState(branches[0]?.id || '');
  const [query, setQuery] = useState('');
  const [productId, setProductId] = useState('');
  const [systemQty, setSystemQty] = useState<number | null>(null);
  const [counted, setCounted] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [last, setLast] = useState<{ previous: number; next: number; diff: number } | null>(null);

  const matches = query.trim()
    ? products.filter((p) => p.nameAr.includes(query.trim()) || p.sku.toLowerCase().includes(query.trim().toLowerCase())).slice(0, 8)
    : [];

  useEffect(() => {
    setSystemQty(null);
    if (!branchId || !productId) return;
    fetch(`/api/admin/inventory/adjust-info?branchId=${branchId}&productId=${productId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.success) setSystemQty(d.qty);
      })
      .catch(() => null);
  }, [branchId, productId]);

  const diff = systemQty !== null && counted !== '' ? Number(counted) - systemQty : null;

  const submit = async () => {
    if (!branchId || !productId || counted === '' || !reason.trim() || busy) return;
    setBusy(true);
    try {
      const res = (await apiFetch('/api/admin/inventory/adjust', 'POST', {
        branchId, productId, countedQty: Number(counted), reason: reason.trim(),
      })) as { previous: number; next: number; diff: number };
      setLast(res);
      toast(isAr ? `تمت التسوية: ${res.previous} → ${res.next}` : `Adjusted: ${res.previous} → ${res.next}`, 'success');
      setCounted('');
      setReason('');
      setConfirming(false);
      setSystemQty(res.next);
      router.refresh();
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : 'فشل', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-xl space-y-4">
      <Stepper steps={[isAr ? 'الفرع والصنف' : 'Branch & item', isAr ? 'العد والسبب' : 'Count & reason', isAr ? 'تأكيد' : 'Confirm']} active={productId ? (reason.trim() && counted !== '' ? 2 : 1) : 0} />
      <div className="grid sm:grid-cols-2 gap-3 text-xs">
        <div>
          <label htmlFor="st-branch" className="block font-bold text-slate-300 mb-1">الفرع *</label>
          <select id="st-branch" value={branchId} onChange={(e) => setBranchId(e.target.value)} className="w-full min-h-[44px] p-2.5 rounded-xl bg-slate-900 border border-slate-700">
            {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>
        <div className="relative">
          <label htmlFor="st-search" className="block font-bold text-slate-300 mb-1">الصنف *</label>
          <input id="st-search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="بحث بالاسم أو SKU..." className="w-full min-h-[44px] p-2.5 rounded-xl bg-slate-900 border border-slate-700" />
          {matches.length > 0 && (
            <ul className="absolute z-10 mt-1 w-full rounded-xl bg-slate-900 border border-slate-700 max-h-48 overflow-y-auto">
              {matches.map((p) => (
                <li key={p.id}>
                  <button onClick={() => { setProductId(p.id); setQuery(`${p.nameAr} (${p.sku})`); }} className="w-full min-h-[44px] text-right px-3 py-2 hover:bg-slate-800 text-xs">
                    <span className="font-bold">{p.nameAr}</span> <span className="text-slate-500 font-mono">{p.sku}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      {productId && (
        <div className="grid sm:grid-cols-2 gap-3 text-xs">
          <div>
            <label htmlFor="st-counted" className="block font-bold text-slate-300 mb-1">
              الكمية المعدودة * {systemQty !== null && <span className="text-slate-500">(النظام: {systemQty})</span>}
            </label>
            <input id="st-counted" type="number" min={0} step={1} value={counted} onChange={(e) => setCounted(e.target.value)} className="w-full min-h-[44px] p-2.5 rounded-xl bg-slate-900 border border-slate-700 font-bold" />
            {diff !== null && diff !== 0 && (
              <p className={`mt-1 font-bold ${diff > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>الفرق: {diff > 0 ? '+' : ''}{diff}</p>
            )}
          </div>
          <div>
            <label htmlFor="st-reason" className="block font-bold text-slate-300 mb-1">سبب التسوية (إجباري) *</label>
            <input id="st-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="مثال: جرد شهري..." className="w-full min-h-[44px] p-2.5 rounded-xl bg-slate-900 border border-slate-700" />
          </div>
        </div>
      )}
      {last && <p role="status" className="text-xs text-emerald-400 font-bold flex items-center gap-1"><ClipboardCheck className="w-4 h-4" /> آخر تسوية: {last.previous} → {last.next} (الفرق {last.diff})</p>}
      <button
        onClick={() => setConfirming(true)}
        disabled={!branchId || !productId || counted === '' || !reason.trim()}
        className="min-h-[44px] px-6 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 text-xs font-black"
      >
        {isAr ? 'مراجعة وتأكيد التسوية' : 'Review & confirm'}
      </button>
      <ConfirmDialog
        open={confirming}
        title={isAr ? 'تأكيد تسوية المخزون؟' : 'Confirm stock adjustment?'}
        impact={isAr ? `ستتغير الكمية من ${systemQty} إلى ${counted} مع سجل تدقيق دائم. لا يمكن التراجع الآلي.` : `Quantity changes from ${systemQty} to ${counted} with a permanent audit log.`}
        confirmLabel={isAr ? 'تأكيد التسوية' : 'Confirm'}
        onConfirm={submit}
        onClose={() => { if (!busy) setConfirming(false); }}
        busy={busy}
      />
    </div>
  );
}
