'use client';

import React, { useState, useEffect } from 'react';
import { useLocale } from 'next-intl';
import {
  Plus,
  Search,
  Printer,
} from 'lucide-react';
import { Modal, apiFetch } from './ui';
import { useToast } from '@/components/Toast';
import { inputCls, Button } from '@/components/ui/foundation';
import Pagination from './Pagination';

interface CustomerOpt {
  id: string;
  name: string | null;
  phone: string;
}

interface BranchOpt {
  id: string;
  name: string;
  nameEn: string;
}

interface PaymentAllocation {
  id: string;
  invoiceId: string;
  invoiceNumber: string;
  amount: number;
}

interface CustomerPaymentRow {
  id: string;
  receiptNumber: string;
  customerId: string;
  branchId: string;
  amount: number;
  allocatedAmount: number;
  credit: number;
  method: string;
  reference: string | null;
  notes: string | null;
  paidAt: string;
  createdAt: string;
  customer?: { id: string; name: string | null; phone: string };
  branch?: { id: string; name: string; nameEn: string };
  allocations: PaymentAllocation[];
}

interface OpenInvoice {
  id: string;
  invoiceNumber: string;
  total: number;
  paidAmount: number;
  outstanding: number;
  dueDate: string | null;
}

export default function CustomerPaymentsManager({
  customers,
  branches,
  initialCustomerId = '',
  initialInvoiceId = '',
}: {
  customers: CustomerOpt[];
  branches: BranchOpt[];
  initialCustomerId?: string;
  initialInvoiceId?: string;
}) {
  const locale = useLocale();
  const { toast } = useToast();
  const isAr = locale === 'ar';
  const L = (ar: string, en: string) => (isAr ? ar : en);
  const currencyLabel = L('ج.م', 'EGP');

  const [payments, setPayments] = useState<CustomerPaymentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [branchFilter, setBranchFilter] = useState('');
  const [page, setPage] = useState(1);
  const [pageCount, setPageCount] = useState(1);
  const [total, setTotal] = useState(0);

  // New Payment Modal
  const [showNewModal, setShowNewModal] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState(initialCustomerId || customers[0]?.id || '');
  const [selectedBranchId, setSelectedBranchId] = useState(branches[0]?.id || '');
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [paymentReference, setPaymentReference] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [openInvoices, setOpenInvoices] = useState<OpenInvoice[]>([]);
  const [allocations, setAllocations] = useState<Record<string, number>>({});
  const [recording, setRecording] = useState(false);
  const [recordError, setRecordError] = useState('');

  const fetchPayments = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: '10',
      });
      if (search) params.set('q', search);
      if (branchFilter) params.set('branchId', branchFilter);

      const res = (await apiFetch(`/api/admin/customer-payments?${params.toString()}`, 'GET')) as {
        success?: boolean;
        rows?: CustomerPaymentRow[];
        total?: number;
        pageCount?: number;
      };
      if (res.rows) {
        setPayments(res.rows);
        setTotal(res.total || 0);
        setPageCount(res.pageCount || 1);
      }
    } catch {
      toast(L('فشل تحميل سجل المقبوضات', 'Failed to load payments'), 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayments();
  }, [page, branchFilter]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1);
      fetchPayments();
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Load customer open invoices for allocation
  const loadCustomerOpenInvoices = async (custId: string) => {
    if (!custId) return;
    try {
      const res = (await apiFetch(`/api/admin/receivables?customerId=${custId}`, 'GET')) as {
        openInvoices?: OpenInvoice[];
      };
      const invs = res.openInvoices || [];
      setOpenInvoices(invs);

      // If initial invoice was passed, auto-allocate
      if (initialInvoiceId) {
        const target = invs.find((i) => i.id === initialInvoiceId);
        if (target) {
          setAllocations({ [target.id]: target.outstanding });
          setPaymentAmount(target.outstanding);
        }
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    if (showNewModal && selectedCustomerId) {
      loadCustomerOpenInvoices(selectedCustomerId);
    }
  }, [showNewModal, selectedCustomerId]);

  useEffect(() => {
    if (initialCustomerId || initialInvoiceId) {
      setShowNewModal(true);
    }
  }, [initialCustomerId, initialInvoiceId]);

  const handleAllocationChange = (invId: string, val: number) => {
    const next = { ...allocations, [invId]: Math.max(0, val) };
    if (val <= 0) delete next[invId];
    setAllocations(next);

    // Sum up allocated amounts to update total payment amount if desired
    const sum = Object.values(next).reduce((a, b) => a + b, 0);
    if (paymentAmount < sum) {
      setPaymentAmount(sum);
    }
  };

  const handlePayFullInvoice = (inv: OpenInvoice) => {
    handleAllocationChange(inv.id, inv.outstanding);
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (paymentAmount <= 0) {
      setRecordError(L('يرجى تحديد مبلغ دفع صحيح أكبر من صفر', 'Please enter a valid amount'));
      return;
    }
    setRecording(true);
    setRecordError('');
    try {
      const allocList = Object.entries(allocations)
        .filter(([, amt]) => amt > 0)
        .map(([invoiceId, amount]) => ({ invoiceId, amount }));

      await apiFetch('/api/admin/customer-payments', 'POST', {
        customerId: selectedCustomerId,
        branchId: selectedBranchId,
        amount: paymentAmount,
        method: paymentMethod,
        reference: paymentReference || undefined,
        notes: paymentNotes || undefined,
        allocations: allocList.length > 0 ? allocList : undefined,
      });

      toast(L('تم تسجيل سند القبض بنجاح وتحديث حساب العميل', 'Payment recorded successfully'), 'success');
      setShowNewModal(false);
      setAllocations({});
      setPaymentAmount(0);
      setPaymentReference('');
      setPaymentNotes('');
      fetchPayments();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : L('فشل في تسجيل الدفعة', 'Could not record payment');
      setRecordError(msg);
      toast(msg, 'error');
    } finally {
      setRecording(false);
    }
  };

  const printReceipt = (p: CustomerPaymentRow) => {
    const win = window.open('', '_blank', 'width=600,height=800');
    if (!win) return;
    const branchName = isAr ? p.branch?.name || '' : p.branch?.nameEn || p.branch?.name || '';
    const custName = p.customer?.name || '';
    const custPhone = p.customer?.phone || '';

    const allocRows = (p.allocations || [])
      .map(
        (a) => `
        <tr>
          <td>${a.invoiceNumber}</td>
          <td style="text-align:end; font-weight:bold;">${Number(a.amount).toFixed(2)} ${currencyLabel}</td>
        </tr>`
      )
      .join('');

    const html = `<!doctype html>
<html dir="${isAr ? 'rtl' : 'ltr'}" lang="${isAr ? 'ar' : 'en'}">
<head>
  <meta charset="utf-8">
  <title>${L('سند قبض رسمي', 'Official Payment Receipt')} - ${p.receiptNumber}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; padding: 40px; color: #1e293b; font-size: 13px; line-height: 1.5; }
    .header { text-align: center; border-bottom: 2px solid #e2e8f0; padding-bottom: 16px; margin-bottom: 20px; }
    .company { font-size: 20px; font-weight: 900; }
    .title { font-size: 16px; font-weight: bold; color: #059669; margin-top: 8px; }
    .receipt-no { font-family: monospace; font-size: 14px; font-weight: bold; color: #0284c7; }
    .info-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; margin-bottom: 20px; }
    .amount-box { text-align: center; background: #ecfdf5; border: 2px solid #059669; border-radius: 12px; padding: 16px; margin-bottom: 20px; }
    .amount-val { font-size: 24px; font-weight: 900; color: #065f46; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
    th { background: #f1f5f9; padding: 8px; text-align: start; font-size: 12px; }
    td { padding: 8px; border-bottom: 1px solid #e2e8f0; font-size: 12px; }
    .signatures { display: flex; justify-content: space-between; margin-top: 50px; padding: 0 40px; }
    .sig-line { border-top: 1px solid #94a3b8; width: 160px; text-align: center; padding-top: 8px; font-size: 11px; color: #64748b; }
    @media print { body { padding: 0; } }
  </style>
</head>
<body>
  <div class="header">
    <div class="company">SPORTS CHAMPIONS</div>
    <div>${branchName}</div>
    <div class="title">${L('سند استلام وقبض نقدية / دفعات', 'Official Payment Receipt')}</div>
    <div class="receipt-no">${p.receiptNumber}</div>
    <div style="font-size:11px; color:#64748b; margin-top:4px;">${new Date(p.paidAt).toLocaleString(isAr ? 'ar-EG' : 'en-US')}</div>
  </div>

  <div class="amount-box">
    <div style="font-size:12px; font-weight:bold; color:#065f46; margin-bottom:4px;">${L('المبلغ المستلم', 'Received Amount')}</div>
    <div class="amount-val">${Number(p.amount).toFixed(2)} ${currencyLabel}</div>
  </div>

  <div class="info-card">
    <div style="display:flex; justify-content:space-between; margin-bottom:8px;">
      <span style="color:#64748b;">${L('وصلنا من السيد / السادة', 'Received From')}:</span>
      <span style="font-weight:bold;">${custName}</span>
    </div>
    <div style="display:flex; justify-content:space-between; margin-bottom:8px;">
      <span style="color:#64748b;">${L('رقم الموبايل', 'Phone')}:</span>
      <span dir="ltr" style="font-family:monospace;">${custPhone}</span>
    </div>
    <div style="display:flex; justify-content:space-between; margin-bottom:8px;">
      <span style="color:#64748b;">${L('طريقة الدفع', 'Payment Method')}:</span>
      <span style="font-weight:bold;">${p.method}</span>
    </div>
    ${p.reference ? `
    <div style="display:flex; justify-content:space-between; margin-bottom:8px;">
      <span style="color:#64748b;">${L('رقم الإيصال / الشيك / الحوالة', 'Reference / Cheque')}:</span>
      <span style="font-family:monospace;">${p.reference}</span>
    </div>` : ''}
    ${p.notes ? `
    <div style="margin-top:8px; border-top:1px dashed #cbd5e1; padding-top:8px; color:#475569; font-size:12px;">
      ${p.notes}
    </div>` : ''}
  </div>

  ${allocRows ? `
  <div>
    <div style="font-weight:bold; font-size:12px; margin-bottom:6px;">${L('توزيع السداد على الفواتير', 'Settled Invoices')}</div>
    <table>
      <thead>
        <tr>
          <th>${L('رقم الفاتورة', 'Invoice No.')}</th>
          <th style="text-align:end;">${L('المبلغ المخصص', 'Allocated Amount')}</th>
        </tr>
      </thead>
      <tbody>
        ${allocRows}
      </tbody>
    </table>
  </div>` : ''}

  <div class="signatures">
    <div class="sig-line">${L('توقيع المحصل / أمين الخزينة', 'Cashier Signature')}</div>
    <div class="sig-line">${L('توقيع العميل / المستلم', 'Customer Signature')}</div>
  </div>

  <script>window.onload = () => window.print();</script>
</body>
</html>`;

    win.document.write(html);
    win.document.close();
  };

  return (
    <div className="space-y-4">
      {/* Top Filter and Actions Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-2.5" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={L('بحث بسند القبض أو العميل...', 'Search receipt or customer...')}
              className="pr-9 pl-4 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-slate-100 w-56 focus:outline-none focus:border-blue-500"
            />
          </div>

          {branches.length > 1 && (
            <select
              value={branchFilter}
              onChange={(e) => {
                setBranchFilter(e.target.value);
                setPage(1);
              }}
              className="py-2 px-3 rounded-xl bg-slate-900 border border-slate-700 text-xs text-slate-200 focus:outline-none"
            >
              <option value="">{L('جميع الفروع', 'All Branches')}</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {isAr ? b.name : b.nameEn}
                </option>
              ))}
            </select>
          )}
        </div>

        <Button
          onClick={() => {
            setShowNewModal(true);
          }}
          variant="primary"
        >
          <Plus className="w-4 h-4" />
          {L('تسجيل سند قبض جديد', 'Record Payment')}
        </Button>
      </div>

      {/* Receipts Table */}
      <div className="app-scrollbar app-scrollbar-horizontal overflow-x-auto">
        <table className="w-full min-w-[760px] text-xs text-start">
          <thead className="text-slate-400 bg-slate-950 border-b border-slate-800">
            <tr>
              <th className="p-3">{L('رقم السند', 'Receipt No.')}</th>
              <th className="p-3">{L('العميل', 'Customer')}</th>
              <th className="p-3">{L('الفرع', 'Branch')}</th>
              <th className="p-3">{L('المبلغ المستلم', 'Amount')}</th>
              <th className="p-3">{L('المخصص للفواتير', 'Allocated')}</th>
              <th className="p-3">{L('رصيد معلق', 'Credit')}</th>
              <th className="p-3">{L('طريقة الدفع', 'Method')}</th>
              <th className="p-3">{L('التاريخ', 'Date')}</th>
              <th className="p-3">{L('إجراءات', 'Actions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {payments.map((p) => (
              <tr key={p.id} className="hover:bg-slate-900/50 transition-colors">
                <td className="p-3 font-mono font-bold text-sky-400">{p.receiptNumber}</td>
                <td className="p-3 font-semibold text-slate-200">
                  {p.customer?.name || '—'}
                  {p.customer?.phone && (
                    <div className="text-[10px] text-slate-400 font-mono" dir="ltr">
                      {p.customer.phone}
                    </div>
                  )}
                </td>
                <td className="p-3 text-slate-300">
                  {isAr ? p.branch?.name : p.branch?.nameEn || p.branch?.name}
                </td>
                <td className="p-3 font-black text-emerald-400">
                  {Number(p.amount).toLocaleString()} {currencyLabel}
                </td>
                <td className="p-3 font-bold text-slate-300">
                  {Number(p.allocatedAmount).toLocaleString()} {currencyLabel}
                </td>
                <td className="p-3">
                  {Number(p.credit) > 0 ? (
                    <span className="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 font-bold border border-blue-500/30 text-[10px]">
                      {Number(p.credit).toLocaleString()} {currencyLabel}
                    </span>
                  ) : (
                    <span className="text-slate-500">—</span>
                  )}
                </td>
                <td className="p-3 font-bold text-slate-300">{p.method}</td>
                <td className="p-3 text-slate-400">
                  {new Date(p.paidAt).toLocaleDateString(isAr ? 'ar-EG' : 'en-US')}
                </td>
                <td className="p-3">
                  <button
                    onClick={() => printReceipt(p)}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                    title={L('طباعة السند', 'Print Receipt')}
                  >
                    <Printer className="w-3.5 h-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {payments.length === 0 && !loading && (
          <div className="text-center text-xs text-slate-500 py-12">
            {L('لا توجد سندات قبض مسجلة بعد', 'No payment receipts found')}
          </div>
        )}
      </div>

      {payments.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <span className="text-[11px] font-bold text-slate-400">
            {L(`إجمالي: ${total} سند قبض`, `Total: ${total} receipts`)}
          </span>
          <Pagination page={page} totalPages={pageCount} onPageChange={setPage} />
        </div>
      )}

      {/* Record Payment Modal */}
      {showNewModal && (
        <Modal
          title={L('تسجيل سند قبض دفعة مالية', 'Record Customer Payment')}
          onClose={() => setShowNewModal(false)}
        >
          <form onSubmit={handleRecordPayment} className="space-y-4 text-xs max-h-[80vh] overflow-y-auto pr-1">
            {recordError && (
              <div role="alert" className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 font-bold">
                {recordError}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-400 mb-1">
                  {L('العميل', 'Customer')}
                </label>
                <select
                  value={selectedCustomerId}
                  onChange={(e) => {
                    setSelectedCustomerId(e.target.value);
                    loadCustomerOpenInvoices(e.target.value);
                  }}
                  className={inputCls}
                >
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name || c.phone} ({c.phone})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-400 mb-1">
                  {L('الفرع المستلم', 'Receiving Branch')}
                </label>
                <select
                  value={selectedBranchId}
                  onChange={(e) => setSelectedBranchId(e.target.value)}
                  className={inputCls}
                >
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {isAr ? b.name : b.nameEn}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-400 mb-1">
                  {L('المبلغ المستلم بالجنيه *', 'Amount Received (EGP) *')}
                </label>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  required
                  value={paymentAmount || ''}
                  onChange={(e) => setPaymentAmount(Number(e.target.value) || 0)}
                  className={`${inputCls} text-base font-bold text-emerald-400`}
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-400 mb-1">
                  {L('طريقة الدفع', 'Payment Method')}
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className={inputCls}
                >
                  <option value="CASH">{L('نقدًا (كاش)', 'Cash')}</option>
                  <option value="CARD">{L('بطاقة بنكية / فيزا', 'Card / POS')}</option>
                  <option value="BANK_TRANSFER">{L('تحويل بنكي / إنستاباي', 'Bank Transfer / InstaPay')}</option>
                  <option value="CHEQUE">{L('شيك مصرفي', 'Cheque')}</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-400 mb-1">
                {L('رقم المرجع / الشيك / الحوالة (اختياري)', 'Reference / Cheque No.')}
              </label>
              <input
                type="text"
                placeholder={L('مثال: 94819283 أو رقم الشيك...', 'e.g. InstaPay ref or cheque no...')}
                value={paymentReference}
                onChange={(e) => setPaymentReference(e.target.value)}
                className={inputCls}
              />
            </div>

            {/* Invoices Allocation Section */}
            <div className="border-t border-slate-800 pt-3 space-y-2">
              <div className="flex justify-between items-center">
                <span className="font-extrabold text-slate-200">
                  {L('توزيع السداد على فواتير العميل المستحقة', 'Allocate Payment to Invoices')}
                </span>
                <span className="text-[11px] text-slate-400">
                  {openInvoices.length} {L('فاتورة مستحقة', 'open invoices')}
                </span>
              </div>

              {openInvoices.length > 0 ? (
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {openInvoices.map((inv) => {
                    const allocatedVal = allocations[inv.id] || 0;
                    return (
                      <div
                        key={inv.id}
                        className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 flex flex-wrap items-center justify-between gap-2"
                      >
                        <div>
                          <div className="font-mono font-bold text-sky-400">{inv.invoiceNumber}</div>
                          <div className="text-[10px] text-slate-400">
                            {L('المتبقي', 'Outstanding')}: <span className="text-amber-400 font-bold">{Number(inv.outstanding).toFixed(2)} {currencyLabel}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handlePayFullInvoice(inv)}
                            className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-bold"
                          >
                            {L('سداد كامل', 'Pay Full')}
                          </button>
                          <input
                            type="number"
                            min="0"
                            max={inv.outstanding}
                            step="0.01"
                            value={allocatedVal || ''}
                            onChange={(e) => handleAllocationChange(inv.id, Number(e.target.value) || 0)}
                            placeholder="0.00"
                            className="w-24 text-end px-2 py-1 rounded bg-slate-950 border border-slate-700 text-xs text-emerald-400 font-bold"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-3 rounded-xl bg-slate-900/50 border border-slate-800 text-center text-slate-400 text-[11px]">
                  {L('لا توجد فواتير معلقة لهذا العميل. سيتم حفظ المبلغ كرصيد دائن للعميل.', 'No open invoices. Amount will be credited to customer balance.')}
                </div>
              )}
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-400 mb-1">
                {L('ملاحظات', 'Notes')}
              </label>
              <textarea
                rows={2}
                value={paymentNotes}
                onChange={(e) => setPaymentNotes(e.target.value)}
                placeholder={L('أي تفاصيل إضافية عن السداد...', 'Any additional details...')}
                className={`${inputCls} resize-none`}
              />
            </div>

            <button
              type="submit"
              disabled={recording}
              className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white font-extrabold transition-all"
            >
              {recording ? L('جاري تسجيل السند...', 'Recording...') : L('تسجيل سند القبض', 'Save Receipt')}
            </button>
          </form>
        </Modal>
      )}
    </div>
  );
}
