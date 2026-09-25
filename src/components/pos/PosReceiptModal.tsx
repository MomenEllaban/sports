'use client';

import React from 'react';
import { Printer, CheckCircle2, PlusCircle } from 'lucide-react';
import { Button, DialogFrame } from '@/components/ui/foundation';

function escapeHtml(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[char] || char);
}

export interface PosReceiptData {
  saleNumber: string;
  branchName: string;
  cashierName: string;
  createdAt: string;
  items: Array<{
    nameAr: string;
    quantity: number;
    unitPrice: number;
  }>;
  subtotal: number;
  discount: number;
  vat: number;
  total: number;
  paymentMethod: string;
  tendered?: number;
  change?: number;
  customerName?: string;
  customerPhone?: string;
}

export default function PosReceiptModal({
  isOpen,
  onClose,
  data,
  onNewSale,
}: {
  isOpen: boolean;
  onClose: () => void;
  data: PosReceiptData | null;
  onNewSale: () => void;
}) {
  if (!isOpen || !data) return null;

  const handlePrint = () => {
    const printWindow = window.open('', '_blank', 'width=420,height=700');
    if (!printWindow) return;

    const saleNumber = escapeHtml(data.saleNumber);
    const branchName = escapeHtml(data.branchName);
    const cashierName = escapeHtml(data.cashierName);
    const customerName = escapeHtml(data.customerName);
    const customerPhone = escapeHtml(data.customerPhone);
    const paymentMethod = escapeHtml(data.paymentMethod);
    const itemRows = data.items.map((item) => `
      <div class="item-row">
        <div class="bold">${escapeHtml(item.nameAr)}</div>
        <div class="row">
          <span>${item.quantity} × ${item.unitPrice.toFixed(2)}</span>
          <span class="bold">${(item.quantity * item.unitPrice).toFixed(2)} ج.م</span>
        </div>
      </div>
    `).join('');

    printWindow.document.write(`
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
        <head>
          <meta charset="utf-8">
          <title>فاتورة كاشير - ${saleNumber}</title>
          <style>
            body {
              font-family: 'Courier New', Courier, monospace, sans-serif;
              font-size: 12px;
              line-height: 1.35;
              color: #000;
              margin: 10px;
              width: 290px;
            }
            .text-center { text-align: center; }
            .text-left { text-align: left; }
            .bold { font-weight: bold; }
            .divider { border-top: 1px dashed #222; margin: 6px 0; }
            .row { display: flex; justify-content: space-between; margin: 2px 0; }
            .title { font-size: 16px; font-weight: bold; margin-bottom: 2px; }
            .subtitle { font-size: 11px; margin-bottom: 4px; }
            .item-row { margin: 4px 0; }
            .barcode { font-family: monospace; font-size: 14px; letter-spacing: 2px; }
            @media print {
              body { margin: 0; width: 100%; }
              @page { margin: 0; size: 80mm auto; }
            }
          </style>
        </head>
        <body>
          <div class="text-center">
            <div class="title">SPORTS CHAMPIONS</div>
            <div class="subtitle">المتجر الرائد للملابس والمعدات الرياضية</div>
            <div>الإسكندرية - ${branchName}</div>
            <div>هاتف: 03 5926908 | واتساب: 01224226876</div>
            <div class="divider"></div>
            <div class="bold">فاتورة بيع ضريبية مبسطة</div>
            <div>رقم: ${saleNumber}</div>
            <div>التاريخ: ${new Date(data.createdAt).toLocaleString('ar-EG')}</div>
            <div>الكاشير: ${cashierName}</div>
            ${customerName ? `<div>العميل: ${customerName} (${customerPhone})</div>` : ''}
            <div class="divider"></div>
          </div>

          <div class="bold row">
            <span>الصنف</span>
            <span>الكمية × السعر</span>
            <span>الإجمالي</span>
          </div>
          <div class="divider"></div>

          ${itemRows}

          <div class="divider"></div>
          <div class="row"><span>المجموع الفرعي:</span><span>${data.subtotal.toFixed(2)} ج.م</span></div>
          ${data.discount > 0 ? `<div class="row bold"><span>خصم مطبق:</span><span>-${data.discount.toFixed(2)} ج.م</span></div>` : ''}
          <div class="row"><span>ضريبة القيمة المضافة (14%):</span><span>${data.vat.toFixed(2)} ج.م</span></div>
          <div class="divider"></div>
          <div class="row bold" style="font-size: 14px;">
            <span>الصافي المطلوب:</span>
            <span>${data.total.toFixed(2)} ج.م</span>
          </div>

          <div class="divider"></div>
          <div class="row"><span>طريقة الدفع:</span><span>${paymentMethod}</span></div>
          ${data.tendered ? `<div class="row"><span>المبلغ المستلم:</span><span>${data.tendered.toFixed(2)} ج.م</span></div>` : ''}
          ${data.change !== undefined ? `<div class="row bold"><span>الباقي للعميل:</span><span>${data.change.toFixed(2)} ج.م</span></div>` : ''}

          <div class="divider"></div>
          <div class="text-center" style="margin-top: 8px;">
            <div class="barcode">||| |||| || ||||| |||</div>
            <div style="font-size: 10px; margin-top: 4px;">الاستبدال والاسترجاع خلال 14 يوماً بالفاتورة بحالتها الأصلية</div>
            <div class="bold" style="margin-top: 4px;">شكراً لزيارتكم!</div>
          </div>
          <script>window.onload = function() { window.print(); }<\/script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <DialogFrame
      title="تم تسجيل الفاتورة بنجاح"
      onClose={onClose}
      size="md"
      panelClassName="max-w-md border-emerald-500/40 bg-slate-950"
      bodyClassName="space-y-5"
      footer={(
        <div className="grid w-full gap-2 sm:grid-cols-2">
          <Button type="button" variant="brand" onClick={handlePrint} className="w-full">
            <Printer className="h-4 w-4" />
            <span>طباعة الإيصال الحراري (80mm)</span>
          </Button>
          <button
            type="button"
            onClick={() => {
              onClose();
              onNewSale();
            }}
            className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-2xl bg-slate-800 text-xs font-bold text-slate-200 hover:bg-slate-700"
          >
            <PlusCircle className="h-4 w-4" />
            <span>فاتورة جديدة للعميل القادم</span>
          </button>
        </div>
      )}
    >
      <div className="space-y-2 text-center">
        <div className="mx-auto flex h-14 w-14 animate-scale-in items-center justify-center rounded-full border border-emerald-500/40 bg-emerald-500/20 text-emerald-400">
          <CheckCircle2 className="h-8 w-8" />
        </div>
        <p className="font-mono text-xs text-slate-400">
          رقم الفاتورة: <strong className="text-amber-400">{data.saleNumber}</strong>
        </p>
      </div>

      <div className="space-y-2 rounded-2xl border border-slate-300 bg-white p-4 font-mono text-[11px] text-slate-950 shadow-inner">
        <div className="border-b border-dashed border-slate-400 pb-2 text-center">
          <div className="text-sm font-black">SPORTS CHAMPIONS</div>
          <div className="text-[10px] text-slate-600">{data.branchName}</div>
          <div className="text-[10px] text-slate-600">{new Date(data.createdAt).toLocaleString('ar-EG')}</div>
        </div>

        <div className="app-scrollbar max-h-36 space-y-1 overflow-y-auto py-1 pr-1">
          {data.items.map((it, idx) => (
            <div key={idx} className="flex items-center justify-between text-[10px]">
              <span className="line-clamp-1 flex-1 font-sans">{it.nameAr} x{it.quantity}</span>
              <span className="shrink-0 font-bold tabular-nums">{(it.quantity * it.unitPrice).toLocaleString()} ج.م</span>
            </div>
          ))}
        </div>

        <div className="space-y-1 border-t border-dashed border-slate-400 pt-2">
          <div className="flex justify-between"><span>المجموع:</span><span>{data.subtotal.toLocaleString()} ج.م</span></div>
          {data.discount > 0 && <div className="flex justify-between font-bold text-emerald-700"><span>الخصم:</span><span>-{data.discount.toLocaleString()} ج.م</span></div>}
          <div className="flex justify-between border-t border-slate-200 pt-1 text-xs font-black"><span>المدفوع ({data.paymentMethod}):</span><span>{data.total.toLocaleString()} ج.م</span></div>
          {data.change !== undefined && data.change > 0 && <div className="flex justify-between text-[10px] text-slate-600"><span>الباقي:</span><span>{data.change.toLocaleString()} ج.م</span></div>}
        </div>
      </div>
    </DialogFrame>
  );
}
