'use client';

import React, { useState, useEffect } from 'react';
import { useLocale } from 'next-intl';
import { useRouter } from '@/i18n/routing';
import {
  FileText,
  Plus,
  Search,
  Eye,
  Send,
  CheckCircle,
  XCircle,
  ArrowRightCircle,
  Printer,
  Trash2,
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

interface QuotationItem {
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

interface QuotationRow {
  id: string;
  quotationNumber: string;
  customerName: string;
  customerId: string;
  branchId: string;
  subtotal: number;
  discount: number;
  vat: number;
  total: number;
  status: string;
  effectiveStatus: string;
  availableActions: string[];
  validUntil: string;
  createdAt: string;
  lineCount: number;
  branch?: { id: string; name: string; nameEn: string };
  customer?: { id: string; name: string | null; phone: string; email: string | null };
  items?: QuotationItem[];
  notes?: string | null;
}

export default function QuotationsManager({
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

  const [quotations, setQuotations] = useState<QuotationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [branchFilter, setBranchFilter] = useState('');
  const [page, setPage] = useState(1);
  const [pageCount, setPageCount] = useState(1);
  const [total, setTotal] = useState(0);

  // New quotation modal state
  const [showNewModal, setShowNewModal] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState(customers[0]?.id || '');
  const [customCustomerName, setCustomCustomerName] = useState('');
  const [selectedBranchId, setSelectedBranchId] = useState(branches[0]?.id || '');
  const [validUntilDays, setValidUntilDays] = useState(15);
  const [quoteDiscount, setQuoteDiscount] = useState(0);
  const [quoteNotes, setQuoteNotes] = useState('');
  const [lines, setLines] = useState<Array<{ productId: string; quantity: number; unitPrice: number }>>([]);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  // View / Action modal state
  const [activeQuote, setActiveQuote] = useState<QuotationRow | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectInput, setShowRejectInput] = useState(false);

  const fetchQuotations = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: '10',
      });
      if (search) params.set('q', search);
      if (statusFilter) params.set('status', statusFilter);
      if (branchFilter) params.set('branchId', branchFilter);

      const res = (await apiFetch(`/api/admin/quotations?${params.toString()}`, 'GET')) as {
        success?: boolean;
        rows?: QuotationRow[];
        total?: number;
        pageCount?: number;
      };
      if (res.rows) {
        setQuotations(res.rows);
        setTotal(res.total || 0);
        setPageCount(res.pageCount || 1);
      }
    } catch (e) {
      toast(L('فشل تحميل عروض الأسعار', 'Failed to load quotations'), 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQuotations();
  }, [page, statusFilter, branchFilter]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1);
      fetchQuotations();
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const openQuoteDetail = async (id: string) => {
    setLoadingDetail(true);
    setShowRejectInput(false);
    setRejectReason('');
    try {
      const res = (await apiFetch(`/api/admin/quotations/${id}`, 'GET')) as {
        success?: boolean;
        quotation?: QuotationRow;
      };
      if (res.quotation) {
        setActiveQuote(res.quotation);
      }
    } catch {
      toast(L('تعذر تحميل تفاصيل العرض', 'Failed to load quote details'), 'error');
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleApplyAction = async (action: string, reason?: string) => {
    if (!activeQuote) return;
    setActionBusy(true);
    try {
      const res = (await apiFetch(`/api/admin/quotations/${activeQuote.id}`, 'POST', {
        action,
        reason,
      })) as { success?: boolean; status?: string; invoice?: { id: string; invoiceNumber: string } };

      toast(
        action === 'convert' && res.invoice
          ? L(`تم تحويل العرض إلى فاتورة رقم ${res.invoice.invoiceNumber}`, `Converted to invoice #${res.invoice.invoiceNumber}`)
          : L('تم تحديث حالة عرض السعر', 'Quotation status updated'),
        'success'
      );

      setActiveQuote(null);
      fetchQuotations();
      if (action === 'convert' && res.invoice) {
        router.push('/admin/sales/invoices');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : L('فشل في تنفيذ الإجراء', 'Action failed');
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

  // Calculations for new quote
  const linesSubtotal = lines.reduce((acc, l) => acc + l.quantity * l.unitPrice, 0);
  const calculatedDiscount = Math.min(linesSubtotal, quoteDiscount);
  const netSubtotal = linesSubtotal - calculatedDiscount;
  const calculatedVat = Math.round(netSubtotal * 0.14 * 100) / 100;
  const grandTotal = Math.round((netSubtotal + calculatedVat) * 100) / 100;

  const handleCreateQuotation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (lines.length === 0) {
      setCreateError(L('يرجى إضافة صنف واحد على الأقل', 'Please add at least one line item'));
      return;
    }
    setCreating(true);
    setCreateError('');
    try {
      const validUntilDate = new Date();
      validUntilDate.setDate(validUntilDate.getDate() + validUntilDays);

      await apiFetch('/api/admin/quotations', 'POST', {
        customerId: selectedCustomerId,
        customerName: customCustomerName || undefined,
        branchId: selectedBranchId,
        discount: quoteDiscount,
        validUntil: validUntilDate.toISOString(),
        notes: quoteNotes || undefined,
        items: lines.map((l) => ({
          productId: l.productId,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
        })),
      });

      toast(L('تم إنشاء عرض السعر بنجاح', 'Quotation created successfully'), 'success');
      setShowNewModal(false);
      setLines([]);
      setQuoteDiscount(0);
      setQuoteNotes('');
      fetchQuotations();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : L('فشل في إنشاء عرض السعر', 'Could not create quotation');
      setCreateError(msg);
      toast(msg, 'error');
    } finally {
      setCreating(false);
    }
  };

  const printQuotation = (q: QuotationRow) => {
    const win = window.open('', '_blank', 'width=800,height=900');
    if (!win) return;
    const branchName = isAr ? q.branch?.name || '' : q.branch?.nameEn || q.branch?.name || '';
    const custName = q.customer?.name || q.customerName || '';
    const custPhone = q.customer?.phone || '';

    const itemsRows = (q.items || [])
      .map(
        (item, idx) => `
        <tr>
          <td>${idx + 1}</td>
          <td>${isAr ? item.product?.nameAr || item.product?.nameEn : item.product?.nameEn || item.product?.nameAr}<br><small style="color:#666">${item.product?.sku || ''}</small></td>
          <td>${item.quantity}</td>
          <td>${Number(item.unitPrice).toFixed(2)}</td>
          <td>${Number(item.lineTotal).toFixed(2)}</td>
        </tr>`
      )
      .join('');

    const html = `<!doctype html>
<html dir="${isAr ? 'rtl' : 'ltr'}" lang="${isAr ? 'ar' : 'en'}">
<head>
  <meta charset="utf-8">
  <title>${L('عرض سعر', 'Quotation')} - ${q.quotationNumber}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; padding: 40px; color: #1e293b; font-size: 13px; line-height: 1.5; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #e2e8f0; padding-bottom: 20px; margin-bottom: 24px; }
    .company { font-size: 20px; font-weight: 900; color: #0f172a; }
    .badge { display: inline-block; padding: 4px 10px; border-radius: 9999px; background: #e0f2fe; color: #0284c7; font-weight: bold; font-size: 11px; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 24px; background: #f8fafc; padding: 16px; border-radius: 12px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
    th { background: #f1f5f9; padding: 10px; text-align: start; font-weight: 700; border-bottom: 1px solid #cbd5e1; font-size: 12px; }
    td { padding: 10px; border-bottom: 1px solid #e2e8f0; }
    .totals { width: 320px; margin-${isAr ? 'right' : 'left'}: auto; background: #f8fafc; padding: 16px; border-radius: 12px; }
    .totals-row { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 13px; }
    .grand-total { font-size: 16px; font-weight: 900; color: #0f172a; border-top: 2px solid #cbd5e1; padding-top: 8px; margin-top: 8px; }
    .footer { text-align: center; margin-top: 40px; color: #64748b; font-size: 11px; }
    @media print { body { padding: 0; } }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="company">SPORTS CHAMPIONS</div>
      <div>${branchName}</div>
    </div>
    <div style="text-align:${isAr ? 'left' : 'right'}">
      <div style="font-size:18px; font-weight:bold; color:#0284c7;">${L('عرض سعر رسمي', 'Official Quotation')}</div>
      <div style="font-family:monospace; font-weight:bold; margin-top:4px;">${q.quotationNumber}</div>
      <div style="color:#64748b; font-size:11px; margin-top:4px;">${new Date(q.createdAt).toLocaleDateString(isAr ? 'ar-EG' : 'en-US')}</div>
    </div>
  </div>

  <div class="info-grid">
    <div>
      <div style="font-weight:bold; color:#64748b; font-size:11px; margin-bottom:4px;">${L('بيانات العميل', 'Customer Information')}</div>
      <div style="font-weight:bold; font-size:14px;">${custName}</div>
      <div dir="ltr" style="text-align:${isAr ? 'right' : 'left'}; color:#475569;">${custPhone}</div>
    </div>
    <div>
      <div style="font-weight:bold; color:#64748b; font-size:11px; margin-bottom:4px;">${L('صلاحية العرض', 'Validity')}</div>
      <div style="font-weight:bold; color:#b45309;">${L('ساري حتى', 'Valid until')}: ${new Date(q.validUntil).toLocaleDateString(isAr ? 'ar-EG' : 'en-US')}</div>
      <div style="font-size:11px; color:#64748b;">${q.notes || ''}</div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width:30px;">#</th>
        <th>${L('الصنف والمواصفات', 'Item & Description')}</th>
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
    <div class="totals-row"><span>${L('المجموع الفرعي', 'Subtotal')}:</span> <span>${Number(q.subtotal).toFixed(2)} ${currencyLabel}</span></div>
    ${Number(q.discount) > 0 ? `<div class="totals-row" style="color:#e11d48"><span>${L('الخصم', 'Discount')}:</span> <span>-${Number(q.discount).toFixed(2)} ${currencyLabel}</span></div>` : ''}
    <div class="totals-row"><span>${L('ضريبة القيمة المضافة (14%)', 'VAT (14%)')}:</span> <span>${Number(q.vat).toFixed(2)} ${currencyLabel}</span></div>
    <div class="totals-row grand-total"><span>${L('الإجمالي النهائي', 'Grand Total')}:</span> <span>${Number(q.total).toFixed(2)} ${currencyLabel}</span></div>
  </div>

  <div class="footer">
    <p>${L('شكراً لتعاملكم معنا. هذا العرض خاضع لشروط وأسعار الشركة السارية.', 'Thank you for your business. Subject to standard terms.')}</p>
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
              placeholder={L('بحث بالرقم أو العميل...', 'Search quote or customer...')}
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
            <option value="SENT">{L('مرسل (SENT)', 'Sent')}</option>
            <option value="ACCEPTED">{L('مقبول (ACCEPTED)', 'Accepted')}</option>
            <option value="REJECTED">{L('مرفوض (REJECTED)', 'Rejected')}</option>
            <option value="EXPIRED">{L('منتهي الصلاحية (EXPIRED)', 'Expired')}</option>
            <option value="CONVERTED">{L('تم التحويل لفاتورة (CONVERTED)', 'Converted')}</option>
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
          {L('إنشاء عرض سعر جديد', 'New Quotation')}
        </Button>
      </div>

      {/* Quotations Table */}
      <div className="app-scrollbar app-scrollbar-horizontal overflow-x-auto">
        <table className="w-full min-w-[760px] text-xs text-start">
          <thead className="text-slate-400 bg-slate-950 border-b border-slate-800">
            <tr>
              <th className="p-3">{L('رقم العرض', 'Quote No.')}</th>
              <th className="p-3">{L('العميل', 'Customer')}</th>
              <th className="p-3">{L('الفرع', 'Branch')}</th>
              <th className="p-3">{L('الأصناف', 'Items')}</th>
              <th className="p-3">{L('المبلغ الكلي', 'Total')}</th>
              <th className="p-3">{L('الحالة', 'Status')}</th>
              <th className="p-3">{L('صلاحية العرض', 'Valid Until')}</th>
              <th className="p-3">{L('إجراءات', 'Actions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {quotations.map((q) => (
              <tr key={q.id} className="hover:bg-slate-900/50 transition-colors">
                <td className="p-3 font-mono font-bold text-sky-400">{q.quotationNumber}</td>
                <td className="p-3 font-semibold text-slate-200">
                  {q.customer?.name || q.customerName || '—'}
                  {q.customer?.phone && (
                    <div className="text-[10px] text-slate-400 font-mono" dir="ltr">
                      {q.customer.phone}
                    </div>
                  )}
                </td>
                <td className="p-3 text-slate-300">
                  {isAr ? q.branch?.name : q.branch?.nameEn || q.branch?.name}
                </td>
                <td className="p-3 font-bold text-slate-300">{q.lineCount}</td>
                <td className="p-3 font-black text-slate-100">
                  {Number(q.total).toLocaleString()} {currencyLabel}
                </td>
                <td className="p-3">
                  <StatusBadge value={q.effectiveStatus || q.status} />
                </td>
                <td className="p-3 text-slate-400">
                  {new Date(q.validUntil).toLocaleDateString(isAr ? 'ar-EG' : 'en-US')}
                </td>
                <td className="p-3">
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => openQuoteDetail(q.id)}
                      className="p-1.5 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 transition-colors"
                      title={L('عرض ومتابعة', 'View & Manage')}
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={async () => {
                        await openQuoteDetail(q.id);
                        if (activeQuote) printQuotation(activeQuote);
                      }}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                      title={L('طباعة', 'Print')}
                    >
                      <Printer className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {quotations.length === 0 && !loading && (
          <div className="text-center text-xs text-slate-500 py-12">
            {L('لا توجد عروض أسعار مسجلة', 'No quotations found')}
          </div>
        )}
      </div>

      {quotations.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <span className="text-[11px] font-bold text-slate-400">
            {L(`إجمالي: ${total} عرض`, `Total: ${total} quotes`)}
          </span>
          <Pagination page={page} totalPages={pageCount} onPageChange={setPage} />
        </div>
      )}

      {/* New Quotation Modal */}
      {showNewModal && (
        <Modal
          title={L('إنشاء عرض سعر جديد', 'Create New Quotation')}
          onClose={() => setShowNewModal(false)}
        >
          <form onSubmit={handleCreateQuotation} className="space-y-4 text-xs max-h-[80vh] overflow-y-auto pr-1">
            {createError && (
              <div role="alert" className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 font-bold">
                {createError}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-400 mb-1">
                  {L('العميل المسجل', 'Registered Customer')}
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
                  {L('اسم العميل / الجهة في العرض (اختياري)', 'Display Name on Quote (optional)')}
                </label>
                <input
                  type="text"
                  placeholder={L('مثال: شركة الأمل الرياضية', 'e.g. Hope Sports Co.')}
                  value={customCustomerName}
                  onChange={(e) => setCustomCustomerName(e.target.value)}
                  className={inputCls}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-400 mb-1">
                  {L('الفرع المصدر', 'Issuing Branch')}
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

              <div>
                <label className="block text-[11px] font-bold text-slate-400 mb-1">
                  {L('فترة الصلاحية (أيام)', 'Validity Period (Days)')}
                </label>
                <input
                  type="number"
                  min="1"
                  max="90"
                  value={validUntilDays}
                  onChange={(e) => setValidUntilDays(Number(e.target.value) || 15)}
                  className={inputCls}
                />
              </div>
            </div>

            {/* Line items section */}
            <div className="border-t border-slate-800 pt-3 space-y-3">
              <div className="flex justify-between items-center">
                <span className="font-extrabold text-slate-200">
                  {L('أصناف عرض السعر', 'Quote Items')}
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

            {/* Totals Summary */}
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
                  value={quoteDiscount}
                  onChange={(e) => setQuoteDiscount(Number(e.target.value) || 0)}
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
                {L('ملاحظات وشروط خاصة', 'Notes & Terms')}
              </label>
              <textarea
                rows={2}
                value={quoteNotes}
                onChange={(e) => setQuoteNotes(e.target.value)}
                placeholder={L('أي شروط دفع، مواعيد تسليم، أو تفاصيل إضافية...', 'Payment terms, delivery estimates...')}
                className={`${inputCls} resize-none`}
              />
            </div>

            <button
              type="submit"
              disabled={creating}
              className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white font-extrabold transition-all"
            >
              {creating ? L('جاري الحفظ...', 'Saving...') : L('حفظ عرض السعر', 'Save Quotation')}
            </button>
          </form>
        </Modal>
      )}

      {/* Quote Detail & Actions Modal */}
      {activeQuote && (
        <Modal
          title={`${L('عرض سعر', 'Quotation')} ${activeQuote.quotationNumber}`}
          onClose={() => setActiveQuote(null)}
        >
          <div className="space-y-4 text-xs max-h-[80vh] overflow-y-auto pr-1">
            <div className="flex flex-wrap justify-between items-center gap-2 p-3 rounded-xl bg-slate-900 border border-slate-800">
              <div>
                <span className="text-slate-400">{L('العميل', 'Customer')}: </span>
                <span className="font-bold text-slate-200">
                  {activeQuote.customer?.name || activeQuote.customerName}
                </span>
                {activeQuote.customer?.phone && (
                  <span className="text-slate-400 font-mono ms-2" dir="ltr">
                    ({activeQuote.customer.phone})
                  </span>
                )}
              </div>
              <StatusBadge value={activeQuote.effectiveStatus || activeQuote.status} />
            </div>

            {/* Line items list */}
            <div>
              <div className="font-bold text-slate-300 mb-2">
                {L('الأصناف والأسعار', 'Items & Pricing')}
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
                    {(activeQuote.items || []).map((it) => (
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
                <span>{Number(activeQuote.subtotal).toFixed(2)} {currencyLabel}</span>
              </div>
              {Number(activeQuote.discount) > 0 && (
                <div className="flex justify-between text-rose-400">
                  <span>{L('الخصم', 'Discount')}:</span>
                  <span>-{Number(activeQuote.discount).toFixed(2)} {currencyLabel}</span>
                </div>
              )}
              <div className="flex justify-between text-slate-400">
                <span>{L('ضريبة القيمة المضافة', 'VAT')}:</span>
                <span>{Number(activeQuote.vat).toFixed(2)} {currencyLabel}</span>
              </div>
              <div className="flex justify-between font-black text-sm text-emerald-400 pt-1 border-t border-slate-800">
                <span>{L('الإجمالي النهائي', 'Total')}:</span>
                <span>{Number(activeQuote.total).toFixed(2)} {currencyLabel}</span>
              </div>
            </div>

            {/* Actions Bar */}
            <div className="border-t border-slate-800 pt-3 space-y-2">
              <div className="font-bold text-slate-300 text-[11px]">
                {L('الإجراءات المتاحة لدورة حياة العرض', 'Available Lifecycle Actions')}
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => printQuotation(activeQuote)}
                  className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold flex items-center gap-1.5"
                >
                  <Printer className="w-3.5 h-3.5" />
                  {L('طباعة العرض A4', 'Print A4')}
                </button>

                {activeQuote.availableActions.includes('send') && (
                  <button
                    type="button"
                    disabled={actionBusy}
                    onClick={() => handleApplyAction('send')}
                    className="px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold flex items-center gap-1.5"
                  >
                    <Send className="w-3.5 h-3.5" />
                    {L('إرسال للعميل', 'Send to Customer')}
                  </button>
                )}

                {activeQuote.availableActions.includes('accept') && (
                  <button
                    type="button"
                    disabled={actionBusy}
                    onClick={() => handleApplyAction('accept')}
                    className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold flex items-center gap-1.5"
                  >
                    <CheckCircle className="w-3.5 h-3.5" />
                    {L('قبول العرض', 'Accept Quote')}
                  </button>
                )}

                {activeQuote.availableActions.includes('reject') && (
                  <button
                    type="button"
                    disabled={actionBusy}
                    onClick={() => setShowRejectInput(!showRejectInput)}
                    className="px-3 py-2 rounded-xl bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 font-bold flex items-center gap-1.5"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    {L('رفض العرض', 'Reject Quote')}
                  </button>
                )}

                {activeQuote.availableActions.includes('convert') && (
                  <button
                    type="button"
                    disabled={actionBusy}
                    onClick={() => handleApplyAction('convert')}
                    className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-extrabold flex items-center gap-1.5"
                  >
                    <ArrowRightCircle className="w-4 h-4" />
                    {L('تحويل إلى فاتورة مبيعات', 'Convert to Invoice')}
                  </button>
                )}
              </div>

              {showRejectInput && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 space-y-2 mt-2">
                  <label className="block text-[11px] font-bold text-rose-300">
                    {L('سبب الرفض (اختياري)', 'Reason for rejection (optional)')}
                  </label>
                  <input
                    type="text"
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder={L('مثال: السعر غير مناسب للعميل...', 'e.g. Price too high...')}
                    className={inputCls}
                  />
                  <button
                    type="button"
                    disabled={actionBusy}
                    onClick={() => handleApplyAction('reject', rejectReason)}
                    className="py-1.5 px-3 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold"
                  >
                    {L('تأكيد الرفض', 'Confirm Rejection')}
                  </button>
                </div>
              )}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
