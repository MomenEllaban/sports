'use client';

import React from 'react';
import { Printer, CheckCircle2, PlusCircle } from 'lucide-react';
import { Button } from '@/components/ui/foundation';

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div
        className="w-full max-w-md glass-panel p-6 rounded-3xl border border-emerald-500/40 shadow-2xl bg-slate-950 text-slate-100 space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-center space-y-2">
          <div className="w-14 h-14 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 mx-auto flex items-center justify-center animate-scale-in">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-black text-slate-100">تم تسجيل الفاتورة بنجاح!</h2>
          <p className="text-xs text-slate-400 font-mono">
            رقم الفاتورة: <strong className="text-amber-400">{data.saleNumber}</strong>
          </p>
        </div>

        {/* Thermal Receipt Preview Paper Card */}
        <div className="p-4 rounded-2xl bg-white text-slate-950 font-mono text-[11px] shadow-inner space-y-2 border border-slate-300">
          <div className="text-center border-b border-dashed border-slate-400 pb-2">
            <div className="font-black text-sm">SPORTS CHAMPIONS</div>
            <div className="text-[10px] text-slate-600">{data.branchName}</div>
            <div className="text-[10px] text-slate-600">{new Date(data.createdAt).toLocaleString('ar-EG')}</div>
          </div>

          <div className="space-y-1 py-1 max-h-36 overflow-y-auto pr-1">
            {data.items.map((it, idx) => (
              <div key={idx} className="flex justify-between items-center text-[10px]">
                <span className="line-clamp-1 flex-1 font-sans">{it.nameAr} x{it.quantity}</span>
                <span className="font-bold tabular-nums shrink-0">{(it.quantity * it.unitPrice).toLocaleString()} ج.م</span>
              </div>
            ))}
          </div>

          <div className="border-t border-dashed border-slate-400 pt-2 space-y-1">
            <div className="flex justify-between">
              <span>المجموع:</span>
              <span>{data.subtotal.toLocaleString()} ج.م</span>
            </div>
            {data.discount > 0 && (
              <div className="flex justify-between text-emerald-700 font-bold">
                <span>الخصم:</span>
                <span>-{data.discount.toLocaleString()} ج.م</span>
              </div>
            )}
            <div className="flex justify-between font-black text-xs pt-1 border-t border-slate-200">
              <span>المدفوع ({data.paymentMethod}):</span>
              <span>{data.total.toLocaleString()} ج.م</span>
            </div>
            {data.change !== undefined && data.change > 0 && (
              <div className="flex justify-between text-[10px] text-slate-600">
                <span>الباقي:</span>
                <span>{data.change.toLocaleString()} ج.م</span>
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-2 pt-1">
          <Button
            type="button"
            variant="brand"
            onClick={handlePrint}
            className="w-full"
          >
            <Printer className="w-4 h-4" />
            <span>طباعة الإيصال الحراري (80mm)</span>
          </Button>

          <button
            type="button"
            onClick={() => {
              onClose();
              onNewSale();
            }}
            className="w-full py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs flex items-center justify-center gap-2"
          >
            <PlusCircle className="w-4 h-4" />
            <span>فاتورة جديدة للعميل القادم</span>
          </button>
        </div>
      </div>
    </div>
  );
}
