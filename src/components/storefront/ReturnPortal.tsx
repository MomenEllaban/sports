'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useLocale } from 'next-intl';
import {
  RotateCcw,
  X,
  Check,
  Upload,
  Camera,
  Package,
  ShieldAlert,
  Loader2,
  ReceiptText,
  ClipboardList,
} from 'lucide-react';
import { DirectionalIcon } from '@/components/ui/foundation';
import { apiRequest } from '@/lib/client-api';

type EItem = {
  orderItemId: string;
  productId: string;
  nameAr: string;
  nameEn?: string;
  sku: string;
  images: string[];
  quantity: number;
  unitPrice: number;
  blocked: boolean;
  blockedReason: string | null;
  blockedReasonEn?: string | null;
};

type Eligibility = {
  success: boolean;
  eligible: boolean;
  reasons: string[];
  reasonsEn?: string[];
  orderNumber: string;
  items: EItem[];
  policyDays: number;
};

type TrackResult = {
  success: boolean;
  return?: {
    returnNumber: string;
    status: string;
    type: string;
    branch: string;
    branchEn?: string;
    createdAt: string;
    updatedAt: string;
    items: Array<{ nameAr: string; nameEn?: string; quantity: number; reasonCode: string; refundAmount: number }>;
    refunds: Array<{ amount: number; method: string; status: string }>;
  };
  error?: string;
};

const REASONS: Array<{ code: string; ar: string; en: string }> = [
  { code: 'SIZE_ISSUE', ar: 'مقاس غير مناسب', en: 'Wrong size' },
  { code: 'DEFECTIVE', ar: 'عيب مصنعي أو تلف', en: 'Defective / damaged' },
  { code: 'WRONG_ITEM', ar: 'صنف خاطئ بالمقارنة بالطلب', en: 'Wrong item delivered' },
  { code: 'NOT_AS_DESCRIBED', ar: 'غير مطابق للوصف أو الصور', en: 'Not as described' },
  { code: 'CHANGED_MIND', ar: 'تغيّر رأيي', en: 'Changed my mind' },
  { code: 'OTHER', ar: 'سبب آخر', en: 'Other' },
];

const PHOTO_REQUIRED_REASONS = new Set(['DEFECTIVE']);

type Selected = { quantity: number; reasonCode: string; images: string[] };

