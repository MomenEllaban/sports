'use client';

import React, { useState, useEffect } from 'react';
import { useLocale } from 'next-intl';
import { useRouter, usePathname, Link } from '@/i18n/routing';
import { useTranslations } from 'next-intl';
import { Plus, ChevronDown, ChevronUp, Package } from 'lucide-react';
import { StatusBadge, PayLabel, SourceLabel, Modal, apiFetch } from './ui';
import { inputCls, Button, NumberField, ConfirmDialog } from '@/components/ui/foundation';
import { nextOrderStatuses, transitionImpact } from '@/lib/orders/transitions';
import { useToast } from '@/components/Toast';
import Pagination from './Pagination';
import InvoiceActions from './InvoiceActions';

interface OrderItem {
  id: string;
  productId: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  product: { id?: string; nameAr: string; nameEn: string; sku: string };
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
  editVersion?: number;
  receiptImage?: string | null;
  invoiceId?: string | null;
  returnStatus?: string;
  returns?: Array<{ id: string; returnNumber: string; status: string; refunds: Array<{ id: string; status: string; amount: number }> }>;
  createdAt: string;
  items: OrderItem[];
  customer: { id: string; name: string | null; phone: string } | null;
  branch: { id: string; name: string } | null;
}

interface ProductOpt { id: string; nameAr: string; nameEn: string; price: number }
interface BranchOpt { id: string; name: string; nameEn: string }

