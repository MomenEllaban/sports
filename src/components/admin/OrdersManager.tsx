'use client';

import React, { useState, useEffect } from 'react';
import { useLocale } from 'next-intl';
import { useRouter, Link } from '@/i18n/routing';
import { useTranslations } from 'next-intl';
import { Plus, ChevronDown, ChevronUp, Package } from 'lucide-react';
import { StatusBadge, PayLabel, SourceLabel, Modal, apiFetch } from './ui';
import { Stepper, inputCls } from '@/components/ui/foundation';
import { useToast } from '@/components/Toast';
import Pagination from './Pagination';

interface OrderItem {
  id: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  product: { nameAr: string; nameEn: string; sku: string };
}

interface OrderRow {
  kind: 'ORDER' | 'POS';
  id: string;
  orderNumber: string;
  orderSource: string;
  guestName: string | null;
  guestPhone: string;
  guestAddress?: string;
  deliveryAddress: string;
  shippingProvider: string;
  trackingNumber: string | null;
  paymentMethod: string;
  totalAmount: number;
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  orderStatus: string;
  paymentStatus: string;
  receiptImage?: string | null;
  refund?: { id: string; status: string; amount: number; lastError?: string | null } | null;
  returnStatus?: string;
  returns?: Array<{ id: string; returnNumber: string; status: string }>;
  createdAt: string;
  items: OrderItem[];
  customer: { id: string; name: string | null; phone: string } | null;
  branch: { id: string; name: string } | null;
}

interface ProductOpt { id: string; nameAr: string; nameEn: string; price: number }
interface BranchOpt { id: string; name: string; nameEn: string }

