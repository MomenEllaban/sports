'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { useLocale } from 'next-intl';
import { usePathname, useRouter } from '@/i18n/routing';
import {
  FileText,
  DollarSign,
  TrendingDown,
  Clock,
  CheckCircle2,
  AlertCircle,
  CreditCard,
  Check,
  Search,
  TriangleAlert,
} from 'lucide-react';
import { Button, Modal } from '@/components/ui/foundation';
import { useToast } from '@/components/Toast';
import { apiFetch } from './ui';
import Pagination from './Pagination';
import { getClientErrorMessage } from '@/lib/client-api';
import type { PurchaseOrderStatus } from '@prisma/client';

export interface PurchaseInvoiceItem {
  id: string;
  poNumber: string;
  supplierId: string;
  supplierName: string;
  branchName: string;
  /** Full order value. */
  totalAmount: number;
  /** Received share of the order: the part actually owed for goods in hand. */
  committed: number;
  paidAmount: number;
  outstandingBalance: number;
  status: PurchaseOrderStatus;
  paymentStatus: 'UNPAID' | 'PARTIALLY_PAID' | 'PAID';
  createdAt: string;
  itemsCount: number;
}

export interface SupplierOption {
  id: string;
  name: string;
}

type PaymentMethod = 'CASH' | 'BANK_TRANSFER' | 'CHEQUE' | 'VODAFONE_CASH';

const METHODS: Array<{ value: PaymentMethod; ar: string; en: string }> = [
  { value: 'BANK_TRANSFER', ar: 'تحويل بنكي', en: 'Bank Transfer' },
  { value: 'CASH', ar: 'نقداً من الخزينة', en: 'Cash from Treasury' },
  { value: 'CHEQUE', ar: 'شيك بنكي', en: 'Cheque' },
  { value: 'VODAFONE_CASH', ar: 'فودافون كاش / إنستاباي', en: 'Vodafone Cash / InstaPay' },
];

