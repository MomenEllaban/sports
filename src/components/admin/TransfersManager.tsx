'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { ArrowLeftRight } from 'lucide-react';
import { Modal, StatusBadge, apiFetch } from './ui';
import { getClientErrorMessage } from '@/lib/client-api';
import { useToast } from '@/components/Toast';
import { inputCls, Button, Pagination } from '@/components/ui/foundation';

interface BranchOpt { id: string; name: string; nameEn: string }
interface ProductOpt { id: string; nameAr: string; nameEn: string }
interface TransferItem {
  id: string;
  sku: string;
  nameAr: string;
  nameEn: string;
  quantity: number;
  quantityShipped: number;
  quantityReceived: number;
  outstanding: number;
}
interface TransferRow {
  id: string;
  transferNumber: string;
  status: string;
  fromBranchId: string;
  fromBranchName: string;
  fromBranchNameEn: string;
  toBranchId: string;
  toBranchName: string;
  toBranchNameEn: string;
  notes: string | null;
  cancelReason: string | null;
  createdAt: string;
  itemCount: number;
  totalRequested: number;
  totalShipped: number;
  totalReceived: number;
  items: TransferItem[];
  availableActions: string[];
}
interface TransferPage {
  rows: TransferRow[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

const STATUS_FILTERS = [
  'PENDING',
  'APPROVED',
  'IN_TRANSIT',
  'PARTIALLY_RECEIVED',
  'COMPLETED',
  'REJECTED',
  'CANCELLED',
];

const PAGE_SIZE = 8;

/**
 * Transfer lifecycle console. The list is server-paginated and branch-scoped,
 * and every action posts a single transition; the server owns the compare-and-swap
 * and the stock movement, so the UI never moves stock itself.
 */
export default function TransfersManager({
  branches,
  products,
}: {
  branches: BranchOpt[];
  products: ProductOpt[];
}) {
  const t = useTranslations('admin');
  const locale = useLocale();
  const { toast } = useToast();
  const isAr = locale === 'ar';

  const [data, setData] = useState<TransferPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState('');
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [branchId, setBranchId] = useState('');
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');

  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [fromBranchId, setFromBranchId] = useState(branches[0]?.id || '');
  const [toBranchId, setToBranchId] = useState(branches[1]?.id || branches[0]?.id || '');
  const [lines, setLines] = useState<Array<{ productId: string; quantity: number }>>([
    { productId: products[0]?.id || '', quantity: 1 },
  ]);

  const [receiving, setReceiving] = useState<TransferRow | null>(null);
  const [receiveLines, setReceiveLines] = useState<Record<string, number>>({});
  const [canceling, setCanceling] = useState<TransferRow | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [busyId, setBusyId] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setListError('');
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
      if (status) params.set('status', status);
      if (branchId) params.set('branchId', branchId);
      if (query) params.set('q', query);
      const res = await apiFetch<TransferPage>(`/api/admin/transfers?${params.toString()}`, 'GET');
      setData(res);
    } catch (e) {
      setListError(getClientErrorMessage(e, t('operationFailed')));
    } finally {
      setLoading(false);
    }
  }, [page, status, branchId, query, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const bName = (r: TransferRow, from: boolean) =>
    (isAr ? (from ? r.fromBranchName : r.toBranchName) : from ? r.fromBranchNameEn : r.toBranchNameEn);
  const iName = (i: TransferItem) => (isAr ? i.nameAr : i.nameEn);

  const act = async (row: TransferRow, action: string, extra: Record<string, unknown> = {}) => {
    setBusyId(row.id);
    try {
      await apiFetch(`/api/admin/transfers/${row.id}`, 'POST', { action, ...extra });
      toast(t('operationSuccess'), 'success');
      await load();
    } catch (e) {
      toast(getClientErrorMessage(e, t('operationFailed')), 'error');
      throw e;
    } finally {
      setBusyId('');
    }
  };

  const submitCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFormError('');
    try {
      await apiFetch('/api/admin/transfers', 'POST', { fromBranchId, toBranchId, items: lines });
      setShowCreate(false);
      setLines([{ productId: products[0]?.id || '', quantity: 1 }]);
      toast(t('operationSuccess'), 'success');
      setPage(1);
      await load();
    } catch (err) {
      setFormError(getClientErrorMessage(err, t('operationFailed')));
    } finally {
      setSaving(false);
    }
  };

  const openReceive = (row: TransferRow) => {
    setReceiving(row);
    // Pre-fill with everything still outstanding: a full receipt is the common
    // case, and the manager can lower a line instead of retyping everything.
    const initial: Record<string, number> = {};
    for (const item of row.items) initial[item.id] = item.outstanding;
    setReceiveLines(initial);
  };

