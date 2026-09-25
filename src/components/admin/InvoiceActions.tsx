'use client';

import React, { useState } from 'react';
import { Printer, RotateCcw } from 'lucide-react';
import { useLocale } from 'next-intl';
import { apiFetch } from './ui';

type Snapshot = {
  invoiceNumber?: string;
  source?: string;
  createdAt?: string;
  branch?: { name?: string; nameEn?: string };
  customer?: { name?: string | null; phone?: string | null } | null;
  cashier?: { id?: string; name?: string | null } | null;
  paymentMethod?: string;
  subtotal?: number;
  discount?: number;
  vat?: number;
  deliveryFee?: number;
  total?: number;
  etaUuid?: string | null;
  lines?: Array<{ nameAr?: string; nameEn?: string; sku?: string; barcode?: string | null; quantity: number; unitPrice: number; totalPrice: number }>;
};

function esc(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char] || char));
}

function number(value: unknown): string {
  const n = Number(value || 0);
  return Number.isFinite(n) ? n.toFixed(2) : '0.00';
}

function printSnapshot(snapshot: Snapshot, isReprint: boolean, copyNumber?: number, isAr = true) {
  const win = window.open('', '_blank', 'width=480,height=760');
  if (!win) return false;
  const L = (ar: string, en: string) => (isAr ? ar : en);
  const rows = (snapshot.lines || []).map((line) => `<tr><td>${esc(isAr ? line.nameAr || line.nameEn : line.nameEn || line.nameAr)}<br><small>${esc(line.sku)}</small></td><td>${esc(line.quantity)}</td><td>${number(line.unitPrice)}</td><td>${number(line.totalPrice)}</td></tr>`).join('');
  const marker = isReprint
    ? `<div class="reprint">${L(`نسخة معادة الطباعة`, `Reprinted copy`)} ${copyNumber ? `#${copyNumber}` : ''}</div>`
    : '';
  const branchName = isAr ? snapshot.branch?.name || '' : snapshot.branch?.nameEn || snapshot.branch?.name || '';
  const doc = `<!doctype html><html dir="${isAr ? 'rtl' : 'ltr'}" lang="${isAr ? 'ar' : 'en'}"><head><meta charset="utf-8"><title>${L('فاتورة', 'Invoice')} ${esc(snapshot.invoiceNumber)}</title><style>body{font-family:Arial,sans-serif;width:360px;margin:18px;color:#111;font-size:12px}table{width:100%;border-collapse:collapse}th,td{padding:6px 3px;border-bottom:1px solid #ddd;text-align:start}th{font-size:11px}.center{text-align:center}.total{font-size:16px;font-weight:bold}.reprint{background:#fef3c7;border:2px solid #b45309;padding:8px;margin:8px 0;font-weight:bold;text-align:center}@media print{@page{size:80mm auto;margin:0}body{width:100%;margin:0}}</style></head><body><div class="center"><h2>SPORTS CHAMPIONS</h2><p>${esc(branchName)}</p><p>${L('فاتورة ضريبية مبسطة', 'Simplified tax invoice')}</p><p>${L('رقم', 'No.')}: ${esc(snapshot.invoiceNumber)}</p><p>${L('التاريخ', 'Date')}: ${esc(snapshot.createdAt || '')}</p>${marker}</div><table><thead><tr><th>${L('الصنف', 'Item')}</th><th>${L('الكمية', 'Qty')}</th><th>${L('السعر', 'Price')}</th><th>${L('الإجمالي', 'Total')}</th></tr></thead><tbody>${rows}</tbody></table><p>${L('المجموع', 'Subtotal')}: ${number(snapshot.subtotal)}</p><p>${L('الخصم', 'Discount')}: ${number(snapshot.discount)}</p><p>${L('ضريبة القيمة المضافة', 'VAT')}: ${number(snapshot.vat)}</p><p>${L('التوصيل', 'Delivery')}: ${number(snapshot.deliveryFee)}</p><p class="total">${L('الإجمالي', 'Total')}: ${number(snapshot.total)}</p><p>${L('الدفع', 'Payment')}: ${esc(snapshot.paymentMethod)}</p><p class="center">${esc(snapshot.etaUuid || '')}</p><script>window.onload=()=>window.print()<\/script></body></html>`;
  win.document.write(doc);
  win.document.close();
  return true;
}

