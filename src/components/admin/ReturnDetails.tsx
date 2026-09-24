'use client';

import React, { useState } from 'react';
import { useRouter } from '@/i18n/routing';
import { Check, X, PackageCheck, RotateCcw, Banknote } from 'lucide-react';
import { apiFetch } from '@/components/admin/ui';
import { useToast } from '@/components/Toast';
import { SafeImage, Stepper, ConfirmDialog } from '@/components/ui/foundation';

interface Props {
  data: {
    id: string;
    returnNumber: string;
    status: string;
    type: string;
    channel: string;
    source: string;
    notes: string | null;
    etaStatus: string;
    exchangeSaleId: string | null;
    createdAt: string;
    updatedAt: string;
    customerPhone: string | null;
    branch: { id: string; name: string };
    order: { id: string; orderNumber: string; totalAmount: number } | null;
    sale: { id: string; saleNumber: string; totalAmount: number } | null;
    items: Array<{
      id: string; quantity: number; reasonCode: string; condition: string;
      disposition: string; refundAmount: number; notes: string | null; images: string[];
      product: { id: string; nameAr: string; sku: string; images: string[] };
    }>;
    refunds: Array<{ id: string; amount: number; method: string; status: string; gatewayRef: string | null; lastError: string | null; attempts: number }>;
  };
  canAct: boolean;
}

const STEPS = ['REQUESTED', 'APPROVED', 'RECEIVED', 'REFUND_PENDING', 'COMPLETED'];
const stepAr: Record<string, string> = {
  REQUESTED: 'طلب', APPROVED: 'اعتماد', RECEIVED: 'استلام', REFUND_PENDING: 'استرداد', COMPLETED: 'مكتمل',
};

