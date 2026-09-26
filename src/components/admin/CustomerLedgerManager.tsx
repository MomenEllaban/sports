'use client';

import React, { useState, useMemo } from 'react';
import { useLocale } from 'next-intl';
import {
  DollarSign,
  TrendingDown,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  Search,
  MessageCircle,
  FileText,
  X,
  Calendar,
  Phone,
} from 'lucide-react';
import { Button } from '@/components/ui/foundation';

export interface CustomerLedgerEntry {
  id: string;
  name: string | null;
  phone: string;
  email: string | null;
  totalInvoiced: number;
  totalPaid: number;
  outstandingBalance: number;
  transactionsCount: number;
  lastActivityDate: string | null;
  unpaidInvoicesCount: number;
  invoices: Array<{
    id: string;
    number: string;
    date: string;
    total: number;
    paid: number;
    balance: number;
    status: string;
  }>;
}

export default function CustomerLedgerManager({
  customers,
}: {
  customers: CustomerLedgerEntry[];
}) {
  const locale = useLocale();
  const isAr = locale === 'ar';
  const L = (ar: string, en: string) => (isAr ? ar : en);
  const currencyLabel = L('ج.م', 'EGP');

  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'ALL' | 'DEBTORS' | 'SETTLED'>('ALL');
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerLedgerEntry | null>(null);

  const stats = useMemo(() => {
    let totalInvoiced = 0;
    let totalPaid = 0;
    let totalOutstanding = 0;
    let debtorsCount = 0;

    customers.forEach((c) => {
      totalInvoiced += c.totalInvoiced;
      totalPaid += c.totalPaid;
      if (c.outstandingBalance > 0) {
        totalOutstanding += c.outstandingBalance;
        debtorsCount++;
      }
    });

    return { totalInvoiced, totalPaid, totalOutstanding, debtorsCount };
  }, [customers]);

  const filtered = useMemo(() => {
    return customers.filter((c) => {
      const q = search.trim().toLowerCase();
      const matchesSearch =
        !q ||
        (c.name && c.name.toLowerCase().includes(q)) ||
        c.phone.includes(q) ||
        (c.email && c.email.toLowerCase().includes(q));

      if (!matchesSearch) return false;

      if (filter === 'DEBTORS') return c.outstandingBalance > 0;
      if (filter === 'SETTLED') return c.outstandingBalance <= 0;
      return true;
    });
  }, [customers, search, filter]);

  const handleWhatsAppReminder = (c: CustomerLedgerEntry) => {
    const cleanPhone = c.phone.replace(/[^0-9]/g, '');
    const phoneWithCode = cleanPhone.startsWith('0') ? '2' + cleanPhone : cleanPhone;
    const balance = c.outstandingBalance.toLocaleString();

    const msg = isAr
      ? `تحية طيبة ${c.name || 'عميلنا العزيز'}، نود تذكيركم بأن لديكم رصيد مستحق بقيمة ${balance} ${currencyLabel} طرف متجر سبورتس. يرجى التكرم بالسداد عبر Instapay أو الدفع في الفرع لتسوية حسابكم. شكراً لتعاملكم الراقي معنا.`
      : `Dear ${c.name || 'Customer'}, this is a friendly reminder regarding your outstanding balance of ${balance} ${currencyLabel} with Sports Store. Please arrange settlement via Instapay or branch cashier. Thank you.`;

    window.open(`https://wa.me/${phoneWithCode}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-panel p-5 rounded-2xl border border-slate-800 bg-slate-900/60">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-semibold">{L('إجمالي المبيعات والفواتير', 'Total Invoiced')}</span>
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black text-slate-100">{stats.totalInvoiced.toLocaleString()}</span>
            <span className="text-xs text-slate-400 ms-1">{currencyLabel}</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">{L('قيمة كل المبيعات الصادرة', 'Cumulative value of all sales')}</p>
        </div>

        <div className="glass-panel p-5 rounded-2xl border border-slate-800 bg-slate-900/60">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-semibold">{L('إجمالي المحصل والمقبوض', 'Total Collected')}</span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black text-emerald-400">{stats.totalPaid.toLocaleString()}</span>
            <span className="text-xs text-slate-400 ms-1">{currencyLabel}</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            {stats.totalInvoiced > 0
              ? `${((stats.totalPaid / stats.totalInvoiced) * 100).toFixed(1)}% ${L('نسبة التحصيل', 'collection rate')}`
              : '0%'}
          </p>
        </div>

        <div className="glass-panel p-5 rounded-2xl border border-slate-800 bg-slate-900/60">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-semibold">{L('الذمم المدينة المستحقة', 'Outstanding Receivables')}</span>
            <div className="p-2 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20">
              <TrendingDown className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black text-rose-400">{stats.totalOutstanding.toLocaleString()}</span>
            <span className="text-xs text-slate-400 ms-1">{currencyLabel}</span>
          </div>
          <p className="text-[11px] text-rose-400/80 mt-1">{L('مديونيات قيد التحصيل', 'Pending customer receivables')}</p>
        </div>

        <div className="glass-panel p-5 rounded-2xl border border-slate-800 bg-slate-900/60">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-semibold">{L('العملاء المدينون', 'Debtors Count')}</span>
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <AlertCircle className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black text-amber-400">{stats.debtorsCount}</span>
            <span className="text-xs text-slate-400 ms-2">{L('عميل مدين', 'customers')}</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">{L('يحتاجون متابعة تحصيل', 'Require collection follow-up')}</p>
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
            {L('كل العملاء', 'All Accounts')} ({customers.length})
          </button>
          <button
            onClick={() => setFilter('DEBTORS')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
              filter === 'DEBTORS'
                ? 'bg-rose-600 text-white shadow-lg shadow-rose-500/20'
                : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-rose-300'
            }`}
          >
            {L('مدينون بمستحقات', 'Has Debt')} ({stats.debtorsCount})
          </button>
          <button
            onClick={() => setFilter('SETTLED')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
              filter === 'SETTLED'
                ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/20'
                : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-emerald-300'
            }`}
          >
            {L('حسابات خالصة', 'Settled')} ({customers.length - stats.debtorsCount})
          </button>
        </div>

        <div className="relative min-w-[240px]">
          <Search className="w-4 h-4 text-slate-500 absolute start-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={L('بحث باسم العميل أو الهاتف...', 'Search name or phone...')}
            className="w-full bg-slate-900/80 border border-slate-700/80 rounded-xl ps-9 pe-3 py-1.5 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
          />
        </div>
      </div>

      {/* Ledger Table */}
      <div className="app-scrollbar app-scrollbar-horizontal overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900/40">
        <table className="w-full min-w-[800px] text-xs text-start">
          <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
            <tr>
              <th className="p-3.5 text-start">{L('العميل', 'Customer')}</th>
              <th className="p-3.5 text-center">{L('إجمالي الفواتير', 'Total Invoiced')}</th>
              <th className="p-3.5 text-center">{L('المسدد', 'Paid Amount')}</th>
              <th className="p-3.5 text-center">{L('الرصيد المستحق', 'Outstanding Balance')}</th>
              <th className="p-3.5 text-center">{L('حالة الحساب', 'Account Status')}</th>
              <th className="p-3.5 text-center">{L('آخر حركة', 'Last Activity')}</th>
              <th className="p-3.5 text-end">{L('الإجراءات', 'Actions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-slate-500">
                  {L('لا توجد سجلات مالية مطابقة', 'No customer financial ledger records found')}
                </td>
              </tr>
            ) : (
              filtered.map((c) => {
                const hasDebt = c.outstandingBalance > 0;

                return (
                  <tr key={c.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="p-3.5">
                      <div className="font-bold text-slate-100">{c.name || L('عميل بدون اسم', 'Unnamed Customer')}</div>
                      <div className="text-[11px] text-slate-400 font-mono mt-0.5" dir="ltr">
                        {c.phone}
                      </div>
                    </td>

                    <td className="p-3.5 text-center text-slate-200 font-semibold">
                      {c.totalInvoiced.toLocaleString()} {currencyLabel}
                    </td>

                    <td className="p-3.5 text-center text-emerald-400 font-semibold">
                      {c.totalPaid.toLocaleString()} {currencyLabel}
                    </td>

                    <td className="p-3.5 text-center">
                      <span className={`text-sm font-black ${hasDebt ? 'text-rose-400' : 'text-slate-400'}`}>
                        {c.outstandingBalance.toLocaleString()} {currencyLabel}
                      </span>
                    </td>

                    <td className="p-3.5 text-center">
                      {hasDebt ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-300 border border-rose-500/30">
                          <AlertCircle className="w-3 h-3" />
                          {L('مدين', 'Debtor')}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">
                          <CheckCircle2 className="w-3 h-3" />
                          {L('خالص', 'Settled')}
                        </span>
                      )}
                    </td>

                    <td className="p-3.5 text-center text-slate-400 text-[11px]">
                      {c.lastActivityDate ? new Date(c.lastActivityDate).toLocaleDateString(locale) : '—'}
                    </td>

                    <td className="p-3.5 text-end">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setSelectedCustomer(c)}
                          className="px-2.5 py-1 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-300 border border-blue-500/30 text-[11px] font-bold inline-flex items-center gap-1 transition-colors"
                        >
                          <FileText className="w-3 h-3" />
                          {L('كشف الحساب', 'Statement')}
                        </button>

                        {hasDebt && (
                          <button
                            onClick={() => handleWhatsAppReminder(c)}
                            className="p-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 transition-colors"
                            title={L('إرسال تذكير بالمطالبة عبر واتساب', 'Send reminder via WhatsApp')}
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Customer Statement Modal */}
      {selectedCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl relative">
            <button
              onClick={() => setSelectedCustomer(null)}
              className="absolute top-5 end-5 p-1 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="border-b border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-100 text-base">
                    {L('كشف حساب العميل التفصيلي', 'Customer Account Statement')}
                  </h3>
                  <div className="flex items-center gap-3 text-xs text-slate-400 mt-1">
                    <span className="font-semibold text-slate-200">{selectedCustomer.name || L('عميل', 'Customer')}</span>
                    <span className="flex items-center gap-1 font-mono" dir="ltr">
                      <Phone className="w-3 h-3 text-slate-500" />
                      {selectedCustomer.phone}
                    </span>
                  </div>
                </div>
              </div>

              {/* Statement Balance Bar */}
              <div className="grid grid-cols-3 gap-3 mt-4 p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-center">
                <div>
                  <div className="text-[10px] text-slate-500">{L('إجمالي المبيعات', 'Invoiced')}</div>
                  <div className="text-sm font-bold text-slate-200 mt-0.5">
                    {selectedCustomer.totalInvoiced.toLocaleString()} {currencyLabel}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-500">{L('المسدد', 'Paid')}</div>
                  <div className="text-sm font-bold text-emerald-400 mt-0.5">
                    {selectedCustomer.totalPaid.toLocaleString()} {currencyLabel}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-500">{L('الرصيد المتبقي', 'Due Balance')}</div>
                  <div
                    className={`text-sm font-black mt-0.5 ${
                      selectedCustomer.outstandingBalance > 0 ? 'text-rose-400' : 'text-slate-400'
                    }`}
                  >
                    {selectedCustomer.outstandingBalance.toLocaleString()} {currencyLabel}
                  </div>
                </div>
              </div>
            </div>

            {/* Invoices List */}
            <div className="flex-1 overflow-y-auto app-scrollbar py-4 space-y-3">
              <h4 className="text-xs font-bold text-slate-300">
                {L('الفواتير والمعاملات المسجلة', 'Registered Invoices & Orders')} ({selectedCustomer.invoices.length})
              </h4>

              {selectedCustomer.invoices.length === 0 ? (
                <div className="p-6 text-center text-slate-500 text-xs border border-dashed border-slate-800 rounded-xl">
                  {L('لا توجد فواتير مسجلة لهذا العميل حتى الآن', 'No invoices found for this customer')}
                </div>
              ) : (
                selectedCustomer.invoices.map((inv) => (
                  <div
                    key={inv.id}
                    className="p-3.5 rounded-xl bg-slate-950/50 border border-slate-800 flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="font-bold text-slate-200">{inv.number}</div>
                      <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                        <Calendar className="w-3 h-3" />
                        {new Date(inv.date).toLocaleDateString(locale)}
                      </div>
                    </div>

                    <div className="text-end">
                      <div className="font-bold text-slate-200">
                        {inv.total.toLocaleString()} {currencyLabel}
                      </div>
                      <div className="text-[11px] mt-0.5">
                        {inv.balance > 0 ? (
                          <span className="text-rose-400 font-semibold">
                            {L('متبقي:', 'Due:')} {inv.balance.toLocaleString()} {currencyLabel}
                          </span>
                        ) : (
                          <span className="text-emerald-400 font-semibold">{L('مسددة بالكامل', 'Fully Paid')}</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="flex items-center justify-between border-t border-slate-800 pt-4">
              {selectedCustomer.outstandingBalance > 0 ? (
                <Button
                  onClick={() => handleWhatsAppReminder(selectedCustomer)}
                  variant="primary"
                  className="bg-emerald-600 hover:bg-emerald-500 text-white"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  {L('إرسال مطالبة بالسداد عبر واتساب', 'Send Settlement Reminder via WhatsApp')}
                </Button>
              ) : (
                <div />
              )}
              <Button variant="secondary" onClick={() => setSelectedCustomer(null)}>
                {L('إغلاق', 'Close')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
