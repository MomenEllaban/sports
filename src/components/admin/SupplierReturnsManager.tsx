'use client';

import React, { useState } from 'react';
import { useLocale } from 'next-intl';
import { useRouter } from '@/i18n/routing';
import {
  RotateCcw,
  Search,
  Package,
  Calendar,
  AlertCircle,
  Truck,
  CheckCircle,
} from 'lucide-react';
import { Modal, apiFetch } from './ui';
import { useToast } from '@/components/Toast';
import { inputCls, Button } from '@/components/ui/foundation';

interface ReturnLog {
  id: string;
  referenceId: string | null;
  changeQuantity: number;
  newQuantity: number;
  createdAt: string;
  notes: string | null;
  product: { nameAr: string; nameEn: string; sku: string };
  branch: { name: string; nameEn: string };
}

interface PurchaseOrderWithItems {
  id: string;
  poNumber: string;
  status: string;
  branch: { id: string; name: string; nameEn: string };
  supplier: { id: string; name: string };
  items: Array<{
    id: string;
    productId: string;
    quantityOrdered: number;
    quantityReceived: number;
    unitCost: number;
    product: { id: string; nameAr: string; nameEn: string; sku: string };
  }>;
}

export default function SupplierReturnsManager({
  returnLogs,
  eligiblePurchaseOrders,
}: {
  returnLogs: ReturnLog[];
  eligiblePurchaseOrders: PurchaseOrderWithItems[];
}) {
  const locale = useLocale();
  const router = useRouter();
  const { toast } = useToast();
  const isAr = locale === 'ar';
  const L = (ar: string, en: string) => (isAr ? ar : en);

  const [activeTab, setActiveTab] = useState<'history' | 'eligible'>('history');
  const [search, setSearch] = useState('');

  // Return modal state
  const [selectedPo, setSelectedPo] = useState<PurchaseOrderWithItems | null>(null);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [returnQty, setReturnQty] = useState(1);
  const [returnReason, setReturnReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const openReturnModal = (po: PurchaseOrderWithItems) => {
    setSelectedPo(po);
    const firstReceived = po.items.find((i) => i.quantityReceived > 0);
    setSelectedProductId(firstReceived ? firstReceived.productId : '');
    setReturnQty(1);
    setReturnReason('');
    setSubmitError('');
  };

  const selectedItem = selectedPo?.items.find((i) => i.productId === selectedProductId);
  const maxAvailable = selectedItem ? selectedItem.quantityReceived : 0;

  const handleExecuteReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPo || !selectedProductId) return;
    if (returnQty <= 0 || returnQty > maxAvailable) {
      setSubmitError(L(`الكمية يجب أن تكون بين 1 و ${maxAvailable}`, `Quantity must be between 1 and ${maxAvailable}`));
      return;
    }
    if (!returnReason.trim()) {
      setSubmitError(L('يرجى ذكر سبب الإرجاع للمورد', 'Please provide a return reason'));
      return;
    }

    setSubmitting(true);
    setSubmitError('');
    try {
      await apiFetch(`/api/admin/purchase-orders/${selectedPo.id}/return`, 'POST', {
        productId: selectedProductId,
        quantity: returnQty,
        reason: returnReason.trim(),
      });

      toast(L('تم تسجيل إرجاع البضاعة للمورد وخصمها من رصيد المخزون بنجاح', 'Supplier return executed and stock decremented'), 'success');
      setSelectedPo(null);
      router.refresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : L('فشل في تسجيل المرتجع', 'Could not record return');
      setSubmitError(msg);
      toast(msg, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredLogs = returnLogs.filter(
    (l) =>
      (l.referenceId || '').toLowerCase().includes(search.toLowerCase()) ||
      l.product.nameAr.toLowerCase().includes(search.toLowerCase()) ||
      l.product.sku.toLowerCase().includes(search.toLowerCase())
  );

  const filteredOrders = eligiblePurchaseOrders.filter(
    (o) =>
      o.poNumber.toLowerCase().includes(search.toLowerCase()) ||
      o.supplier.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      {/* Sub Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('history')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'history'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            <RotateCcw className="w-3.5 h-3.5 inline ml-1.5" />
            {L('سجل المرتجعات المنفذة', 'Executed Returns History')} ({returnLogs.length})
          </button>
          <button
            onClick={() => setActiveTab('eligible')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'eligible'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            <Truck className="w-3.5 h-3.5 inline ml-1.5" />
            {L('أوامر الشراء المستلمة (بدء مرتجع جديد)', 'Eligible POs for Return')} ({eligiblePurchaseOrders.length})
          </button>
        </div>

        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-2.5" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={L('بحث بالرقم أو المنتج أو المورد...', 'Search PO, product, supplier...')}
            className="pr-9 pl-4 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-slate-100 w-64 focus:outline-none focus:border-blue-500"
          />
        </div>
      </div>

      {/* History View */}
      {activeTab === 'history' && (
        <div className="app-scrollbar app-scrollbar-horizontal overflow-x-auto">
          <table className="w-full min-w-[760px] text-xs text-start">
            <thead className="text-slate-400 bg-slate-950 border-b border-slate-800">
              <tr>
                <th className="p-3">{L('التاريخ', 'Date')}</th>
                <th className="p-3">{L('أمر الشراء المرجعي', 'PO Reference')}</th>
                <th className="p-3">{L('الفرع', 'Branch')}</th>
                <th className="p-3">{L('الصنف المرتجع', 'Returned Item')}</th>
                <th className="p-3">{L('الكمية المرتجعة', 'Qty Returned')}</th>
                <th className="p-3">{L('الرصيد بعد الخصم', 'Balance After')}</th>
                <th className="p-3">{L('السبب والملاحظات', 'Reason / Notes')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {filteredLogs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-900/50 transition-colors">
                  <td className="p-3 text-slate-400">
                    {new Date(log.createdAt).toLocaleString(isAr ? 'ar-EG' : 'en-US')}
                  </td>
                  <td className="p-3 font-mono font-bold text-sky-400">{log.referenceId || '—'}</td>
                  <td className="p-3 text-slate-300">{isAr ? log.branch.name : log.branch.nameEn}</td>
                  <td className="p-3 font-bold text-slate-100">
                    {isAr ? log.product.nameAr : log.product.nameEn}
                    <span className="text-[10px] text-slate-500 font-mono block">{log.product.sku}</span>
                  </td>
                  <td className="p-3 font-black text-rose-400">{Math.abs(log.changeQuantity)}</td>
                  <td className="p-3 font-bold text-slate-300">{log.newQuantity}</td>
                  <td className="p-3 text-slate-400">{log.notes || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {filteredLogs.length === 0 && (
            <div className="text-center text-xs text-slate-500 py-12">
              {L('لا توجد حركات إرجاع للموردين مسجلة بعد', 'No supplier return records found')}
            </div>
          )}
        </div>
      )}

      {/* Eligible POs View */}
      {activeTab === 'eligible' && (
        <div className="app-scrollbar app-scrollbar-horizontal overflow-x-auto">
          <table className="w-full min-w-[760px] text-xs text-start">
            <thead className="text-slate-400 bg-slate-950 border-b border-slate-800">
              <tr>
                <th className="p-3">{L('رقم أمر الشراء', 'PO No.')}</th>
                <th className="p-3">{L('المورد', 'Supplier')}</th>
                <th className="p-3">{L('الفرع', 'Branch')}</th>
                <th className="p-3">{L('الأصناف المستلمة', 'Received Items')}</th>
                <th className="p-3">{L('الحالة', 'Status')}</th>
                <th className="p-3">{L('إجراء', 'Action')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {filteredOrders.map((po) => {
                const receivedCount = po.items.filter((i) => i.quantityReceived > 0).length;
                return (
                  <tr key={po.id} className="hover:bg-slate-900/50 transition-colors">
                    <td className="p-3 font-mono font-bold text-sky-400">{po.poNumber}</td>
                    <td className="p-3 font-semibold text-slate-200">{po.supplier.name}</td>
                    <td className="p-3 text-slate-300">{isAr ? po.branch.name : po.branch.nameEn}</td>
                    <td className="p-3 font-bold text-emerald-400">
                      {receivedCount} {L('صنف متاح للإرجاع', 'items eligible')}
                    </td>
                    <td className="p-3 font-bold text-slate-300">{po.status}</td>
                    <td className="p-3">
                      <Button
                        onClick={() => openReturnModal(po)}
                        variant="secondary"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        {L('إرجاع بضاعة للمورد', 'Return to Supplier')}
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {filteredOrders.length === 0 && (
            <div className="text-center text-xs text-slate-500 py-12">
              {L('لا توجد أوامر شراء مستلمة متاحة للإرجاع', 'No received POs eligible for return')}
            </div>
          )}
        </div>
      )}

      {/* Return Action Modal */}
      {selectedPo && (
        <Modal
          title={`${L('إرجاع أصناف من أمر الشراء', 'Return Goods on PO')} ${selectedPo.poNumber}`}
          onClose={() => setSelectedPo(null)}
        >
          <form onSubmit={handleExecuteReturn} className="space-y-4 text-xs">
            {submitError && (
              <div role="alert" className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 font-bold">
                {submitError}
              </div>
            )}

            <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex justify-between items-center">
              <div>
                <span className="text-slate-400">{L('المورد', 'Supplier')}: </span>
                <span className="font-bold text-slate-200">{selectedPo.supplier.name}</span>
              </div>
              <div>
                <span className="text-slate-400">{L('الفرع', 'Branch')}: </span>
                <span className="font-bold text-slate-200">{isAr ? selectedPo.branch.name : selectedPo.branch.nameEn}</span>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-400 mb-1">
                {L('اختر الصنف المراد إرجاعه *', 'Select Item to Return *')}
              </label>
              <select
                value={selectedProductId}
                onChange={(e) => {
                  setSelectedProductId(e.target.value);
                  setReturnQty(1);
                }}
                className={inputCls}
              >
                {selectedPo.items
                  .filter((i) => i.quantityReceived > 0)
                  .map((it) => (
                    <option key={it.productId} value={it.productId}>
                      {isAr ? it.product.nameAr : it.product.nameEn} ({it.product.sku}) — {L('المستلم', 'Received')}: {it.quantityReceived}
                    </option>
                  ))}
              </select>
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-[11px] font-bold text-slate-400">
                  {L('الكمية المرتجعة *', 'Return Quantity *')}
                </label>
                <span className="text-[10px] text-amber-400 font-bold">
                  {L('الحد الأقصى المتاح:', 'Max Available:')} {maxAvailable}
                </span>
              </div>
              <input
                type="number"
                min="1"
                max={maxAvailable}
                required
                value={returnQty}
                onChange={(e) => setReturnQty(Math.min(maxAvailable, Math.max(1, Number(e.target.value) || 1)))}
                className={inputCls}
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-400 mb-1">
                {L('سبب الإرجاع للمورد *', 'Return Reason *')}
              </label>
              <textarea
                rows={2}
                required
                value={returnReason}
                onChange={(e) => setReturnReason(e.target.value)}
                placeholder={L('مثال: تالف أثناء الشحن، عيب مصنعي، غير مطابق للمواصفات...', 'e.g. Damaged in transit, defective...')}
                className={`${inputCls} resize-none`}
              />
            </div>

            <button
              type="submit"
              disabled={submitting || maxAvailable <= 0}
              className="w-full py-3 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-60 text-white font-extrabold transition-all"
            >
              {submitting ? L('جاري تسجيل المرتجع وخصم المخزون...', 'Processing Return...') : L('تأكيد الإرجاع للمورد', 'Confirm Supplier Return')}
            </button>
          </form>
        </Modal>
      )}
    </div>
  );
}
