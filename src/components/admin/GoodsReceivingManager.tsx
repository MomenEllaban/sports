'use client';

import React, { useState, useMemo } from 'react';
import { useLocale } from 'next-intl';
import {
  PackageCheck,
  Truck,
  Boxes,
  Clock,
  Search,
  CheckCircle2,
  X,
  Check,
} from 'lucide-react';
import { Button } from '@/components/ui/foundation';
import { useToast } from '@/components/Toast';
import { apiFetch } from './ui';

export interface ReceivingOrderItem {
  id: string;
  productId: string;
  productNameAr: string;
  productNameEn: string;
  sku: string;
  quantityOrdered: number;
  quantityReceived: number;
  unitCost: number;
}

export interface ReceivingPurchaseOrder {
  id: string;
  poNumber: string;
  supplierId: string;
  supplierName: string;
  branchId: string;
  branchName: string;
  status: 'DRAFT' | 'SUBMITTED' | 'PARTIALLY_RECEIVED' | 'RECEIVED' | 'CANCELLED';
  totalAmount: number;
  createdAt: string;
  items: ReceivingOrderItem[];
}

export default function GoodsReceivingManager({
  purchaseOrders: initialOrders,
}: {
  purchaseOrders: ReceivingPurchaseOrder[];
}) {
  const locale = useLocale();
  const isAr = locale === 'ar';
  const L = (ar: string, en: string) => (isAr ? ar : en);
  const { toast } = useToast();

  const [orders, setOrders] = useState<ReceivingPurchaseOrder[]>(initialOrders);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'AWAITING' | 'PARTIAL' | 'RECEIVED' | 'ALL'>('AWAITING');

  // Modal inspection state
  const [inspectingOrder, setInspectingOrder] = useState<ReceivingPurchaseOrder | null>(null);
  const [batchQuantities, setBatchQuantities] = useState<Record<string, number>>({});
  const [isReceiving, setIsReceiving] = useState(false);

  const stats = useMemo(() => {
    let awaiting = 0;
    let partial = 0;
    let received = 0;
    let pendingUnits = 0;

    orders.forEach((po) => {
      if (po.status === 'SUBMITTED') awaiting++;
      else if (po.status === 'PARTIALLY_RECEIVED') partial++;
      else if (po.status === 'RECEIVED') received++;

      if (po.status === 'SUBMITTED' || po.status === 'PARTIALLY_RECEIVED') {
        po.items.forEach((item) => {
          pendingUnits += Math.max(0, item.quantityOrdered - item.quantityReceived);
        });
      }
    });

    return { awaiting, partial, received, pendingUnits };
  }, [orders]);

  const filtered = useMemo(() => {
    return orders.filter((po) => {
      const q = search.trim().toLowerCase();
      const matchesSearch =
        !q ||
        po.poNumber.toLowerCase().includes(q) ||
        po.supplierName.toLowerCase().includes(q) ||
        po.branchName.toLowerCase().includes(q);

      if (!matchesSearch) return false;

      if (filter === 'AWAITING') return po.status === 'SUBMITTED';
      if (filter === 'PARTIAL') return po.status === 'PARTIALLY_RECEIVED';
      if (filter === 'RECEIVED') return po.status === 'RECEIVED';
      return true;
    });
  }, [orders, search, filter]);

  const openInspectionModal = (po: ReceivingPurchaseOrder) => {
    setInspectingOrder(po);
    const initialBatch: Record<string, number> = {};
    po.items.forEach((item) => {
      const remaining = Math.max(0, item.quantityOrdered - item.quantityReceived);
      initialBatch[item.id] = remaining; // default to receiving the remaining
    });
    setBatchQuantities(initialBatch);
  };

  const handleReceiveBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inspectingOrder) return;

    const payload = Object.entries(batchQuantities)
      .filter(([, qty]) => qty > 0)
      .map(([itemId, quantity]) => ({ itemId, quantity }));

    if (payload.length === 0) {
      toast(L('الرجاء إدخال كمية مستلمة واحدة على الأقل', 'Please enter at least one quantity to receive'), 'error');
      return;
    }

    setIsReceiving(true);
    try {
      await apiFetch<{ purchaseOrder?: unknown }>(`/api/admin/purchase-orders/${inspectingOrder.id}/receive`, 'POST', {
        received: payload,
      });

      setOrders((prev) =>
        prev.map((po) => {
          if (po.id !== inspectingOrder.id) return po;
          const updatedItems = po.items.map((it) => {
            const added = batchQuantities[it.id] || 0;
            return {
              ...it,
              quantityReceived: it.quantityReceived + added,
            };
          });

          const isFullyReceived = updatedItems.every((it) => it.quantityReceived >= it.quantityOrdered);

          return {
            ...po,
            status: isFullyReceived ? 'RECEIVED' : 'PARTIALLY_RECEIVED',
            items: updatedItems,
          };
        })
      );

      toast(
        L('تم تسجيل إذن الاستلام وتحديث أرصدة المخزون بنجاح!', 'Goods receipt recorded and inventory stock updated!'),
        'success'
      );
      setInspectingOrder(null);
    } catch (err: unknown) {
      const msg = (err as Error)?.message || L('فشل استلام الشحنة، تأكد من الكميات', 'Failed to receive goods');
      toast(msg, 'error');
    } finally {
      setIsReceiving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-panel p-5 rounded-2xl border border-slate-800 bg-slate-900/60">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-semibold">{L('بانتظار الاستلام والفحص', 'Awaiting Receipt')}</span>
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black text-amber-400">{stats.awaiting}</span>
            <span className="text-xs text-slate-400 ms-2">{L('أمر توريد', 'orders')}</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">{L('شحنات مرسلة من الموردين', 'Shipments dispatched by suppliers')}</p>
        </div>

        <div className="glass-panel p-5 rounded-2xl border border-slate-800 bg-slate-900/60">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-semibold">{L('استلام جزئي قيد الاستكمال', 'Partially Received')}</span>
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <Truck className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black text-blue-400">{stats.partial}</span>
            <span className="text-xs text-slate-400 ms-2">{L('أمر توريد', 'orders')}</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">{L('استلمت دفعة وبانتظار الباقي', 'Received in part, remainder pending')}</p>
        </div>

        <div className="glass-panel p-5 rounded-2xl border border-slate-800 bg-slate-900/60">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-semibold">{L('القطع المنتظرة في المخازن', 'Pending Units')}</span>
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
              <Boxes className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black text-purple-400">{stats.pendingUnits.toLocaleString()}</span>
            <span className="text-xs text-slate-400 ms-1">{L('قطعة', 'units')}</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">{L('ستضاف للرصيد فور اعتماد الفحص', 'Will increment stock upon inspection')}</p>
        </div>

        <div className="glass-panel p-5 rounded-2xl border border-slate-800 bg-slate-900/60">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-semibold">{L('أوامر مستلمة ومغلقة', 'Completed Receipts')}</span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black text-emerald-400">{stats.received}</span>
            <span className="text-xs text-slate-400 ms-2">{L('أمر توريد', 'orders')}</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">{L('تم فحصها وإدخالها المخزن بالكامل', 'Fully verified and stocked')}</p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setFilter('AWAITING')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
              filter === 'AWAITING'
                ? 'bg-amber-600 text-white shadow-lg shadow-amber-500/20'
                : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200'
            }`}
          >
            {L('بانتظار الاستلام', 'Awaiting Receipt')} ({stats.awaiting})
          </button>
          <button
            onClick={() => setFilter('PARTIAL')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
              filter === 'PARTIAL'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200'
            }`}
          >
            {L('استلام جزئي', 'Partially Received')} ({stats.partial})
          </button>
          <button
            onClick={() => setFilter('RECEIVED')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
              filter === 'RECEIVED'
                ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/20'
                : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200'
            }`}
          >
            {L('مكتملة الاستلام', 'Fully Received')} ({stats.received})
          </button>
          <button
            onClick={() => setFilter('ALL')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
              filter === 'ALL'
                ? 'bg-slate-600 text-white shadow-lg shadow-slate-500/20'
                : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200'
            }`}
          >
            {L('الكل', 'All Orders')} ({orders.length})
          </button>
        </div>

        <div className="relative min-w-[240px]">
          <Search className="w-4 h-4 text-slate-500 absolute start-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={L('بحث برقم الأمر أو المورد أو الفرع...', 'Search PO, supplier, branch...')}
            className="w-full bg-slate-900/80 border border-slate-700/80 rounded-xl ps-9 pe-3 py-1.5 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
          />
        </div>
      </div>

      {/* Orders Table */}
      <div className="app-scrollbar app-scrollbar-horizontal overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900/40">
        <table className="w-full min-w-[800px] text-xs text-start">
          <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
            <tr>
              <th className="p-3.5 text-start">{L('رقم الأمر', 'PO Number')}</th>
              <th className="p-3.5 text-start">{L('المورد', 'Supplier')}</th>
              <th className="p-3.5 text-start">{L('الفرع المستلم', 'Destination Branch')}</th>
              <th className="p-3.5 text-center">{L('حالة الاستلام', 'Receiving Status')}</th>
              <th className="p-3.5 text-center">{L('نسبة الاستلام', 'Received Progress')}</th>
              <th className="p-3.5 text-center">{L('تاريخ الأمر', 'Date')}</th>
              <th className="p-3.5 text-end">{L('الإجراءات', 'Actions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-slate-500">
                  {L('لا توجد شحنات مطابقة للفلتر المحدد', 'No purchase shipments found for selected criteria')}
                </td>
              </tr>
            ) : (
              filtered.map((po) => {
                const totalOrdered = po.items.reduce((s, i) => s + i.quantityOrdered, 0);
                const totalReceived = po.items.reduce((s, i) => s + i.quantityReceived, 0);
                const pct = totalOrdered > 0 ? Math.min(100, Math.round((totalReceived / totalOrdered) * 100)) : 0;
                const canReceive = po.status === 'SUBMITTED' || po.status === 'PARTIALLY_RECEIVED';

                return (
                  <tr key={po.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="p-3.5">
                      <span className="font-mono font-bold text-blue-400">{po.poNumber}</span>
                    </td>

                    <td className="p-3.5 font-bold text-slate-200">{po.supplierName}</td>

                    <td className="p-3.5 text-slate-300">{po.branchName}</td>

                    <td className="p-3.5 text-center">
                      {po.status === 'SUBMITTED' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-300 border border-amber-500/30">
                          <Clock className="w-3 h-3" />
                          {L('بانتظار الاستلام', 'Pending Delivery')}
                        </span>
                      )}
                      {po.status === 'PARTIALLY_RECEIVED' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-blue-500/10 text-blue-300 border border-blue-500/30">
                          <Truck className="w-3 h-3" />
                          {L('استلام جزئي', 'Partial')}
                        </span>
                      )}
                      {po.status === 'RECEIVED' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">
                          <CheckCircle2 className="w-3 h-3" />
                          {L('مستلم بالكامل', 'Fully Received')}
                        </span>
                      )}
                      {po.status === 'DRAFT' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-700/50 text-slate-400 border border-slate-600/50">
                          {L('مسودة', 'Draft')}
                        </span>
                      )}
                    </td>

                    <td className="p-3.5 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-20 bg-slate-800 rounded-full h-2 overflow-hidden">
                          <div
                            className={`h-full transition-all ${
                              pct >= 100 ? 'bg-emerald-500' : pct > 0 ? 'bg-blue-500' : 'bg-slate-700'
                            }`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-[11px] font-mono text-slate-400">
                          {totalReceived}/{totalOrdered} ({pct}%)
                        </span>
                      </div>
                    </td>

                    <td className="p-3.5 text-center text-slate-400 text-[11px]">
                      {new Date(po.createdAt).toLocaleDateString(locale)}
                    </td>

                    <td className="p-3.5 text-end">
                      {canReceive ? (
                        <button
                          onClick={() => openInspectionModal(po)}
                          className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold inline-flex items-center gap-1.5 shadow-md shadow-blue-600/20 transition-all"
                        >
                          <PackageCheck className="w-3.5 h-3.5" />
                          {L('فحص واستلام', 'Inspect & Receive')}
                        </button>
                      ) : (
                        <span className="text-xs text-slate-500 font-semibold px-2">
                          {po.status === 'RECEIVED' ? L('مكتمل', 'Done') : '—'}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Goods Receipt Note (GRN) Inspection Modal */}
      {inspectingOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl relative">
            <button
              onClick={() => setInspectingOrder(null)}
              className="absolute top-5 end-5 p-1 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="border-b border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  <PackageCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-100 text-base">
                    {L('إذن استلام وفحص مخزني (GRN)', 'Goods Receipt Note (GRN)')}
                  </h3>
                  <div className="flex items-center gap-3 text-xs text-slate-400 mt-1">
                    <span className="font-mono text-blue-400 font-bold">{inspectingOrder.poNumber}</span>
                    <span>•</span>
                    <span className="text-slate-200">{inspectingOrder.supplierName}</span>
                    <span>•</span>
                    <span>{L('الفرع:', 'Branch:')} {inspectingOrder.branchName}</span>
                  </div>
                </div>
              </div>
            </div>

            <form onSubmit={handleReceiveBatch} className="flex-1 flex flex-col overflow-hidden">
              <div className="flex-1 overflow-y-auto app-scrollbar py-4 space-y-3">
                <div className="flex items-center justify-between text-xs text-slate-400 px-1">
                  <span>{L('حدد الكميات المستلمة فعلياً بعد فحص الشحنة:', 'Enter actual verified quantities received:')}</span>
                  <button
                    type="button"
                    onClick={() => {
                      const maxBatch: Record<string, number> = {};
                      inspectingOrder.items.forEach((it) => {
                        maxBatch[it.id] = Math.max(0, it.quantityOrdered - it.quantityReceived);
                      });
                      setBatchQuantities(maxBatch);
                    }}
                    className="text-blue-400 hover:text-blue-300 font-bold"
                  >
                    {L('استلام كل المتبقي', 'Receive All Remaining')}
                  </button>
                </div>

                {inspectingOrder.items.map((item) => {
                  const remaining = Math.max(0, item.quantityOrdered - item.quantityReceived);

                  return (
                    <div
                      key={item.id}
                      className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex-1">
                        <div className="font-bold text-slate-100">
                          {isAr ? item.productNameAr : item.productNameEn}
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                          SKU: {item.sku}
                        </div>
                        <div className="text-[11px] text-slate-400 mt-1">
                          {L('المطلوب:', 'Ordered:')} <span className="font-bold">{item.quantityOrdered}</span> |{' '}
                          {L('المستلم سابقاً:', 'Previously received:')}{' '}
                          <span className="text-emerald-400 font-bold">{item.quantityReceived}</span> |{' '}
                          {L('المتبقي:', 'Remaining:')}{' '}
                          <span className="text-amber-400 font-bold">{remaining}</span>
                        </div>
                      </div>

                      <div className="w-32">
                        <label className="text-[10px] text-slate-400 block mb-1">
                          {L('الكمية المستلمة الآن', 'Receiving Now')}
                        </label>
                        <input
                          type="number"
                          min={0}
                          max={remaining}
                          value={batchQuantities[item.id] ?? 0}
                          onChange={(e) => {
                            const val = Math.max(0, Math.min(remaining, Number(e.target.value) || 0));
                            setBatchQuantities((prev) => ({ ...prev, [item.id]: val }));
                          }}
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-center text-xs font-bold text-slate-100 focus:outline-none focus:border-blue-500"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-slate-800 pt-4">
                <Button type="button" variant="secondary" onClick={() => setInspectingOrder(null)} disabled={isReceiving}>
                  {L('إلغاء', 'Cancel')}
                </Button>
                <Button type="submit" variant="primary" disabled={isReceiving} className="bg-blue-600 hover:bg-blue-500">
                  <Check className="w-3.5 h-3.5" />
                  {isReceiving ? L('جارٍ التحديث...', 'Updating Stock...') : L('تأكيد الاستلام وإضافة للمخزون', 'Confirm & Add to Stock')}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
