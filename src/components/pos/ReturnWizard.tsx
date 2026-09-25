'use client';

import React, { useState } from 'react';
import { RotateCcw, Search, ArrowLeftRight } from 'lucide-react';
import { useToast } from '@/components/Toast';
import { Stepper, SafeImage, ConfirmDialog, Button, NumberField, DialogFrame } from '@/components/ui/foundation';
import { apiRequest } from '@/lib/client-api';
import { useLocale } from 'next-intl';

interface LookupItem {
  saleItemId: string; productId: string; nameAr: string; nameEn: string; sku: string;
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
  const isAr = useLocale() === 'ar';
  const L = (ar: string, en: string) => (isAr ? ar : en);
  const currencyLabel = L('ج.م', 'EGP');
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
  const [exchangeOptions, setExchangeOptions] = useState<Array<{ id: string; nameAr: string; nameEn: string; sku: string; price: number; stock: number }>>([]);
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
      const data = await apiRequest<{ lookup?: boolean; sales?: LookupSale[]; error?: string }>('/api/pos/returns', {
        method: 'POST',
        body: JSON.stringify({ saleNumber: find.trim() || undefined, customerPhone: phone.trim() || undefined }),
        errorKey: 'pos:returns:lookup',
      });
      if (data.lookup) {
        setCandidates(data.sales || []);
        if (!data.sales || data.sales.length === 0) setError(L('لا فواتير مطابقة', 'No matching invoices'));
      }
    } catch {
      setError(L('تعذر الاتصال — المرتجع يحتاج إنترنت ولا يعمل أوفلاين', 'Connection failed — returns require an internet connection and do not work offline'));
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
    const data = await apiRequest<{ products?: Array<{ id: string; nameAr: string; nameEn: string; sku: string; price: number; inventories?: Array<{ stockQuantity: number }> }> }>(`/api/pos/products?q=${encodeURIComponent(exchangeSearch.trim())}`, { errorKey: 'pos:returns:exchange-search' });
    if (Array.isArray(data.products)) {
      setExchangeOptions(data.products.slice(0, 8).map((p: { id: string; nameAr: string; nameEn: string; sku: string; price: number; inventories?: Array<{ stockQuantity: number }> }) => ({
        id: p.id, nameAr: p.nameAr, nameEn: p.nameEn, sku: p.sku, price: p.price,
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
      const data = await apiRequest<{ returnNumber: string; status: string; refundTotal: number; payout?: { ok: boolean; error?: string }; needsPin?: boolean; error?: string }>('/api/pos/returns', {
        method: 'POST',
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
        errorKey: 'pos:returns:create',
      });
      setResult({ returnNumber: data.returnNumber, status: data.status, refundTotal: data.refundTotal, payout: data.payout || { ok: false } });
      toast(L(`تم تسجيل المرتجع ${data.returnNumber}`, `Return ${data.returnNumber} recorded`), 'success');
      setStep(4);
      onDone();
    } catch {
      setError(L('تعذر الاتصال — المرتجع يحتاج إنترنت ولا يعمل أوفلاين', 'Connection failed — returns require an internet connection and do not work offline'));
    } finally {
      setBusy(false);
      setConfirming(false);
    }
  };

  const reasons = ['SIZE_ISSUE', 'DEFECTIVE', 'WRONG_ITEM', 'NOT_AS_DESCRIBED', 'CHANGED_MIND', 'OTHER'];
  const reasonLabels: Record<string, string> = {
    SIZE_ISSUE: L('مقاس', 'Size issue'), DEFECTIVE: L('عيب مصنعي', 'Defective'), WRONG_ITEM: L('صنف خطأ', 'Wrong item'),
    NOT_AS_DESCRIBED: L('غير مطابق', 'Not as described'), CHANGED_MIND: L('تغيير رأي', 'Changed mind'), OTHER: L('أخرى', 'Other'),
  };

  return (
    <>
      <DialogFrame
        title={L('مرتجع / استبدال', 'Return / exchange')}
        onClose={onClose}
        size="lg"
        panelClassName="max-w-2xl"
        bodyClassName="space-y-4"
        header={<span className="flex items-center gap-2"><RotateCcw className="h-5 w-5 text-amber-400" />{L('مرتجع / استبدال', 'Return / exchange')}</span>}
      >
        <Stepper steps={[L('الفاتورة', 'Invoice'), L('الأصناف', 'Items'), L('استبدال', 'Exchange'), L('التسوية', 'Settlement'), L('تم', 'Done')]} active={Math.min(step, 4)} />

        {step === 0 && (
          <div className="space-y-3">
            <div className="grid sm:grid-cols-2 gap-2">
              <div>
                <label htmlFor="rw-sale" className="block text-xs font-bold text-slate-300 mb-1">{L('رقم الفاتورة / باركود الإيصال', 'Invoice number / receipt barcode')}</label>
                <input id="rw-sale" value={find} onChange={(e) => setFind(e.target.value)} dir="ltr" placeholder="POS-2026-000123" className="w-full min-h-[44px] p-3 rounded-xl bg-slate-950 border border-slate-700 font-mono font-bold" />
              </div>
              <div>
                <label htmlFor="rw-phone" className="block text-xs font-bold text-slate-300 mb-1">{L('أو هاتف العميل (آخر فواتيره)', 'Or customer phone (recent invoices)')}</label>
                <input id="rw-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} dir="ltr" placeholder="01xxxxxxxxx" className="w-full min-h-[44px] p-3 rounded-xl bg-slate-950 border border-slate-700 font-bold" />
              </div>
            </div>
            <button onClick={lookup} disabled={busy} className="min-h-[44px] px-5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white text-xs font-bold flex items-center gap-1">
              <Search className="w-4 h-4" /> {busy ? '...' : L('بحث', 'Search')}
            </button>
            {error && <p role="alert" className="text-xs font-bold text-rose-400">{error}</p>}
            {candidates.length > 0 && (
              <ul className="space-y-2">
                {candidates.map((s) => (
                  <li key={s.id}>
                    <button onClick={() => chooseSale(s)} className="w-full min-h-[44px] p-3 rounded-2xl bg-slate-950 border border-slate-700 hover:border-blue-500 text-start text-xs flex justify-between gap-2">
                      <span className="font-mono font-bold text-amber-400" dir="ltr">{s.saleNumber}</span>
                      <span>{s.totalAmount.toLocaleString()} {currencyLabel} • {new Date(s.createdAt).toLocaleDateString(isAr ? 'ar-EG' : 'en-EG')}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {step === 1 && sale && (
          <div className="space-y-3">
            <p className="text-xs text-slate-400">{L('الفاتورة', 'Invoice')} <span className="font-mono font-bold text-amber-400" dir="ltr">{sale.saleNumber}</span> — {L('حدد الكميات والأسباب', 'Select quantities and reasons')}: </p>
            {sale.items.map((i) => {
              const p = picks[i.saleItemId] || { qty: 0, reason: 'SIZE_ISSUE' };
              return (
                <div key={i.saleItemId} className="p-3 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
                  <div className="flex gap-2 items-center">
                    <span className="relative w-12 h-12 rounded-xl overflow-hidden bg-slate-900 shrink-0 block">
                      <SafeImage src={i.images[0] || '/placeholder-product.svg'} alt={isAr ? i.nameAr : i.nameEn || i.nameAr} fill sizes="48px" className="object-cover" />
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-xs truncate">{isAr ? i.nameAr : i.nameEn || i.nameAr}</div>
                      <div className="text-[11px] text-slate-500">{L('المباع', 'Sold')} {i.quantity} • {L('المتاح للإرجاع', 'Available for return')} {i.quantity}</div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => setPicks({ ...picks, [i.saleItemId]: { ...p, qty: Math.max(0, p.qty - 1) } })} aria-label={`${L('إنقاص كمية', 'Decrease quantity')} ${isAr ? i.nameAr : i.nameEn || i.nameAr}`} className="min-h-[44px] min-w-[44px] rounded-lg bg-slate-800 font-black">−</button>
                      <span className="w-8 text-center font-black" aria-live="polite">{p.qty}</span>
                      <button onClick={() => setPicks({ ...picks, [i.saleItemId]: { ...p, qty: Math.min(i.quantity, p.qty + 1) } })} aria-label={`${L('زيادة كمية', 'Increase quantity')} ${isAr ? i.nameAr : i.nameEn || i.nameAr}`} className="min-h-[44px] min-w-[44px] rounded-lg bg-slate-800 font-black">+</button>
                    </div>
                  </div>
                  {p.qty > 0 && (
                    <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={`${L('سبب', 'Reason')} ${isAr ? i.nameAr : i.nameEn || i.nameAr}`}>
                      {reasons.map((r) => (
                        <button
                          key={r}
                          role="radio"
                          aria-checked={p.reason === r}
                          onClick={() => setPicks({ ...picks, [i.saleItemId]: { ...p, reason: r } })}
                          className={`min-h-[44px] px-3 rounded-xl border text-[11px] font-bold ${p.reason === r ? 'bg-amber-500 text-slate-950 border-amber-400' : 'bg-slate-900 border-slate-700 text-slate-300'}`}
                        >
                          {reasonLabels[r]}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
            {error && <p role="alert" className="text-xs font-bold text-rose-400">{error}</p>}
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setStep(0)} className="min-h-[44px] rounded-xl bg-slate-800 font-bold text-xs">{L('رجوع', 'Back')}</button>
              <button onClick={() => setStep(2)} disabled={pickedCount === 0} className="min-h-[44px] rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 font-bold text-xs">{L('التالي', 'Next')} ({pickedCount})</button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-3 text-xs">
            <label className="flex items-center gap-2 font-bold cursor-pointer">
              <input type="checkbox" checked={isExchange} onChange={(e) => setIsExchange(e.target.checked)} className="w-5 h-5 accent-amber-500" />
              <ArrowLeftRight className="w-4 h-4 text-amber-400" /> {L('استبدال بمقاس/صنف آخر (فاتورة جديدة مرتبطة)', 'Exchange for another size/item (linked new invoice)')}
            </label>
            {isExchange && (
              <div className="space-y-2 p-3 rounded-2xl bg-slate-950 border border-slate-800">
                <div className="flex gap-2">
                  <input value={exchangeSearch} onChange={(e) => setExchangeSearch(e.target.value)} aria-label={L('بحث عن الصنف البديل', 'Search replacement item')} placeholder={L('بحث عن البديل...', 'Search replacement...')} className="flex-1 min-h-[44px] p-2.5 rounded-xl bg-slate-900 border border-slate-700" />
                  <button onClick={searchExchange} className="min-h-[44px] px-4 rounded-xl bg-slate-800 font-bold">{L('بحث', 'Search')}</button>
                </div>
                {exchangeOptions.map((o) => (
                  <button key={o.id} onClick={() => setExchangeProduct(o.id)} className={`w-full min-h-[44px] p-2.5 rounded-xl border text-start flex justify-between ${exchangeProduct === o.id ? 'bg-blue-600/20 border-blue-500' : 'bg-slate-900 border-slate-800'}`}>
                    <span className="font-bold">{isAr ? o.nameAr : o.nameEn || o.nameAr} <span className="text-slate-500 font-mono">{o.sku}</span></span>
                    <span className={o.stock > 0 ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>{o.stock > 0 ? `${o.stock} ${L('متاح', 'available')}` : L('نافد', 'Out')}</span>
                  </button>
                ))}
                <div className="flex items-center gap-2">
                  <label htmlFor="rw-exqty" className="font-bold text-slate-300">{L('الكمية', 'Quantity')}:</label>
                  <NumberField id="rw-exqty" min={1} step={1} value={exchangeQty} onChange={setExchangeQty} inputClassName="w-20 text-center" />
                </div>
              </div>
            )}
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setStep(1)} className="min-h-[44px] rounded-xl bg-slate-800 font-bold">{L('رجوع', 'Back')}</button>
              <button onClick={() => setStep(3)} disabled={isExchange && !exchangeProduct} className="min-h-[44px] rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 font-bold">{L('التالي', 'Next')}</button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-3 text-xs">
            <div>
              <label htmlFor="rw-method" className="block font-bold text-slate-300 mb-1">{L('طريقة الاسترداد', 'Refund method')}</label>
              <select id="rw-method" value={refundMethod} onChange={(e) => setRefundMethod(e.target.value)} className="w-full min-h-[44px] p-2.5 rounded-xl bg-slate-950 border border-slate-700">
                <option value="">{L('الأصلية تلقائياً', 'Original method automatically')}</option>
                <option value="CASH">{L('نقدي من الدرج', 'Cash from drawer')}</option>
                <option value="INSTAPAY">{L('انستاباي', 'InstaPay')}</option>
                <option value="VODAFONE">{L('فودافون كاش', 'Vodafone Cash')}</option>
                <option value="BANK_TRANSFER">{L('تحويل بنكي', 'Bank transfer')}</option>
              </select>
            </div>
            <div>
              <label htmlFor="rw-pin" className="block font-bold text-slate-300 mb-1">{L('PIN المدير (عند الحاجة — فوق الحد)', 'Manager PIN (when required — above limit)')}</label>
              <input id="rw-pin" type="password" inputMode="numeric" value={managerPin} onChange={(e) => setManagerPin(e.target.value)} placeholder="••••" className="w-full min-h-[44px] p-2.5 rounded-xl bg-slate-950 border border-slate-700" />
              <p className="text-[11px] text-slate-500 mt-1">{L('المبالغ الكبيرة أو النقدية فوق الحد تحتاج اعتماد مدير — أدخل الـ PIN هنا بدل رفض العملية.', 'Large amounts or cash above the limit require manager approval — enter the PIN here instead of rejecting the operation.')}</p>
            </div>
            {error && <p role="alert" className="font-bold text-rose-400">{error}</p>}
            <div className="grid grid-cols-2 gap-2">
              <Button onClick={() => setStep(2)} className="bg-slate-800 font-bold">{L('رجوع', 'Back')}</Button>
              <Button onClick={() => setConfirming(true)} disabled={busy} variant="brand" className="font-black">
                {busy ? '...' : L('مراجعة وتأكيد', 'Review & confirm')}
              </Button>
            </div>
          </div>
        )}

        {step === 4 && result && (
          <div className="space-y-3 text-center">
            <p className="font-black text-emerald-400">{L('تم تسجيل المرتجع', 'Return recorded')} {result.returnNumber}</p>
            <p className="text-xs text-slate-300">{L('المبلغ', 'Amount')}: {result.refundTotal.toLocaleString()} {currencyLabel} — {result.payout.ok ? L('تم الرد', 'Refunded') : `${L('بانتظار التنفيذ', 'Pending execution')}: ${result.payout.error || ''}`}</p>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => window.print()} className="min-h-[44px] rounded-xl bg-slate-800 font-bold text-xs">{L('اطبع إيصال المرتجع', 'Print return receipt')}</button>
              <button onClick={onClose} className="min-h-[44px] rounded-xl bg-blue-600 hover:bg-blue-500 font-bold text-xs">{L('فاتورة جديدة', 'New invoice')}</button>
            </div>
          </div>
        )}
      </DialogFrame>
      <ConfirmDialog
        open={confirming}
        title={L('تأكيد المرتجع؟', 'Confirm return?')}
        impact={`${L(`سيُستلم ${pickedCount} صنف ويُرد المخزون القابل للبيع للفرع، مع تعديل النقاط والعمولة — راجع الأصناف قبل التأكيد.`, `${pickedCount} items will be received and sellable branch stock will be restored, with points and commission adjusted — review the items before confirming.`)}`}
        confirmLabel={L('تأكيد المرتجع', 'Confirm return')}
        onConfirm={submit}
        onClose={() => { if (!busy) setConfirming(false); }}
        busy={busy}
      />
    </>
  );
}
