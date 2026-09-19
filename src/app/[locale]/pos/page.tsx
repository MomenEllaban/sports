'use client';

import React, { useState, useEffect, useRef } from 'react';
import { usePosStore } from '@/store/posStore';
import { ShoppingCart, Search, Barcode, Printer, User, Check, Tag, Award, X } from 'lucide-react';
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

  // Customer lookup state
  const [customerPhone, setCustomerPhone] = useState('');
  const [customer, setCustomer] = useState<{ id: string; name: string | null; phone: string; loyaltyPoints: number } | null>(null);
  const [customerSearching, setCustomerSearching] = useState(false);
  const [customerError, setCustomerError] = useState('');
  const [showQuickCustomerModal, setShowQuickCustomerModal] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newCustomerPhone, setNewCustomerPhone] = useState('');
  const [newCustomerLoading, setNewCustomerLoading] = useState(false);
  const customerInputRef = useRef<HTMLInputElement>(null);

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
    offlineQueue,
    queueOfflineSale,
    clearOfflineQueue,
  } = usePosStore();
  const [loadError, setLoadError] = useState('');
  const [saleError, setSaleError] = useState('');
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    fetchPosProducts();
  }, []);

  const fetchPosProducts = async () => {
    try {
      setLoading(true);
      setLoadError('');
      const res = await fetch('/api/pos/products');
      const data = await res.json();
      if (data.success) {
        setProducts(data.products);
      } else {
        setLoadError('تعذر تحميل المنتجات من السيرفر.');
      }
    } catch {
      setLoadError('تعذر الاتصال بالسيرفر. تحقق من الإنترنت وحاول مجدداً.');
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

  const searchCustomer = async () => {
    if (!customerPhone || customerPhone.length < 5) return;
    setCustomerSearching(true);
    setCustomerError('');
    try {
      const res = await fetch(`/api/pos/customer?phone=${encodeURIComponent(customerPhone)}`);
      const data = await res.json();
      if (data.success) {
        setCustomer(data.customer);
        setCustomerError('');
      } else {
        setCustomer(null);
        setCustomerError('العميل غير موجود — سيتم البيع بدون ربط');
      }
    } catch {
      setCustomerError('تعذر البحث');
    } finally {
      setCustomerSearching(false);
    }
  };

  const clearCustomer = () => {
    setCustomer(null);
    setCustomerPhone('');
    setCustomerError('');
  };

  const handleCreateQuickCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustomerName.trim() || !newCustomerPhone.trim()) return;
    setNewCustomerLoading(true);
    try {
      const res = await fetch('/api/pos/customer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newCustomerName.trim(), phone: newCustomerPhone.trim() }),
      });
      const data = await res.json();
      if (data.success && data.customer) {
        setCustomer(data.customer);
        setShowQuickCustomerModal(false);
        setNewCustomerName('');
        setNewCustomerPhone('');
        setCustomerError('');
      } else {
        setCustomerError(data.error || 'فشل إضافة العميل');
      }
    } catch {
      setCustomerError('فشل الاتصال لإضافة العميل');
    } finally {
      setNewCustomerLoading(false);
    }
  };

  const handleCompleteSale = async (payMethod: 'CASH' | 'CARD' | 'INSTAPAY') => {
    if (ticketItems.length === 0) return;
    setSaleError('');

    const payload = {
      paymentMethod: payMethod,
      discountAmount,
      customerId: customer?.id || null,
      items: ticketItems.map((i) => ({
        productId: i.id,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
      })),
    };

    try {
      const res = await fetch('/api/pos/sale', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
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
        setSaleError(data.error || 'حدث خطأ أثناء حفظ الفاتورة.');
      }
    } catch {
      // Offline mode: queue the sale locally and sync later
      queueOfflineSale({
        id: `offline-${Date.now()}`,
        saleNumber: `OFFLINE-${Date.now()}`,
        branchId: '',
        cashierId: '',
        items: ticketItems.map((i) => ({ ...i })),
        subtotal: getSubtotal(),
        taxAmount: getVatAmount(),
        discountAmount,
        totalAmount: getTotalAmount(),
        paymentMethod: payMethod,
        timestamp: new Date().toISOString(),
      });
      clearTicket();
    }
  };

  const handleSyncOffline = async () => {
    if (offlineQueue.length === 0 || syncing) return;
    setSyncing(true);
    setSaleError('');
    const remaining: typeof offlineQueue = [];
    for (const sale of offlineQueue) {
      try {
        const res = await fetch('/api/pos/sale', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            paymentMethod: sale.paymentMethod,
            discountAmount: sale.discountAmount,
            items: sale.items.map((i) => ({ productId: i.id, quantity: i.quantity, unitPrice: i.unitPrice })),
          }),
        });
        const data = await res.json();
        if (!data.success) remaining.push(sale);
      } catch {
        remaining.push(sale);
      }
    }
    clearOfflineQueue();
    remaining.forEach((s) => queueOfflineSale(s));
    if (remaining.length > 0) {
      setSaleError(`تعذر مزامنة ${remaining.length} فاتورة. سيُعاد المحاولة لاحقاً.`);
    }
    setSyncing(false);
    fetchPosProducts();
  };

  return (
    <div className="h-screen w-screen bg-slate-950 text-slate-100 flex flex-col overflow-hidden font-sans dir-rtl">
      {/* POS Top Header Bar */}
      <header className="h-14 bg-slate-900 border-b border-slate-800 px-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <Image
            src="/logo.avif"
            alt="أبطال الرياضة"
            width={960}
            height={822}
            quality={85}
            sizes="40px"
            className="h-10 w-auto rounded-lg object-contain drop-shadow-[0_0_8px_rgba(245,166,35,0.35)]"
          />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-bold text-sm text-slate-100 leading-tight">
                كاشير - فرع الإبراهيمية الرئيسي
              </h1>
              <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-400 font-black text-[10px] border border-amber-500/30">
                POS
              </span>
            </div>
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
            <label htmlFor="pos-search" className="block text-[11px] font-bold text-slate-400 mb-1">
              بحث المنتجات (باركود / اسم / SKU)
            </label>
            <input
              id="pos-search"
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="امسح البار كود أو ابحث باسم المنتج / SKU..."
              aria-label="بحث المنتجات بالباركود أو الاسم"
              className="w-full pl-10 pr-4 py-3 rounded-2xl bg-slate-900 border border-slate-800 text-sm font-semibold text-slate-100 focus:outline-none focus:border-amber-500 shadow-inner placeholder:text-slate-500"
              autoFocus
            />
            <Barcode className="w-5 h-5 text-amber-400 absolute left-3 top-9" />
          </div>

          {/* Products Quick Touch Grid */}
          <div className="flex-1 overflow-y-auto pr-1">
            {loading ? (
              <div className="text-center text-xs text-slate-500 py-12">جاري تحميل المنتجات...</div>
            ) : loadError ? (
              <div className="text-center text-xs py-12 space-y-3">
                <p className="text-rose-400 font-bold">{loadError}</p>
                <button onClick={fetchPosProducts} className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold">
                  إعادة المحاولة
                </button>
              </div>
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

          {/* Customer Search Section */}
          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2 text-xs shrink-0">
            <div className="flex justify-between items-center">
              <span className="font-bold text-slate-300 flex items-center gap-1">
                <User className="w-3.5 h-3.5 text-blue-400" />
                العميل (اختياري):
              </span>
              {customer && (
                <button onClick={clearCustomer} className="text-rose-400 hover:text-rose-300">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            {customer ? (
              <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/30 flex items-center justify-between">
                <div>
                  <div className="font-bold text-blue-300">{customer.name || customer.phone}</div>
                  <div className="text-[10px] text-slate-400 flex items-center gap-1">
                    <Award className="w-3 h-3 text-amber-400" />
                    {customer.loyaltyPoints} نقطة ولاء
                  </div>
                </div>
                <Check className="w-4 h-4 text-emerald-400" />
              </div>
            ) : (
              <div className="space-y-1.5">
                <div className="grid grid-cols-12 gap-2">
                  <input
                    ref={customerInputRef}
                    type="tel"
                    placeholder="رقم موبايل العميل..."
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && searchCustomer()}
                    className="col-span-9 p-2 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-100"
                    dir="ltr"
                  />
                  <button
                    onClick={searchCustomer}
                    disabled={customerSearching}
                    className="col-span-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white font-bold rounded-lg text-xs flex items-center justify-center"
                  >
                    {customerSearching ? '...' : <Search className="w-3.5 h-3.5" />}
                  </button>
                </div>
                <div className="flex items-center justify-between">
                  {customerError ? (
                    <p className="text-[10px] text-amber-400">{customerError}</p>
                  ) : <span />}
                  <button
                    type="button"
                    onClick={() => {
                      setNewCustomerPhone(customerPhone);
                      setShowQuickCustomerModal(true);
                    }}
                    className="text-[10px] text-blue-400 hover:text-blue-300 font-bold underline"
                  >
                    + عميل جديد سريع
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Discounts & Totals Drawer */}
          <div className="space-y-3 pt-3 border-t border-slate-800 shrink-0">
            {saleError && (
              <div role="alert" className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-bold">
                {saleError}
              </div>
            )}
            {offlineQueue.length > 0 && (
              <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-bold flex justify-between items-center">
                <span>فواتير معلقة (عدم اتصال): {offlineQueue.length}</span>
                <button onClick={handleSyncOffline} disabled={syncing} className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-slate-950 font-bold">
                  {syncing ? 'جاري المزامنة...' : 'مزامنة الآن'}
                </button>
              </div>
            )}
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
                <div className="col-span-5">
                  <label htmlFor="pos-discount" className="block text-[10px] font-bold text-slate-400 mb-1">مبلغ الخصم (ج.م)</label>
                  <input
                    id="pos-discount"
                    type="number"
                    min={0}
                    placeholder="مثال: 50"
                    value={discountInput}
                    onChange={(e) => setDiscountInput(e.target.value)}
                    className="w-full p-2 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-100 placeholder:text-slate-500"
                  />
                </div>
                <div className="col-span-4">
                  <label htmlFor="pos-pin" className="block text-[10px] font-bold text-slate-400 mb-1">PIN المدير</label>
                  <input
                    id="pos-pin"
                    type="password"
                    inputMode="numeric"
                    placeholder="1234"
                    value={managerPin}
                    onChange={(e) => setManagerPin(e.target.value)}
                    className="w-full p-2 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-100 placeholder:text-slate-500"
                  />
                </div>
                <div className="col-span-3 flex items-end">
                  <button
                    onClick={handleApplyDiscount}
                    aria-label="تطبيق الخصم"
                    className="w-full py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg text-xs"
                  >
                    تطبيق
                  </button>
                </div>
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
              <p className="text-[11px] text-slate-600">
                هاتف: <span dir="ltr" className="tabular-nums font-bold">03 5926908</span> | واتساب: <span dir="ltr" className="tabular-nums font-bold">0122 422 6876</span>
              </p>
              <p className="text-[10px] text-slate-500">ر.ض: <span dir="ltr" className="tabular-nums font-medium">123-456-789</span></p>
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
                className="py-2.5 rounded-xl bg-slate-900 text-slate-100 font-bold text-xs flex items-center justify-center gap-1"
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

      {/* Quick Customer Modal */}
      {showQuickCustomerModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-sm space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="font-extrabold text-sm text-slate-100 flex items-center gap-2">
                <User className="w-4 h-4 text-blue-400" />
                إضافة عميل سريع
              </h3>
              <button
                onClick={() => setShowQuickCustomerModal(false)}
                className="text-slate-400 hover:text-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateQuickCustomer} className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1">
                  اسم العميل *
                </label>
                <input
                  type="text"
                  required
                  placeholder="مثال: أحمد مصطفى"
                  value={newCustomerName}
                  onChange={(e) => setNewCustomerName(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100 focus:border-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1">
                  رقم الموبايل *
                </label>
                <input
                  type="tel"
                  required
                  placeholder="مثال: 01012345678"
                  value={newCustomerPhone}
                  onChange={(e) => setNewCustomerPhone(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100 focus:border-blue-500 outline-none"
                  dir="ltr"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={newCustomerLoading}
                  className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white font-bold text-xs flex items-center justify-center gap-1 shadow-lg shadow-blue-600/20"
                >
                  {newCustomerLoading ? 'جاري الحفظ...' : 'حفظ وتثبيت بالفاتورة'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowQuickCustomerModal(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

