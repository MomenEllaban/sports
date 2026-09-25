'use client';

import React, { useState } from 'react';
import { useRouter } from '@/i18n/routing';
import { Check, X, PackageCheck, RotateCcw, Banknote } from 'lucide-react';
import { apiFetch } from '@/components/admin/ui';
import { useToast } from '@/components/Toast';
import { SafeImage, Stepper, ConfirmDialog } from '@/components/ui/foundation';
import { useLocale } from 'next-intl';

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
    branch: { id: string; name: string; nameEn?: string | null };
    order: { id: string; orderNumber: string; totalAmount: number } | null;
    sale: { id: string; saleNumber: string; totalAmount: number } | null;
    items: Array<{
      id: string; quantity: number; reasonCode: string; condition: string;
      disposition: string; refundAmount: number; notes: string | null; images: string[];
      product: { id: string; nameAr: string; nameEn: string; sku: string; images: string[] };
    }>;
    refunds: Array<{ id: string; amount: number; method: string; status: string; gatewayRef: string | null; lastError: string | null; attempts: number }>;
  };
  canAct: boolean;
}

const STEPS = ['REQUESTED', 'APPROVED', 'RECEIVED', 'REFUND_PENDING', 'COMPLETED'];
const stepLabels: Record<string, { ar: string; en: string }> = {
  REQUESTED: { ar: 'طلب', en: 'Requested' }, APPROVED: { ar: 'اعتماد', en: 'Approved' }, RECEIVED: { ar: 'استلام', en: 'Received' }, REFUND_PENDING: { ar: 'استرداد', en: 'Refund' }, COMPLETED: { ar: 'مكتمل', en: 'Completed' },
};