export default function ReturnDetails({ data, canAct }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [busy, setBusy] = useState('');
  const [confirm, setConfirm] = useState<null | { action: string; title: string; impact: string }>(null);
  const [reason, setReason] = useState('');
  const [receive, setReceive] = useState(data.items.map((i) => ({ returnItemId: i.id, condition: i.condition, disposition: i.disposition })));
  const [refundMethod, setRefundMethod] = useState('ORIGINAL_GATEWAY');
  const [manualRef, setManualRef] = useState('');
  const [manualProof, setManualProof] = useState('');

  const call = async (action: string, extra: Record<string, unknown> = {}) => {
    setBusy(action);
    try {
      const res = (await apiFetch(`/api/admin/returns/${data.id}`, 'POST', { action, ...extra })) as { refund?: unknown; quote?: { total?: number } };
      toast('تم بنجاح', 'success');
      setConfirm(null);
      router.refresh();
      return res;
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : 'فشل', 'error');
      return null;
    } finally {
      setBusy('');
    }
  };

  const retryRefund = async (refundId: string) => {
    setBusy(`retry-${refundId}`);
    try {
      const res = (await apiFetch(`/api/admin/returns/refunds/${refundId}`, 'POST', {})) as { success?: boolean; result?: { error?: string } };
      toast(res.success ? 'تم رد المبلغ' : res.result?.error || 'فشل', res.success ? 'success' : 'error');
      router.refresh();
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : 'فشل', 'error');
    } finally {
      setBusy('');
    }
  };

  const manualSettle = async (refundId: string) => {
    if (!manualRef.trim()) {
      toast('أدخل مرجع التحويل', 'error');
      return;
    }
    setBusy(`manual-${refundId}`);
    try {
      await apiFetch(`/api/admin/returns/refunds/${refundId}`, 'POST', { action: 'manual', gatewayRef: manualRef.trim(), proofImage: manualProof.trim() || undefined });
      toast('تم تسجيل التحويل اليدوي', 'success');
      router.refresh();
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : 'فشل', 'error');
    } finally {
      setBusy('');
    }
  };

  const stepIdx = STEPS.indexOf(data.status);
  const done = data.status === 'COMPLETED';

  return (
    <div className="space-y-6">
      {/* Header + timeline */}
      <div className="glass-panel p-5 rounded-3xl border border-slate-800 space-y-3">
        <div className="flex flex-wrap justify-between gap-2 items-center">
          <h2 className="font-mono font-black text-amber-400" dir="ltr">{data.returnNumber}</h2>
          <span className="text-[11px] text-slate-400">{data.type} • {data.channel} • {data.branch.name}</span>
        </div>
        {!done && !['REJECTED', 'CANCELLED'].includes(data.status) && (
          <Stepper steps={STEPS.map((s) => stepAr[s])} active={Math.max(0, stepIdx)} />
        )}
        {(data.status === 'REJECTED' || data.status === 'CANCELLED') && (
          <p className="text-xs font-bold text-slate-400">الحالة: {data.status === 'REJECTED' ? 'مرفوض' : 'ملغي'} — {data.notes || ''}</p>
        )}
      </div>

      {/* Items with receive controls */}
      <div className="glass-panel p-5 rounded-3xl border border-slate-800 space-y-3">
        <h3 className="font-extrabold text-sm">الأصناف والفحص</h3>
        {data.items.map((ri, idx) => {
          const rc = receive[idx];
          return (
            <div key={ri.id} className="p-3 rounded-2xl bg-slate-900 border border-slate-800 space-y-2 text-xs">
              <div className="flex gap-2 items-center">
                <span className="relative w-12 h-12 rounded-xl overflow-hidden bg-slate-950 shrink-0 block">
                  <SafeImage src={ri.product.images[0] || '/placeholder-product.svg'} alt={ri.product.nameAr} fill sizes="48px" className="object-cover" />
                </span>
                <div className="flex-1">
                  <div className="font-bold">{ri.product.nameAr} <span className="text-slate-500 font-mono">×{ri.quantity}</span></div>
                  <div className="text-[11px] text-slate-500">السبب: {ri.reasonCode} • المصير: {ri.disposition} • المسترد: {ri.refundAmount.toLocaleString()}</div>
                </div>
              </div>
              {canAct && data.status === 'APPROVED' && (
                <div className="grid sm:grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 mb-1">الحالة عند الاستلام</label>
                    <select
                      value={rc.condition}
                      onChange={(e) => setReceive(receive.map((x, i) => (i === idx ? { ...x, condition: e.target.value } : x)))}
                      className="w-full min-h-[44px] p-2 rounded-xl bg-slate-950 border border-slate-700"
                    >
                      <option value="GOOD">سليم</option>
                      <option value="DAMAGED">تالف</option>
                      <option value="DEFECTIVE">عيب مصنعي</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 mb-1">المصير</label>
                    <select
                      value={rc.disposition}
                      onChange={(e) => setReceive(receive.map((x, i) => (i === idx ? { ...x, disposition: e.target.value } : x)))}
                      className="w-full min-h-[44px] p-2 rounded-xl bg-slate-950 border border-slate-700"
                    >
                      <option value="RESTOCK">إعادة للبيع</option>
                      <option value="INSPECT">فحص معلق</option>
                      <option value="DAMAGED">تالف (خارج البيع)</option>
                    </select>
                  </div>
                </div>
              )}
            </div>
          );
        })}
        {canAct && data.status === 'APPROVED' && (
          <div className="grid sm:grid-cols-[1fr_auto] gap-2">
            <div>
              <label htmlFor="rd-method" className="block text-[11px] font-bold text-slate-400 mb-1">طريقة الاسترداد</label>
              <select id="rd-method" value={refundMethod} onChange={(e) => setRefundMethod(e.target.value)} className="w-full min-h-[44px] p-2 rounded-xl bg-slate-950 border border-slate-700">
                <option value="ORIGINAL_GATEWAY">الأصلية</option>
                <option value="CASH">نقدي</option>
                <option value="INSTAPAY">انستاباي</option>
                <option value="VODAFONE">فودافون كاش</option>
                <option value="BANK_TRANSFER">تحويل بنكي</option>
              </select>
            </div>
            <div className="flex items-end">
              <button
                onClick={() => call('receive', { lines: receive, refundMethod })}
                disabled={busy !== ''}
                className="w-full sm:w-auto min-h-[44px] px-5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white text-xs font-black flex items-center gap-1"
              >
                <PackageCheck className="w-4 h-4" /> استلام وتسجيل الاسترداد
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Refunds */}
      {data.refunds.length > 0 && (
        <div className="glass-panel p-5 rounded-3xl border border-slate-800 space-y-3">
          <h3 className="font-extrabold text-sm">الاسترداد</h3>
          {data.refunds.map((f) => (
            <div key={f.id} className="p-3 rounded-2xl bg-slate-900 border border-slate-800 text-xs space-y-2">
              <div className="flex flex-wrap justify-between gap-2">
                <span className="font-black">{f.amount.toLocaleString()} ج.م • {f.method}</span>
                <span className={`px-2 py-0.5 rounded-lg font-bold text-[10px] ${f.status === 'DONE' ? 'bg-emerald-500/15 text-emerald-400' : f.status === 'FAILED' || f.status === 'MANUAL_REQUIRED' ? 'bg-rose-500/15 text-rose-400' : 'bg-amber-500/15 text-amber-300'}`}>
                  {f.status}
                </span>
              </div>
              {f.lastError && <p className="text-rose-400">{f.lastError} (محاولات: {f.attempts})</p>}
              {f.gatewayRef && <p className="text-slate-400 font-mono" dir="ltr">{f.gatewayRef}</p>}
              {canAct && (f.status === 'FAILED' || f.status === 'PENDING') && (
                <button onClick={() => retryRefund(f.id)} disabled={busy !== ''} className="min-h-[44px] px-4 rounded-xl bg-slate-800 font-bold flex items-center gap-1 disabled:opacity-60">
                  <RotateCcw className="w-4 h-4" /> إعادة المحاولة
                </button>
              )}
              {canAct && f.status === 'MANUAL_REQUIRED' && (
                <div className="grid sm:grid-cols-[1fr_1fr_auto] gap-2">
                  <input value={manualRef} onChange={(e) => setManualRef(e.target.value)} placeholder="مرجع التحويل *" aria-label="مرجع التحويل" className="min-h-[44px] p-2.5 rounded-xl bg-slate-950 border border-slate-700" />
                  <input value={manualProof} onChange={(e) => setManualProof(e.target.value)} placeholder="رابط صورة الإثبات (اختياري)" dir="ltr" aria-label="صورة الإثبات" className="min-h-[44px] p-2.5 rounded-xl bg-slate-950 border border-slate-700" />
                  <button onClick={() => manualSettle(f.id)} disabled={busy !== ''} className="min-h-[44px] px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 font-bold flex items-center gap-1">
                    <Banknote className="w-4 h-4" /> تسجيل يدوي
                  </button>
                </div>
              )}
            </div>
          ))}
          <p className="text-[11px] text-slate-500">ETA credit: {data.etaStatus}</p>
        </div>
      )}

      {/* Actions by state */}
      {canAct && (
        <div className="flex flex-wrap gap-2">
          {data.status === 'REQUESTED' && (
            <>
              <button onClick={() => call('approve')} disabled={busy !== ''} className="min-h-[44px] px-5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white text-xs font-black flex items-center gap-1">
                <Check className="w-4 h-4" /> اعتماد
              </button>
              <button onClick={() => setConfirm({ action: 'reject', title: 'رفض المرتجع؟', impact: 'لن يُستلم ولن يُسترد أي مبلغ. سجّل السبب للعميل.' })} disabled={busy !== ''} className="min-h-[44px] px-5 rounded-xl bg-rose-600/20 border border-rose-500/40 text-rose-300 text-xs font-bold flex items-center gap-1">
                <X className="w-4 h-4" /> رفض
              </button>
            </>
          )}
          {(data.status === 'REQUESTED' || data.status === 'APPROVED') && (
            <button onClick={() => setConfirm({ action: 'cancel', title: 'إلغاء المرتجع؟', impact: 'يُغلق الطلب قبل الاستلام بلا أي أثر مخزني أو مالي.' })} disabled={busy !== ''} className="min-h-[44px] px-5 rounded-xl bg-slate-800 text-xs font-bold">
              إلغاء
            </button>
          )}
        </div>
      )}

      {confirm?.action === 'reject' && (
        <div className="mt-3">
          <label htmlFor="return-reject-reason" className="mb-1 block text-xs font-bold text-slate-300">سبب الرفض</label>
          <input id="return-reject-reason" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="اكتب سبب الرفض للعميل" className="min-h-11 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100" />
        </div>
      )}

      <ConfirmDialog
        open={confirm !== null}
        title={confirm?.title || ''}
        impact={confirm?.impact || ''}
        confirmLabel="تأكيد"
        onConfirm={() => confirm && call(confirm.action, confirm.action === 'reject' ? { reason: reason.trim() } : {})}
        onClose={() => setConfirm(null)}
        busy={busy !== ''}
      />
    </div>
  );
}
