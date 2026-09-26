'use client';

import React, { useState, useEffect } from 'react';
import { useLocale } from 'next-intl';
import { useRouter } from '@/i18n/routing';
import {
  FileText,
  Plus,
  Search,
  Eye,
  CheckCircle,
  XCircle,
  Printer,
  Trash2,
  DollarSign,
  AlertCircle,
  CreditCard,
} from 'lucide-react';
import { Modal, StatusBadge, apiFetch } from './ui';
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

interface ProductOpt {
  id: string;
  nameAr: string;
  nameEn: string;
  sku: string;
  price: number;
}

interface InvoiceLine {
  id: string;
  productId: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  product?: {
    id: string;
    sku: string;
    nameAr: string;
    nameEn: string;
  };
}

interface Allocation {
  id: string;
  amount: number;
  createdAt: string;
  payment: {
    id: string;
    receiptNumber: string;
    paidAt: string;
    method: string;
  };
}

interface InvoiceRow {
  id: string;
  invoiceNumber: string;
  customerId: string;
  branchId: string;
  subtotal: number;
  discount: number;
  vat: number;
  total: number;
  paidAmount: number;
  outstanding: number;
  status: string;
  overdue: boolean;
  dueDate: string | null;
  issuedAt: string | null;
  createdAt: string;
  lineCount: number;
  hasPayments: boolean;
  branch?: { id: string; name: string; nameEn: string };
  customer?: { id: string; name: string | null; phone: string };
  lines?: InvoiceLine[];
  allocations?: Allocation[];
  availableActions?: string[];
  notes?: string | null;
}

interface SummaryData {
  invoiced: number;
  paid: number;
  outstanding: number;
}