export default function ReturnDetails({ data, canAct }: Props) {
  const router = useRouter();
  const isAr = useLocale() === 'ar';
  const L = (ar: string, en: string) => (isAr ? ar : en);
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
      toast(L('تم بنجاح', 'Done successfully'), 'success');
      setConfirm(null);
      router.refresh();
      return res;
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : L('فشل', 'Operation failed'), 'error');
      return null;
    } finally {
      setBusy('');
    }
  };

  const retryRefund = async (refundId: string) => {
    setBusy(`retry-${refundId}`);
    try {
      const res = (await apiFetch(`/api/admin/returns/refunds/${refundId}`, 'POST', {})) as { success?: boolean; result?: { error?: string } };
      toast(res.success ? L('تم رد المبلغ', 'Refund completed') : res.result?.error || L('فشل', 'Operation failed'), res.success ? 'success' : 'error');
      router.refresh();
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : L('فشل', 'Operation failed'), 'error');
    } finally {
      setBusy('');
    }
  };

  const manualSettle = async (refundId: string) => {
    if (!manualRef.trim()) {
      toast(L('أدخل مرجع التحويل', 'Enter the transfer reference'), 'error');
      return;
    }
    setBusy(`manual-${refundId}`);
    try {
      await apiFetch(`/api/admin/returns/refunds/${refundId}`, 'POST', { action: 'manual', gatewayRef: manualRef.trim(), proofImage: manualProof.trim() || undefined });
      toast(L('تم تسجيل التحويل اليدوي', 'Manual transfer recorded'), 'success');
      router.refresh();
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : L('فشل', 'Operation failed'), 'error');
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
          <span className="text-[11px] text-slate-400">{data.type} • {data.channel} • {isAr ? data.branch.name : data.branch.nameEn || data.branch.name}</span>
        </div>
        {!done && !['REJECTED', 'CANCELLED'].includes(data.status) && (
          <Stepper steps={STEPS.map((s) => stepLabels[s]?.[isAr ? 'ar' : 'en'] || s)} active={Math.max(0, stepIdx)} />
        )}
        {(data.status === 'REJECTED' || data.status === 'CANCELLED') && (
          <p className="text-xs font-bold text-slate-400">{L('الحالة', 'Status')}: {data.status === 'REJECTED' ? L('مرفوض', 'Rejected') : L('ملغي', 'Cancelled')} — {data.notes || ''}</p>
        )}
      </div>

      {/* Items with receive controls */}
      <div className="glass-panel p-5 rounded-3xl border border-slate-800 space-y-3">
        <h3 className="font-extrabold text-sm">{L('الأصناف والفحص', 'Items & inspection')}</h3>
        {data.items.map((ri, idx) => {
          const rc = receive[idx];
          return (
            <div key={ri.id} className="p-3 rounded-2xl bg-slate-900 border border-slate-800 space-y-2 text-xs">
              <div className="flex gap-2 items-center">
                <span className="relative w-12 h-12 rounded-xl overflow-hidden bg-slate-950 shrink-0 block">
                  <SafeImage src={ri.product.images[0] || '/placeholder-product.svg'} alt={isAr ? ri.product.nameAr : ri.product.nameEn} fill sizes="48px" className="object-cover" />
                </span>
                <div className="flex-1">
                  <div className="font-bold">{isAr ? ri.product.nameAr : ri.product.nameEn} <span className="text-slate-500 font-mono">×{ri.quantity}</span></div>
                  <div className="text-[11px] text-slate-500">{L('السبب', 'Reason')}: {ri.reasonCode} • {L('المصير', 'Disposition')}: {ri.disposition} • {L('المسترد', 'Refund')}: {ri.refundAmount.toLocaleString()}</div>
                </div>
              </div>
              {canAct && data.status === 'APPROVED' && (
                <div className="grid sm:grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 mb-1">{L('الحالة عند الاستلام', 'Condition on receipt')}</label>
                    <select
                      value={rc.condition}
                      onChange={(e) => setReceive(receive.map((x, i) => (i === idx ? { ...x, condition: e.target.value } : x)))}
                      className="w-full min-h-[44px] p-2 rounded-xl bg-slate-950 border border-slate-700"
                    >
                      <option value="GOOD">{L('سليم', 'Good')}</option>
                      <option value="DAMAGED">{L('تالف', 'Damaged')}</option>
                      <option value="DEFECTIVE">{L('عيب مصنعي', 'Defective')}</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 mb-1">{L('المصير', 'Disposition')}</label>
                    <select
                      value={rc.disposition}
                      onChange={(e) => setReceive(receive.map((x, i) => (i === idx ? { ...x, disposition: e.target.value } : x)))}
                      className="w-full min-h-[44px] p-2 rounded-xl bg-slate-950 border border-slate-700"
                    >
                      <option value="RESTOCK">{L('إعادة للبيع', 'Restock')}</option>
                      <option value="INSPECT">{L('فحص معلق', 'Pending inspection')}</option>
                      <option value="DAMAGED">{L('تالف (خارج البيع)', 'Damaged (not for sale)')}</option>
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
              <label htmlFor="rd-method" className="block text-[11px] font-bold text-slate-400 mb-1">{L('طريقة الاسترداد', 'Refund method')}</label>
              <select id="rd-method" value={refundMethod} onChange={(e) => setRefundMethod(e.target.value)} className="w-full min-h-[44px] p-2 rounded-xl bg-slate-950 border border-slate-700">
                <option value="ORIGINAL_GATEWAY">{L('الأصلية', 'Original gateway')}</option>
                <option value="CASH">{L('نقدي', 'Cash')}</option>
                <option value="INSTAPAY">InstaPay</option>
                <option value="VODAFONE">{L('فودافون كاش', 'Vodafone Cash')}</option>
                <option value="BANK_TRANSFER">{L('تحويل بنكي', 'Bank transfer')}</option>
              </select>
            </div>
            <div className="flex items-end">
              <button
                onClick={() => call('receive', { lines: receive, refundMethod })}
                disabled={busy !== ''}
                className="w-full sm:w-auto min-h-[44px] px-5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white text-xs font-black flex items-center gap-1"
              >
                <PackageCheck className="w-4 h-4" /> {L('استلام وتسجيل الاسترداد', 'Receive & record refund')}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Refunds */}
      {data.refunds.length > 0 && (
        <div className="glass-panel p-5 rounded-3xl border border-slate-800 space-y-3">
          <h3 className="font-extrabold text-sm">{L('الاسترداد', 'Refund')}</h3>
          {data.refunds.map((f) => (
            <div key={f.id} className="p-3 rounded-2xl bg-slate-900 border border-slate-800 text-xs space-y-2">
              <div className="flex flex-wrap justify-between gap-2">
                <span className="font-black">{f.amount.toLocaleString()} {L('ج.م', 'EGP')} • {f.method}</span>
                <span className={`px-2 py-0.5 rounded-lg font-bold text-[10px] ${f.status === 'DONE' ? 'bg-emerald-500/15 text-emerald-400' : f.status === 'FAILED' || f.status === 'MANUAL_REQUIRED' ? 'bg-rose-500/15 text-rose-400' : 'bg-amber-500/15 text-amber-300'}`}>
                  {f.status}
                </span>
              </div>
              {f.lastError && <p className="text-rose-400">{f.lastError} ({L('محاولات', 'attempts')}: {f.attempts})</p>}
              {f.gatewayRef && <p className="text-slate-400 font-mono" dir="ltr">{f.gatewayRef}</p>}
              {canAct && (f.status === 'FAILED' || f.status === 'PENDING') && (
                <button onClick={() => retryRefund(f.id)} disabled={busy !== ''} className="min-h-[44px] px-4 rounded-xl bg-slate-800 font-bold flex items-center gap-1 disabled:opacity-60">
                  <RotateCcw className="w-4 h-4" /> {L('إعادة المحاولة', 'Retry')}
                </button>
              )}
              {canAct && f.status === 'MANUAL_REQUIRED' && (
                <div className="grid sm:grid-cols-[1fr_1fr_auto] gap-2">
                  <input value={manualRef} onChange={(e) => setManualRef(e.target.value)} placeholder={L('مرجع التحويل *', 'Transfer reference *')} aria-label={L('مرجع التحويل', 'Transfer reference')} className="min-h-[44px] p-2.5 rounded-xl bg-slate-950 border border-slate-700" />
                  <input value={manualProof} onChange={(e) => setManualProof(e.target.value)} placeholder={L('رابط صورة الإثبات (اختياري)', 'Proof image URL (optional)')} dir="ltr" aria-label={L('صورة الإثبات', 'Proof image')} className="min-h-[44px] p-2.5 rounded-xl bg-slate-950 border border-slate-700" />
                  <button onClick={() => manualSettle(f.id)} disabled={busy !== ''} className="min-h-[44px] px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 font-bold flex items-center gap-1">
                    <Banknote className="w-4 h-4" /> {L('تسجيل يدوي', 'Record manually')}
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
                <Check className="w-4 h-4" /> {L('اعتماد', 'Approve')}
              </button>
              <button onClick={() => setConfirm({ action: 'reject', title: L('رفض المرتجع؟', 'Reject return?'), impact: L('لن يُستلم ولن يُسترد أي مبلغ. سجّل السبب للعميل.', 'No items will be received or refunded. Record the reason for the customer.') })} disabled={busy !== ''} className="min-h-[44px] px-5 rounded-xl bg-rose-600/20 border border-rose-500/40 text-rose-300 text-xs font-bold flex items-center gap-1">
                <X className="w-4 h-4" /> {L('رفض', 'Reject')}
              </button>
            </>
          )}
          {(data.status === 'REQUESTED' || data.status === 'APPROVED') && (
            <button onClick={() => setConfirm({ action: 'cancel', title: L('إلغاء المرتجع؟', 'Cancel return?'), impact: L('يُغلق الطلب قبل الاستلام بلا أي أثر مخزني أو مالي.', 'Closes the request before receipt with no stock or financial effect.') })} disabled={busy !== ''} className="min-h-[44px] px-5 rounded-xl bg-slate-800 text-xs font-bold">
              {L('إلغاء', 'Cancel')}
            </button>
          )}
        </div>
      )}

      {confirm?.action === 'reject' && (
        <div className="mt-3">
          <label htmlFor="return-reject-reason" className="mb-1 block text-xs font-bold text-slate-300">{L('سبب الرفض', 'Reason for rejection')}</label>
          <input id="return-reject-reason" value={reason} onChange={(event) => setReason(event.target.value)} placeholder={L('اكتب سبب الرفض للعميل', 'Write the rejection reason for the customer')} className="min-h-11 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100" />
        </div>
      )}

      <ConfirmDialog
        open={confirm !== null}
        title={confirm?.title || ''}
        impact={confirm?.impact || ''}
        confirmLabel={L('تأكيد', 'Confirm')}
        onConfirm={() => confirm && call(confirm.action, confirm.action === 'reject' ? { reason: reason.trim() } : {})}
        onClose={() => setConfirm(null)}
        busy={busy !== ''}
      />
    </div>
  );
}