const ORDER_STATUSES = ['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'RETURNED'];
const PAYMENT_METHODS = ['COD', 'PAYMOB', 'FAWRY', 'INSTAPAY', 'VODAFONE_CASH', 'KASHIER', 'CASH', 'CARD'];

export default function OrdersManager({
  orders,
  products,
  branches,
}: {
  orders: OrderRow[];
  products: ProductOpt[];
  branches: BranchOpt[];
}) {
  const t = useTranslations('admin');
  const locale = useLocale();
  const router = useRouter();
  const { toast } = useToast();
  const isAr = locale === 'ar';

  const [statusFilter, setStatusFilter] = useState('ALL');
  const [sourceFilter, setSourceFilter] = useState('ALL');
  const [updatingId, setUpdatingId] = useState('');
  const [error, setError] = useState('');
  // T10 refund wizard
  const [refundTarget, setRefundTarget] = useState<OrderRow | null>(null);
  const [refundStep, setRefundStep] = useState(1);
  const [refundReason, setRefundReason] = useState('');
  const [refundBusy, setRefundBusy] = useState(false);
  const [refundError, setRefundError] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showNewOrder, setShowNewOrder] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newOrderError, setNewOrderError] = useState('');

  const [page, setPage] = useState(1);  const PAGE_SIZE = 10;

  const [newOrderForm, setNewOrderForm] = useState({
    guestName: '',
    guestPhone: '',
    deliveryAddress: '',
    paymentMethod: 'COD',
    branchId: branches[0]?.id || '',
    orderSource: 'WHATSAPP',
    notes: '',
  });
  const [orderLines, setOrderLines] = useState<Array<{ productId: string; quantity: number }>>([
    { productId: products[0]?.id || '', quantity: 1 },
  ]);

  const filtered = orders.filter(
    (o) =>
      (statusFilter === 'ALL' || o.orderStatus === statusFilter) &&
      (sourceFilter === 'ALL' || o.orderSource === sourceFilter)
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pagedRows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [statusFilter, sourceFilter]);

  const changeStatus = async (id: string, orderStatus: string) => {
    setUpdatingId(id);
    setError('');
    try {
      await apiFetch(`/api/admin/orders/${id}`, 'PATCH', { orderStatus });
      toast(t('orderStatusUpdated'), 'success');
      router.refresh();
    } catch {
      const msg = t('operationFailed');
      setError(msg);
      toast(msg, 'error');
    } finally {
      setUpdatingId('');
    }
  };

  // T10: request a refund (wizard confirm) + retry a stuck one.
  const submitRefund = async () => {
    if (!refundTarget || refundBusy) return;
    setRefundBusy(true);
    setRefundError('');
    try {
      const res = (await apiFetch(`/api/admin/orders/${refundTarget.id}/refund`, 'POST', { reason: refundReason || undefined })) as {
        result?: { ok?: boolean; error?: string };
      };
      if (res.result && res.result.ok === false) {
        toast(`${isAr ? 'سُجل الاسترداد — فشل رد المبلغ، سيُعاد تلقائياً' : 'Refund recorded — payout failed, will retry'}: ${res.result.error || ''}`, 'info');
      } else {
        toast(isAr ? 'تم الاسترداد وإرجاع المخزون' : 'Refunded with restock', 'success');
      }
      setRefundTarget(null);
      setRefundStep(1);
      setRefundReason('');
      router.refresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t('operationFailed');
      setRefundError(msg);
    } finally {
      setRefundBusy(false);
    }
  };

  const retryRefund = async (refundId: string) => {
    setUpdatingId(refundId);
    try {
      const res = (await apiFetch(`/api/admin/refunds/${refundId}`, 'POST', {})) as { success?: boolean; result?: { error?: string } };
      toast(res.success ? (isAr ? 'تم رد المبلغ' : 'Payout succeeded') : (res.result?.error || t('operationFailed')), res.success ? 'success' : 'error');
      router.refresh();
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : t('operationFailed'), 'error');
    } finally {
      setUpdatingId('');
    }
  };
  // T03: retry booking a MANUAL shipment with the real courier.
  const retryShipment = async (id: string) => {
    setUpdatingId(id);
    setError('');
    try {
      const res = (await apiFetch(`/api/admin/orders/${id}/ship`, 'POST', {})) as { trackingNumber?: string; labelUrl?: string };
      toast(`${isAr ? 'تم حجز الشحنة' : 'Shipment booked'}: ${res.trackingNumber || ''}`, 'success');
      router.refresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t('operationFailed');
      setError(msg);
      toast(msg, 'error');
    } finally {
      setUpdatingId('');
    }
  };

  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setNewOrderError('');
    try {
      const items = orderLines
        .filter((l) => l.productId && l.quantity > 0)
        .map((l) => {
          const prod = products.find((p) => p.id === l.productId);
          return {
            productId: l.productId,
            quantity: l.quantity,
            unitPrice: prod?.price || 0,
          };
        });

      if (items.length === 0) {
        setNewOrderError(isAr ? 'أضف منتجاً على الأقل' : 'Add at least one product');
        setSaving(false);
        return;
      }

      await apiFetch('/api/admin/orders', 'POST', {
        ...newOrderForm,
        items,
      });

      setShowNewOrder(false);
      toast(t('operationSuccess'), 'success');
      router.refresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'فشل في إنشاء الطلب';
      setNewOrderError(msg);
      toast(msg, 'error');
    } finally {
      setSaving(false);
    }
  };

  const labelCls = 'block text-[11px] font-bold text-slate-400 mb-1';

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="p-4 bg-slate-900 border-b border-slate-800 flex flex-wrap justify-between items-center gap-3 text-xs">
        <span className="font-bold text-slate-200">
          {isAr ? `إجمالي الطلبات: ${filtered.length} طلب` : `Total orders: ${filtered.length}`}
        </span>
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
            className="px-2 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 text-xs"
          >
            <option value="ALL">{isAr ? 'كل المصادر' : 'All sources'}</option>
            <option value="ONLINE">{t('src_ONLINE')}</option>
            <option value="POS">{t('src_POS')}</option>
            <option value="WHATSAPP">{t('src_WHATSAPP')}</option>
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-2 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 text-xs"
          >
            <option value="ALL">{isAr ? 'كل الحالات' : 'All statuses'}</option>
            {ORDER_STATUSES.map((s) => (
              <option key={s} value={s}>{t(`status_${s}`)}</option>
            ))}
          </select>
          <button
            onClick={() => setShowNewOrder(true)}
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold flex items-center gap-2 shadow-lg shadow-blue-600/25 transition-all"
          >
            <Plus className="w-4 h-4" />
            {isAr ? 'طلب يدوي' : 'New Order'}
          </button>
        </div>
      </div>

      {error && (
        <div role="alert" className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs mx-4">
          {error}
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs text-start">
          <thead className="text-slate-400 bg-slate-950 border-b border-slate-800">
            <tr>
              <th className="p-3">{isAr ? 'رقم الطلب' : 'Order No.'}</th>
              <th className="p-3">{isAr ? 'المصدر' : 'Source'}</th>
              <th className="p-3">{isAr ? 'العميل والموبايل' : 'Customer'}</th>
              <th className="p-3">{isAr ? 'المنتجات' : 'Products'}</th>
              <th className="p-3">{isAr ? 'شركة الشحن / التتبع' : 'Courier'}</th>
              <th className="p-3">{isAr ? 'الدفع' : 'Payment'}</th>
              <th className="p-3">{isAr ? 'المبلغ الكلي' : 'Total'}</th>
              <th className="p-3">{isAr ? 'حالة الطلب' : 'Status'}</th>
              <th className="p-3">{t('changeStatus')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {pagedRows.map((ord) => (
              <React.Fragment key={ord.id}>
                <tr className="hover:bg-slate-900/50 transition-colors">
                  <td className="p-3 font-bold text-amber-400">
                    <div>{ord.orderNumber}</div>
                    {ord.kind === 'POS' && (
                      <span className="inline-block mt-0.5 px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 text-[9px] font-black border border-purple-500/30">
                        {isAr ? 'كاشير POS' : 'POS'}
                      </span>
                    )}
                    <div className="text-[10px] text-slate-500">{new Date(ord.createdAt).toLocaleDateString(isAr ? 'ar-EG' : 'en-US')}</div>
                  </td>
                  <td className="p-3 font-semibold text-slate-300"><SourceLabel value={ord.orderSource} /></td>
                  <td className="p-3">
                    <div className="font-bold text-slate-100">
                      {ord.customer?.name || ord.guestName || (isAr ? 'عميل' : 'Guest')}
                    </div>
                    <Link
                      href={`/admin/customers?phone=${encodeURIComponent(ord.customer?.phone || ord.guestPhone)}`}
                      className="text-[10px] text-blue-400 hover:underline"
                      dir="ltr"
                      title={isAr ? 'عرض ملف العميل' : 'View customer'}
                    >
                      {ord.customer?.phone || ord.guestPhone}
                    </Link>
                  </td>
                  <td className="p-3">
                    {ord.items.length > 0 ? (
                      <button
                        onClick={() => setExpandedId(expandedId === ord.id ? null : ord.id)}
                        className="flex items-center gap-1 text-blue-400 hover:text-blue-300 font-bold transition-colors"
                      >
                        <Package className="w-3.5 h-3.5" />
                        <span>{ord.items.length} {isAr ? 'صنف' : 'items'}</span>
                        {expandedId === ord.id ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                      </button>
                    ) : (
                      <span className="text-slate-500">—</span>
                    )}
                  </td>
                  <td className="p-3">
                    <span className="font-bold text-blue-400 block">{ord.shippingProvider}</span>
                    {ord.trackingNumber?.startsWith('MANUAL-') ? (
                      <button
                        onClick={() => retryShipment(ord.id)}
                        disabled={updatingId === ord.id}
                        title={isAr ? 'شركة الشحن غير محجوزة — اضغط للحجز الآن' : 'Courier not booked — click to book now'}
                        className="mt-1 min-h-[44px] px-2.5 rounded-lg bg-amber-500/15 border border-amber-500/40 text-amber-300 text-[10px] font-bold hover:bg-amber-500/25 disabled:opacity-60"
                      >
                        {isAr ? 'شحنة يدوية — احجز الآن' : 'Manual — book now'}
                      </button>
                    ) : (
                      <span className="text-[10px] text-slate-400">{ord.trackingNumber || '—'}</span>
                    )}
                  </td>
                  <td className="p-3 text-slate-300"><PayLabel value={ord.paymentMethod} /></td>
                  <td className="p-3 font-black text-slate-100">{ord.totalAmount.toLocaleString()} {isAr ? 'ج.م' : 'EGP'}</td>
                  <td className="p-3"><StatusBadge value={ord.orderStatus} />
                    {ord.refund && (
                      <span className={`mt-1 block px-2 py-0.5 rounded-lg font-bold text-[10px] w-fit ${
                        ord.refund.status === 'SUCCEEDED' ? 'bg-emerald-500/15 text-emerald-400'
                        : ord.refund.status === 'FAILED' ? 'bg-rose-500/15 text-rose-400'
                        : 'bg-amber-500/15 text-amber-400'
                      }`}>
                        {ord.refund.status === 'SUCCEEDED' ? (isAr ? 'مسترد' : 'Refunded')
                          : ord.refund.status === 'FAILED' ? (isAr ? 'فشل الرد — أعد' : 'Payout failed — retry')
                          : (isAr ? 'استرداد معلق' : 'Refund pending')}
                      </span>
                    )}
                    {ord.refund && (ord.refund.status === 'FAILED' || ord.refund.status === 'PENDING') && (
                      <button
                        onClick={() => retryRefund(ord.refund!.id)}
                        disabled={updatingId === ord.refund.id}
                        className="mt-1 min-h-[44px] px-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-[10px] font-bold text-slate-200 disabled:opacity-60"
                      >
                        {isAr ? 'إعادة محاولة الرد' : 'Retry payout'}
                      </button>
                    )}
                  </td>
                  <td className="p-3">
                    {ord.kind === 'ORDER' ? (
                      <select
                        value={ord.orderStatus}
                        disabled={updatingId === ord.id}
                        onChange={(e) => changeStatus(ord.id, e.target.value)}
                        className="px-2 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 text-xs disabled:opacity-60"
                      >
                        {ORDER_STATUSES.map((s) => (
                          <option key={s} value={s}>{t(`status_${s}`)}</option>
                        ))}
                      </select>
                    ) : (
                      <span className="text-[11px] text-slate-500 font-bold" title={isAr ? 'بيع كاشير مكتمل ومدفوع' : 'Completed paid POS sale'}>
                        {isAr ? 'بيع مكتمل' : 'Completed'}
                      </span>
                    )}
                  </td>
                </tr>
                {/* Expanded Items Row */}
                {expandedId === ord.id && ord.items.length > 0 && (
                  <tr>
                    <td colSpan={9} className="p-0">
                      <div className="bg-slate-900/60 border-b border-slate-800 p-4">
                        <div className="text-[11px] font-bold text-slate-400 mb-2">{isAr ? 'تفاصيل المنتجات:' : 'Order items:'}</div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                          {ord.items.map((item) => (
                            <div key={item.id} className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 flex justify-between items-center text-xs">
                              <div>
                                <div className="font-bold text-slate-100">{isAr ? item.product.nameAr : item.product.nameEn}</div>
                                <div className="text-[10px] text-amber-400">SKU: {item.product.sku}</div>
                              </div>
                              <div className="text-right">
                                <div className="font-black text-slate-100">{item.totalPrice.toLocaleString()} {isAr ? 'ج.م' : 'EGP'}</div>
                                <div className="text-[10px] text-slate-400">{item.unitPrice.toLocaleString()} × {item.quantity}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                        {/* Order Summary */}
                        <div className="mt-3 flex flex-wrap gap-4 text-[11px] text-slate-400">
                          <span>{isAr ? 'المجموع الفرعي' : 'Subtotal'}: {ord.subtotal?.toLocaleString()} {isAr ? 'ج.م' : 'EGP'}</span>
                          {ord.discountAmount > 0 && <span className="text-rose-400">{isAr ? 'خصم' : 'Discount'}: -{ord.discountAmount?.toLocaleString()}</span>}
                          <span>{isAr ? 'العنوان' : 'Address'}: {ord.deliveryAddress}</span>
                        </div>
                        {ord.kind === 'ORDER' && ord.orderStatus === 'DELIVERED' && ord.paymentStatus === 'PAID' && !ord.refund && (
                          <button
                            onClick={() => { setRefundTarget(ord); setRefundStep(1); setRefundReason(''); setRefundError(''); }}
                            className="mt-3 min-h-[44px] px-4 rounded-xl bg-rose-600/20 hover:bg-rose-600/30 border border-rose-500/40 text-rose-300 text-xs font-bold"
                          >
                            {isAr ? 'استرداد الطلب...' : 'Refund order...'}
                          </button>
                        )}
                        {/* T-RMA returns section */}
                        {ord.kind === 'ORDER' && (
                          <div className="mt-3 p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs space-y-2">
                            <div className="flex flex-wrap justify-between items-center gap-2">
                              <span className="font-bold text-slate-300">
                                {isAr ? 'المرتجعات' : 'Returns'}:
                                <span className={`ml-1 px-2 py-0.5 rounded-lg text-[10px] ${ord.returnStatus === 'FULL' ? 'bg-emerald-500/15 text-emerald-400' : ord.returnStatus === 'PARTIAL' ? 'bg-amber-500/15 text-amber-300' : 'bg-slate-800 text-slate-400'}`}>
                                  {ord.returnStatus === 'FULL' ? (isAr ? 'كامل' : 'Full') : ord.returnStatus === 'PARTIAL' ? (isAr ? 'جزئي' : 'Partial') : (isAr ? 'بلا' : 'None')}
                                </span>
                              </span>
                              <Link href={`/admin/returns/new?orderNumber=${encodeURIComponent(ord.orderNumber)}`} className="min-h-[44px] px-3 rounded-lg bg-orange-600/20 border border-orange-500/40 text-orange-300 font-bold flex items-center">
                                {isAr ? 'طلب مرتجع' : 'New return'}
                              </Link>
                            </div>
                            {(ord.returns || []).length > 0 && (
                              <div className="flex flex-wrap gap-2">
                                {(ord.returns || []).map((rm) => (
                                  <Link key={rm.id} href={`/admin/returns/${rm.id}`} className="font-mono text-[11px] text-amber-400 hover:underline" dir="ltr">
                                    {rm.returnNumber} ({rm.status})
                                  </Link>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                        {ord.kind === 'ORDER' && ord.receiptImage && (
                          <div className="mt-3 p-3 rounded-xl bg-slate-950 border border-amber-500/30 flex items-center gap-3">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={ord.receiptImage} alt={isAr ? 'صورة إيصال التحويل' : 'Transfer receipt'} className="w-24 h-24 rounded-lg object-cover border border-amber-500/40" />
                            <div className="space-y-1">
                              <div className="text-[11px] font-black text-amber-300">{isAr ? 'إيصال التحويل مرفق — راجع وحصّل قبل الاعتماد' : 'Transfer receipt attached'}</div>
                              <a href={ord.receiptImage} target="_blank" rel="noopener noreferrer" className="text-[11px] font-bold text-blue-400 hover:underline">
                                {isAr ? 'فتح الصورة بالحجم الكامل' : 'Open full image'}
                              </a>
                            </div>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="text-center text-xs text-slate-500 py-12">{t('noData')}</div>
        )}
      </div>

      {filtered.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <span className="text-[11px] font-bold text-slate-400">
            {isAr ? `${filtered.length} طلب` : `${filtered.length} orders`}
          </span>
          <Pagination page={safePage} totalPages={totalPages} onPageChange={setPage} />
        </div>
      )}

      {/* New Manual Order Modal */}
      {showNewOrder && (
        <Modal title={isAr ? 'إضافة طلب يدوي (واتساب/هاتف)' : 'Add Manual Order (WhatsApp/Phone)'} onClose={() => setShowNewOrder(false)}>
          <form onSubmit={handleCreateOrder} className="space-y-3 text-xs">
            {newOrderError && (
              <div role="alert" className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 font-bold">
                {newOrderError}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>{isAr ? 'مصدر الطلب' : 'Order Source'}</label>
                <select value={newOrderForm.orderSource} onChange={(e) => setNewOrderForm({ ...newOrderForm, orderSource: e.target.value })} className={inputCls}>
                  <option value="WHATSAPP">واتساب</option>
                  <option value="ONLINE">أونلاين</option>
                  <option value="POS">POS</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>{isAr ? 'الفرع' : 'Branch'}</label>
                <select value={newOrderForm.branchId} onChange={(e) => setNewOrderForm({ ...newOrderForm, branchId: e.target.value })} className={inputCls}>
                  {branches.map((b) => <option key={b.id} value={b.id}>{isAr ? b.name : b.nameEn}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>{isAr ? 'اسم العميل' : 'Customer Name'}</label>
                <input required placeholder={isAr ? 'الاسم بالكامل' : 'Full name'} value={newOrderForm.guestName} onChange={(e) => setNewOrderForm({ ...newOrderForm, guestName: e.target.value })} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>{isAr ? 'رقم الموبايل *' : 'Phone *'}</label>
                <input required type="tel" dir="ltr" placeholder="01xxxxxxxxx" value={newOrderForm.guestPhone} onChange={(e) => setNewOrderForm({ ...newOrderForm, guestPhone: e.target.value })} className={inputCls} />
              </div>
            </div>

            <div>
              <label className={labelCls}>{isAr ? 'عنوان التوصيل *' : 'Delivery Address *'}</label>
              <input required placeholder={isAr ? 'الشارع، المبنى، المنطقة، المدينة' : 'Street, building, area, city'} value={newOrderForm.deliveryAddress} onChange={(e) => setNewOrderForm({ ...newOrderForm, deliveryAddress: e.target.value })} className={inputCls} />
            </div>

            <div>
              <label className={labelCls}>{isAr ? 'طريقة الدفع' : 'Payment Method'}</label>
              <select value={newOrderForm.paymentMethod} onChange={(e) => setNewOrderForm({ ...newOrderForm, paymentMethod: e.target.value })} className={inputCls}>
                {PAYMENT_METHODS.map((pm) => <option key={pm} value={pm}>{pm}</option>)}
              </select>
            </div>

            {/* Order Lines */}
            <div>
              <label className={labelCls}>{isAr ? 'المنتجات *' : 'Products *'}</label>
              {orderLines.map((line, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 mb-2 items-center">
                  <select
                    value={line.productId}
                    onChange={(e) => setOrderLines(orderLines.map((l, i) => (i === idx ? { ...l, productId: e.target.value } : l)))}
                    className={`${inputCls} col-span-8`}
                  >
                    {products.map((p) => <option key={p.id} value={p.id}>{isAr ? p.nameAr : p.nameEn} — {p.price.toLocaleString()} {isAr ? 'ج.م' : 'EGP'}</option>)}
                  </select>
                  <input
                    type="number" min="1"
                    value={line.quantity}
                    onChange={(e) => setOrderLines(orderLines.map((l, i) => (i === idx ? { ...l, quantity: Number(e.target.value) } : l)))}
                    className={`${inputCls} col-span-3`}
                    placeholder={isAr ? 'الكمية' : 'Qty'}
                  />
                  <button type="button" onClick={() => setOrderLines(orderLines.filter((_, i) => i !== idx))} className="col-span-1 text-rose-400 hover:text-rose-300 font-bold text-lg">×</button>
                </div>
              ))}
              <button type="button" onClick={() => setOrderLines([...orderLines, { productId: products[0]?.id || '', quantity: 1 }])} className="text-blue-400 font-bold hover:underline text-xs">
                + {isAr ? 'إضافة منتج' : 'Add product'}
              </button>
            </div>

            <div>
              <label className={labelCls}>{isAr ? 'ملاحظات' : 'Notes'}</label>
              <textarea rows={2} placeholder={isAr ? 'أي ملاحظات على الطلب...' : 'Any order notes...'} value={newOrderForm.notes} onChange={(e) => setNewOrderForm({ ...newOrderForm, notes: e.target.value })} className={`${inputCls} resize-none`} />
            </div>

            <button type="submit" disabled={saving} className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white font-extrabold transition-all">
              {saving ? (isAr ? 'جاري الحفظ...' : 'Saving...') : (isAr ? 'إنشاء الطلب' : 'Create Order')}
            </button>
          </form>
        </Modal>
      )}

      {/* T10 refund wizard */}
      {refundTarget && (
        <Modal title={isAr ? `استرداد ${refundTarget.orderNumber}` : `Refund ${refundTarget.orderNumber}`} onClose={() => { if (!refundBusy) setRefundTarget(null); }}>
          <div className="space-y-4 text-xs">
            <Stepper steps={[isAr ? 'مراجعة المبلغ والأصناف' : 'Review amount & items', isAr ? 'سبب الاسترداد' : 'Reason', isAr ? 'تأكيد' : 'Confirm']} active={refundStep - 1} />
            {refundStep === 1 && (
              <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-1.5">
                <div className="flex justify-between text-slate-400"><span>{isAr ? 'إجمالي الطلب:' : 'Order total:'}</span><span className="font-black text-slate-100">{refundTarget.totalAmount.toLocaleString()} {isAr ? 'ج.م' : 'EGP'}</span></div>
                <div className="flex justify-between text-slate-400"><span>{isAr ? 'طريقة الدفع:' : 'Method:'}</span><span className="font-bold">{refundTarget.paymentMethod}</span></div>
                <div className="text-[11px] text-slate-500">{refundTarget.items.map((i) => `${isAr ? i.product.nameAr : i.product.nameEn} ×${i.quantity}`).join(' • ')}</div>
                <p className="text-[11px] text-amber-300">سيُرجع المخزون للفرع فوراً، ويُرد المبلغ عبر البوابة (أو يُسوى نقداً).</p>
              </div>
            )}
            {refundStep === 2 && (
              <div>
                <label htmlFor="refund-reason" className="block font-bold text-slate-300 mb-1">{isAr ? 'سبب الاسترداد' : 'Refund reason'}</label>
                <textarea id="refund-reason" rows={3} value={refundReason} onChange={(e) => setRefundReason(e.target.value)} placeholder={isAr ? 'مثال: عيب مصنعي...' : 'e.g. defective item...'} className="w-full min-h-[44px] p-3 rounded-xl bg-slate-950 border border-slate-700 focus:outline-none focus:border-rose-500" />
              </div>
            )}
            {refundStep === 3 && (
              <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 leading-relaxed">
                {isAr
                  ? `تأكيد استرداد ${refundTarget.totalAmount.toLocaleString()} ج.م لطلب ${refundTarget.orderNumber}؟ لا يمكن التراجع — المخزون يُرجع والطلب يصبح مرتجعاً.`
                  : `Confirm refunding ${refundTarget.totalAmount} for ${refundTarget.orderNumber}? Irreversible — stock returns and order becomes RETURNED.`}
              </div>
            )}
            {refundError && <p role="alert" className="text-rose-400 font-bold">{refundError}</p>}
            <div className="grid grid-cols-2 gap-2">
              {refundStep > 1 ? (
                <button onClick={() => setRefundStep(refundStep - 1)} disabled={refundBusy} className="min-h-[44px] rounded-xl bg-slate-800 text-slate-200 font-bold">{isAr ? 'السابق' : 'Back'}</button>
              ) : (
                <button onClick={() => setRefundTarget(null)} disabled={refundBusy} className="min-h-[44px] rounded-xl bg-slate-800 text-slate-200 font-bold">{isAr ? 'إلغاء' : 'Cancel'}</button>
              )}
              {refundStep < 3 ? (
                <button onClick={() => setRefundStep(refundStep + 1)} className="min-h-[44px] rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold">{isAr ? 'التالي' : 'Next'}</button>
              ) : (
                <button onClick={submitRefund} disabled={refundBusy} className="min-h-[44px] rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-60 text-white font-black">
                  {refundBusy ? '...' : (isAr ? 'تأكيد الاسترداد' : 'Confirm refund')}
                </button>
              )}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