  const submitReceive = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!receiving) return;
    setSaving(true);
    try {
      const payload = receiving.items
        .map((i) => ({ itemId: i.id, quantityReceived: receiveLines[i.id] ?? 0 }))
        .filter((l) => l.quantityReceived > 0);
      await act(receiving, 'receive', { lines: payload });
      setReceiving(null);
      toast(t('transferReceiveSaved'), 'success');
    } catch {
      /* act() already surfaced the reason */
    } finally {
      setSaving(false);
    }
  };

  const submitCancel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canceling) return;
    if (!cancelReason.trim()) return;
    setSaving(true);
    try {
      await act(canceling, 'cancel', { reason: cancelReason.trim() });
      setCanceling(null);
      setCancelReason('');
      toast(t('transferCancelled'), 'success');
    } catch {
      /* act() already surfaced the reason */
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap justify-between items-center gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                setQuery(q.trim());
                setPage(1);
              }
            }}
            onBlur={() => {
              setQuery(q.trim());
              setPage(1);
            }}
            placeholder={t('transferSearch')}
            aria-label={t('transferSearch')}
            className={`${inputCls} max-w-[260px]`}
          />
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
            aria-label={t('transferAllStatuses')}
            className={`${inputCls} max-w-[190px]`}
          >
            <option value="">{t('transferAllStatuses')}</option>
            {STATUS_FILTERS.map((s) => (
              <option key={s} value={s}>
                {t(`status_${s}`)}
              </option>
            ))}
          </select>
          {branches.length > 1 && (
            <select
              value={branchId}
              onChange={(e) => {
                setBranchId(e.target.value);
                setPage(1);
              }}
              aria-label={t('transferAllBranches')}
              className={`${inputCls} max-w-[190px]`}
            >
              <option value="">{t('transferAllBranches')}</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {isAr ? b.name : b.nameEn}
                </option>
              ))}
            </select>
          )}
        </div>
        <Button onClick={() => setShowCreate(true)} variant="brand">
          <ArrowLeftRight className="w-4 h-4" />
          {t('newTransfer')}
        </Button>
      </div>

      {listError && (
        <div role="alert" className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs">
          {listError}
        </div>
      )}

      <div className="space-y-3" aria-busy={loading}>
        {!loading && (data?.rows.length ?? 0) === 0 && (
          <div className="text-center text-xs text-slate-500 py-8">{t('noTransfers')}</div>
        )}
        {data?.rows.map((tr) => (
          <div key={tr.id} className="p-4 rounded-2xl bg-slate-900 border border-slate-800 text-xs space-y-2">
            <div className="flex flex-wrap justify-between items-center gap-2">
              <span className="font-extrabold text-amber-400">{tr.transferNumber}</span>
              <StatusBadge value={tr.status} />
            </div>
            <div className="text-slate-300">
              {bName(tr, true)} ← {bName(tr, false)}
            </div>
            <div className="app-scrollbar overflow-x-auto">
              <table className="w-full text-[11px]">
                <thead className="text-slate-400">
                  <tr>
                    <th className="pb-1 text-start">{isAr ? 'الصنف' : 'Item'}</th>
                    <th className="pb-1">{t('transferShipped')}</th>
                    <th className="pb-1">{t('transferReceived')}</th>
                    <th className="pb-1">{t('transferOutstanding')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {tr.items.map((i) => (
                    <tr key={i.id}>
                      <td className="py-1 text-slate-200">
                        {iName(i)} <span className="text-slate-500">{i.sku}</span>
                      </td>
                      <td className="py-1 text-center text-slate-300">{i.quantityShipped}</td>
                      <td className="py-1 text-center text-emerald-400">{i.quantityReceived}</td>
                      <td className={`py-1 text-center ${i.outstanding > 0 ? 'text-amber-400' : 'text-slate-500'}`}>
                        {i.outstanding}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {tr.cancelReason && <div className="text-rose-400/90">{tr.cancelReason}</div>}

            <div className="flex flex-wrap gap-2 pt-1">
              {tr.availableActions.includes('approve') && (
                <button
                  type="button"
                  disabled={busyId === tr.id}
                  onClick={() => void act(tr, 'approve')}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white font-bold text-xs"
                >
                  {t('transferApprove')}
                </button>
              )}
              {tr.availableActions.includes('reject') && (
                <button
                  type="button"
                  disabled={busyId === tr.id}
                  onClick={() => void act(tr, 'reject').catch(() => null)}
                  className="px-4 py-2 rounded-xl bg-rose-600/20 hover:bg-rose-600 border border-rose-500/40 text-rose-400 hover:text-white font-bold text-xs"
                >
                  {t('transferReject')}
                </button>
              )}
              {tr.availableActions.includes('ship') && (
                <button
                  type="button"
                  disabled={busyId === tr.id}
                  onClick={() => {
                    if (window.confirm(t('transferShipConfirm'))) void act(tr, 'ship').catch(() => null);
                  }}
                  className="px-4 py-2 rounded-xl bg-blue-600/20 hover:bg-blue-600 border border-blue-500/40 text-blue-300 hover:text-white font-bold text-xs"
                >
                  {t('transferShip')}
                </button>
              )}
              {tr.availableActions.includes('receive') && (
                <button
                  type="button"
                  disabled={busyId === tr.id}
                  onClick={() => openReceive(tr)}
                  className="px-4 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500 border border-amber-500/40 text-amber-300 hover:text-slate-950 font-bold text-xs"
                >
                  {t('transferReceive')}
                </button>
              )}
              {tr.availableActions.includes('cancel') && (
                <button
                  type="button"
                  disabled={busyId === tr.id}
                  onClick={() => {
                    setCanceling(tr);
                    setCancelReason('');
                  }}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-bold text-xs"
                >
                  {t('transferCancel')}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {data && data.total > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <span className="text-[11px] font-bold text-slate-400">
            {isAr ? `${data.total} تحويل` : `${data.total} transfers`}
          </span>
          <Pagination page={data.page} totalPages={data.pageCount} onPageChange={setPage} />
        </div>
      )}

      {showCreate && (
        <Modal title={t('newTransfer')} onClose={() => setShowCreate(false)}>
          <form onSubmit={submitCreate} className="space-y-3 text-xs">
            {formError && (
              <div role="alert" className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400">
                {formError}
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-400 mb-1">
                  {isAr ? 'الفرع المصدر (من) *' : 'From Branch *'}
                </label>
                <select value={fromBranchId} onChange={(e) => setFromBranchId(e.target.value)} className={inputCls}>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {isAr ? b.name : b.nameEn}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-400 mb-1">
                  {isAr ? 'الفرع المستلم (إلى) *' : 'To Branch *'}
                </label>
                <select value={toBranchId} onChange={(e) => setToBranchId(e.target.value)} className={inputCls}>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {isAr ? b.name : b.nameEn}
                    </option>
                  ))}
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
                      copy[idx] = { ...copy[idx], productId: e.target.value };
                      setLines(copy);
                    }}
                    className={`${inputCls} col-span-2`}
                  >
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {isAr ? p.nameAr : p.nameEn}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min={1}
                    value={line.quantity}
                    placeholder={isAr ? 'الكمية' : 'Qty'}
                    onChange={(e) => {
                      const copy = [...lines];
                      copy[idx] = { ...copy[idx], quantity: Number(e.target.value) };
                      setLines(copy);
                    }}
                    className={inputCls}
                  />
                </div>
              </div>
            ))}
            <button
              type="button"
              onClick={() => setLines([...lines, { productId: products[0]?.id || '', quantity: 1 }])}
              className="text-blue-400 font-bold hover:underline"
            >
              + {isAr ? 'إضافة صنف' : 'Add item'}
            </button>
            <button
              type="submit"
              disabled={saving}
              className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-slate-950 font-extrabold transition-all"
            >
              {saving ? t('loading') : t('confirm')}
            </button>
          </form>
        </Modal>
      )}

      {receiving && (
        <Modal title={`${t('transferReceiveTitle')} — ${receiving.transferNumber}`} onClose={() => setReceiving(null)}>
          <form onSubmit={submitReceive} className="space-y-3 text-xs">
            <p className="text-slate-400">{t('transferReceiveHint')}</p>
            <div className="space-y-2">
              {receiving.items.map((i) => (
                <div key={i.id} className="flex items-center justify-between gap-3">
                  <span className="text-slate-200">
                    {iName(i)} <span className="text-slate-500">{i.sku}</span>
                  </span>
                  <input
                    type="number"
                    min={0}
                    max={i.outstanding}
                    value={receiveLines[i.id] ?? 0}
                    onChange={(e) =>
                      setReceiveLines((prev) => ({ ...prev, [i.id]: Number(e.target.value) }))
                    }
                    aria-label={`${iName(i)} — ${t('transferReceive')}`}
                    className={`${inputCls} max-w-[110px]`}
                  />
                </div>
              ))}
            </div>
            <button
              type="submit"
              disabled={saving}
              className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-slate-950 font-extrabold transition-all"
            >
              {saving ? t('loading') : t('confirm')}
            </button>
          </form>
        </Modal>
      )}

      {canceling && (
        <Modal title={`${t('transferCancel')} — ${canceling.transferNumber}`} onClose={() => setCanceling(null)}>
          <form onSubmit={submitCancel} className="space-y-3 text-xs">
            <label className="block text-[11px] font-bold text-slate-400" htmlFor="cancel-reason">
              {t('transferCancelReason')}
            </label>
            <textarea
              id="cancel-reason"
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              rows={3}
              required
              className={inputCls}
            />
            <button
              type="submit"
              disabled={saving || !cancelReason.trim()}
              className="w-full py-3 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-60 text-white font-extrabold transition-all"
            >
              {saving ? t('loading') : t('confirm')}
            </button>
          </form>
        </Modal>
      )}
    </div>
  );
}
