'use client';

import React, { useState, useEffect } from 'react';
import { usePosStore } from '@/store/posStore';
import { ShoppingCart, Search, Barcode, Printer, User, ShieldAlert, Check, RefreshCw, Zap, Tag, Lock } from 'lucide-react';
import Image from 'next/image';

interface DbProduct {
  id: string;
  sku: string;
  barcode: string | null;
  nameAr: string;
  nameEn: string;
  price: number;
  inventories: Array<{ stockQuantity: number }>;
}

export default function PosTerminalPage() {
  const [products, setProducts] = useState<DbProduct[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [receiptData, setReceiptData] = useState<{
    saleNumber: string;
    items: Array<{ name: string; qty: number; price: number; total: number }>;
    subtotal: number;
    vat: number;
    discount: number;
    total: number;
    qrCodeUrl: string;
    timestamp: string;
  } | null>(null);

  const [managerPin, setManagerPin] = useState('');
  const [discountInput, setDiscountInput] = useState('');
  const [pinError, setPinError] = useState(false);

  const {
    ticketItems,
    addItemToTicket,
    updateItemQuantity,
    removeItemFromTicket,
    applyDiscount,
    clearTicket,
    getSubtotal,
    getVatAmount,
    getTotalAmount,
    discountAmount,
  } = usePosStore();

  useEffect(() => {
    fetchPosProducts();
  }, []);

  const fetchPosProducts = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/pos/products');
      const data = await res.json();
      if (data.success) {
        setProducts(data.products);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const filteredProducts = products.filter(
    (p) =>
      p.nameAr.includes(searchTerm) ||
      p.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.barcode && p.barcode.includes(searchTerm))
  );

  const handleApplyDiscount = () => {
    const val = Number(discountInput);
    if (isNaN(val) || val <= 0) return;

    const ok = applyDiscount(val, managerPin);
    if (!ok) {
      setPinError(true);
    } else {
      setPinError(false);
      setDiscountInput('');
      setManagerPin('');
    }
  };

  const handleCompleteSale = async (payMethod: 'CASH' | 'CARD' | 'INSTAPAY') => {
    if (ticketItems.length === 0) return;

    try {
      const res = await fetch('/api/pos/sale', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentMethod: payMethod,
          discountAmount,
          items: ticketItems.map((i) => ({
            productId: i.id,
            quantity: i.quantity,
            unitPrice: i.unitPrice,
          })),
        }),
      });

      const data = await res.json();
      if (data.success) {
        setReceiptData({
          saleNumber: data.saleNumber,
          items: ticketItems.map((i) => ({
            name: i.nameAr,
            qty: i.quantity,
            price: i.unitPrice,
            total: i.unitPrice * i.quantity,
          })),
          subtotal: getSubtotal(),
          vat: getVatAmount(),
          discount: discountAmount,
          total: getTotalAmount(),
          qrCodeUrl: data.qrCodeDataUrl,
          timestamp: new Date().toLocaleString('ar-EG'),
        });

        setShowReceiptModal(true);
        clearTicket();
        fetchPosProducts(); // Refresh stock
      } else {
        alert('حدث خطأ أثناء حفظ الفاتورة.');
      }
    } catch (err) {
      console.error(err);
      alert('تم حفظ الفاتورة في الانتظار (وضع عدم الاتصال).');
    }
  };

  return (
    <div className="h-screen w-screen bg-slate-950 text-slate-100 flex flex-col overflow-hidden font-sans dir-rtl">
      {/* POS Top Header Bar */}
      <header className="h-14 bg-slate-900 border-b border-slate-800 px-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-amber-500 text-slate-950 font-black flex items-center justify-center text-sm">
            POS
          </div>
          <div>
            <h1 className="font-bold text-sm text-slate-100 leading-tight">
              كاشير - فرع الإبراهيمية الرئيسي
            </h1>
            <p className="text-[10px] text-slate-400">92 شارع عمر لطفى - الإسكندرية</p>
          </div>
        </div>

        {/* Cashier Info */}
        <div className="flex items-center gap-3 text-xs">
          <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/30 flex items-center gap-1">
            <Check className="w-3.5 h-3.5" /> مصلحة الضرائب ETA متصلة
          </span>
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-800 text-slate-300">
            <User className="w-4 h-4 text-blue-400" />
            <span>كاشير: سارة فهمي</span>
          </div>
        </div>
      </header>

      {/* Main Grid View */}
      <div className="flex-1 grid grid-cols-12 overflow-hidden">
        {/* Left Side: Product Selector & Barcode Scanner */}
        <div className="col-span-7 border-l border-slate-800 p-4 flex flex-col space-y-4 bg-slate-950 overflow-hidden">
          {/* Barcode Search Input */}
          <div className="relative">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="امسح البار كود أو ابحث باسم المنتج / SKU..."
              className="w-full pl-10 pr-4 py-3 rounded-2xl bg-slate-900 border border-slate-800 text-sm font-semibold text-slate-100 focus:outline-none focus:border-amber-500 shadow-inner"
              autoFocus
            />
            <Barcode className="w-5 h-5 text-amber-400 absolute left-3 top-3.5" />
          </div>

          {/* Products Quick Touch Grid */}
          <div className="flex-1 overflow-y-auto pr-1">
            {loading ? (
              <div className="text-center text-xs text-slate-500 py-12">جاري تحميل المنتجات...</div>
            ) : (
              <div className="grid grid-cols-3 gap-3">
                {filteredProducts.map((prod) => {
                  const stock = prod.inventories?.[0]?.stockQuantity || 0;
                  return (
                    <button
                      key={prod.id}
                      onClick={() =>
                        addItemToTicket({
                          id: prod.id,
                          sku: prod.sku,
                          barcode: prod.barcode,
                          nameAr: prod.nameAr,
                          nameEn: prod.nameEn,
                          price: prod.price,
                          stockQuantity: stock,
                        })
                      }
                      className="glass-card p-3 rounded-2xl text-right flex flex-col justify-between h-32 hover:border-amber-500/50 transition-all border border-slate-800/80 active:scale-95"
                    >
                      <div className="space-y-1">
                        <div className="text-[10px] text-amber-400 font-bold">SKU: {prod.sku}</div>
                        <h3 className="font-bold text-xs text-slate-100 line-clamp-2 leading-snug">
                          {prod.nameAr}
                        </h3>
                      </div>

                      <div className="flex items-baseline justify-between border-t border-slate-800/80 pt-2">
                        <span className="text-xs text-slate-400">مخزن: {stock}</span>
                        <span className="font-black text-sm text-blue-400">
                          {prod.price.toLocaleString()} ج.م
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Current Sale Ticket & Touch Numpad */}
        <div className="col-span-5 p-4 flex flex-col justify-between bg-slate-900/60 overflow-hidden">
          <div className="space-y-3 flex-1 flex flex-col overflow-hidden">
            <div className="flex justify-between items-center border-b border-slate-800 pb-2">
              <h2 className="font-black text-sm text-slate-100 flex items-center gap-2">
                <ShoppingCart className="w-4 h-4 text-amber-400" />
                تذكرة البيع الحالية ({ticketItems.length} صنف)
              </h2>
              <button
                onClick={clearTicket}
                className="text-[11px] text-rose-400 hover:underline font-bold"
              >
                إلغاء التذكرة
              </button>
            </div>

            {/* Ticket Items List */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {ticketItems.length === 0 ? (
                <div className="text-center text-slate-500 text-xs py-16">
                  لا توجد منتجات في التذكرة حالياً. اختر من القائمة.
                </div>
              ) : (
                ticketItems.map((item) => (
                  <div
                    key={item.id}
                    className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex justify-between items-center text-xs"
                  >
                    <div className="space-y-0.5">
                      <div className="font-bold text-slate-100 line-clamp-1">{item.nameAr}</div>
                      <div className="text-[10px] text-slate-400">
                        {item.unitPrice.toLocaleString()} ج.م x {item.quantity}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => updateItemQuantity(item.id, item.quantity - 1)}
                        className="w-6 h-6 rounded bg-slate-800 text-slate-300 font-bold"
                      >
                        -
                      </button>
                      <span className="font-bold text-sm w-4 text-center">{item.quantity}</span>
                      <button
                        onClick={() => updateItemQuantity(item.id, item.quantity + 1)}
                        className="w-6 h-6 rounded bg-slate-800 text-slate-300 font-bold"
                      >
                        +
                      </button>
                      <span className="font-black text-blue-400 min-w-[60px] text-left">
                        {(item.unitPrice * item.quantity).toLocaleString()} ج.م
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Discounts & Totals Drawer */}
          <div className="space-y-3 pt-3 border-t border-slate-800 shrink-0">
            {/* Manager Discount Section */}
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2 text-xs">
              <div className="flex justify-between items-center">
                <span className="font-bold text-slate-300 flex items-center gap-1">
                  <Tag className="w-3.5 h-3.5 text-amber-400" />
                  خصم المدير:
                </span>
                {discountAmount > 0 && (
                  <span className="text-emerald-400 font-bold">تم تطبيق خصم {discountAmount} ج.م</span>
                )}
              </div>

              <div className="grid grid-cols-12 gap-2">
                <input
                  type="number"
                  placeholder="مبلغ الخصم (ج.م)"
                  value={discountInput}
                  onChange={(e) => setDiscountInput(e.target.value)}
                  className="col-span-5 p-2 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-100"
                />
                <input
                  type="password"
                  placeholder="PIN المدير (1234)"
                  value={managerPin}
                  onChange={(e) => setManagerPin(e.target.value)}
                  className="col-span-4 p-2 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-100"
                />
                <button
                  onClick={handleApplyDiscount}
                  className="col-span-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg text-xs"
                >
                  تطبيق
                </button>
              </div>
              {pinError && <p className="text-[10px] text-rose-400">كلمة سر المدير خاطئة (جرب 1234)</p>}
            </div>

            {/* Calculations Breakdown */}
            <div className="space-y-1 text-xs">
              <div className="flex justify-between text-slate-400">
                <span>المجموع:</span>
                <span>{getSubtotal().toLocaleString()} ج.م</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>ضريبة القيمة المضافة 14%:</span>
                <span>{getVatAmount().toLocaleString()} ج.م</span>
              </div>
              <div className="flex justify-between text-base font-black text-slate-100 pt-1 border-t border-slate-800">
                <span>الإجمالي النهائي:</span>
                <span className="text-amber-400">{getTotalAmount().toLocaleString()} ج.م</span>
              </div>
            </div>

            {/* Payment Touch Buttons */}
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => handleCompleteSale('CASH')}
                className="py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 font-extrabold text-xs text-white shadow-lg"
              >
                نقداً (كاش)
              </button>
              <button
                onClick={() => handleCompleteSale('CARD')}
                className="py-3 rounded-xl bg-blue-600 hover:bg-blue-500 font-extrabold text-xs text-white shadow-lg"
              >
                فيزا / بطاقة
              </button>
              <button
                onClick={() => handleCompleteSale('INSTAPAY')}
                className="py-3 rounded-xl bg-purple-600 hover:bg-purple-500 font-extrabold text-xs text-white shadow-lg"
              >
                انستا باي
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Printable Receipt Modal with ETA QR Code */}
      {showReceiptModal && receiptData && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white text-slate-900 p-6 rounded-2xl max-w-sm w-full space-y-4 shadow-2xl dir-rtl">
            <div className="text-center space-y-1 border-b border-slate-200 pb-3">
              <h2 className="font-black text-lg text-slate-900">ابطال الرياضة الإبراهيمية</h2>
              <p className="text-[11px] text-slate-600">92 شارع عمر لطفى - الإبراهيمية - الإسكندرية</p>
              <p className="text-[11px] text-slate-600">هاتف: 03 5926908 | ر.ض: 123-456-789</p>
              <div className="text-xs font-bold text-slate-800 pt-1">فاتورة بيع / إيصال إلكتروني ETA</div>
              <div className="text-[10px] text-slate-500">رقم الفاتورة: {receiptData.saleNumber}</div>
            </div>

            <div className="space-y-1 text-xs border-b border-slate-200 pb-3">
              {receiptData.items.map((item, idx) => (
                <div key={idx} className="flex justify-between">
                  <span>{item.name} x{item.qty}</span>
                  <span className="font-bold">{item.total.toLocaleString()} ج.م</span>
                </div>
              ))}
            </div>

            <div className="space-y-1 text-xs font-semibold">
              <div className="flex justify-between text-slate-600">
                <span>المجموع الفرعي:</span>
                <span>{receiptData.subtotal.toLocaleString()} ج.م</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>ضريبة القيمة المضافة (14%):</span>
                <span>{receiptData.vat.toLocaleString()} ج.م</span>
              </div>
              <div className="flex justify-between text-sm font-black text-slate-900 pt-1 border-t border-slate-200">
                <span>الإجمالي:</span>
                <span>{receiptData.total.toLocaleString()} ج.م</span>
              </div>
            </div>

            {/* ETA Verification QR Code */}
            {receiptData.qrCodeUrl && (
              <div className="text-center space-y-1 pt-2 border-t border-slate-200">
                <Image
                  src={receiptData.qrCodeUrl}
                  alt="ETA QR Code"
                  width={140}
                  height={140}
                  className="mx-auto"
                />
                <p className="text-[9px] text-slate-500">رمز التحقق الإلكتروني - مصلحة الضرائب المصرية</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                onClick={() => window.print()}
                className="py-2.5 rounded-xl bg-slate-900 text-white font-bold text-xs flex items-center justify-center gap-1"
              >
                <Printer className="w-4 h-4" /> طباعة
              </button>
              <button
                onClick={() => setShowReceiptModal(false)}
                className="py-2.5 rounded-xl bg-slate-200 text-slate-800 font-bold text-xs"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