const ORDER_STATUSES = ['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'RETURNED'];
const SELECTABLE_ORDER_STATUSES = ORDER_STATUSES.filter((status) => status !== 'RETURNED');
const PAYMENT_METHODS = ['COD', 'PAYMOB', 'FAWRY', 'INSTAPAY', 'VODAFONE_CASH', 'KASHIER', 'CASH', 'CARD'];

function filtersFromPath(pathname: string): { status: string; source: string } {
  if (pathname.endsWith('/online')) return { status: 'ALL', source: 'ONLINE' };
  if (pathname.endsWith('/pos')) return { status: 'ALL', source: 'POS' };
  if (pathname.endsWith('/whatsapp')) return { status: 'ALL', source: 'WHATSAPP' };
  if (pathname.endsWith('/processing')) return { status: 'PROCESSING', source: 'ALL' };
  if (pathname.endsWith('/completed')) return { status: 'DELIVERED', source: 'ALL' };
  if (pathname.endsWith('/cancelled')) return { status: 'CANCELLED', source: 'ALL' };
  return { status: 'ALL', source: 'ALL' };
}

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
  const pathname = usePathname() || '';
  const { toast } = useToast();
  const isAr = locale === 'ar';

  const [statusFilter, setStatusFilter] = useState(() => filtersFromPath(pathname).status);
  const [sourceFilter, setSourceFilter] = useState(() => filtersFromPath(pathname).source);
  const [updatingId, setUpdatingId] = useState('');
  const [pendingStatusChange, setPendingStatusChange] = useState<{ id: string; from: string; to: string } | null>(null);
  const [error, setError] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showNewOrder, setShowNewOrder] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newOrderError, setNewOrderError] = useState('');

  const [page, setPage] = useState(1);  const PAGE_SIZE = 10;
  const [searchQuery, setSearchQuery] = useState('');
  const [orderList, setOrderList] = useState(orders);

  useEffect(() => {
    setOrderList(orders);
  }, [orders]);

  useEffect(() => {
    const next = filtersFromPath(pathname);
    setStatusFilter(next.status);
    setSourceFilter(next.source);
  }, [pathname]);

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
  const [editingOrder, setEditingOrder] = useState<OrderRow | null>(null);
  const [editLines, setEditLines] = useState<Array<{ productId: string; quantity: number }>>([]);
  const [editForm, setEditForm] = useState({ guestName: '', guestPhone: '', deliveryAddress: '', notes: '', discountAmount: '' });
  const [editError, setEditError] = useState('');
  const [editing, setEditing] = useState(false);

  const q = searchQuery.trim().toLowerCase();
  const filtered = orderList.filter((o) => {
    if (statusFilter !== 'ALL' && o.orderStatus !== statusFilter) return false;
    if (sourceFilter !== 'ALL' && o.orderSource !== sourceFilter) return false;
    if (q) {
      const matchNum = o.orderNumber.toLowerCase().includes(q);
      const matchPhone = o.guestPhone?.toLowerCase().includes(q);
      const matchName = o.guestName?.toLowerCase().includes(q);
      if (!matchNum && !matchPhone && !matchName) return false;
    }
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pagedRows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [statusFilter, sourceFilter, searchQuery]);

  const requestStatusChange = (order: OrderRow, to: string) => {
    if (!nextOrderStatuses(order.orderStatus).some((status) => status === to)) return;
    setError('');
    setPendingStatusChange({ id: order.id, from: order.orderStatus, to });
  };

  const confirmStatusChange = async () => {
    if (!pendingStatusChange) return;
    const pending = pendingStatusChange;
    setUpdatingId(pending.id);
    setError('');
    try {
      await apiFetch(`/api/admin/orders/${pending.id}/status`, 'PATCH', {
        toStatus: pending.to,
        expectedFromStatus: pending.from,
      });
      setOrderList((prev) => prev.map((o) => (o.id === pending.id ? { ...o, orderStatus: pending.to } : o)));
      setPendingStatusChange(null);
      toast(t('orderStatusUpdated'), 'success');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t('operationFailed');
      setPendingStatusChange(null);
      setError(msg);
      toast(msg, 'error');
      router.refresh();
    } finally {
      setUpdatingId('');
    }
  };

  const canEditOrder = (order: OrderRow) => order.kind === 'ORDER'
    && ['PENDING', 'CONFIRMED'].includes(order.orderStatus)
    && order.paymentStatus === 'PENDING'
    && !order.receiptImage;

  const openEditOrder = (order: OrderRow) => {
    if (!canEditOrder(order)) return;
    setEditingOrder(order);
    setEditError('');
    setEditForm({
      guestName: order.guestName || order.customer?.name || '',
      guestPhone: order.guestPhone,
      deliveryAddress: order.deliveryAddress,
      notes: '',
      discountAmount: String(order.discountAmount || 0),
    });
    setEditLines(order.items.map((item) => ({ productId: item.productId, quantity: item.quantity })));
  };

  const handleEditOrder = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editingOrder) return;
    setEditing(true);
    setEditError('');
    try {
      const discount = Number(editForm.discountAmount || 0);
      if (!Number.isFinite(discount) || discount < 0) throw new Error(isAr ? 'الخصم غير صالح' : 'Invalid discount');
      await apiFetch(`/api/admin/orders/${editingOrder.id}/edit`, 'PATCH', {
        expectedVersion: editingOrder.editVersion || 0,
        guestName: editForm.guestName,
        guestPhone: editForm.guestPhone,
        deliveryAddress: editForm.deliveryAddress,
        notes: editForm.notes,
        discountAmount: discount,
        items: editLines,
      });
      setEditingOrder(null);
      toast(isAr ? 'تم تعديل الطلب وتسجيله في سجل التدقيق' : 'Order updated and audited', 'success');
      router.refresh();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t('operationFailed');
      setEditError(message);
      toast(message, 'error');
    } finally {
      setEditing(false);
    }
  };

  // T-RMA: retry a stuck payout via the unified outbox.
  const retryRefund = async (refundId: string) => {
    setUpdatingId(refundId);
    try {
      const res = (await apiFetch(`/api/admin/returns/refunds/${refundId}`, 'POST', {})) as { success?: boolean; result?: { error?: string } };
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
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={isAr ? 'بحث برقم الطلب / الموبايل / الاسم...' : 'Search by order no / phone / name...'}
            className="px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 text-xs placeholder:text-slate-500 w-48 sm:w-60 min-h-[36px]"
          />
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
            {SELECTABLE_ORDER_STATUSES.map((s) => (
              <option key={s} value={s}>{t(`status_${s}`)}</option>
            ))}
          </select>
          <Button
            onClick={() => setShowNewOrder(true)}
            variant="primary"
          >
            <Plus className="w-4 h-4" />
            {isAr ? 'طلب يدوي' : 'New Order'}
          </Button>
        </div>
      </div>

      {error && (
        <div role="alert" className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs mx-4">
          {error}
        </div>
      )}

      {/* Table */}
      <div className="app-scrollbar app-scrollbar-horizontal overflow-x-auto">
        <table className="w-full min-w-[760px] text-xs text-start">
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
                  <td className="p-3"><StatusBadge value={ord.orderStatus} /></td>
                  <td className="p-3">
                    {ord.kind === 'ORDER' ? (
                      <select
                        value={ord.orderStatus}
                        disabled={updatingId === ord.id}
                        onChange={(e) => requestStatusChange(ord, e.target.value)}
                        aria-label={isAr ? 'تأكيد تغيير حالة الطلب' : 'Confirm order status change'}
                        className="min-h-[44px] px-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 text-xs disabled:opacity-60"
                      >
                        <option value={ord.orderStatus}>{t(`status_${ord.orderStatus}`)}</option>
                        {nextOrderStatuses(ord.orderStatus).map((s) => (
                          <option key={s} value={s}>{t(`status_${s}`)}</option>
                        ))}
                      </select>
                    ) : (
                      <span className="text-[11px] text-slate-500 font-bold" title={isAr ? 'بيع كاشير مكتمل ومدفوع' : 'Completed paid POS sale'}>
                        {isAr ? 'بيع مكتمل' : 'Completed'}
                      </span>
                    )}
                    {canEditOrder(ord) && (
                      <button
                        type="button"
                        onClick={() => openEditOrder(ord)}
                        className="mt-2 min-h-[44px] px-2.5 rounded-lg border border-blue-500/40 bg-blue-500/10 text-blue-300 text-[10px] font-bold hover:bg-blue-500/20"
                      >
                        {isAr ? 'تعديل الطلب' : 'Edit order'}
                      </button>
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
                              <div className="text-start">
                                <div className="font-black text-slate-100">{item.totalPrice.toLocaleString()} {isAr ? 'ج.م' : 'EGP'}</div>
                                <div className="text-[10px] text-slate-400">{item.unitPrice.toLocaleString()} × {item.quantity}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-800 bg-slate-950 p-3">
                          <span className="text-[11px] font-bold text-slate-300">{isAr ? 'الفاتورة' : 'Invoice'}</span>
                          <InvoiceActions invoiceId={ord.invoiceId} compact />
                        </div>
                        {/* Order Summary */}
                        <div className="mt-3 flex flex-wrap gap-4 text-[11px] text-slate-400">
                          <span>{isAr ? 'المجموع الفرعي' : 'Subtotal'}: {ord.subtotal?.toLocaleString()} {isAr ? 'ج.م' : 'EGP'}</span>
                          {ord.discountAmount > 0 && <span className="text-rose-400">{isAr ? 'خصم' : 'Discount'}: -{ord.discountAmount?.toLocaleString()}</span>}
                          <span>{isAr ? 'العنوان' : 'Address'}: {ord.deliveryAddress}</span>
                        </div>
                        {/* T-RMA returns section (single path) */}
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
                              <div className="space-y-2">
                                {(ord.returns || []).map((rm) => (
                                  <div key={rm.id} className="flex flex-wrap items-center gap-2 justify-between">
                                    <Link href={`/admin/returns/${rm.id}`} className="font-mono text-[11px] text-amber-400 hover:underline" dir="ltr">
                                      {rm.returnNumber} ({rm.status})
                                    </Link>
                                    {(rm.refunds || []).map((f) => (
                                      <span key={f.id} className="flex items-center gap-1.5">
                                        <span className={`px-2 py-0.5 rounded-lg font-bold text-[10px] ${f.status === 'DONE' ? 'bg-emerald-500/15 text-emerald-400' : f.status === 'FAILED' || f.status === 'MANUAL_REQUIRED' ? 'bg-rose-500/15 text-rose-400' : 'bg-amber-500/15 text-amber-300'}`}>
                                          {f.status === 'DONE' ? (isAr ? 'مسترد' : 'Refunded') : f.status === 'FAILED' ? (isAr ? 'فشل الرد' : 'Payout failed') : f.status === 'MANUAL_REQUIRED' ? (isAr ? 'تسوية يدوية' : 'Manual') : (isAr ? 'معلق' : 'Pending')}
                                          {' • '}{f.amount.toLocaleString()}
                                        </span>
                                        {(f.status === 'FAILED' || f.status === 'PENDING') && (
                                          <button
                                            onClick={() => retryRefund(f.id)}
                                            disabled={updatingId === f.id}
                                            className="min-h-[44px] px-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-[10px] font-bold text-slate-200 disabled:opacity-60"
                                          >
                                            {isAr ? 'إعادة' : 'Retry'}
                                          </button>
                                        )}
                                      </span>
                                    ))}
                                  </div>
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
      <ConfirmDialog
        open={Boolean(pendingStatusChange)}
        title={isAr ? 'تأكيد تغيير حالة الطلب' : 'Confirm order status change'}
        impact={pendingStatusChange ? `${isAr ? 'رقم الطلب' : 'Order'}: ${pendingStatusChange.id}\n${isAr ? 'من' : 'From'}: ${t(`status_${pendingStatusChange.from}`)} ← ${isAr ? 'إلى' : 'to'} ${t(`status_${pendingStatusChange.to}`)}\n${transitionImpact(pendingStatusChange.to) === 'RESTOCK'
          ? (isAr ? 'سيتم إرجاع كميات الأصناف إلى مخزون الفرع.' : 'The order quantities will be returned to branch stock.')
          : transitionImpact(pendingStatusChange.to) === 'FULFILLMENT'
            ? (isAr ? 'سيتم تحديث مسار الشحن/التسليم. لن يتغير المخزون.' : 'Fulfillment/tracking will advance. Stock will not change.')
            : (isAr ? 'لن يتغير المخزون من هذه العملية.' : 'This transition will not change stock.')}` : ''}
        confirmLabel={isAr ? 'تأكيد التغيير' : 'Confirm change'}
        onConfirm={confirmStatusChange}
        onClose={() => setPendingStatusChange(null)}
        busy={Boolean(updatingId)}
      />

      {editingOrder && (
        <Modal title={isAr ? `تعديل الطلب ${editingOrder.orderNumber}` : `Edit order ${editingOrder.orderNumber}`} onClose={() => setEditingOrder(null)} size="lg">
          <form onSubmit={handleEditOrder} className="space-y-4 text-xs">
            {editError && <div role="alert" className="status-danger rounded-xl border p-3 font-bold">{editError}</div>}
            <p className="text-slate-400">{isAr ? 'تُحسب الإجماليات والمخزون على الخادم، ولا يمكن تعديل طلب بعد التجهيز أو الدفع.' : 'Totals and stock are recalculated on the server; shipped or paid orders cannot be edited.'}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>{isAr ? 'اسم العميل' : 'Customer name'}</label>
                <input value={editForm.guestName} onChange={(e) => setEditForm({ ...editForm, guestName: e.target.value })} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>{isAr ? 'رقم الموبايل' : 'Phone'}</label>
                <input required dir="ltr" value={editForm.guestPhone} onChange={(e) => setEditForm({ ...editForm, guestPhone: e.target.value })} className={inputCls} />
              </div>
            </div>
            <div>
              <label className={labelCls}>{isAr ? 'عنوان التوصيل' : 'Delivery address'}</label>
              <input required value={editForm.deliveryAddress} onChange={(e) => setEditForm({ ...editForm, deliveryAddress: e.target.value })} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>{isAr ? 'الخصم (ج.م)' : 'Discount (EGP)'}</label>
              <input type="number" min="0" step="0.01" value={editForm.discountAmount} onChange={(e) => setEditForm({ ...editForm, discountAmount: e.target.value })} className={inputCls} />
            </div>
            <div>
              <div className="flex items-center justify-between gap-2 mb-2">
                <label className={labelCls + ' mb-0'}>{isAr ? 'الأصناف' : 'Items'}</label>
                <span className="font-bold text-slate-300">{isAr ? 'الإجمالي التقديري' : 'Indicative total'}: {(editLines.reduce((sum, line) => { const p = products.find((item) => item.id === line.productId); return sum + (p?.price || 0) * line.quantity; }, 0)).toLocaleString()}</span>
              </div>
              <div className="space-y-2">
                {editLines.map((line, index) => {
                  const selectedIds = new Set(editLines.filter((_, i) => i !== index).map((item) => item.productId));
                  return (
                    <div key={`${line.productId}-${index}`} className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_100px_auto] gap-2 items-center">
                      <select value={line.productId} onChange={(e) => setEditLines(editLines.map((item, i) => i === index ? { ...item, productId: e.target.value } : item))} className={inputCls}>
                        {products.filter((product) => !selectedIds.has(product.id)).map((product) => <option key={product.id} value={product.id}>{isAr ? product.nameAr : product.nameEn} — {product.price.toLocaleString()}</option>)}
                      </select>
                      <NumberField min={1} step={1} value={line.quantity} onChange={(value) => setEditLines(editLines.map((item, i) => i === index ? { ...item, quantity: value } : item))} inputClassName="w-full" />
                      <button type="button" onClick={() => setEditLines(editLines.filter((_, i) => i !== index))} className="min-h-[44px] px-3 rounded-lg border border-rose-500/30 text-rose-300 hover:bg-rose-500/10" aria-label={isAr ? 'حذف الصنف' : 'Remove item'}>×</button>
                    </div>
                  );
                })}
              </div>
              <button type="button" onClick={() => {
                const used = new Set(editLines.map((line) => line.productId));
                const next = products.find((product) => !used.has(product.id));
                if (next) setEditLines([...editLines, { productId: next.id, quantity: 1 }]);
              }} className="mt-2 min-h-[44px] text-blue-400 font-bold hover:underline text-xs">+ {isAr ? 'إضافة صنف' : 'Add item'}</button>
            </div>
            <div>
              <label className={labelCls}>{isAr ? 'ملاحظات التعديل' : 'Edit notes'}</label>
              <textarea rows={2} value={editForm.notes} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} className={`${inputCls} resize-none`} />
            </div>
            <Button type="submit" variant="primary" disabled={editing} className="w-full">{editing ? (isAr ? 'جاري الحفظ...' : 'Saving...') : (isAr ? 'حفظ التعديل' : 'Save changes')}</Button>
          </form>
        </Modal>
      )}

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
                  <NumberField
                    min={1}
                    step={1}
                    value={line.quantity}
                    onChange={(v) => setOrderLines(orderLines.map((l, i) => (i === idx ? { ...l, quantity: v } : l)))}
                    inputClassName="col-span-3"
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

            <Button
              type="submit"
              variant="primary"
              disabled={saving}
              className="w-full"
            >
              {saving ? (isAr ? 'جاري الحفظ...' : 'Saving...') : (isAr ? 'إنشاء الطلب' : 'Create Order')}
            </Button>
          </form>
        </Modal>
      )}
    </div>
  );
}
