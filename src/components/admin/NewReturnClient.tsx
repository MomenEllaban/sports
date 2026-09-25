'use client';

import React, { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useRouter } from '@/i18n/routing';
import { apiFetch } from '@/components/admin/ui';
import { useToast } from '@/components/Toast';
import { Stepper } from '@/components/ui/foundation';
import { apiRequest } from '@/lib/client-api';

const REASONS = [
  ['SIZE_ISSUE', 'مقاس'], ['DEFECTIVE', 'عيب مصنعي'], ['WRONG_ITEM', 'صنف خطأ'],
  ['NOT_AS_DESCRIBED', 'غير مطابق'], ['CHANGED_MIND', 'تغيير رأي'], ['OTHER', 'أخرى'],
];

/** Manual RMA creation (T-RMA): order/sale lookup → items → submit. */
export default function NewReturnClient() {
  const params = useSearchParams();
  const router = useRouter();
  const { toast } = useToast();
  const [docType, setDocType] = useState<'order' | 'sale'>('order');
  const [docNumber, setDocNumber] = useState(params.get('orderNumber') || '');
  const [doc, setDoc] = useState<null | {
    id: string; number: string;
    items: Array<{ refId: string; productId: string; nameAr: string; quantity: number }>;
  }>(null);
  const [picks, setPicks] = useState<Record<string, { qty: number; reason: string }>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const lookup = async () => {
    if (!docNumber.trim()) return;
    setBusy(true);
    setError('');
    try {
      const lookupUrl = docType === 'order'
        ? `/api/orders/track?query=${encodeURIComponent(docNumber.trim())}`
        : `/api/admin/sales/lookup?number=${encodeURIComponent(docNumber.trim())}`;
      const data = await apiRequest<{ success?: boolean; sale?: typeof doc }>(lookupUrl, { errorKey: `admin:returns:lookup:${docType}` });
      if (docType === 'order') {
        // track API returns masked summary; fetch full lines via admin returns lookup
        const full = await apiRequest<{ doc?: typeof doc }>(`/api/admin/returns/lookup?orderNumber=${encodeURIComponent(docNumber.trim())}`, { errorKey: 'admin:returns:full-lookup' });
        if (!full.doc) throw new Error('غير موجود');
        setDoc(full.doc);
      } else {
        if (!data.sale) throw new Error('غير موجود');
        setDoc(data.sale);
      }
      setPicks({});
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'فشل البحث');
    } finally {
      setBusy(false);
    }
  };

  const submit = async () => {
    const items = Object.entries(picks)
      .filter(([, p]) => p.qty > 0)
      .map(([refId, p]) => {
        const line = doc!.items.find((i) => i.refId === refId)!;
        return { refId, productId: line.productId, quantity: p.qty, reasonCode: p.reason };
      });
    if (items.length === 0) return;
    setBusy(true);
    setError('');
    try {
      const res = (await apiFetch('/api/admin/returns', 'POST', {
        ...(docType === 'order' ? { orderId: doc!.id } : { saleId: doc!.id }),
        items,
      })) as { return?: { id: string; returnNumber: string } };
      toast(`تم إنشاء المرتجع ${res.return?.returnNumber}`, 'success');
      router.push(`/admin/returns/${res.return?.id}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'فشل الإنشاء');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-2xl space-y-4">
      <Stepper steps={['المستند', 'الأصناف', 'إرسال']} active={doc ? 1 : 0} />
      <div className="grid sm:grid-cols-[120px_1fr_auto] gap-2 text-xs">
        <select value={docType} onChange={(e) => { setDocType(e.target.value as 'order' | 'sale'); setDoc(null); }} aria-label="النوع" className="min-h-[44px] p-2.5 rounded-xl bg-slate-900 border border-slate-700">
          <option value="order">طلب</option>
          <option value="sale">فاتورة POS</option>
        </select>
        <input value={docNumber} onChange={(e) => setDocNumber(e.target.value)} dir="ltr" placeholder={docType === 'order' ? 'ORD-2026-XXXX' : 'POS-2026-XXXXX'} aria-label="رقم المستند" className="min-h-[44px] p-2.5 rounded-xl bg-slate-900 border border-slate-700 font-mono font-bold" />
        <button onClick={lookup} disabled={busy} className="min-h-[44px] px-5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white font-bold">بحث</button>
      </div>
      {error && <p role="alert" className="text-xs font-bold text-rose-400">{error}</p>}
      {doc && (
        <div className="space-y-2">
          <p className="text-xs text-slate-400">المستند <span className="font-mono font-bold text-amber-400" dir="ltr">{doc.number}</span></p>
          {doc.items.map((i) => {
            const p = picks[i.refId] || { qty: 0, reason: 'SIZE_ISSUE' };
            return (
              <div key={i.refId} className="p-3 rounded-2xl bg-slate-900 border border-slate-800 space-y-2 text-xs">
                <div className="flex justify-between items-center gap-2">
                  <span className="font-bold">{i.nameAr} <span className="text-slate-500">(المباع {i.quantity})</span></span>
                  <span className="flex items-center gap-1">
                    <button onClick={() => setPicks({ ...picks, [i.refId]: { ...p, qty: Math.max(0, p.qty - 1) } })} aria-label="إنقاص" className="min-h-[44px] min-w-[44px] rounded-lg bg-slate-800 font-black">−</button>
                    <span className="w-8 text-center font-black">{p.qty}</span>
                    <button onClick={() => setPicks({ ...picks, [i.refId]: { ...p, qty: Math.min(i.quantity, p.qty + 1) } })} aria-label="زيادة" className="min-h-[44px] min-w-[44px] rounded-lg bg-slate-800 font-black">+</button>
                  </span>
                </div>
                {p.qty > 0 && (
                  <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="السبب">
                    {REASONS.map(([code, label]) => (
                      <button key={code} role="radio" aria-checked={p.reason === code} onClick={() => setPicks({ ...picks, [i.refId]: { ...p, reason: code } })}
                        className={`min-h-[44px] px-3 rounded-xl border text-[11px] font-bold ${p.reason === code ? 'bg-amber-500 text-slate-950 border-amber-400' : 'bg-slate-950 border-slate-700'}`}>
                        {label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          <button onClick={submit} disabled={busy} className="min-h-[44px] px-6 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white text-xs font-black">
            {busy ? '...' : 'إنشاء طلب المرتجع'}
          </button>
        </div>
      )}
    </div>
  );
}
