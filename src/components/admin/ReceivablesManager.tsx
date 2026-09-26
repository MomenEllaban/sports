'use client';

import React, { useState, useEffect } from 'react';
import { useLocale } from 'next-intl';
import { useRouter } from '@/i18n/routing';
import {
  Users,
  Search,
  AlertCircle,
  Eye,
  CreditCard,
  TrendingDown,
  DollarSign,
  Clock,
  ArrowRight,
} from 'lucide-react';
import { Modal, apiFetch } from './ui';
import { useToast } from '@/components/Toast';
import { inputCls, Button } from '@/components/ui/foundation';

interface BranchOpt {
  id: string;
  name: string;
  nameEn: string;
}

interface DebtorRow {
  customerId: string;
  customerName: string;
  customerPhone: string;
  invoiced: number;
  paid: number;
  outstanding: number;
  openInvoiceCount: number;
  overdueCount: number;
}

interface SummaryData {
  customers: number;
  invoiced: number;
  paid: number;
  outstanding: number;
}

interface OpenInvoice {
  id: string;
  invoiceNumber: string;
  total: number;
  paidAmount: number;
  outstanding: number;
  dueDate: string | null;
  overdue: boolean;
}

export default function ReceivablesManager({ branches }: { branches: BranchOpt[] }) {
  const locale = useLocale();
  const router = useRouter();
  const { toast } = useToast();
  const isAr = locale === 'ar';
  const L = (ar: string, en: string) => (isAr ? ar : en);
  const currencyLabel = L('ج.م', 'EGP');

  const [debtors, setDebtors] = useState<DebtorRow[]>([]);
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [branchFilter, setBranchFilter] = useState('');

  // Drill-down modal for selected customer
  const [selectedCustomer, setSelectedCustomer] = useState<DebtorRow | null>(null);
  const [openInvoices, setOpenInvoices] = useState<OpenInvoice[]>([]);
  const [loadingInvoices, setLoadingInvoices] = useState(false);

  const fetchReceivables = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('q', search);
      if (branchFilter) params.set('branchId', branchFilter);

      const res = (await apiFetch(`/api/admin/receivables?${params.toString()}`, 'GET')) as {
        success?: boolean;
        rows?: DebtorRow[];
        summary?: SummaryData;
      };
      if (res.rows) {
        setDebtors(res.rows);
        setSummary(res.summary || null);
      }
    } catch {
      toast(L('فشل تحميل تقرير الذمم المدينة', 'Failed to load receivables'), 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReceivables();
  }, [branchFilter]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchReceivables();
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const openCustomerDrilldown = async (customer: DebtorRow) => {
    setSelectedCustomer(customer);
    setLoadingInvoices(true);
    try {
      const res = (await apiFetch(`/api/admin/receivables?customerId=${customer.customerId}`, 'GET')) as {
        openInvoices?: OpenInvoice[];
      };
      setOpenInvoices(res.openInvoices || []);
    } catch {
      toast(L('تعذر تحميل فواتير العميل', 'Failed to load customer invoices'), 'error');
    } finally {
      setLoadingInvoices(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Overview Metric Cards */}
      {summary && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="glass-panel p-4 rounded-2xl border border-slate-800 space-y-1">
            <div className="text-xs text-slate-400">{L('العملاء المدينون', 'Debtor Customers')}</div>
            <div className="text-2xl font-black text-slate-100 flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-400" />
              {summary.customers}
            </div>
            <div className="text-[10px] text-slate-500">{L('عملاء عليهم فواتير غير مسددة', 'Customers with unpaid invoices')}</div>
          </div>

          <div className="glass-panel p-4 rounded-2xl border border-slate-800 space-y-1">
            <div className="text-xs text-slate-400">{L('إجمالي المبيعات الآجلة', 'Total Invoiced')}</div>
            <div className="text-2xl font-black text-slate-100">
              {Number(summary.invoiced).toLocaleString()} {currencyLabel}
            </div>
            <div className="text-[10px] text-slate-500">{L('قيمة الفواتير المصدرة', 'Issued invoices total')}</div>
          </div>

          <div className="glass-panel p-4 rounded-2xl border border-slate-800 space-y-1">
            <div className="text-xs text-slate-400">{L('المبالغ المحصلة', 'Collected Amount')}</div>
            <div className="text-2xl font-black text-emerald-400">
              {Number(summary.paid).toLocaleString()} {currencyLabel}
            </div>
            <div className="text-[10px] text-emerald-500/80">{L('تم تحصيله وتوريده للخزينة', 'Collected into treasury')}</div>
          </div>

          <div className="glass-panel p-4 rounded-2xl border border-slate-800 space-y-1">
            <div className="text-xs text-slate-400">{L('صافي الذمم المستحقة', 'Outstanding Debt')}</div>
            <div className="text-2xl font-black text-amber-400">
              {Number(summary.outstanding).toLocaleString()} {currencyLabel}
            </div>
            <div className="text-[10px] text-amber-500/80">{L('مبالغ معلقة بحاجة للمتابعة', 'Pending collection')}</div>
          </div>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-2.5" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={L('بحث باسم العميل أو رقم الموبايل...', 'Search by customer name or phone...')}
              className="pr-9 pl-4 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-slate-100 w-64 focus:outline-none focus:border-blue-500"
            />
          </div>

          {branches.length > 1 && (
            <select
              value={branchFilter}
              onChange={(e) => setBranchFilter(e.target.value)}
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
          onClick={() => router.push('/admin/sales/payments')}
          variant="primary"
        >
          <CreditCard className="w-4 h-4" />
          {L('تسجيل تحصيل دفعة', 'Record Payment')}
        </Button>
      </div>

      {/* Debtors Table */}
      <div className="app-scrollbar app-scrollbar-horizontal overflow-x-auto">
        <table className="w-full min-w-[760px] text-xs text-start">
          <thead className="text-slate-400 bg-slate-950 border-b border-slate-800">
            <tr>
              <th className="p-3">{L('العميل', 'Customer')}</th>
              <th className="p-3">{L('رقم الموبايل', 'Phone')}</th>
              <th className="p-3">{L('إجمالي المفوتر', 'Invoiced')}</th>
              <th className="p-3">{L('المسدد', 'Paid')}</th>
              <th className="p-3">{L('المتبقي المستحق', 'Outstanding')}</th>
              <th className="p-3">{L('الفواتير المعلقة', 'Open Invoices')}</th>
              <th className="p-3">{L('حالة السداد', 'Status')}</th>
              <th className="p-3">{L('إجراءات', 'Actions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {debtors.map((row) => (
              <tr key={row.customerId} className="hover:bg-slate-900/50 transition-colors">
                <td className="p-3 font-bold text-slate-100">{row.customerName}</td>
                <td className="p-3 font-mono text-slate-400" dir="ltr">{row.customerPhone}</td>
                <td className="p-3 font-semibold text-slate-300">
                  {Number(row.invoiced).toLocaleString()} {currencyLabel}
                </td>
                <td className="p-3 font-bold text-emerald-400">
                  {Number(row.paid).toLocaleString()} {currencyLabel}
                </td>
                <td className="p-3 font-black text-amber-400">
                  {Number(row.outstanding).toLocaleString()} {currencyLabel}
                </td>
                <td className="p-3 font-bold text-slate-200">
                  {row.openInvoiceCount} {L('فاتورة', 'inv.')}
                </td>
                <td className="p-3">
                  {row.overdueCount > 0 ? (
                    <span className="px-2.5 py-1 rounded-full bg-rose-500/15 border border-rose-500/40 text-rose-300 text-[10px] font-bold flex items-center gap-1 w-fit">
                      <AlertCircle className="w-3 h-3" />
                      {row.overdueCount} {L('متأخرة', 'overdue')}
                    </span>
                  ) : (
                    <span className="px-2.5 py-1 rounded-full bg-blue-500/15 border border-blue-500/40 text-blue-300 text-[10px] font-bold w-fit">
                      {L('في موعدها', 'Within terms')}
                    </span>
                  )}
                </td>
                <td className="p-3">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => openCustomerDrilldown(row)}
                      className="p-1.5 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 transition-colors"
                      title={L('عرض كشف الحساب والفواتير', 'View Statement & Invoices')}
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => router.push(`/admin/sales/payments?customerId=${row.customerId}`)}
                      className="p-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 transition-colors"
                      title={L('تحصيل دفعة مالية', 'Record Payment')}
                    >
                      <CreditCard className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {debtors.length === 0 && !loading && (
          <div className="text-center text-xs text-slate-500 py-12">
            {L('لا توجد مديونيات معلقة للعملاء', 'No outstanding customer balances found')}
          </div>
        )}
      </div>

      {/* Customer Drilldown Modal */}
      {selectedCustomer && (
        <Modal
          title={`${L('فواتير ومديونية العميل', 'Customer Receivables')} — ${selectedCustomer.customerName}`}
          onClose={() => setSelectedCustomer(null)}
        >
          <div className="space-y-4 text-xs max-h-[80vh] overflow-y-auto pr-1">
            <div className="grid grid-cols-2 gap-3 p-3 bg-slate-900 rounded-xl border border-slate-800">
              <div>
                <span className="text-slate-400">{L('رقم الموبايل', 'Phone')}: </span>
                <span className="font-mono font-bold text-slate-200" dir="ltr">{selectedCustomer.customerPhone}</span>
              </div>
              <div className="text-end">
                <span className="text-slate-400">{L('إجمالي المديونية', 'Total Due')}: </span>
                <span className="font-black text-amber-400 text-sm">{Number(selectedCustomer.outstanding).toLocaleString()} {currencyLabel}</span>
              </div>
            </div>

            <div>
              <div className="font-bold text-slate-200 mb-2">
                {L('الفواتير المفتوحة المستحقة', 'Open Invoices')}
              </div>

              {loadingInvoices ? (
                <div className="py-6 text-center text-slate-500">{L('جاري التحميل...', 'Loading...')}</div>
              ) : openInvoices.length > 0 ? (
                <div className="space-y-2">
                  {openInvoices.map((inv) => (
                    <div
                      key={inv.id}
                      className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 flex flex-wrap items-center justify-between gap-2"
                    >
                      <div>
                        <div className="font-mono font-bold text-sky-400 flex items-center gap-2">
                          {inv.invoiceNumber}
                          {inv.overdue && (
                            <span className="text-[10px] text-rose-400 font-bold bg-rose-500/10 px-1.5 py-0.5 rounded border border-rose-500/30">
                              {L('متأخرة', 'Overdue')}
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-400 mt-1">
                          {L('تاريخ الاستحقاق', 'Due Date')}: {inv.dueDate ? new Date(inv.dueDate).toLocaleDateString(isAr ? 'ar-EG' : 'en-US') : '—'}
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="text-end">
                          <div className="text-[10px] text-slate-500">{L('المتبقي', 'Outstanding')}</div>
                          <div className="font-black text-amber-400">{Number(inv.outstanding).toFixed(2)} {currencyLabel}</div>
                        </div>

                        <button
                          onClick={() => {
                            router.push(`/admin/sales/payments?customerId=${selectedCustomer.customerId}&invoiceId=${inv.id}`);
                          }}
                          className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1"
                        >
                          <CreditCard className="w-3 h-3" />
                          {L('تحصيل', 'Collect')}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-6 text-center text-slate-500">
                  {L('لا توجد فواتير معلقة', 'No open invoices')}
                </div>
              )}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