export default function InvoicesManager({
  customers,
  branches,
  products,
}: {
  customers: CustomerOpt[];
  branches: BranchOpt[];
  products: ProductOpt[];
}) {
  const locale = useLocale();
  const router = useRouter();
  const { toast } = useToast();
  const isAr = locale === 'ar';
  const L = (ar: string, en: string) => (isAr ? ar : en);
  const currencyLabel = L('ج.م', 'EGP');

  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [branchFilter, setBranchFilter] = useState('');
  const [page, setPage] = useState(1);
  const [pageCount, setPageCount] = useState(1);
  const [total, setTotal] = useState(0);

  // New Invoice Modal
  const [showNewModal, setShowNewModal] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState(customers[0]?.id || '');
  const [selectedBranchId, setSelectedBranchId] = useState(branches[0]?.id || '');
  const [invoiceDiscount, setInvoiceDiscount] = useState(0);
  const [invoiceDueDate, setInvoiceDueDate] = useState('');
  const [invoiceNotes, setInvoiceNotes] = useState('');
  const [lines, setLines] = useState<Array<{ productId: string; quantity: number; unitPrice: number }>>([]);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  // View / Detail Modal
  const [activeInvoice, setActiveInvoice] = useState<InvoiceRow | null>(null);
  const [actionBusy, setActionBusy] = useState(false);

  const fetchInvoices = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: '10',
      });
      if (search) params.set('q', search);
      if (statusFilter) params.set('status', statusFilter);
      if (branchFilter) params.set('branchId', branchFilter);

      const res = (await apiFetch(`/api/admin/invoices?${params.toString()}`, 'GET')) as {
        success?: boolean;
        rows?: InvoiceRow[];
        summary?: SummaryData;
        total?: number;
        pageCount?: number;
      };
      if (res.rows) {
        setInvoices(res.rows);
        setSummary(res.summary || null);
        setTotal(res.total || 0);
        setPageCount(res.pageCount || 1);
      }
    } catch {
      toast(L('فشل تحميل الفواتير', 'Failed to load invoices'), 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvoices();
  }, [page, statusFilter, branchFilter]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1);
      fetchInvoices();
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const openInvoiceDetail = async (id: string) => {
    try {
      const res = (await apiFetch(`/api/admin/invoices/${id}`, 'GET')) as {
        success?: boolean;
        invoice?: InvoiceRow;
      };
      if (res.invoice) {
        setActiveInvoice(res.invoice);
      }
    } catch {
      toast(L('تعذر تحميل تفاصيل الفاتورة', 'Failed to load invoice details'), 'error');
    }
  };

  const handleApplyAction = async (action: 'issue' | 'void') => {
    if (!activeInvoice) return;
    setActionBusy(true);
    try {
      await apiFetch(`/api/admin/invoices/${activeInvoice.id}`, 'POST', { action });
      toast(
        action === 'issue'
          ? L('تم إصدار الفاتورة رسميًا وتثبيت الذمة المالية', 'Invoice issued successfully')
          : L('تم إلغاء/إبطال الفاتورة', 'Invoice voided successfully'),
        'success'
      );
      setActiveInvoice(null);
      fetchInvoices();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : L('فشل الإجراء', 'Action failed');
      toast(msg, 'error');
    } finally {
      setActionBusy(false);
    }
  };

  const addLine = () => {
    const firstProd = products[0];
    if (!firstProd) return;
    setLines([...lines, { productId: firstProd.id, quantity: 1, unitPrice: Number(firstProd.price) || 0 }]);
  };

  const removeLine = (idx: number) => {
    setLines(lines.filter((_, i) => i !== idx));
  };

  const updateLineProduct = (idx: number, prodId: string) => {
    const prod = products.find((p) => p.id === prodId);
    const updated = [...lines];
    updated[idx] = {
      ...updated[idx],
      productId: prodId,
      unitPrice: prod ? Number(prod.price) || 0 : updated[idx].unitPrice,
    };
    setLines(updated);
  };

  const updateLineQuantity = (idx: number, qty: number) => {
    const updated = [...lines];
    updated[idx] = { ...updated[idx], quantity: Math.max(1, qty) };
    setLines(updated);
  };

  const updateLinePrice = (idx: number, price: number) => {
    const updated = [...lines];
    updated[idx] = { ...updated[idx], unitPrice: Math.max(0, price) };
    setLines(updated);
  };

  // Calculations for new invoice
  const linesSubtotal = lines.reduce((acc, l) => acc + l.quantity * l.unitPrice, 0);
  const calculatedDiscount = Math.min(linesSubtotal, invoiceDiscount);
  const netSubtotal = linesSubtotal - calculatedDiscount;
  const calculatedVat = Math.round(netSubtotal * 0.14 * 100) / 100;
  const grandTotal = Math.round((netSubtotal + calculatedVat) * 100) / 100;

  const handleCreateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (lines.length === 0) {
      setCreateError(L('يرجى إضافة صنف واحد على الأقل', 'Please add at least one line item'));
      return;
    }
    setCreating(true);
    setCreateError('');
    try {
      await apiFetch('/api/admin/invoices', 'POST', {
        customerId: selectedCustomerId,
        branchId: selectedBranchId,
        discount: invoiceDiscount,
        dueDate: invoiceDueDate || undefined,
        notes: invoiceNotes || undefined,
        items: lines.map((l) => ({
          productId: l.productId,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
        })),
      });

      toast(L('تم إنشاء مسودة الفاتورة بنجاح', 'Invoice draft created successfully'), 'success');
      setShowNewModal(false);
      setLines([]);
      setInvoiceDiscount(0);
      setInvoiceNotes('');
      fetchInvoices();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : L('فشل في إنشاء الفاتورة', 'Could not create invoice');
      setCreateError(msg);
      toast(msg, 'error');
    } finally {
      setCreating(false);
    }
  };

  const printInvoice = (inv: InvoiceRow) => {
    const win = window.open('', '_blank', 'width=800,height=900');
    if (!win) return;
    const branchName = isAr ? inv.branch?.name || '' : inv.branch?.nameEn || inv.branch?.name || '';
    const custName = inv.customer?.name || '';
    const custPhone = inv.customer?.phone || '';

    const itemsRows = (inv.lines || [])
      .map(
        (line, idx) => `
        <tr>
          <td>${idx + 1}</td>
          <td>${isAr ? line.product?.nameAr || line.product?.nameEn : line.product?.nameEn || line.product?.nameAr}<br><small style="color:#666">${line.product?.sku || ''}</small></td>
          <td>${line.quantity}</td>
          <td>${Number(line.unitPrice).toFixed(2)}</td>
          <td>${Number(line.lineTotal).toFixed(2)}</td>
        </tr>`
      )
      .join('');

    const html = `<!doctype html>
<html dir="${isAr ? 'rtl' : 'ltr'}" lang="${isAr ? 'ar' : 'en'}">
<head>
  <meta charset="utf-8">
  <title>${L('فاتورة ضريبية', 'Tax Invoice')} - ${inv.invoiceNumber}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; padding: 40px; color: #1e293b; font-size: 13px; line-height: 1.5; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #e2e8f0; padding-bottom: 20px; margin-bottom: 24px; }
    .company { font-size: 20px; font-weight: 900; color: #0f172a; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 24px; background: #f8fafc; padding: 16px; border-radius: 12px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
    th { background: #f1f5f9; padding: 10px; text-align: start; font-weight: 700; border-bottom: 1px solid #cbd5e1; font-size: 12px; }
    td { padding: 10px; border-bottom: 1px solid #e2e8f0; }
    .totals { width: 320px; margin-${isAr ? 'right' : 'left'}: auto; background: #f8fafc; padding: 16px; border-radius: 12px; }
    .totals-row { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 13px; }
    .grand-total { font-size: 16px; font-weight: 900; color: #0f172a; border-top: 2px solid #cbd5e1; padding-top: 8px; margin-top: 8px; }
    .paid-row { color: #059669; font-weight: bold; }
    .due-row { color: #dc2626; font-weight: 900; font-size: 14px; border-top: 1px dashed #cbd5e1; padding-top: 6px; }
    .footer { text-align: center; margin-top: 40px; color: #64748b; font-size: 11px; }
    @media print { body { padding: 0; } }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="company">SPORTS CHAMPIONS</div>
      <div>${branchName}</div>
      <div style="font-size:11px; color:#64748b;">${L('سجل تجاري: 102938 | بطاقة ضريبية: 492-819-201', 'CR: 102938 | Tax ID: 492-819-201')}</div>
    </div>
    <div style="text-align:${isAr ? 'left' : 'right'}">
      <div style="font-size:18px; font-weight:bold; color:#0f172a;">${L('فاتورة مبيعات ضريبية', 'Tax Sales Invoice')}</div>
      <div style="font-family:monospace; font-weight:bold; color:#0284c7; margin-top:4px;">${inv.invoiceNumber}</div>
      <div style="color:#64748b; font-size:11px; margin-top:4px;">${L('تاريخ الإصدار', 'Date')}: ${new Date(inv.createdAt).toLocaleDateString(isAr ? 'ar-EG' : 'en-US')}</div>
      ${inv.dueDate ? `<div style="color:#b45309; font-size:11px; font-weight:bold;">${L('تاريخ الاستحقاق', 'Due Date')}: ${new Date(inv.dueDate).toLocaleDateString(isAr ? 'ar-EG' : 'en-US')}</div>` : ''}
    </div>
  </div>

  <div class="info-grid">
    <div>
      <div style="font-weight:bold; color:#64748b; font-size:11px; margin-bottom:4px;">${L('العميل', 'Customer')}</div>
      <div style="font-weight:bold; font-size:14px;">${custName}</div>
      <div dir="ltr" style="text-align:${isAr ? 'right' : 'left'}; color:#475569;">${custPhone}</div>
    </div>
    <div>
      <div style="font-weight:bold; color:#64748b; font-size:11px; margin-bottom:4px;">${L('حالة الفاتورة والتحصيل', 'Status')}</div>
      <div style="font-weight:bold;">${inv.status}</div>
      <div style="font-size:11px; color:#64748b;">${inv.notes || ''}</div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width:30px;">#</th>
        <th>${L('الصنف', 'Item')}</th>
        <th style="width:70px;">${L('الكمية', 'Qty')}</th>
        <th style="width:100px;">${L('السعر', 'Price')}</th>
        <th style="width:110px;">${L('الإجمالي', 'Total')}</th>
      </tr>
    </thead>
    <tbody>
      ${itemsRows}
    </tbody>
  </table>

  <div class="totals">
    <div class="totals-row"><span>${L('المجموع الفرعي', 'Subtotal')}:</span> <span>${Number(inv.subtotal).toFixed(2)} ${currencyLabel}</span></div>
    ${Number(inv.discount) > 0 ? `<div class="totals-row" style="color:#e11d48"><span>${L('الخصم', 'Discount')}:</span> <span>-${Number(inv.discount).toFixed(2)} ${currencyLabel}</span></div>` : ''}
    <div class="totals-row"><span>${L('ضريبة القيمة المضافة (14%)', 'VAT (14%)')}:</span> <span>${Number(inv.vat).toFixed(2)} ${currencyLabel}</span></div>
    <div class="totals-row grand-total"><span>${L('إجمالي الفاتورة', 'Total')}:</span> <span>${Number(inv.total).toFixed(2)} ${currencyLabel}</span></div>
    <div class="totals-row paid-row"><span>${L('المدفوع', 'Paid')}:</span> <span>${Number(inv.paidAmount).toFixed(2)} ${currencyLabel}</span></div>
    <div class="totals-row due-row"><span>${L('المتبقي المستحق', 'Outstanding')}:</span> <span>${Number(inv.outstanding).toFixed(2)} ${currencyLabel}</span></div>
  </div>

  <div class="footer">
    <p>${L('شكراً لاختياركم سبورتس تشامبيونز. الفاتورة خاضعة لقوانين مصلحة الضرائب المصرية.', 'Thank you for choosing Sports Champions. Official Egyptian Tax Invoice.')}</p>
  </div>
  <script>window.onload = () => window.print();</script>
</body>
</html>`;

    win.document.write(html);
    win.document.close();
  };

  return (
    <div className="space-y-4">
      {/* Metrics Summary Header Cards */}
      {summary && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="glass-panel p-4 rounded-2xl border border-slate-800 space-y-1">
            <div className="text-xs text-slate-400">{L('إجمالي المفوتر المصدر', 'Total Invoiced')}</div>
            <div className="text-xl font-black text-slate-100">
              {Number(summary.invoiced).toLocaleString()} {currencyLabel}
            </div>
          </div>
          <div className="glass-panel p-4 rounded-2xl border border-slate-800 space-y-1">
            <div className="text-xs text-slate-400">{L('المحصل الفعلي', 'Paid Amount')}</div>
            <div className="text-xl font-black text-emerald-400">
              {Number(summary.paid).toLocaleString()} {currencyLabel}
            </div>
          </div>
          <div className="glass-panel p-4 rounded-2xl border border-slate-800 space-y-1">
            <div className="text-xs text-slate-400">{L('الذمم المعلقة (المستحق)', 'Outstanding Receivables')}</div>
            <div className="text-xl font-black text-amber-400">
              {Number(summary.outstanding).toLocaleString()} {currencyLabel}
            </div>
          </div>
        </div>
      )}

      {/* Filter and Actions Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-2.5" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={L('بحث برقم الفاتورة أو العميل...', 'Search invoice or customer...')}
              className="pr-9 pl-4 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-slate-100 w-56 focus:outline-none focus:border-blue-500"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="py-2 px-3 rounded-xl bg-slate-900 border border-slate-700 text-xs text-slate-200 focus:outline-none"
          >
            <option value="">{L('جميع الحالات', 'All Statuses')}</option>
            <option value="DRAFT">{L('مسودة (DRAFT)', 'Draft')}</option>
            <option value="ISSUED">{L('مصدرة غير مدفوعة (ISSUED)', 'Issued')}</option>
            <option value="PARTIALLY_PAID">{L('مدفوعة جزئيًا (PARTIALLY_PAID)', 'Partially Paid')}</option>
            <option value="PAID">{L('مسددة بالكامل (PAID)', 'Paid')}</option>
            <option value="VOID">{L('ملغاة (VOID)', 'Void')}</option>
          </select>

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
            setLines([]);
            addLine();
            setShowNewModal(true);
          }}
          variant="primary"
        >
          <Plus className="w-4 h-4" />
          {L('إنشاء فاتورة جديدة', 'New Invoice')}
        </Button>
      </div>

      {/* Invoices Table */}
      <div className="app-scrollbar app-scrollbar-horizontal overflow-x-auto">
        <table className="w-full min-w-[800px] text-xs text-start">
          <thead className="text-slate-400 bg-slate-950 border-b border-slate-800">
            <tr>
              <th className="p-3">{L('رقم الفاتورة', 'Invoice No.')}</th>
              <th className="p-3">{L('العميل', 'Customer')}</th>
              <th className="p-3">{L('الفرع', 'Branch')}</th>
              <th className="p-3">{L('الإجمالي', 'Total')}</th>
              <th className="p-3">{L('المدفوع', 'Paid')}</th>
              <th className="p-3">{L('المتبقي', 'Outstanding')}</th>
              <th className="p-3">{L('الحالة', 'Status')}</th>
              <th className="p-3">{L('تاريخ الاستحقاق', 'Due Date')}</th>
              <th className="p-3">{L('إجراءات', 'Actions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {invoices.map((inv) => (
              <tr key={inv.id} className="hover:bg-slate-900/50 transition-colors">
                <td className="p-3 font-mono font-bold text-sky-400">{inv.invoiceNumber}</td>
                <td className="p-3 font-semibold text-slate-200">
                  {inv.customer?.name || '—'}
                  {inv.customer?.phone && (
                    <div className="text-[10px] text-slate-400 font-mono" dir="ltr">
                      {inv.customer.phone}
                    </div>
                  )}
                </td>
                <td className="p-3 text-slate-300">
                  {isAr ? inv.branch?.name : inv.branch?.nameEn || inv.branch?.name}
                </td>
                <td className="p-3 font-black text-slate-100">
                  {Number(inv.total).toLocaleString()} {currencyLabel}
                </td>
                <td className="p-3 font-bold text-emerald-400">
                  {Number(inv.paidAmount).toLocaleString()} {currencyLabel}
                </td>
                <td className={`p-3 font-bold ${Number(inv.outstanding) > 0 ? 'text-amber-400' : 'text-slate-400'}`}>
                  {Number(inv.outstanding).toLocaleString()} {currencyLabel}
                </td>
                <td className="p-3">
                  <div className="flex flex-col gap-1">
                    <StatusBadge value={inv.status} />
                    {inv.overdue && (
                      <span className="text-[10px] text-rose-400 font-bold flex items-center gap-0.5">
                        <AlertCircle className="w-3 h-3" />
                        {L('متأخرة السداد', 'Overdue')}
                      </span>
                    )}
                  </div>
                </td>
                <td className="p-3 text-slate-400">
                  {inv.dueDate ? new Date(inv.dueDate).toLocaleDateString(isAr ? 'ar-EG' : 'en-US') : '—'}
                </td>
                <td className="p-3">
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => openInvoiceDetail(inv.id)}
                      className="p-1.5 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 transition-colors"
                      title={L('عرض ومتابعة', 'View & Manage')}
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={async () => {
                        await openInvoiceDetail(inv.id);
                        if (activeInvoice) printInvoice(activeInvoice);
                      }}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                      title={L('طباعة', 'Print')}
                    >
                      <Printer className="w-3.5 h-3.5" />
                    </button>
                    {Number(inv.outstanding) > 0 && inv.status !== 'DRAFT' && inv.status !== 'VOID' && (
                      <button
                        onClick={() => router.push(`/admin/sales/payments?customerId=${inv.customerId}&invoiceId=${inv.id}`)}
                        className="p-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 transition-colors"
                        title={L('تحصيل دفعة', 'Record Payment')}
                      >
                        <CreditCard className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {invoices.length === 0 && !loading && (
          <div className="text-center text-xs text-slate-500 py-12">
            {L('لا توجد فواتير مبيعات مسجلة', 'No invoices found')}
          </div>
        )}
      </div>

      {invoices.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <span className="text-[11px] font-bold text-slate-400">
            {L(`إجمالي: ${total} فاتورة`, `Total: ${total} invoices`)}
          </span>
          <Pagination page={page} totalPages={pageCount} onPageChange={setPage} />
        </div>
      )}

      {/* New Invoice Modal */}
      {showNewModal && (
        <Modal
          title={L('إنشاء فاتورة مبيعات جديدة', 'Create Customer Invoice')}
          onClose={() => setShowNewModal(false)}
        >
          <form onSubmit={handleCreateInvoice} className="space-y-4 text-xs max-h-[80vh] overflow-y-auto pr-1">
            {createError && (
              <div role="alert" className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 font-bold">
                {createError}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-400 mb-1">
                  {L('العميل', 'Customer')}
                </label>
                <select
                  value={selectedCustomerId}
                  onChange={(e) => setSelectedCustomerId(e.target.value)}
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
                  {L('الفرع', 'Branch')}
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

            <div>
              <label className="block text-[11px] font-bold text-slate-400 mb-1">
                {L('تاريخ الاستحقاق', 'Due Date')}
              </label>
              <input
                type="date"
                value={invoiceDueDate}
                onChange={(e) => setInvoiceDueDate(e.target.value)}
                className={inputCls}
              />
            </div>

            {/* Line items section */}
            <div className="border-t border-slate-800 pt-3 space-y-3">
              <div className="flex justify-between items-center">
                <span className="font-extrabold text-slate-200">
                  {L('أصناف الفاتورة', 'Invoice Items')}
                </span>
                <button
                  type="button"
                  onClick={addLine}
                  className="px-2.5 py-1 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 text-[11px] font-bold flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" />
                  {L('إضافة صنف', 'Add Item')}
                </button>
              </div>

              <div className="space-y-2">
                {lines.map((line, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2 items-center bg-slate-900/60 p-2.5 rounded-xl border border-slate-800">
                    <div className="col-span-6">
                      <select
                        value={line.productId}
                        onChange={(e) => updateLineProduct(idx, e.target.value)}
                        className={inputCls}
                      >
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>
                            {isAr ? p.nameAr : p.nameEn} ({p.sku})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="col-span-2">
                      <input
                        type="number"
                        min="1"
                        value={line.quantity}
                        onChange={(e) => updateLineQuantity(idx, Number(e.target.value))}
                        className={inputCls}
                        title={L('الكمية', 'Quantity')}
                      />
                    </div>
                    <div className="col-span-3">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={line.unitPrice}
                        onChange={(e) => updateLinePrice(idx, Number(e.target.value))}
                        className={inputCls}
                        title={L('السعر', 'Price')}
                      />
                    </div>
                    <div className="col-span-1 text-center">
                      <button
                        type="button"
                        onClick={() => removeLine(idx)}
                        className="text-rose-400 hover:text-rose-300 p-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Financial Totals */}
            <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-800 space-y-1.5 text-[11px]">
              <div className="flex justify-between text-slate-400">
                <span>{L('المجموع الفرعي', 'Subtotal')}:</span>
                <span>{linesSubtotal.toFixed(2)} {currencyLabel}</span>
              </div>
              <div className="flex justify-between items-center text-slate-400">
                <span>{L('الخصم', 'Discount')}:</span>
                <input
                  type="number"
                  min="0"
                  max={linesSubtotal}
                  value={invoiceDiscount}
                  onChange={(e) => setInvoiceDiscount(Number(e.target.value) || 0)}
                  className="w-24 text-end px-2 py-0.5 rounded bg-slate-950 border border-slate-700 text-xs text-rose-400 font-bold"
                />
              </div>
              <div className="flex justify-between text-slate-400">
                <span>{L('ضريبة 14%', 'VAT (14%)')}:</span>
                <span>{calculatedVat.toFixed(2)} {currencyLabel}</span>
              </div>
              <div className="flex justify-between font-black text-sm text-emerald-400 pt-1 border-t border-slate-800">
                <span>{L('الإجمالي النهائي', 'Grand Total')}:</span>
                <span>{grandTotal.toFixed(2)} {currencyLabel}</span>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-400 mb-1">
                {L('ملاحظات', 'Notes')}
              </label>
              <textarea
                rows={2}
                value={invoiceNotes}
                onChange={(e) => setInvoiceNotes(e.target.value)}
                placeholder={L('شروط السداد، البنك، أو ملاحظات التسليم...', 'Terms, delivery note...')}
                className={`${inputCls} resize-none`}
              />
            </div>

            <button
              type="submit"
              disabled={creating}
              className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white font-extrabold transition-all"
            >
              {creating ? L('جاري الحفظ...', 'Saving...') : L('حفظ الفاتورة', 'Save Invoice')}
            </button>
          </form>
        </Modal>
      )}

      {/* Invoice Detail Modal */}
      {activeInvoice && (
        <Modal
          title={`${L('فاتورة مبيعات', 'Invoice')} ${activeInvoice.invoiceNumber}`}
          onClose={() => setActiveInvoice(null)}
        >
          <div className="space-y-4 text-xs max-h-[80vh] overflow-y-auto pr-1">
            <div className="flex flex-wrap justify-between items-center gap-2 p-3 rounded-xl bg-slate-900 border border-slate-800">
              <div>
                <span className="text-slate-400">{L('العميل', 'Customer')}: </span>
                <span className="font-bold text-slate-200">{activeInvoice.customer?.name}</span>
                {activeInvoice.customer?.phone && (
                  <span className="text-slate-400 font-mono ms-2" dir="ltr">
                    ({activeInvoice.customer.phone})
                  </span>
                )}
              </div>
              <StatusBadge value={activeInvoice.status} />
            </div>

            {/* Line items list */}
            <div>
              <div className="font-bold text-slate-300 mb-2">
                {L('أصناف الفاتورة', 'Invoice Lines')}
              </div>
              <div className="app-scrollbar app-scrollbar-horizontal overflow-x-auto">
                <table className="w-full text-xs text-start">
                  <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
                    <tr>
                      <th className="p-2">{L('الصنف', 'Item')}</th>
                      <th className="p-2">{L('الكمية', 'Qty')}</th>
                      <th className="p-2">{L('السعر', 'Price')}</th>
                      <th className="p-2">{L('الإجمالي', 'Total')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {(activeInvoice.lines || []).map((it) => (
                      <tr key={it.id}>
                        <td className="p-2 font-semibold text-slate-200">
                          {isAr ? it.product?.nameAr || it.product?.nameEn : it.product?.nameEn || it.product?.nameAr}
                        </td>
                        <td className="p-2">{it.quantity}</td>
                        <td className="p-2">{Number(it.unitPrice).toFixed(2)}</td>
                        <td className="p-2 font-bold text-slate-100">{Number(it.lineTotal).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Financial summary */}
            <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-800 space-y-1 text-[11px]">
              <div className="flex justify-between text-slate-400">
                <span>{L('المجموع الفرعي', 'Subtotal')}:</span>
                <span>{Number(activeInvoice.subtotal).toFixed(2)} {currencyLabel}</span>
              </div>
              {Number(activeInvoice.discount) > 0 && (
                <div className="flex justify-between text-rose-400">
                  <span>{L('الخصم', 'Discount')}:</span>
                  <span>-{Number(activeInvoice.discount).toFixed(2)} {currencyLabel}</span>
                </div>
              )}
              <div className="flex justify-between text-slate-400">
                <span>{L('ضريبة القيمة المضافة', 'VAT')}:</span>
                <span>{Number(activeInvoice.vat).toFixed(2)} {currencyLabel}</span>
              </div>
              <div className="flex justify-between font-black text-sm text-slate-100 pt-1 border-t border-slate-800">
                <span>{L('إجمالي الفاتورة', 'Total')}:</span>
                <span>{Number(activeInvoice.total).toFixed(2)} {currencyLabel}</span>
              </div>
              <div className="flex justify-between font-bold text-emerald-400">
                <span>{L('المدفوع المحصل', 'Paid')}:</span>
                <span>{Number(activeInvoice.paidAmount).toFixed(2)} {currencyLabel}</span>
              </div>
              <div className="flex justify-between font-black text-amber-400">
                <span>{L('المتبقي المستحق', 'Outstanding')}:</span>
                <span>{Number(activeInvoice.outstanding).toFixed(2)} {currencyLabel}</span>
              </div>
            </div>

            {/* Payment allocations list if any */}
            {(activeInvoice.allocations || []).length > 0 && (
              <div>
                <div className="font-bold text-slate-300 mb-2">
                  {L('الدفعات المحصلة على هذه الفاتورة', 'Payment Allocations')}
                </div>
                <div className="space-y-1.5">
                  {activeInvoice.allocations!.map((al) => (
                    <div key={al.id} className="p-2 rounded-xl bg-slate-900 border border-slate-800 flex justify-between items-center text-xs">
                      <div>
                        <span className="font-mono text-sky-400 font-bold">{al.payment.receiptNumber}</span>
                        <span className="text-slate-400 ms-2">({al.payment.method})</span>
                        <span className="text-slate-500 ms-2 text-[10px]">
                          {new Date(al.payment.paidAt).toLocaleDateString(isAr ? 'ar-EG' : 'en-US')}
                        </span>
                      </div>
                      <span className="font-bold text-emerald-400">
                        {Number(al.amount).toFixed(2)} {currencyLabel}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Actions Bar */}
            <div className="border-t border-slate-800 pt-3 space-y-2">
              <div className="font-bold text-slate-300 text-[11px]">
                {L('الإجراءات المتاحة', 'Available Actions')}
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => printInvoice(activeInvoice)}
                  className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold flex items-center gap-1.5"
                >
                  <Printer className="w-3.5 h-3.5" />
                  {L('طباعة الفاتورة A4', 'Print Invoice')}
                </button>

                {activeInvoice.status === 'DRAFT' && (
                  <button
                    type="button"
                    disabled={actionBusy}
                    onClick={() => handleApplyAction('issue')}
                    className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-extrabold flex items-center gap-1.5"
                  >
                    <CheckCircle className="w-4 h-4" />
                    {L('إصدار الفاتورة رسميًا', 'Issue Invoice')}
                  </button>
                )}

                {activeInvoice.status !== 'VOID' && !activeInvoice.hasPayments && (
                  <button
                    type="button"
                    disabled={actionBusy}
                    onClick={() => handleApplyAction('void')}
                    className="px-3 py-2 rounded-xl bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 font-bold flex items-center gap-1.5"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    {L('إلغاء / إبطال الفاتورة', 'Void Invoice')}
                  </button>
                )}

                {Number(activeInvoice.outstanding) > 0 && activeInvoice.status !== 'DRAFT' && (
                  <button
                    type="button"
                    onClick={() => router.push(`/admin/sales/payments?customerId=${activeInvoice.customerId}&invoiceId=${activeInvoice.id}`)}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold flex items-center gap-1.5"
                  >
                    <CreditCard className="w-4 h-4" />
                    {L('تحصيل دفعة مالية', 'Record Payment')}
                  </button>
                )}
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
