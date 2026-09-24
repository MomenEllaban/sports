'use client';

import React, { useState } from 'react';
import { RotateCcw, Search, ArrowLeftRight } from 'lucide-react';
import { useToast } from '@/components/Toast';
import { Stepper, SafeImage, ConfirmDialog, Button, NumberField } from '@/components/ui/foundation';

interface LookupItem {
  saleItemId: string; productId: string; nameAr: string; sku: string;
  images: string[]; quantity: number; unitPrice: number; size: string | null; color: string | null;
}
interface LookupSale {
  id: string; saleNumber: string; branchId: string; totalAmount: number; createdAt: string;
  items: LookupItem[];
}

/**
 * In-store return/exchange wizard (T-RMA §5.1): find invoice → pick items +
 * reasons → exchange (optional) → summary + payout → confirm → receipt.
 * Offline is blocked with a clear message (money needs the server).
 */
export default function PosReturnWizard({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const { toast } = useToast();
  const [step, setStep] = useState(0);
  const [find, setFind] = useState('');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [candidates, setCandidates] = useState<LookupSale[]>([]);
  const [sale, setSale] = useState<LookupSale | null>(null);
  const [picks, setPicks] = useState<Record<string, { qty: number; reason: string }>>({});
  const [isExchange, setIsExchange] = useState(false);
  const [exchangeProduct, setExchangeProduct] = useState('');
  const [exchangeQty, setExchangeQty] = useState(1);
  const [exchangeSearch, setExchangeSearch] = useState('');
  const [exchangeOptions, setExchangeOptions] = useState<Array<{ id: string; nameAr: string; sku: string; price: number; stock: number }>>([]);
  const [refundMethod, setRefundMethod] = useState('');
  const [managerPin, setManagerPin] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [result, setResult] = useState<{ returnNumber: string; status: string; refundTotal: number; payout: { ok: boolean; error?: string } } | null>(null);
  const [error, setError] = useState('');

  const lookup = async () => {
    if (!find.trim() && !phone.trim()) return;
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/pos/returns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ saleNumber: find.trim() || undefined, customerPhone: phone.trim() || undefined }),
      });
      const data = await res.json();
      if (!data.success) {
        setError(data.error || 'غير موجود');
      } else if (data.lookup) {
        setCandidates(data.sales);
        if (data.sales.length === 0) setError('لا فواتير مطابقة');
      }
    } catch {
      setError('تعذر الاتصال — المرتجع يحتاج إنترنت ولا يعمل أوفلاين');
    } finally {
      setBusy(false);
    }
  };

  const chooseSale = (s: LookupSale) => {
    setSale(s);
    const init: Record<string, { qty: number; reason: string }> = {};
    for (const i of s.items) init[i.saleItemId] = { qty: 0, reason: 'SIZE_ISSUE' };
    setPicks(init);
    setStep(1);
  };

  const searchExchange = async () => {
    if (!exchangeSearch.trim()) return;
    const res = await fetch(`/api/pos/products?q=${encodeURIComponent(exchangeSearch.trim())}`);
    const data = await res.json().catch(() => null);
    if (data?.success && Array.isArray(data.products)) {
      setExchangeOptions(data.products.slice(0, 8).map((p: { id: string; nameAr: string; sku: string; price: number; inventories?: Array<{ stockQuantity: number }> }) => ({
        id: p.id, nameAr: p.nameAr, sku: p.sku, price: p.price,
        stock: (p.inventories || []).reduce((s: number, x: { stockQuantity: number }) => s + x.stockQuantity, 0),
      })));
    }
  };

  const pickedCount = Object.values(picks).reduce((s, p) => s + p.qty, 0);

  const submit = async () => {
    if (!sale || pickedCount === 0 || busy) return;
    setBusy(true);
    setError('');
    try {
      const chosen = exchangeProduct ? [{ productId: exchangeProduct, quantity: exchangeQty }] : [];
      const res = await fetch('/api/pos/returns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          saleId: sale.id,
          customerPhone: phone.trim() || undefined,
          items: Object.entries(picks)
            .filter(([, p]) => p.qty > 0)
            .map(([saleItemId, p]) => {
              const item = sale.items.find((i) => i.saleItemId === saleItemId)!;
              return { saleItemId, productId: item.productId, quantity: Math.min(p.qty, item.quantity), reasonCode: p.reason };
            }),
          refundMethod: refundMethod || undefined,
          managerPin: managerPin || undefined,
          exchange: isExchange && chosen.length > 0 ? { items: chosen, paymentMethod: 'CASH' } : undefined,
          clientRequestId: `pos-${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setResult({ returnNumber: data.returnNumber, status: data.status, refundTotal: data.refundTotal, payout: data.payout || { ok: false } });
        toast(`تم تسجيل المرتجع ${data.returnNumber}`, 'success');
        setStep(4);
        onDone();
      } else {
        setError(data.needsPin ? `يحتاج PIN مدير: ${data.error}` : data.error || 'فشل');
        if (data.needsPin) setStep(3);
      }
    } catch {
      setError('تعذر الاتصال — المرتجع يحتاج إنترنت ولا يعمل أوفلاين');
    } finally {
      setBusy(false);
      setConfirming(false);
    }
  };

  const reasons = ['SIZE_ISSUE', 'DEFECTIVE', 'WRONG_ITEM', 'NOT_AS_DESCRIBED', 'CHANGED_MIND', 'OTHER'];
  const reasonAr: Record<string, string> = {
    SIZE_ISSUE: 'مقاس', DEFECTIVE: 'عيب مصنعي', WRONG_ITEM: 'صنف خطأ',
    NOT_AS_DESCRIBED: 'غير مطابق', CHANGED_MIND: 'تغيير رأي', OTHER: 'أخرى',
  };

  return (
    <div className="fixed inset-0 z-[80] bg-black/70 p-4 overflow-y-auto" onClick={onClose}>
      <div className="max-w-2xl mx-auto rounded-3xl bg-slate-900 border border-slate-700 p-5 sm:p-6 space-y-4 my-6" onClick={(e) => e.stopPropagation()}>
        <h2 className="font-black text-base flex items-center gap-2">
          <RotateCcw className="w-5 h-5 text-amber-400" />
          مرتجع / استبدال
        </h2>
        <Stepper steps={['الفاتورة', 'الأصناف', 'استبدال', 'التسوية', 'تم']} active={Math.min(step, 4)} />

        {step === 0 && (
          <div className="space-y-3">
            <div className="grid sm:grid-cols-2 gap-2">
              <div>
                <label htmlFor="rw-sale" className="block text-xs font-bold text-slate-300 mb-1">رقم الفاتورة / باركود الإيصال</label>
                <input id="rw-sale" value={find} onChange={(e) => setFind(e.target.value)} dir="ltr" placeholder="POS-2026-XXXXX" className="w-full min-h-[44px] p-3 rounded-xl bg-slate-950 border border-slate-700 font-mono font-bold" />
              </div>
              <div>
                <label htmlFor="rw-phone" className="block text-xs font-bold text-slate-300 mb-1">أو هاتف العميل (آخر فواتيره)</label>
                <input id="rw-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} dir="ltr" placeholder="01xxxxxxxxx" className="w-full min-h-[44px] p-3 rounded-xl bg-slate-950 border border-slate-700 font-bold" />
              </div>
            </div>
            <button onClick={lookup} disabled={busy} className="min-h-[44px] px-5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white text-xs font-bold flex items-center gap-1">
              <Search className="w-4 h-4" /> {busy ? '...' : 'بحث'}
            </button>
            {error && <p role="alert" className="text-xs font-bold text-rose-400">{error}</p>}
            {candidates.length > 0 && (
              <ul className="space-y-2">
                {candidates.map((s) => (
                  <li key={s.id}>
                    <button onClick={() => chooseSale(s)} className="w-full min-h-[44px] p-3 rounded-2xl bg-slate-950 border border-slate-700 hover:border-blue-500 text-start text-xs flex justify-between gap-2">
                      <span className="font-mono font-bold text-amber-400" dir="ltr">{s.saleNumber}</span>
                      <span>{s.totalAmount.toLocaleString()} ج.م • {new Date(s.createdAt).toLocaleDateString('ar-EG')}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {step === 1 && sale && (
          <div className="space-y-3">
            <p className="text-xs text-slate-400">الفاتورة <span className="font-mono font-bold text-amber-400" dir="ltr">{sale.saleNumber}</span> — حدد الكميات والأسباب:</p>
            {sale.items.map((i) => {
              const p = picks[i.saleItemId] || { qty: 0, reason: 'SIZE_ISSUE' };
              return (
                <div key={i.saleItemId} className="p-3 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
                  <div className="flex gap-2 items-center">
                    <span className="relative w-12 h-12 rounded-xl overflow-hidden bg-slate-900 shrink-0 block">
                      <SafeImage src={i.images[0] || '/placeholder-product.svg'} alt={i.nameAr} fill sizes="48px" className="object-cover" />
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-xs truncate">{i.nameAr}</div>
                      <div className="text-[11px] text-slate-500">المباع {i.quantity} • المتاح للإرجاع {i.quantity}</div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => setPicks({ ...picks, [i.saleItemId]: { ...p, qty: Math.max(0, p.qty - 1) } })} aria-label={`إنقاص كمية ${i.nameAr}`} className="min-h-[44px] min-w-[44px] rounded-lg bg-slate-800 font-black">−</button>
                      <span className="w-8 text-center font-black" aria-live="polite">{p.qty}</span>
                      <button onClick={() => setPicks({ ...picks, [i.saleItemId]: { ...p, qty: Math.min(i.quantity, p.qty + 1) } })} aria-label={`زيادة كمية ${i.nameAr}`} className="min-h-[44px] min-w-[44px] rounded-lg bg-slate-800 font-black">+</button>
                    </div>
                  </div>
                  {p.qty > 0 && (
                    <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={`سبب ${i.nameAr}`}>
                      {reasons.map((r) => (
                        <button
                          key={r}
                          role="radio"
                          aria-checked={p.reason === r}
                          onClick={() => setPicks({ ...picks, [i.saleItemId]: { ...p, reason: r } })}
                          className={`min-h-[44px] px-3 rounded-xl border text-[11px] font-bold ${p.reason === r ? 'bg-amber-500 text-slate-950 border-amber-400' : 'bg-slate-900 border-slate-700 text-slate-300'}`}
                        >
                          {reasonAr[r]}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
            {error && <p role="alert" className="text-xs font-bold text-rose-400">{error}</p>}
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setStep(0)} className="min-h-[44px] rounded-xl bg-slate-800 font-bold text-xs">رجوع</button>
              <button onClick={() => setStep(2)} disabled={pickedCount === 0} className="min-h-[44px] rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 font-bold text-xs">التالي ({pickedCount})</button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-3 text-xs">
            <label className="flex items-center gap-2 font-bold cursor-pointer">
              <input type="checkbox" checked={isExchange} onChange={(e) => setIsExchange(e.target.checked)} className="w-5 h-5 accent-amber-500" />
              <ArrowLeftRight className="w-4 h-4 text-amber-400" /> استبدال بمقاس/صنف آخر (فاتورة جديدة مرتبطة)
            </label>
            {isExchange && (
              <div className="space-y-2 p-3 rounded-2xl bg-slate-950 border border-slate-800">
                <div className="flex gap-2">
                  <input value={exchangeSearch} onChange={(e) => setExchangeSearch(e.target.value)} aria-label="بحث عن الصنف البديل" placeholder="بحث عن البديل..." className="flex-1 min-h-[44px] p-2.5 rounded-xl bg-slate-900 border border-slate-700" />
                  <button onClick={searchExchange} className="min-h-[44px] px-4 rounded-xl bg-slate-800 font-bold">بحث</button>
                </div>
                {exchangeOptions.map((o) => (
                  <button key={o.id} onClick={() => setExchangeProduct(o.id)} className={`w-full min-h-[44px] p-2.5 rounded-xl border text-start flex justify-between ${exchangeProduct === o.id ? 'bg-blue-600/20 border-blue-500' : 'bg-slate-900 border-slate-800'}`}>
                    <span className="font-bold">{o.nameAr} <span className="text-slate-500 font-mono">{o.sku}</span></span>
                    <span className={o.stock > 0 ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>{o.stock > 0 ? `${o.stock} متاح` : 'نافد'}</span>
                  </button>
                ))}
                <div className="flex items-center gap-2">
                  <label htmlFor="rw-exqty" className="font-bold text-slate-300">الكمية:</label>
                  <NumberField id="rw-exqty" min={1} step={1} value={exchangeQty} onChange={setExchangeQty} inputClassName="w-20 text-center" />
                </div>
              </div>
            )}
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setStep(1)} className="min-h-[44px] rounded-xl bg-slate-800 font-bold">رجوع</button>
              <button onClick={() => setStep(3)} disabled={isExchange && !exchangeProduct} className="min-h-[44px] rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 font-bold">التالي</button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-3 text-xs">
            <div>
              <label htmlFor="rw-method" className="block font-bold text-slate-300 mb-1">طريقة الاسترداد</label>
              <select id="rw-method" value={refundMethod} onChange={(e) => setRefundMethod(e.target.value)} className="w-full min-h-[44px] p-2.5 rounded-xl bg-slate-950 border border-slate-700">
                <option value="">الأصلية تلقائياً</option>
                <option value="CASH">نقدي من الدرج</option>
                <option value="INSTAPAY">انستاباي</option>
                <option value="VODAFONE">فودافون كاش</option>
                <option value="BANK_TRANSFER">تحويل بنكي</option>
              </select>
            </div>
            <div>
              <label htmlFor="rw-pin" className="block font-bold text-slate-300 mb-1">PIN المدير (عند الحاجة — فوق الحد)</label>
              <input id="rw-pin" type="password" inputMode="numeric" value={managerPin} onChange={(e) => setManagerPin(e.target.value)} placeholder="••••" className="w-full min-h-[44px] p-2.5 rounded-xl bg-slate-950 border border-slate-700" />
              <p className="text-[11px] text-slate-500 mt-1">المبالغ الكبيرة أو النقدية فوق الحد تحتاج اعتماد مدير — أدخل الـ PIN هنا بدل رفض العملية.</p>
            </div>
            {error && <p role="alert" className="font-bold text-rose-400">{error}</p>}
            <div className="grid grid-cols-2 gap-2">
              <Button onClick={() => setStep(2)} className="bg-slate-800 font-bold">رجوع</Button>
              <Button onClick={() => setConfirming(true)} disabled={busy} variant="brand" className="font-black">
                {busy ? '...' : 'مراجعة وتأكيد'}
              </Button>
            </div>
          </div>
        )}

        {step === 4 && result && (
          <div className="space-y-3 text-center">
            <p className="font-black text-emerald-400">تم تسجيل المرتجع {result.returnNumber}</p>
            <p className="text-xs text-slate-300">المبلغ: {result.refundTotal.toLocaleString()} ج.م — {result.payout.ok ? 'تم الرد' : `بانتظار التنفيذ: ${result.payout.error || ''}`}</p>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => window.print()} className="min-h-[44px] rounded-xl bg-slate-800 font-bold text-xs">اطبع إيصال المرتجع</button>
              <button onClick={onClose} className="min-h-[44px] rounded-xl bg-blue-600 hover:bg-blue-500 font-bold text-xs">فاتورة جديدة</button>
            </div>
          </div>
        )}
      </div>
      <ConfirmDialog
        open={confirming}
        title="تأكيد المرتجع؟"
        impact={`سيُستلم ${pickedCount} صنف ويُرد المخزون القابل للبيع للفرع، مع تعديل النقاط والعمولة — راجع الأصناف قبل التأكيد.`}
        confirmLabel="تأكيد المرتجع"
        onConfirm={submit}
        onClose={() => { if (!busy) setConfirming(false); }}
        busy={busy}
      />
    </div>
  );
}