export function ReturnRequestPanel({ orderNumber, phone }: { orderNumber: string; phone: string }) {
  const isAr = useLocale() === 'ar';
  const L = useCallback((ar: string, en: string) => (isAr ? ar : en), [isAr]);

  const [elig, setElig] = useState<Eligibility | null>(null);
  const [loadingElig, setLoadingElig] = useState(true);
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [selected, setSelected] = useState<Record<string, Selected>>({});
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [subError, setSubError] = useState('');
  const [result, setResult] = useState<{ returnNumber: string; status: string; slaHours: number } | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void apiRequest<Eligibility>(`/api/returns/request?${new URLSearchParams({ order: orderNumber, phone })}`, { errorKey: 'storefront:returns:eligibility' })
      .then((d) => {
        if (!cancelled) {
          setElig(d);
          if (d.items) {
            const init: Record<string, Selected> = {};
            for (const it of d.items) {
              if (!it.blocked) init[it.orderItemId] = { quantity: 1, reasonCode: 'SIZE_ISSUE', images: [] };
            }
            setSelected(init);
          }
        }
      })
      .catch(() => !cancelled && setElig({ success: false, eligible: false, reasons: ['تعذر الاتصال'], reasonsEn: ['Connection failed'], orderNumber, items: [], policyDays: 0 }))
      .finally(() => !cancelled && setLoadingElig(false));
    return () => { cancelled = true; };
  }, [orderNumber, phone, L]);

  const notBlocked = (elig?.items ?? []).filter((i) => !i.blocked);
  const isDefectiveOnly = Object.values(selected).some((s) => s.reasonCode === 'DEFECTIVE');
  const photosMissing =
    Object.values(selected).length > 0 &&
    Object.values(selected).every((s) => PHOTO_REQUIRED_REASONS.has(s.reasonCode) && s.images.length === 0);

  const uploadImage = async (file: File) => {
    setUploading(true);
    setSubError('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      const data = await apiRequest<{ url: string }>('/api/upload/receipt', {
        method: 'POST',
        body: fd,
        errorKey: 'storefront:returns:upload',
      });
      const withDefect = Object.fromEntries(
        Object.entries(selected).map(([k, s]) => [k, { ...s, images: s.reasonCode === 'DEFECTIVE' && s.images.length < 3 ? [...s.images, data.url] : s.images }])
      );
      setSelected(withDefect);
    } catch (e) {
      setSubError(e instanceof Error ? e.message : L('تعذر رفع الصورة', 'Could not upload the photo'));
    } finally {
      setUploading(false);
    }
  };

  const submit = async () => {
    setSubmitting(true);
    setSubError('');
    const items = Object.entries(selected)
      .filter(([, s]) => s.quantity > 0)
      .map(([orderItemId, s]) => {
        const it = (elig?.items ?? []).find((x) => x.orderItemId === orderItemId);
        return {
          orderItemId,
          productId: it!.productId,
          quantity: Math.min(s.quantity, it!.quantity),
          reasonCode: s.reasonCode,
          images: s.reasonCode === 'DEFECTIVE' ? s.images.slice(0, 3) : [],
        };
      });
    try {
      const data = await apiRequest<{ returnNumber: string; status: string; slaHours: number }>('/api/returns/request', {
        method: 'POST',
        body: JSON.stringify({
          phone,
          orderNumber,
          items: items.filter((i) => i.quantity > 0),
          notes: notes.trim() || undefined,
          clientRequestId: `${orderNumber}-${Date.now()}`,
        }),
        errorKey: 'storefront:returns:create',
      });
      setResult({ returnNumber: data.returnNumber, status: data.status, slaHours: data.slaHours });
    } catch {
      setSubError(L('تعذر الاتصال بالسيرفر', 'Cannot reach the server'));
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingElig) {
    return (
      <div className="rounded-2xl bg-slate-900 border border-slate-800 p-4 text-xs text-slate-400 flex items-center gap-2">
        <Loader2 className="w-4 h-4 animate-spin text-blue-400" /> {L('جاري التحقق من إمكانية المرتجع...', 'Checking return eligibility...')}
      </div>
    );
  }

  if (!elig?.success || !elig.eligible) {
    return (
      <div className="rounded-2xl bg-slate-900/60 border border-slate-800 p-4 text-xs text-slate-400 flex items-start gap-2">
        <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
        <div>
          <p className="font-bold text-rose-300">{L('المرتجعات غير متاحة لهذا الطلب', 'Returns are not available for this order')}</p>
          {(isAr ? (elig?.reasons ?? []) : (elig?.reasonsEn ?? elig?.reasons ?? [])).map((r, i) => (
            <p key={i} className="mt-0.5 text-slate-400">• {r}</p>
          ))}
        </div>
      </div>
    );
  }

  if (result) {
    return (
      <div className="rounded-2xl bg-emerald-500/10 border border-emerald-500/40 p-4 text-xs space-y-2">
        <div className="flex items-center gap-2 font-black text-emerald-300">
          <Check className="w-5 h-5" /> {L('تم استلام طلب المرتجع بنجاح', 'Return request submitted')}
        </div>
        <p className="text-slate-200">
          {L('رقم المرتجع:', 'Return number:')} <span className="font-black text-amber-400" dir="ltr">{result.returnNumber}</span>
        </p>
        <p className="text-slate-400">
          {L(
            `الحالة: ${result.status} — نراجع الطلب ونرد خلال حتى ${result.slaHours} ساعة.`,
            `Status: ${STATUS_LABELS.en[result.status] || result.status} — we review requests and respond within up to ${result.slaHours} hours.`
          )}
        </p>
        <p className="text-slate-400">{L('تابع الحالة من قسم "متابعة مرتجع" بالأسفل.', 'Follow up from the “Track a return” section below.')}</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-slate-900/60 border border-slate-800">
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="w-full min-h-[44px] flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-orange-500/15 hover:bg-orange-500 text-orange-400 hover:text-white border border-orange-500/40 font-bold text-xs transition-all"
        >
          <RotateCcw className="w-4 h-4" /> {L('طلب مرتجع لأصناف من هذا الطلب', 'Request a return for items in this order')}
        </button>
      ) : (
        <div className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-black text-slate-100 text-sm">
              <RotateCcw className="w-5 h-5 text-orange-400" />
              {L('طلب مرتجع', 'Return request')}
            </div>
            <button onClick={() => setOpen(false)} aria-label={L('إغلاق', 'Close')} className="min-h-[44px] min-w-[44px] p-2.5 rounded-lg hover:bg-slate-800 text-slate-400 flex items-center justify-center">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Stepper */}
          <div className="flex items-center gap-1 text-[10px] font-bold text-slate-400">
            {[1, 2, 3].map((s) => (
              <React.Fragment key={s}>
                {s > 1 && <div className="h-px flex-1 bg-slate-800" />}
                <div className={`px-2 py-1 rounded-lg ${step === s ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400'}`}>
                  {L(['الأصناف والسبب', 'التفاصيل والصور', 'المراجعة'][s - 1], ['Items & reason', 'Details & photos', 'Review'][s - 1])}
                </div>
              </React.Fragment>
            ))}
          </div>

          {subError && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs">{subError}</div>
          )}

          {step === 1 && (
            <div className="space-y-3">
              <p className="text-xs text-slate-400">{L('اختر الأصناف وحدد السبب لكل صنف.', 'Pick the items and choose a reason for each.')}</p>
              {elig.items.map((it) => {
                const sel = selected[it.orderItemId];
                return (
                  <div key={it.orderItemId} className={`p-3 rounded-xl border ${it.blocked ? 'border-slate-800 opacity-60' : 'border-slate-700'}`}>
                    {it.blocked ? (
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-slate-400">{isAr ? it.nameAr : it.nameEn || it.nameAr}</span>
                        <span className="text-[10px] text-rose-400">{isAr ? it.blockedReason : it.blockedReasonEn || it.blockedReason}</span>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-bold text-slate-200">{isAr ? it.nameAr : it.nameEn || it.nameAr}</span>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => setSelected({ ...selected, [it.orderItemId]: { ...sel, quantity: Math.max(1, sel.quantity - 1) } })}
                              className="w-11 h-11 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-black text-base"
                              aria-label={`${L('إنقاص كمية', 'Decrease quantity of')} ${isAr ? it.nameAr : it.nameEn || it.nameAr}`}
                            >−</button>
                            <span className="w-6 text-center text-xs font-black tabular-nums text-amber-400">{sel.quantity}</span>
                            <button
                              onClick={() => setSelected({ ...selected, [it.orderItemId]: { ...sel, quantity: Math.min(it.quantity, sel.quantity + 1) } })}
                              className="w-11 h-11 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-black text-base"
                              aria-label={`${L('زيادة كمية', 'Increase quantity of')} ${isAr ? it.nameAr : it.nameEn || it.nameAr}`}
                            >+</button>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {REASONS.map((r) => (
                            <button
                              key={r.code}
                              onClick={() => setSelected({ ...selected, [it.orderItemId]: { ...sel, reasonCode: r.code } })}
                              className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-colors ${
                                sel.reasonCode === r.code
                                  ? 'bg-blue-600/30 border-blue-500 text-blue-300'
                                  : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-slate-200'
                              }`}
                            >
                              {r.code === 'DEFECTIVE' ? `${r[isAr ? 'ar' : 'en']} *` : r[isAr ? 'ar' : 'en']}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
              {notBlocked.length === 0 && <p className="text-xs text-rose-400">{L('كل أصناف هذا الطلب غير قابلة للاسترجاع.', 'All items in this order cannot be returned.')}</p>}
              <button
                onClick={() => setStep(2)}
                disabled={notBlocked.length === 0}
                className="w-full min-h-[44px] rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-xs font-black transition-all flex items-center justify-center gap-2"
              >
                {L('التالي', 'Next')} <DirectionalIcon className="w-4 h-4" />
              </button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-3">
              <p className="text-xs text-slate-400">
                {L('نصيحة مختصرة عن سبب عيب مصنعي (وارد الكام). نحتاج صورة إثبات واحدة على الأقل.', 'If any item is defective, please attach at least one photo.')}
              </p>
              {isDefectiveOnly && photosMissing && (
                <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/25 text-amber-300 text-[11px]">
                  {L('الصور مطلوبة للأصناف وحرف (العيب المصنعي).', 'Photos are required for “defective” items.')}
                </div>
              )}
              <label className="flex items-center justify-center gap-2 min-h-[44px] px-3 py-2 rounded-xl bg-slate-900 border border-dashed border-slate-700 text-slate-300 hover:border-blue-500 text-xs font-bold cursor-pointer transition-colors">
                <Upload className="w-4 h-4 text-blue-400" />
                {uploading ? L('جاري الرفع...', 'Uploading...') : L('ارفع صورة إثبات (حتى 3)', 'Upload proof photo (up to 3)')}
                <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden" onChange={(e) => e.target.files?.[0] && uploadImage(e.target.files[0])} />
              </label>
              {Object.values(selected).flatMap((s) => s.images).length > 0 && (
                <div className="flex items-center gap-2 text-[11px] text-emerald-400">
                  <Camera className="w-4 h-4" />
                  <span>{L('تم رفع الصور بنجاح.', 'Photos uploaded.')}</span>
                </div>
              )}
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder={L('تفاصيل إضافية (اختياري)...', 'Additional details (optional)...')}
                className="w-full px-3 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-100 focus:outline-none focus:border-blue-500 placeholder:text-slate-500"
              />
              <button onClick={() => setStep(1)} className="text-xs text-slate-400 hover:text-slate-200">
                {L('رجوع', 'Back')}
              </button>
              <button
                onClick={() => setStep(3)}
                disabled={photosMissing}
                className="w-full min-h-[44px] rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-xs font-black transition-all"
              >
                {L('المراجعة والإرسال', 'Review & submit')}
              </button>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-3">
              <ClipboardList className="w-6 h-6 text-blue-400" />
              <div className="space-y-2">
                {Object.entries(selected)
                  .filter(([, s]) => s.quantity > 0)
                  .map(([id, s]) => {
                    const it = elig.items.find((x) => x.orderItemId === id);
                    const reason = REASONS.find((r) => r.code === s.reasonCode);
                    return (
                      <div key={id} className="flex items-center justify-between p-2 rounded-xl bg-slate-900 text-xs">
                        <div>
                          <p className="font-bold text-slate-200">{it ? (isAr ? it.nameAr : it.nameEn || it.nameAr) : ''}</p>
                          <p className="text-[10px] text-slate-500">{s.quantity} × ({reason ? reason[isAr ? 'ar' : 'en'] : s.reasonCode})</p>
                        </div>
                        <span className="font-black text-amber-400 tabular-nums">{(s.quantity * it!.unitPrice).toLocaleString()}</span>
                      </div>
                    );
                  })}
              </div>
              <button
                onClick={submit}
                disabled={submitting || Object.values(selected).filter((s) => s.quantity > 0).length === 0}
                className="w-full min-h-[44px] rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-xs font-black transition-all flex items-center justify-center gap-2"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                {L('تأكيد وإرسال طلب المرتجع', 'Confirm & submit request')}
              </button>
              <button onClick={() => setStep(2)} disabled={submitting} className="text-xs text-slate-400 hover:text-slate-200">
                {L('رجوع', 'Back')}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const STATUS_STEPS: Array<{ start: string[]; ar: string; en: string; icon: 'req' | 'rcv' | 'appr' | 'ref' | 'done' }> = [
  { start: ['REQUESTED'], ar: 'ننتظر استلامك الأصناف في الفرع', en: 'Awaiting items at the branch', icon: 'req' },
  { start: ['RECEIVED'], ar: 'تم استلام الأصناف', en: 'Items received', icon: 'rcv' },
  { start: ['APPROVED'], ar: 'تمت مراجعة الأصناف والموافقة', en: 'Reviewed & approved', icon: 'appr' },
  { start: ['REFUND_PENDING'], ar: 'جاري إصدار الاسترداد', en: 'Refund in progress', icon: 'ref' },
  { start: ['COMPLETED'], ar: 'اكتمل المرتجع', en: 'Return completed', icon: 'done' },
];

export function ReturnTrackerPanel() {
  const isAr = useLocale() === 'ar';
  const L = (ar: string, en: string) => (isAr ? ar : en);

  const [rtn, setRtn] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [res, setRes] = useState<TrackResult | null>(null);
  const [err, setErr] = useState('');

  const search = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rtn.trim() || !phone.trim()) return;
    setLoading(true);
    setErr('');
    setRes(null);
    try {
      const d = await apiRequest<TrackResult>(`/api/returns/track?${new URLSearchParams({ rtn: rtn.trim().toUpperCase(), phone: phone.trim() })}`, { errorKey: 'storefront:returns:track' });
      setRes(d);
    } catch {
      setErr(L('تعذر الاتصال بالسيرفر', 'Cannot reach the server'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="glass-panel p-5 rounded-3xl border border-slate-800 space-y-4">
      <div className="flex items-center gap-2">
        <ReceiptText className="w-5 h-5 text-orange-400" />
        <h3 className="font-black text-slate-100 text-sm">{L('متابعة مرتجع (RTN)', 'Track a return (RTN)')}</h3>
      </div>
      <form onSubmit={search} className="flex flex-col sm:flex-row gap-2">
        <input
          value={rtn}
          onChange={(e) => setRtn(e.target.value)}
          aria-label={L('رقم المرتجع', 'Return number')}
          placeholder={L('رقم المرتجع (مثال: RTN-...)', 'Return number (e.g. RTN-...)')}
          className="flex-1 min-h-[44px] px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-100 focus:outline-none focus:border-orange-500"
          dir="ltr"
        />
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          aria-label={L('رقم الموبايل', 'Phone number')}
          placeholder={L('رقم الموبايل المستخدم في الطلب', 'Phone used for the request')}
          className="flex-1 min-h-[44px] px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-100 focus:outline-none focus:border-orange-500"
          dir="ltr"
        />
        <button
          type="submit"
          disabled={loading || !rtn.trim() || !phone.trim()}
          className="min-h-[44px] px-5 rounded-xl bg-orange-500 hover:bg-orange-400 text-slate-950 font-black text-xs disabled:opacity-40 transition-all flex items-center justify-center gap-2"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
          {L('تتبع', 'Track')}
        </button>
      </form>

      {err && <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs">{err}</div>}

      {res?.return && (
        <ReturnTimeline r={res.return} />
      )}
    </div>
  );
}

const STATUS_LABELS: Record<'ar' | 'en', Record<string, string>> = {
  ar: {
    REQUESTED: 'طلب',
    APPROVED: 'معتمد',
    RECEIVED: 'مستلم',
    REFUND_PENDING: 'بانتظار الاسترداد',
    COMPLETED: 'مكتمل',
    REJECTED: 'مرفوض',
    CANCELLED: 'ملغي',
  },
  en: {
    REQUESTED: 'Requested',
    APPROVED: 'Approved',
    RECEIVED: 'Received',
    REFUND_PENDING: 'Refund pending',
    COMPLETED: 'Completed',
    REJECTED: 'Rejected',
    CANCELLED: 'Cancelled',
  },
};

function ReturnTimeline({ r }: { r: NonNullable<TrackResult['return']> }) {
  const isAr = useLocale() === 'ar';
  const L = (ar: string, en: string) => (isAr ? ar : en);
  const currentStatus = r.status;
  const reached = (start: string[]) => start.some((s) => currentStatus.startsWith(s));
  const terminal = ['REJECTED', 'CANCELLED', 'FAILED'];
  const refundDone = r.refunds?.some((f) => f.status === 'SUCCEEDED');

  return (
    <div className="space-y-3 text-xs">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="font-black text-amber-400" dir="ltr">{r.returnNumber}</span>
          <span className="px-2.5 py-1 rounded-full bg-slate-900 border border-slate-700 font-bold text-slate-300">
            {STATUS_LABELS[isAr ? 'ar' : 'en'][currentStatus] || currentStatus}
          </span>
        </div>

          <div className="space-y-2">
            {STATUS_STEPS.map((s, i) => {
              const done = reached(s.start) || (i === 4 && refundDone);
              const isNow = currentStatus.startsWith(s.start[0]) && !done;
              return (
                <div key={i} className="flex items-center gap-3">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${done ? 'bg-emerald-500 text-slate-950' : isNow ? 'bg-blue-600 text-white animate-pulse' : 'bg-slate-800 text-slate-500'}`}>
                    {done ? <Check className="w-3.5 h-3.5" /> : <Package className="w-3 h-3" />}
                  </div>
                  <div>
                    <p className={`font-bold ${done ? 'text-emerald-300' : isNow ? 'text-blue-300' : 'text-slate-500'}`}>{L(s.ar, s.en)}</p>
                    {s.icon === 'ref' && r.refunds?.[0] && (
                      <p className="text-[10px] text-slate-500">
                        {L('الاسترداد:', 'Refund:')} {r.refunds[0].amount.toLocaleString()} {L('ج.م', 'EGP')} — {r.refunds.map((f) => (isAr ? f.status : (STATUS_LABELS.en[f.status] || f.status))).join(', ')}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {terminal.some((t) => currentStatus.startsWith(t)) && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400">
              {L('انتهى هذا المرتجع بحالة غير مكتملة. تواصل معنا واتساب للمتابعة.', 'This return ended incomplete. Contact us on WhatsApp to follow up.')}
            </div>
          )}
        </div>
  );
}