export default function InvoiceActions({ invoiceId, compact = false }: { invoiceId?: string | null; compact?: boolean }) {
  const locale = useLocale();
  const isAr = locale === 'ar';
  const [busy, setBusy] = useState<'view' | 'reprint' | ''>('');
  const [error, setError] = useState('');

  if (!invoiceId) return <span className="text-[10px] text-slate-500">{isAr ? 'لا توجد فاتورة' : 'No invoice'}</span>;

  const load = async () => {
    const response = await apiFetch(`/api/admin/tax-invoices/${invoiceId}`, 'GET') as { invoice?: { snapshot?: Snapshot } };
    return response.invoice?.snapshot;
  };

  const view = async () => {
    setBusy('view'); setError('');
    try {
      const snapshot = await load();
      if (!snapshot) throw new Error(isAr ? 'لا توجد بيانات فاتورة' : 'Invoice data unavailable');
      if (!printSnapshot(snapshot, false, undefined, isAr)) throw new Error(isAr ? 'اسمح بالنوافذ المنبثقة للطباعة' : 'Allow pop-ups to print');
    } catch (err) {
      const message = err instanceof Error ? err.message : (isAr ? 'تعذر فتح الفاتورة' : 'Unable to open invoice');
      setError(message);
    } finally { setBusy(''); }
  };

  const reprint = async () => {
    setBusy('reprint'); setError('');
    try {
      const requestId = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `reprint-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const result = await apiFetch(`/api/admin/tax-invoices/${invoiceId}`, 'POST', { requestId, locale, reason: isAr ? 'إعادة طباعة من الطلب' : 'Reprint from orders' }) as { copyNumber?: number };
      const snapshot = await load();
      if (!snapshot) throw new Error(isAr ? 'لا توجد بيانات فاتورة' : 'Invoice data unavailable');
      if (!printSnapshot(snapshot, true, result.copyNumber, isAr)) throw new Error(isAr ? 'اسمح بالنوافذ المنبثقة للطباعة' : 'Allow pop-ups to print');
    } catch (err) {
      const message = err instanceof Error ? err.message : (isAr ? 'تعذر إعادة الطباعة' : 'Unable to reprint');
      setError(message);
    } finally { setBusy(''); }
  };

  return <span className="inline-flex flex-wrap items-center gap-1.5 align-middle">
    <button type="button" onClick={view} disabled={Boolean(busy)} className={`${compact ? 'min-h-[36px] px-2' : 'min-h-[44px] px-3'} rounded-lg border border-slate-600 text-slate-200 text-[10px] font-bold hover:bg-slate-800 disabled:opacity-50`} title={isAr ? 'عرض وطباعة الفاتورة' : 'View and print invoice'}>
      <Printer className="w-3.5 h-3.5 inline-block" /> {busy === 'view' ? '…' : (isAr ? 'عرض الفاتورة' : 'View invoice')}
    </button>
    <button type="button" onClick={reprint} disabled={Boolean(busy)} className={`${compact ? 'min-h-[36px] px-2' : 'min-h-[44px] px-3'} rounded-lg border border-amber-500/40 text-amber-300 text-[10px] font-bold hover:bg-amber-500/10 disabled:opacity-50`} title={isAr ? 'إعادة طباعة مع تسجيلها' : 'Reprint and audit'}>
      <RotateCcw className="w-3.5 h-3.5 inline-block" /> {busy === 'reprint' ? '…' : (isAr ? 'إعادة الطباعة' : 'Reprint')}
    </button>
    {error && <span role="alert" className="status-danger rounded border px-1.5 py-1 text-[9px]">{error}</span>}
  </span>;
}