export default function PurchaseInvoicesManager({
  invoices,
  suppliers,
  totalCount,
  allCount,
  unpaidCount,
  page,
  totalPages,
  unpaidOnly,
  selectedSupplierId,
  totals,
  truncated,
}: {
  invoices: PurchaseInvoiceItem[];
  suppliers: SupplierOption[];
  /** Rows matching the active filter. */
  totalCount: number;
  /** Rows matching the branch and supplier scope, ignoring the unpaid filter. */
  allCount: number;
  /** Rows with an outstanding balance, ignoring the unpaid filter. */
  unpaidCount: number;
  page: number;
  totalPages: number;
  unpaidOnly: boolean;
  selectedSupplierId: string;
  totals: { unattributed: number };
  truncated: boolean;
}) {
  const locale = useLocale();
  const isAr = locale === 'ar';
  const L = useCallback((ar: string, en: string) => (isAr ? ar : en), [isAr]);
  const currencyLabel = L('ج.م', 'EGP');
  const { toast } = useToast();
  const router = useRouter();
  const pathname = usePathname() || '';

  const [search, setSearch] = useState('');
  const [payingInvoice, setPayingInvoice] = useState<PurchaseInvoiceItem | null>(null);
  const [payAmount, setPayAmount] = useState<number>(0);
  const [payMethod, setPayMethod] = useState<PaymentMethod>('BANK_TRANSFER');
  const [payRef, setPayRef] = useState('');
  const [payNotes, setPayNotes] = useState('');
  const [payError, setPayError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [appliedSearch, setAppliedSearch] = useState('');

  // The page is filtered and paginated on the server, so the list below only
  // narrows the rows that were actually delivered for this page.
  const filtered = useMemo(() => {
    const term = appliedSearch.trim().toLowerCase();
    if (!term) return invoices;
    return invoices.filter((inv) =>
      [inv.poNumber, inv.supplierName, inv.branchName].some((value) =>
        value.toLowerCase().includes(term),
      ),
    );
  }, [invoices, appliedSearch]);

  /**
   * One builder for every navigation here. Dropping the filters when changing
   * page or view used to leave the controls showing a state the data did not
   * reflect.
   */
  const buildUrl = (next: { page?: number; unpaid?: boolean; supplierId?: string; query?: string }) => {
    const params = new URLSearchParams();
    const supplierId = next.supplierId !== undefined ? next.supplierId : selectedSupplierId;
    const unpaid = next.unpaid !== undefined ? next.unpaid : unpaidOnly;
    const query = next.query !== undefined ? next.query : appliedSearch;
    if (supplierId) params.set('supplierId', supplierId);
    if (unpaid) params.set('unpaid', '1');
    if (query.trim()) params.set('query', query.trim());
    if ((next.page ?? 1) > 1) params.set('page', String(next.page ?? 1));
    const qs = params.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  };

  const navigate = (next: { page?: number; unpaid?: boolean; supplierId?: string; query?: string }) => {
    router.push(buildUrl({ page: 1, ...next }));
  };

  // Sums cover only the rows on screen. The counts beside the filter buttons come
  // from the server over the whole scoped set, so they are passed in rather than
  // counted here.
  const pageStats = useMemo(() => {
    let committed = 0;
    let paid = 0;
    let due = 0;
    for (const inv of invoices) {
      committed += inv.committed;
      paid += inv.paidAmount;
      due += inv.outstandingBalance;
    }
    return { committed, paid, due };
  }, [invoices]);

  const openPaymentModal = (inv: PurchaseInvoiceItem) => {
    setPayingInvoice(inv);
    setPayAmount(inv.outstandingBalance);
    setPayRef(`PO-${inv.poNumber}`);
    setPayNotes('');
    setPayError('');
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payingInvoice) return;
    if (!Number.isFinite(payAmount) || payAmount <= 0) {
      setPayError(L('أدخل مبلغًا صحيحًا أكبر من صفر', 'Enter an amount greater than zero'));
      return;
    }
    if (payAmount > payingInvoice.outstandingBalance) {
      setPayError(
        L(
          `المبلغ يتجاوز المتبقي على الفاتورة (${payingInvoice.outstandingBalance.toFixed(2)} ${currencyLabel})`,
          `Amount exceeds the invoice balance (${payingInvoice.outstandingBalance.toFixed(2)} ${currencyLabel})`,
        ),
      );
      return;
    }
    setIsSubmitting(true);
    setPayError('');
    try {
      // The order is named explicitly. Without it the payment lands in the
      // supplier ledger with no invoice attached, which is what made the
      // previous balance maths double-count the same cash on several orders.
      await apiFetch('/api/admin/supplier-payments', 'POST', {
        supplierId: payingInvoice.supplierId,
        purchaseOrderId: payingInvoice.id,
        amount: payAmount,
        method: payMethod,
        reference: payRef || undefined,
        notes: payNotes || `Payment for PO ${payingInvoice.poNumber}`,
      });
      toast(L('تم تسجيل دفعة المورد بنجاح وتحديث الحسابات', 'Supplier payment recorded and accounts updated!'), 'success');
      setPayingInvoice(null);
      router.refresh();
    } catch (err) {
      const msg = getClientErrorMessage(err, L('فشل تسجيل الدفعة', 'Failed to record payment'));
      setPayError(msg);
      toast(msg, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filterBtn = (active: boolean, tone: string) =>
    `px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
      active ? `${tone} text-white shadow-lg` : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200'
    }`;

  return (
    <div className="space-y-6">
      {/* Top Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-panel p-5 rounded-2xl border border-slate-800 bg-slate-900/60">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-semibold">{L('المستحق على هذه الصفحة', 'Committed on this page')}</span>
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <FileText className="w-5 h-5" aria-hidden="true" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black text-slate-100">{pageStats.committed.toLocaleString()}</span>
            <span className="text-xs text-slate-400 ms-1">{currencyLabel}</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            {L('قيمة الأصناف المستلمة فعليًا من أوامر التوريد', 'Value of goods actually received on these orders')}
          </p>
        </div>

        <div className="glass-panel p-5 rounded-2xl border border-slate-800 bg-slate-900/60">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-semibold">{L('المسدد لأوامر التوريد', 'Paid against orders')}</span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <DollarSign className="w-5 h-5" aria-hidden="true" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black text-emerald-400">{pageStats.paid.toLocaleString()}</span>
            <span className="text-xs text-slate-400 ms-1">{currencyLabel}</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            {L(
              `مخصص لأوامر هذه الصفحة. الدفعات المسجلة دون أمر محدد: ${totals.unattributed.toLocaleString()} ${currencyLabel}`,
              `Attributed to the orders on this page. Advances recorded without an order: ${totals.unattributed.toLocaleString()} ${currencyLabel}`,
            )}
          </p>
        </div>

        <div className="glass-panel p-5 rounded-2xl border border-slate-800 bg-slate-900/60">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-semibold">{L('المستحق للموردين (ذمم دائنة)', 'Outstanding Payables')}</span>
            <div className="p-2 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20">
              <TrendingDown className="w-5 h-5" aria-hidden="true" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black text-rose-400">{pageStats.due.toLocaleString()}</span>
            <span className="text-xs text-slate-400 ms-1">{currencyLabel}</span>
          </div>
          <p className="text-[11px] text-rose-400/80 mt-1">{L('مستحقات واجبة السداد للموردين', 'Due payments to suppliers')}</p>
        </div>

        <div className="glass-panel p-5 rounded-2xl border border-slate-800 bg-slate-900/60">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-semibold">{L('فواتير غير مسددة', 'Unpaid Bills')}</span>
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Clock className="w-5 h-5" aria-hidden="true" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black text-amber-400">{unpaidCount}</span>
            <span className="text-xs text-slate-400 ms-2">{L('فاتورة', 'bills')}</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">{L('من إجمالي', 'of')} {allCount} {L('فاتورة', 'bills')}</p>
        </div>
      </div>

      {truncated && (
        <div role="alert" className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs font-bold text-amber-300">
          <TriangleAlert className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
          {L(
            'عدد أوامر التوريد كبير جدًا؛ تم عرض أحدث جزء فقط. استخدم تصفية المورد أو زر "غير مسددة" لتضييق النطاق.',
            'There are more purchase orders than this view scans, so only the most recent are shown. Filter by supplier or use the unpaid filter to narrow the range.',
          )}
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate({ unpaid: false })}
            className={filterBtn(!unpaidOnly, 'bg-blue-600 shadow-blue-500/20')}
          >
            {L('كل الفواتير', 'All Invoices')} ({allCount})
          </button>
          <button
            onClick={() => navigate({ unpaid: true })}
            className={filterBtn(unpaidOnly, 'bg-rose-700 shadow-rose-500/20')}
          >
            {L('غير مسددة', 'Unpaid')} ({unpaidCount})
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="sr-only" htmlFor="inv-supplier">{L('تصفية حسب المورد', 'Filter by supplier')}</label>
          <select
            id="inv-supplier"
            value={selectedSupplierId}
            onChange={(e) => navigate({ supplierId: e.target.value })}
            className="min-h-[44px] rounded-xl border border-slate-700 bg-slate-900 px-2 text-xs text-slate-200"
          >
            <option value="">{L('كل الموردين', 'All suppliers')}</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <div className="relative min-w-[240px]">
            <Search className="w-4 h-4 text-slate-500 absolute start-3 top-1/2 -translate-y-1/2" aria-hidden="true" />
            <label className="sr-only" htmlFor="inv-search">{L('بحث في هذه الصفحة', 'Search this page')}</label>
            <input
              id="inv-search"
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setAppliedSearch(e.target.value);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') navigate({ query: search });
              }}
              placeholder={L('بحث في هذه الصفحة...', 'Search this page...')}
              className="w-full min-h-[44px] bg-slate-900/80 border border-slate-700/80 rounded-xl ps-9 pe-3 py-1.5 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Invoices Table */}
      <div className="app-scrollbar app-scrollbar-horizontal overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900/40">
        <table className="w-full min-w-[800px] text-xs text-start">
          <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
            <tr>
              <th className="p-3.5 text-start">{L('رقم الفاتورة / أمر التوريد', 'Bill / PO Number')}</th>
              <th className="p-3.5 text-start">{L('المورد', 'Supplier')}</th>
              <th className="p-3.5 text-center">{L('قيمة الأمر', 'Order Value')}</th>
              <th className="p-3.5 text-center">{L('المستحق بعد الاستلام', 'Committed')}</th>
              <th className="p-3.5 text-center">{L('المسدد', 'Paid Amount')}</th>
              <th className="p-3.5 text-center">{L('المتبقي', 'Due Balance')}</th>
              <th className="p-3.5 text-center">{L('حالة السداد', 'Payment Status')}</th>
              <th className="p-3.5 text-end">{L('الإجراءات', 'Actions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="p-8 text-center text-slate-500">
                  {L('لا توجد فواتير مشتريات مطابقة', 'No purchase bills found')}
                </td>
              </tr>
            ) : (
              filtered.map((inv) => {
                const isPaid = inv.paymentStatus === 'PAID';
                return (
                  <tr key={inv.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="p-3.5">
                      <span className="font-mono font-bold text-blue-400">{inv.poNumber}</span>
                      <div className="text-[10px] text-slate-500 mt-0.5">
                        {inv.itemsCount} {L('أصناف', 'items')} • {inv.branchName} •{' '}
                        {new Date(inv.createdAt).toLocaleDateString(locale)}
                      </div>
                    </td>

                    <td className="p-3.5 font-bold text-slate-200">{inv.supplierName}</td>

                    <td className="p-3.5 text-center font-semibold text-slate-400">
                      {inv.totalAmount.toLocaleString()} {currencyLabel}
                    </td>

                    <td className="p-3.5 text-center font-bold text-slate-200">
                      {inv.committed.toLocaleString()} {currencyLabel}
                    </td>

                    <td className="p-3.5 text-center font-semibold text-emerald-400">
                      {inv.paidAmount.toLocaleString()} {currencyLabel}
                    </td>

                    <td className="p-3.5 text-center">
                      <span className={`font-black ${inv.outstandingBalance > 0 ? 'text-rose-400' : 'text-slate-400'}`}>
                        {inv.outstandingBalance.toLocaleString()} {currencyLabel}
                      </span>
                    </td>

                    <td className="p-3.5 text-center">
                      {inv.paymentStatus === 'PAID' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">
                          <CheckCircle2 className="w-3 h-3" aria-hidden="true" />
                          {L('مسددة بالكامل', 'Paid')}
                        </span>
                      )}
                      {inv.paymentStatus === 'PARTIALLY_PAID' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-blue-500/10 text-blue-300 border border-blue-500/30">
                          <Clock className="w-3 h-3" aria-hidden="true" />
                          {L('مسددة جزئياً', 'Partial')}
                        </span>
                      )}
                      {inv.paymentStatus === 'UNPAID' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-300 border border-rose-500/30">
                          <AlertCircle className="w-3 h-3" aria-hidden="true" />
                          {L('غير مسددة', 'Unpaid')}
                        </span>
                      )}
                    </td>

                    <td className="p-3.5 text-end">
                      {!isPaid ? (
                        <button
                          onClick={() => openPaymentModal(inv)}
                          className="px-3 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-700 text-white text-xs font-bold inline-flex items-center gap-1.5 shadow-md shadow-emerald-600/20 transition-all"
                        >
                          <CreditCard className="w-3.5 h-3.5" aria-hidden="true" />
                          {L('تسجيل دفعة', 'Pay Bill')}
                        </button>
                      ) : (
                        <span className="text-xs text-emerald-400 font-semibold px-2 flex items-center justify-end gap-1">
                          <Check className="w-3.5 h-3.5" aria-hidden="true" />
                          {L('خالصة', 'Settled')}
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

      {totalPages > 1 && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-[11px] font-bold text-slate-400">
            {L(`${filtered.length} من ${totalCount}`, `${filtered.length} of ${totalCount}`)}
          </span>
          <Pagination page={page} totalPages={totalPages} onPageChange={(next) => router.push(buildUrl({ page: next }))} />
        </div>
      )}

      {payingInvoice && (
        <Modal
          title={L('تسجيل دفعة مورد (إذن صرف)', 'Record Supplier Payment')}
          onClose={() => setPayingInvoice(null)}
        >
          <form onSubmit={handleRecordPayment} className="space-y-4 text-xs">
            <p className="text-[11px] text-slate-400">
              {payingInvoice.supplierName} • <span className="font-mono">{payingInvoice.poNumber}</span>
            </p>
            {payError && (
              <div role="alert" className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-2.5 font-bold text-rose-300">
                {payError}
              </div>
            )}

            <div>
              <label htmlFor="pay-amount" className="text-slate-300 font-semibold block mb-1.5">
                {L('المبلغ المسدد', 'Payment Amount')}
              </label>
              <input
                id="pay-amount"
                type="number"
                min={0.01}
                step={0.01}
                max={payingInvoice.outstandingBalance}
                value={payAmount}
                onChange={(e) => setPayAmount(Number(e.target.value))}
                required
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-100 font-bold focus:outline-none focus:border-emerald-500"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                {L('المتبقي على الفاتورة:', 'Due on invoice:')}{' '}
                <span className="text-rose-400 font-bold">
                  {payingInvoice.outstandingBalance.toFixed(2)} {currencyLabel}
                </span>
              </p>
            </div>

            <div>
              <label htmlFor="pay-method" className="text-slate-300 font-semibold block mb-1.5">
                {L('طريقة الدفع', 'Payment Method')}
              </label>
              <select
                id="pay-method"
                value={payMethod}
                onChange={(e) => setPayMethod(e.target.value as PaymentMethod)}
                className="w-full min-h-[44px] bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
              >
                {METHODS.map((m) => (
                  <option key={m.value} value={m.value}>{L(m.ar, m.en)}</option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="pay-ref" className="text-slate-300 font-semibold block mb-1.5">
                {L('رقم الإيصال / المرجع البنكي', 'Reference / Receipt Number')}
              </label>
              <input
                id="pay-ref"
                type="text"
                value={payRef}
                onChange={(e) => setPayRef(e.target.value)}
                placeholder="e.g. TR-998822"
                className="w-full min-h-[44px] bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label htmlFor="pay-notes" className="text-slate-300 font-semibold block mb-1.5">
                {L('ملاحظات الصرف (اختياري)', 'Payment Notes (Optional)')}
              </label>
              <input
                id="pay-notes"
                type="text"
                value={payNotes}
                onChange={(e) => setPayNotes(e.target.value)}
                placeholder={L('بيان السداد أو موافقة المدير المالي', 'Settlement details or approval')}
                className="w-full min-h-[44px] bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
              <Button type="button" variant="secondary" onClick={() => setPayingInvoice(null)} disabled={isSubmitting}>
                {L('إلغاء', 'Cancel')}
              </Button>
              <Button type="submit" variant="primary" disabled={isSubmitting} className="bg-emerald-700 hover:bg-emerald-700">
                <Check className="w-3.5 h-3.5" aria-hidden="true" />
                {isSubmitting ? L('جارٍ التسجيل...', 'Recording...') : L('تأكيد تسجيل الدفعة', 'Confirm Payment')}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
