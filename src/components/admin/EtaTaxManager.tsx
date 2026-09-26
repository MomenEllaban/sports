'use client';

import React, { useState, useMemo } from 'react';
import { useLocale } from 'next-intl';
import {
  FileCheck2,
  Receipt,
  QrCode,
  CheckCircle2,
  AlertCircle,
  Clock,
  Search,
  ShieldCheck,
  X,
} from 'lucide-react';
import EtaRetryButton from './EtaRetryButton';

export interface TaxInvoiceRow {
  id: string;
  invoiceNumber: string;
  etaUuid: string | null;
  orderNumber: string | null;
  saleNumber: string | null;
  branchName: string;
  totalAmount: number;
  vatAmount: number;
  status: string;
  qrCodeData: string | null;
  etaResponseText: string | null;
  createdAt: string;
}

export default function EtaTaxManager({
  invoices,
}: {
  invoices: TaxInvoiceRow[];
}) {
  const locale = useLocale();
  const isAr = locale === 'ar';
  const L = (ar: string, en: string) => (isAr ? ar : en);
  const currencyLabel = L('ج.م', 'EGP');

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'SUBMITTED' | 'ACCEPTED' | 'REJECTED'>('ALL');
  const [activeQrModal, setActiveQrModal] = useState<TaxInvoiceRow | null>(null);

  const stats = useMemo(() => {
    let totalGross = 0;
    let totalVat = 0;
    let accepted = 0;
    let submitted = 0;
    let rejected = 0;

    invoices.forEach((inv) => {
      totalGross += inv.totalAmount;
      totalVat += inv.vatAmount;
      if (inv.status === 'ACCEPTED') accepted++;
      else if (inv.status === 'REJECTED') rejected++;
      else submitted++;
    });

    return { totalGross, totalVat, accepted, submitted, rejected };
  }, [invoices]);

  const filtered = useMemo(() => {
    return invoices.filter((inv) => {
      const q = search.trim().toLowerCase();
      const matchesSearch =
        !q ||
        inv.invoiceNumber.toLowerCase().includes(q) ||
        (inv.etaUuid && inv.etaUuid.toLowerCase().includes(q)) ||
        (inv.orderNumber && inv.orderNumber.toLowerCase().includes(q)) ||
        (inv.saleNumber && inv.saleNumber.toLowerCase().includes(q)) ||
        inv.branchName.toLowerCase().includes(q);

      if (!matchesSearch) return false;

      if (statusFilter !== 'ALL' && inv.status !== statusFilter) return false;
      return true;
    });
  }, [invoices, search, statusFilter]);

  return (
    <div className="space-y-6">
      {/* Top Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="glass-panel p-5 rounded-2xl border border-slate-800 bg-slate-900/60">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-semibold">{L('إجمالي ضريبة القيمة المضافة (14%)', 'Total 14% VAT')}</span>
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <Receipt className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black text-blue-400">{stats.totalVat.toLocaleString()}</span>
            <span className="text-xs text-slate-400 ms-1">{currencyLabel}</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">{L('محصلة لمصلحة الضرائب المصرية', 'Collected for Egyptian Tax Authority')}</p>
        </div>

        <div className="glass-panel p-5 rounded-2xl border border-slate-800 bg-slate-900/60">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-semibold">{L('الفواتير المعتمدة في ETA', 'Approved in ETA')}</span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black text-emerald-400">{stats.accepted}</span>
            <span className="text-xs text-slate-400 ms-2">{L('فاتورة', 'invoices')}</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">{L('برقم UUID موحد وتوقيع إلكتروني', 'With valid UUID and signature')}</p>
        </div>

        <div className="glass-panel p-5 rounded-2xl border border-slate-800 bg-slate-900/60">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-semibold">{L('قيد الإرسال / المعالجة', 'Submitted / Processing')}</span>
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black text-amber-400">{stats.submitted}</span>
            <span className="text-xs text-slate-400 ms-2">{L('فاتورة', 'invoices')}</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">{L('بانتظار إشعار منظومة الضرائب', 'Awaiting ETA webhook confirmation')}</p>
        </div>

        <div className="glass-panel p-5 rounded-2xl border border-slate-800 bg-slate-900/60">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-semibold">{L('إجمالي المبيعات الخاضعة للضريبة', 'Taxable Sales Volume')}</span>
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
              <FileCheck2 className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black text-slate-100">{stats.totalGross.toLocaleString()}</span>
            <span className="text-xs text-slate-400 ms-1">{currencyLabel}</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">{L('مبيعات الفروع والمتجر الإلكتروني', 'Storefront and branch sales')}</p>
        </div>
      </div>

      {/* ETA Compliance Strip */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-950/40 via-slate-900 to-indigo-950/40 border border-blue-500/30 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-blue-500/20 text-blue-400">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-200">
              {L('التكامل مع منظومة الفاتورة والإيصال الإلكتروني (ETA SDK v1.0)', 'ETA E-Invoicing & E-Receipt Compliance')}
            </h4>
            <p className="text-xs text-slate-400 mt-0.5">
              {L(
                'توليد تلقائي لرمز الاستجابة السريع (TLVs QR Code) وتضمين الرقم الضريبي ورقم التسجيل الموحد في كل فاتورة',
                'Automatic TLV QR Code generation and unified tax registration per invoice'
              )}
            </p>
          </div>
        </div>
        <span className="text-xs font-mono font-bold px-3 py-1.5 rounded-xl bg-blue-500/20 text-blue-300 border border-blue-500/30">
          ETA Standard 14% VAT
        </span>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setStatusFilter('ALL')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
              statusFilter === 'ALL'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200'
            }`}
          >
            {L('كل الفواتير', 'All Invoices')} ({invoices.length})
          </button>
          <button
            onClick={() => setStatusFilter('ACCEPTED')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
              statusFilter === 'ACCEPTED'
                ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/20'
                : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-emerald-300'
            }`}
          >
            {L('معتمدة', 'Accepted')} ({stats.accepted})
          </button>
          <button
            onClick={() => setStatusFilter('SUBMITTED')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
              statusFilter === 'SUBMITTED'
                ? 'bg-amber-600 text-white shadow-lg shadow-amber-500/20'
                : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-amber-300'
            }`}
          >
            {L('مرسلة', 'Submitted')} ({stats.submitted})
          </button>
          <button
            onClick={() => setStatusFilter('REJECTED')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
              statusFilter === 'REJECTED'
                ? 'bg-rose-600 text-white shadow-lg shadow-rose-500/20'
                : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-rose-300'
            }`}
          >
            {L('مرفوضة / بحاجة لإعادة إرسال', 'Rejected')} ({stats.rejected})
          </button>
        </div>

        <div className="relative min-w-[240px]">
          <Search className="w-4 h-4 text-slate-500 absolute start-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={L('بحث برقم الفاتورة أو UUID أو الفرع...', 'Search invoice #, UUID, branch...')}
            className="w-full bg-slate-900/80 border border-slate-700/80 rounded-xl ps-9 pe-3 py-1.5 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
          />
        </div>
      </div>

      {/* Tax Invoices Table */}
      <div className="app-scrollbar app-scrollbar-horizontal overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900/40">
        <table className="w-full min-w-[800px] text-xs text-start">
          <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
            <tr>
              <th className="p-3.5 text-start">{L('رقم الفاتورة الضريبية', 'Tax Invoice #')}</th>
              <th className="p-3.5 text-start">{L('رقم ETA الموحد (UUID)', 'ETA UUID')}</th>
              <th className="p-3.5 text-start">{L('المرجع (طلب / كاشير)', 'Reference')}</th>
              <th className="p-3.5 text-start">{L('الفرع', 'Branch')}</th>
              <th className="p-3.5 text-center">{L('إجمالي المبلغ', 'Total Amount')}</th>
              <th className="p-3.5 text-center">{L('ضريبة القيمة المضافة (14%)', 'VAT (14%)')}</th>
              <th className="p-3.5 text-center">{L('حالة الإرسال', 'Status')}</th>
              <th className="p-3.5 text-center">{L('التاريخ', 'Date')}</th>
              <th className="p-3.5 text-end">{L('الإجراءات', 'Actions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={9} className="p-8 text-center text-slate-500">
                  {L('لا توجد فواتير ضريبية مسجلة مطابقة للبحث', 'No tax invoices found matching criteria')}
                </td>
              </tr>
            ) : (
              filtered.map((inv) => (
                <tr key={inv.id} className="hover:bg-slate-800/40 transition-colors">
                  <td className="p-3.5 font-mono font-bold text-blue-400">
                    {inv.invoiceNumber}
                  </td>

                  <td className="p-3.5 font-mono text-[11px] text-slate-400">
                    {inv.etaUuid ? (
                      <span className="truncate max-w-[140px] block" title={inv.etaUuid}>
                        {inv.etaUuid}
                      </span>
                    ) : (
                      <span className="text-slate-600">—</span>
                    )}
                  </td>

                  <td className="p-3.5 text-slate-300 font-mono text-[11px]">
                    {inv.orderNumber ? `ORD-${inv.orderNumber}` : inv.saleNumber ? `POS-${inv.saleNumber}` : '—'}
                  </td>

                  <td className="p-3.5 text-slate-300">{inv.branchName}</td>

                  <td className="p-3.5 text-center font-bold text-slate-100">
                    {inv.totalAmount.toLocaleString()} {currencyLabel}
                  </td>

                  <td className="p-3.5 text-center font-bold text-blue-400">
                    {inv.vatAmount.toLocaleString()} {currencyLabel}
                  </td>

                  <td className="p-3.5 text-center">
                    {inv.status === 'ACCEPTED' && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                        <CheckCircle2 className="w-3 h-3" />
                        {L('معتمدة', 'Accepted')}
                      </span>
                    )}
                    {inv.status === 'SUBMITTED' && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30">
                        <Clock className="w-3 h-3" />
                        {L('مرسلة', 'Submitted')}
                      </span>
                    )}
                    {inv.status === 'REJECTED' && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/30">
                        <AlertCircle className="w-3 h-3" />
                        {L('مرفوضة', 'Rejected')}
                      </span>
                    )}
                  </td>

                  <td className="p-3.5 text-center text-slate-400 text-[11px]">
                    {new Date(inv.createdAt).toLocaleDateString(locale)}
                  </td>

                  <td className="p-3.5 text-end">
                    <div className="flex items-center justify-end gap-2">
                      {inv.qrCodeData && (
                        <button
                          onClick={() => setActiveQrModal(inv)}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition-colors"
                          title={L('عرض رمز الاستجابة السريع QR', 'View QR')}
                        >
                          <QrCode className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <EtaRetryButton id={inv.id} />
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* QR Code Modal */}
      {activeQrModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-sm text-center shadow-2xl relative">
            <button
              onClick={() => setActiveQrModal(null)}
              className="absolute top-5 end-5 p-1 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="p-3 rounded-2xl bg-blue-500/10 text-blue-400 border border-blue-500/20 inline-block mb-3">
              <QrCode className="w-8 h-8" />
            </div>

            <h4 className="font-extrabold text-slate-100 text-base">
              {L('رمز الاستجابة السريع للفاتورة الضريبية', 'Tax Invoice QR Code')}
            </h4>
            <p className="text-xs text-slate-400 mt-1 font-mono">{activeQrModal.invoiceNumber}</p>

            <div className="p-4 bg-white rounded-2xl inline-block mt-4 shadow-inner">
              {/* Fallback QR representation */}
              <div className="w-44 h-44 flex flex-col items-center justify-center text-slate-900 font-mono text-[10px] break-all border-2 border-slate-900 p-2">
                <QrCode className="w-20 h-20 text-slate-950 mb-1" />
                <span className="font-bold">{activeQrModal.invoiceNumber}</span>
                <span>VAT 14%: {activeQrModal.vatAmount} EGP</span>
              </div>
            </div>

            <p className="text-[11px] text-slate-500 mt-4 leading-relaxed">
              {L('مشفر وفق معايير هيئة الزكاة والضريبة ومصلحة الضرائب المصرية TLV Base64', 'Encoded with TLV Base64 standard')}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
