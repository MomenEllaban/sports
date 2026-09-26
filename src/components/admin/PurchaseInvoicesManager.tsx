'use client';

import React, { useState, useMemo } from 'react';
import { useLocale } from 'next-intl';
import {
  FileText,
  DollarSign,
  TrendingDown,
  Clock,
  CheckCircle2,
  AlertCircle,
  Search,
  CreditCard,
  X,
  Check,
} from 'lucide-react';
import { Button } from '@/components/ui/foundation';
import { useToast } from '@/components/Toast';
import { apiFetch } from './ui';

export interface PurchaseInvoiceItem {
  id: string;
  poNumber: string;
  supplierId: string;
  supplierName: string;
  branchName: string;
  totalAmount: number;
  paidAmount: number;
  outstandingBalance: number;
  status: 'SUBMITTED' | 'PARTIALLY_RECEIVED' | 'RECEIVED' | 'CANCELLED';
  paymentStatus: 'UNPAID' | 'PARTIALLY_PAID' | 'PAID';
  createdAt: string;
  itemsCount: number;
}

export interface SupplierOption {
  id: string;
  name: string;
}

export default function PurchaseInvoicesManager({
  invoices: initialInvoices,
  suppliers: _suppliers,
}: {
  invoices: PurchaseInvoiceItem[];
  suppliers?: SupplierOption[];
}) {
  const locale = useLocale();
  const isAr = locale === 'ar';
  const L = (ar: string, en: string) => (isAr ? ar : en);
  const currencyLabel = L('ج.م', 'EGP');
  const { toast } = useToast();

  const [invoices, setInvoices] = useState<PurchaseInvoiceItem[]>(initialInvoices);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'ALL' | 'UNPAID' | 'PAID'>('ALL');

  // Payment modal state
  const [payingInvoice, setPayingInvoice] = useState<PurchaseInvoiceItem | null>(null);
  const [payAmount, setPayAmount] = useState<number>(0);
  const [payMethod, setPayMethod] = useState<'CASH' | 'BANK_TRANSFER' | 'CHEQUE' | 'VODAFONE_CASH'>('BANK_TRANSFER');
  const [payRef, setPayRef] = useState('');
  const [payNotes, setPayNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const stats = useMemo(() => {
    let totalInvoiced = 0;
    let totalPaid = 0;
    let totalDue = 0;
    let unpaidCount = 0;

    invoices.forEach((inv) => {
      totalInvoiced += inv.totalAmount;
      totalPaid += inv.paidAmount;
      totalDue += inv.outstandingBalance;
      if (inv.paymentStatus !== 'PAID') unpaidCount++;
    });

    return { totalInvoiced, totalPaid, totalDue, unpaidCount };
  }, [invoices]);

  const filtered = useMemo(() => {
    return invoices.filter((inv) => {
      const q = search.trim().toLowerCase();
      const matchesSearch =
        !q ||
        inv.poNumber.toLowerCase().includes(q) ||
        inv.supplierName.toLowerCase().includes(q) ||
        inv.branchName.toLowerCase().includes(q);

      if (!matchesSearch) return false;

      if (filter === 'UNPAID') return inv.paymentStatus !== 'PAID';
      if (filter === 'PAID') return inv.paymentStatus === 'PAID';
      return true;
    });
  }, [invoices, search, filter]);

  const openPaymentModal = (inv: PurchaseInvoiceItem) => {
    setPayingInvoice(inv);
    setPayAmount(inv.outstandingBalance > 0 ? inv.outstandingBalance : inv.totalAmount);
    setPayRef(`PO-${inv.poNumber}`);
    setPayNotes('');
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payingInvoice) return;
    if (payAmount <= 0) {
      toast(L('الرجاء إدخال مبلغ دفع صالح', 'Please enter a valid payment amount'), 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      await apiFetch('/api/admin/supplier-payments', 'POST', {
        supplierId: payingInvoice.supplierId,
        amount: payAmount,
        method: payMethod,
        reference: payRef || undefined,
        notes: payNotes || `Payment for PO ${payingInvoice.poNumber}`,
      });

      setInvoices((prev) =>
        prev.map((inv) => {
          if (inv.id !== payingInvoice.id) return inv;
          const newPaid = inv.paidAmount + payAmount;
          const newDue = Math.max(0, inv.totalAmount - newPaid);
          const newStatus: PurchaseInvoiceItem['paymentStatus'] =
            newDue === 0 ? 'PAID' : newPaid > 0 ? 'PARTIALLY_PAID' : 'UNPAID';

          return {
            ...inv,
            paidAmount: newPaid,
            outstandingBalance: newDue,
            paymentStatus: newStatus,
          };
        })
      );

      toast(L('تم تسجيل دفعة المورد بنجاح وتحديث الحسابات', 'Supplier payment recorded and accounts updated!'), 'success');
      setPayingInvoice(null);
    } catch {
      toast(L('فشل تسجيل الدفعة، يرجى المحاولة لاحقاً', 'Failed to record payment'), 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-panel p-5 rounded-2xl border border-slate-800 bg-slate-900/60">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-semibold">{L('إجمالي فواتير المشتريات', 'Total Purchases')}</span>
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <FileText className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black text-slate-100">{stats.totalInvoiced.toLocaleString()}</span>
            <span className="text-xs text-slate-400 ms-1">{currencyLabel}</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">{L('قيمة فواتير أوامر التوريد الصادرة', 'Total PO invoice values')}</p>
        </div>

        <div className="glass-panel p-5 rounded-2xl border border-slate-800 bg-slate-900/60">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-semibold">{L('المدفوع للموردين', 'Total Paid to Suppliers')}</span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black text-emerald-400">{stats.totalPaid.toLocaleString()}</span>
            <span className="text-xs text-slate-400 ms-1">{currencyLabel}</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">{L('تحويلات نقدية وبنكية مسددة', 'Cash and bank transfers paid')}</p>
        </div>

        <div className="glass-panel p-5 rounded-2xl border border-slate-800 bg-slate-900/60">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-semibold">{L('المستحق للموردين (ذمم دائنة)', 'Outstanding Payables')}</span>
            <div className="p-2 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20">
              <TrendingDown className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black text-rose-400">{stats.totalDue.toLocaleString()}</span>
            <span className="text-xs text-slate-400 ms-1">{currencyLabel}</span>
          </div>
          <p className="text-[11px] text-rose-400/80 mt-1">{L('مستحقات واجبة السداد للموردين', 'Due payments to suppliers')}</p>
        </div>

        <div className="glass-panel p-5 rounded-2xl border border-slate-800 bg-slate-900/60">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-semibold">{L('الفواتير غير المسددة', 'Unpaid Bills')}</span>
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black text-amber-400">{stats.unpaidCount}</span>
            <span className="text-xs text-slate-400 ms-2">{L('فاتورة', 'bills')}</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">{L('تحتاج تسوية وصرف دفعات', 'Require payment settlement')}</p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setFilter('ALL')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
              filter === 'ALL'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200'
            }`}
          >
            {L('كل الفواتير', 'All Invoices')} ({invoices.length})
          </button>
          <button
            onClick={() => setFilter('UNPAID')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
              filter === 'UNPAID'
                ? 'bg-rose-600 text-white shadow-lg shadow-rose-500/20'
                : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-rose-300'
            }`}
          >
            {L('غير مسددة', 'Unpaid')} ({stats.unpaidCount})
          </button>
          <button
            onClick={() => setFilter('PAID')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
              filter === 'PAID'
                ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/20'
                : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-emerald-300'
            }`}
          >
            {L('مسددة بالكامل', 'Fully Paid')} ({invoices.length - stats.unpaidCount})
          </button>
        </div>

        <div className="relative min-w-[240px]">
          <Search className="w-4 h-4 text-slate-500 absolute start-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={L('بحث برقم الفاتورة أو المورد...', 'Search bill # or supplier...')}
            className="w-full bg-slate-900/80 border border-slate-700/80 rounded-xl ps-9 pe-3 py-1.5 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
          />
        </div>
      </div>

      {/* Invoices Table */}
      <div className="app-scrollbar app-scrollbar-horizontal overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900/40">
        <table className="w-full min-w-[800px] text-xs text-start">
          <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
            <tr>
              <th className="p-3.5 text-start">{L('رقم الفاتورة / أمر التوريد', 'Bill / PO Number')}</th>
              <th className="p-3.5 text-start">{L('المورد', 'Supplier')}</th>
              <th className="p-3.5 text-center">{L('إجمالي الفاتورة', 'Total Bill')}</th>
              <th className="p-3.5 text-center">{L('المسدد', 'Paid Amount')}</th>
              <th className="p-3.5 text-center">{L('المتبقي', 'Due Balance')}</th>
              <th className="p-3.5 text-center">{L('حالة السداد', 'Payment Status')}</th>
              <th className="p-3.5 text-center">{L('تاريخ الفاتورة', 'Date')}</th>
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
                        {inv.itemsCount} {L('أصناف', 'items')} • {inv.branchName}
                      </div>
                    </td>

                    <td className="p-3.5 font-bold text-slate-200">{inv.supplierName}</td>

                    <td className="p-3.5 text-center font-bold text-slate-200">
                      {inv.totalAmount.toLocaleString()} {currencyLabel}
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
                          <CheckCircle2 className="w-3 h-3" />
                          {L('مسددة بالكامل', 'Paid')}
                        </span>
                      )}
                      {inv.paymentStatus === 'PARTIALLY_PAID' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-blue-500/10 text-blue-300 border border-blue-500/30">
                          <Clock className="w-3 h-3" />
                          {L('مسددة جزئياً', 'Partial')}
                        </span>
                      )}
                      {inv.paymentStatus === 'UNPAID' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-300 border border-rose-500/30">
                          <AlertCircle className="w-3 h-3" />
                          {L('غير مسددة', 'Unpaid')}
                        </span>
                      )}
                    </td>

                    <td className="p-3.5 text-center text-slate-400 text-[11px]">
                      {new Date(inv.createdAt).toLocaleDateString(locale)}
                    </td>

                    <td className="p-3.5 text-end">
                      {!isPaid ? (
                        <button
                          onClick={() => openPaymentModal(inv)}
                          className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold inline-flex items-center gap-1.5 shadow-md shadow-emerald-600/20 transition-all"
                        >
                          <CreditCard className="w-3.5 h-3.5" />
                          {L('تسجيل دفعة', 'Pay Bill')}
                        </button>
                      ) : (
                        <span className="text-xs text-emerald-400 font-semibold px-2 flex items-center justify-end gap-1">
                          <Check className="w-3.5 h-3.5" />
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

      {/* Record Supplier Payment Modal */}
      {payingInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-md shadow-2xl relative">
            <button
              onClick={() => setPayingInvoice(null)}
              className="absolute top-5 end-5 p-1 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-3 border-b border-slate-800 pb-4">
              <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <CreditCard className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-slate-100 text-sm">
                  {L('تسجيل دفعة مورد (إذن صرف)', 'Record Supplier Payment')}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  {payingInvoice.supplierName} • {payingInvoice.poNumber}
                </p>
              </div>
            </div>

            <form onSubmit={handleRecordPayment} className="space-y-4 mt-5">
              <div>
                <label className="text-xs text-slate-300 font-semibold block mb-1.5">
                  {L('المبلغ المسدد', 'Payment Amount')}
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min={1}
                    max={payingInvoice.outstandingBalance > 0 ? payingInvoice.outstandingBalance : undefined}
                    value={payAmount}
                    onChange={(e) => setPayAmount(Math.max(1, Number(e.target.value) || 0))}
                    required
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-100 font-bold focus:outline-none focus:border-emerald-500"
                  />
                  <span className="absolute end-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">
                    {currencyLabel}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  {L('المتبقي على الفاتورة:', 'Due on invoice:')}{' '}
                  <span className="text-rose-400 font-bold">
                    {payingInvoice.outstandingBalance.toLocaleString()} {currencyLabel}
                  </span>
                </p>
              </div>

              <div>
                <label className="text-xs text-slate-300 font-semibold block mb-1.5">
                  {L('طريقة الدفع', 'Payment Method')}
                </label>
                <select
                  value={payMethod}
                  onChange={(e) => setPayMethod(e.target.value as typeof payMethod)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                >
                  <option value="BANK_TRANSFER">{L('تحويل بنكي', 'Bank Transfer')}</option>
                  <option value="CASH">{L('نقداً من الخزينة', 'Cash from Treasury')}</option>
                  <option value="CHEQUE">{L('شيك بنكي', 'Cheque')}</option>
                  <option value="VODAFONE_CASH">{L('فودافون كاش / إنستاباي', 'Vodafone Cash / InstaPay')}</option>
                </select>
              </div>

              <div>
                <label className="text-xs text-slate-300 font-semibold block mb-1.5">
                  {L('رقم الإيصال / المرجع البنكي', 'Reference / Receipt Number')}
                </label>
                <input
                  type="text"
                  value={payRef}
                  onChange={(e) => setPayRef(e.target.value)}
                  placeholder="e.g. TR-998822"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-xs text-slate-300 font-semibold block mb-1.5">
                  {L('ملاحظات الصرف (اختياري)', 'Payment Notes (Optional)')}
                </label>
                <input
                  type="text"
                  value={payNotes}
                  onChange={(e) => setPayNotes(e.target.value)}
                  placeholder={L('بيان السداد أو موافقة المدير المالي', 'Settlement details or approval')}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <Button type="button" variant="secondary" onClick={() => setPayingInvoice(null)} disabled={isSubmitting}>
                  {L('إلغاء', 'Cancel')}
                </Button>
                <Button type="submit" variant="primary" disabled={isSubmitting} className="bg-emerald-600 hover:bg-emerald-500">
                  <Check className="w-3.5 h-3.5" />
                  {isSubmitting ? L('جارٍ التسجيل...', 'Recording...') : L('تأكيد تسجيل الدفعة', 'Confirm Payment')}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
