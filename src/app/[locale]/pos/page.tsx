'use client';

import React, { useState, useEffect, useRef } from 'react';
import { usePosStore } from '@/store/posStore';
import { useToast } from '@/components/Toast';
import { LocaleSwitcher, Stepper, ConfirmDialog } from '@/components/ui/foundation';
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
  const { toast } = useToast();
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
    paymentMethod: 'CASH' | 'CARD' | 'INSTAPAY';
    tendered: number;
    change: number;
    reference: string | null;
    customerName: string | null;
    customerPhone: string | null;
    loyaltyEarned: number;
    qrCodeUrl: string;
    timestamp: string;
  } | null>(null);

  const [managerPin, setManagerPin] = useState('');
  const [discountInput, setDiscountInput] = useState('');
  const [pinError, setPinError] = useState(false);

  // Payment step state: method tabs + tendered/change + confirm
  const [payMethod, setPayMethod] = useState<'CASH' | 'CARD' | 'INSTAPAY'>('CASH');
  const [tenderedInput, setTenderedInput] = useState('');
  const [referenceInput, setReferenceInput] = useState('');
  const [processing, setProcessing] = useState(false);

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
  const [lastChange, setLastChange] = useState(0);

  const total = getTotalAmount();
  const tendered = Number(tenderedInput) || 0;
  const change = payMethod === 'CASH' && tenderedInput !== '' ? Math.max(0, Math.round((tendered - total) * 100) / 100) : 0;
  const tenderedShort = payMethod === 'CASH' && tenderedInput !== '' && tendered < total;

  useEffect(() => {
    fetchPosProducts();
    fetchShiftStatus();
  }, []);

  // ── T05 shift gate ─────────────────────────────────────
  const [shift, setShift] = useState<{ id: string; branchId: string; branchName: string; openedAt: string; openingFloat: number } | null>(null);
  const [shiftLoading, setShiftLoading] = useState(true);
  const [openFloat, setOpenFloat] = useState('');
  const [openNote, setOpenNote] = useState('');
  const [openBusy, setOpenBusy] = useState(false);
  const [openError, setOpenError] = useState('');
  const [showClose, setShowClose] = useState(false);
  const [closePreview, setClosePreview] = useState<{ expected: number; openingFloat: number; maxShortage: number } | null>(null);
  const [actualCash, setActualCash] = useState('');
  const [closeNote, setCloseNote] = useState('');
  const [closeBusy, setCloseBusy] = useState(false);
  const [closeError, setCloseError] = useState('');
  const [closeResult, setCloseResult] = useState<{ expected: number; actual: number; difference: number } | null>(null);

  const fetchShiftStatus = async () => {
    try {
      setShiftLoading(true);
      const res = await fetch('/api/pos/shifts');
      const data = await res.json();
      setShift(data.success && data.shift ? data.shift : null);
    } catch {
      setShift(null);
    } finally {
      setShiftLoading(false);
    }
  };

  const handleOpenShift = async (e: React.FormEvent) => {
    e.preventDefault();
    setOpenBusy(true);
    setOpenError('');
    try {
      const res = await fetch('/api/pos/shifts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ branchId: posBranchId || undefined, openingFloat: openFloat === '' ? undefined : Number(openFloat), openNote: openNote || undefined }),
      });
      const data = await res.json();
      if (data.success && data.shift) {
        toast('تم فتح الوردية — ابدأ أول بيعة', 'success');
        setOpenFloat('');
        setOpenNote('');
        await fetchShiftStatus();
        await fetchPosProducts();
      } else {
        setOpenError(data.error || 'تعذر فتح الوردية');
      }
    } catch {
      setOpenError('تعذر الاتصال بالسيرفر');
    } finally {
      setOpenBusy(false);
    }
  };

  const openCloseWizard = async () => {
    if (!shift) return;
    setCloseError('');
    setCloseResult(null);
    try {
      const res = await fetch(`/api/pos/shifts/${shift.id}`);
      const data = await res.json();
      if (data.success) {
        setClosePreview({ expected: data.expected, openingFloat: data.openingFloat, maxShortage: data.maxShortage });
        setShowClose(true);
      } else {
        toast(data.error || 'تعذر جلب الوردية', 'error');
      }
    } catch {
      toast('تعذر الاتصال بالسيرفر', 'error');
    }
  };

  const handleCloseShift = async () => {
    if (!shift || closeBusy) return;
    setCloseBusy(true);
    setCloseError('');
    try {
      const res = await fetch(`/api/pos/shifts/${shift.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actualCash: Number(actualCash), closeNote: closeNote || undefined }),
      });
      const data = await res.json();
      if (data.success) {
        setCloseResult({ expected: data.expected, actual: data.actual, difference: data.difference });
        toast(`أُغلقت الوردية — الفرق ${data.difference}`, 'success');
        clearTicket();
        await fetchShiftStatus();
      } else {
        setCloseError(data.error || 'تعذر إغلاق الوردية');
      }
    } catch {
      setCloseError('تعذر الاتصال بالسيرفر');
    } finally {
      setCloseBusy(false);
    }
  };

  const [activeBranch, setActiveBranch] = useState<{ id: string; name: string; nameEn: string } | null>(null);
  const [branchOptions, setBranchOptions] = useState<Array<{ id: string; name: string; nameEn: string }>>([]);
  const [posBranchId, setBranchIdState] = useState('');

  const fetchPosProducts = async (branchId?: string) => {
    try {
      setLoading(true);
      setLoadError('');
      const url = branchId ? `/api/pos/products?branchId=${encodeURIComponent(branchId)}` : '/api/pos/products';
      const res = await fetch(url);
      const data = await res.json();
      if (data.success) {
        if (Array.isArray(data.branches) && data.branches.length > 0) {
          setBranchOptions(data.branches);
        }

        if (data.needsBranch) {
          // Manager/admin must pick a branch: restore the last choice when still
          // valid, auto-pick when there is only one, otherwise show the picker.
          setProducts([]);
          setActiveBranch(null);
          const options: Array<{ id: string; name: string; nameEn: string }> = data.branches || [];
          let saved = '';
          try {
            saved = localStorage.getItem('pos:branchId') || '';
          } catch {
            /* storage unavailable */
          }
          const preferred =
            saved && options.some((b) => b.id === saved)
              ? saved
              : options.length === 1
                ? options[0].id
                : '';
          if (preferred) {
            setBranchIdState(preferred);
            await fetchPosProducts(preferred);
          }
          return;
        }

        setProducts(data.products);
        if (data.branch) {
          setActiveBranch(data.branch);
          setBranchIdState(data.branch.id);
          try {
            localStorage.setItem('pos:branchId', data.branch.id);
          } catch {
            /* storage unavailable */
          }
        }
      } else {
        setLoadError(data.error || 'تعذر تحميل المنتجات من السيرفر.');
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

    // Staged locally; the SERVER validates the amount + manager PIN at sale time.
    const ok = applyDiscount(val);
    if (!ok) {
      setPinError(true);
    } else {
      setPinError(false);
      setDiscountInput('');
      toast(`تم تسجيل خصم ${val.toLocaleString()} ج.م — يُعتمد عند التأكيد`, 'info');
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

  const handleCompleteSale = async () => {
    if (ticketItems.length === 0 || processing) return;
    setSaleError('');

    // Cash validation: tendered must cover total
    if (payMethod === 'CASH' && tenderedInput !== '' && tendered < total) {
      setSaleError(`المبلغ المستلم (${tendered.toLocaleString()}) أقل من الإجمالي (${total.toLocaleString()})`);
      return;
    }

    setProcessing(true);
    const paidTendered = payMethod === 'CASH' ? (tenderedInput === '' ? total : tendered) : total;
    const paidChange = payMethod === 'CASH' ? Math.max(0, Math.round((paidTendered - total) * 100) / 100) : 0;

    const payload = {
      paymentMethod: payMethod,
      discountAmount,
      managerPin: managerPin || undefined,
      customerId: customer?.id || null,
      branchId: posBranchId || undefined,
      shiftId: shift?.id || undefined,
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
        setLastChange(paidChange);
        toast(`تم حفظ الفاتورة ${data.saleNumber} بنجاح`, 'success');
        setReceiptData({
          saleNumber: data.saleNumber,
          items: ticketItems.map((i) => ({
            name: i.nameAr,
            qty: i.quantity,
            price: i.unitPrice,
            total: i.unitPrice * i.quantity,
          })),
          subtotal: data.subtotal ?? getSubtotal(),
          vat: data.vatAmount ?? getVatAmount(),
          discount: data.discountAmount ?? discountAmount,
          total: data.totalAmount,
          paymentMethod: payMethod,
          tendered: paidTendered,
          change: paidChange,
          reference: referenceInput.trim() || null,
          customerName: customer?.name || null,
          customerPhone: customer?.phone || null,
          loyaltyEarned: data.loyaltyEarned ?? 0,
          qrCodeUrl: data.qrCodeDataUrl,
          timestamp: new Date().toLocaleString('ar-EG'),
        });

        setShowReceiptModal(true);
        clearTicket();
        setTenderedInput('');
        setReferenceInput('');
        fetchPosProducts(); // Refresh stock
      } else {
        const msg = data.error || 'حدث خطأ أثناء حفظ الفاتورة.';
        setSaleError(msg);
        toast(msg, 'error');
      }
    } catch {
      // Offline mode: queue the sale locally and sync later.
      // The open shift at sale time travels with the queue item (T05).
      queueOfflineSale({
        id: `offline-${Date.now()}`,
        saleNumber: `OFFLINE-${Date.now()}`,
        branchId: posBranchId,
        cashierId: '',
        shiftId: shift?.id,
        customerPhone: customer?.phone,
        items: ticketItems.map((i) => ({ ...i })),
        subtotal: getSubtotal(),
        taxAmount: getVatAmount(),
        discountAmount,
        totalAmount: getTotalAmount(),
        paymentMethod: payMethod,
        timestamp: new Date().toISOString(),
      });
      clearTicket();
    } finally {
      setProcessing(false);
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
            customerPhone: sale.customerPhone || undefined,
            branchId: sale.branchId || undefined,
            shiftId: sale.shiftId || undefined,
            clientSaleId: sale.id,
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
      const msg = `تعذر مزامنة ${remaining.length} فاتورة. سيُعاد المحاولة لاحقاً.`;
      setSaleError(msg);
      toast(msg, 'error');
    } else if (offlineQueue.length > 0) {
      toast('تم مزامنة كل الفواتير المعلقة بنجاح', 'success');
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
                كاشير - {activeBranch ? activeBranch.name : branchOptions.length > 0 ? 'اختر الفرع' : '...'}
              </h1>
              <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-400 font-black text-[10px] border border-amber-500/30">
                POS
              </span>
            </div>
            {branchOptions.length > 0 ? (
              <select
                value={posBranchId}
                onChange={(e) => {
                  const id = e.target.value;
                  setBranchIdState(id);
                  if (id) void fetchPosProducts(id);
                }}
                aria-label="اختيار الفرع"
                className="mt-1 text-[11px] font-bold bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-amber-300 focus:outline-none focus:border-amber-500"
              >
                <option value="" disabled>اختر الفرع</option>
                {branchOptions.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            ) : (
              <p className="text-[10px] text-slate-400">92 شارع عمر لطفى - الإسكندرية</p>
            )}
          </div>
        </div>

        {/* Cashier Info */}
        <div className="flex items-center gap-3 text-xs">
          <LocaleSwitcher />
          {shift && (
            <>
              <span className="px-2.5 py-1 rounded-full bg-blue-500/20 text-blue-300 font-bold border border-blue-500/30">
                وردية مفتوحة • {shift.branchName}
              </span>
              <button
                onClick={openCloseWizard}
                className="min-h-[44px] px-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 font-bold text-slate-200"
              >
                إغلاق الوردية
              </button>
            </>
          )}
          <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/30 flex items-center gap-1">
            <Check className="w-3.5 h-3.5" /> مصلحة الضرائب ETA متصلة
          </span>
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-800 text-slate-300">
            <User className="w-4 h-4 text-blue-400" />
            <span>كاشير: سارة فهمي</span>
          </div>
        </div>
      </header>

      {/* Main Grid View — gated on an open shift (T05) */}
      {!shiftLoading && !shift ? (
        <div className="flex-1 overflow-y-auto p-4 flex items-start justify-center">
          <form onSubmit={handleOpenShift} className="w-full max-w-md glass-panel p-6 rounded-3xl border border-amber-500/40 space-y-4 mt-6">
            <Stepper steps={['عد النقدية بالدرج', 'تأكيد فتح الوردية']} active={0} />
            <h2 className="font-black text-base text-slate-100">افتح وردية لبدء البيع</h2>
            <p className="text-xs text-slate-400 leading-relaxed">
              أول مرة؟ عد الكاش الموجود بالدرج واكتبه هنا. كل فواتيرك ستُنسب لهذه الوردية، وعند الإغلاق ستقارن المتوقع بالمعدود.
            </p>
            <div>
              <label htmlFor="open-float" className="block text-xs font-bold text-slate-300 mb-1">رصيد الافتتاح (ج.م) *</label>
              <input
                id="open-float"
                type="number"
                min="0"
                step="0.01"
                required
                value={openFloat}
                onChange={(e) => setOpenFloat(e.target.value)}
                placeholder="مثال: 500"
                className="w-full min-h-[44px] p-3 rounded-xl bg-slate-900 border border-slate-700 text-slate-100 font-bold focus:outline-none focus:border-amber-500"
              />
            </div>
            <div>
              <label htmlFor="open-note" className="block text-xs font-bold text-slate-300 mb-1">ملاحظة (اختياري)</label>
              <input
                id="open-note"
                type="text"
                value={openNote}
                onChange={(e) => setOpenNote(e.target.value)}
                placeholder="مثال: استلام من الكاشير السابق"
                className="w-full min-h-[44px] p-3 rounded-xl bg-slate-900 border border-slate-700 text-slate-100 focus:outline-none focus:border-amber-500"
              />
            </div>
            {openError && <p role="alert" className="text-xs font-bold text-rose-400">{openError}</p>}
            <button
              type="submit"
              disabled={openBusy}
              className="w-full min-h-[44px] py-3.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-slate-950 font-extrabold text-sm"
            >
              {openBusy ? 'جاري الفتح...' : 'فتح الوردية وبدء البيع'}
            </button>
          </form>
        </div>
      ) : (
      <div className="flex-1 grid grid-cols-12 overflow-hidden">
        {/* Left Side: Product Selector & Barcode Scanner */}
        <div className="col-span-7 border-l border-slate-800 p-4 flex flex-col space-y-4 bg-slate-950 overflow-hidden">
          {/* Steps indicator */}
          <div className="flex items-center gap-2 text-[11px] font-bold" aria-label="خطوات البيع">
            <span className={`px-3 py-1.5 rounded-full border ${customer ? 'bg-blue-600/20 text-blue-300 border-blue-500/40' : 'bg-slate-900 text-slate-400 border-slate-800'}`}>
              1. العميل {customer ? '✓' : '(اختياري)'}
            </span>
            <span className={`px-3 py-1.5 rounded-full border ${ticketItems.length > 0 ? 'bg-blue-600/20 text-blue-300 border-blue-500/40' : 'bg-slate-900 text-slate-400 border-slate-800'}`}>
              2. الأصناف ({ticketItems.reduce((s, i) => s + i.quantity, 0)})
            </span>
            <span className={`px-3 py-1.5 rounded-full border ${ticketItems.length > 0 ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' : 'bg-slate-900 text-slate-400 border-slate-800'}`}>
              3. الدفع والتأكيد
            </span>
          </div>
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
                <button onClick={() => fetchPosProducts(posBranchId || undefined)} className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold">
                  إعادة المحاولة
                </button>
              </div>
            ) : !activeBranch && branchOptions.length > 0 ? (
              <div className="text-center text-xs py-12 space-y-4">
                <p className="text-amber-400 font-bold">اختر الفرع لعرض المنتجات والمخزون</p>
                <select
                  value={posBranchId}
                  onChange={(e) => {
                    const id = e.target.value;
                    setBranchIdState(id);
                    if (id) void fetchPosProducts(id);
                  }}
                  aria-label="اختيار الفرع"
                  className="mx-auto block text-sm font-bold bg-slate-900 border border-slate-700 rounded-xl px-4 py-2 text-amber-300 focus:outline-none focus:border-amber-500"
                >
                  <option value="" disabled>اختر الفرع</option>
                  {branchOptions.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-3">
                {filteredProducts.map((prod) => {
                  const stock = prod.inventories?.[0]?.stockQuantity || 0;
                  const outOfStock = stock <= 0;
                  const inTicket = ticketItems.find((i) => i.id === prod.id)?.quantity || 0;
                  const reachedCap = inTicket >= stock && stock > 0;
                  return (
                    <button
                      key={prod.id}
                      disabled={outOfStock}
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
                      className="glass-card p-3 rounded-2xl text-right flex flex-col justify-between h-32 hover:border-amber-500/50 transition-all border border-slate-800/80 active:scale-95 disabled:opacity-50 disabled:active:scale-100"
                    >
                      <div className="space-y-1">
                        <div className="flex justify-between items-center">
                          <div className="text-[10px] text-amber-400 font-bold">SKU: {prod.sku}</div>
                          {outOfStock ? (
                            <span className="text-[9px] font-black bg-rose-500/20 text-rose-400 px-1.5 py-0.5 rounded">نفد</span>
                          ) : reachedCap ? (
                            <span className="text-[9px] font-black bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded">الحد الأقصى</span>
                          ) : null}
                        </div>
                        <h3 className="font-bold text-xs text-slate-100 line-clamp-2 leading-snug">
                          {prod.nameAr}
                        </h3>
                      </div>

                      <div className="flex items-baseline justify-between border-t border-slate-800/80 pt-2">
                        <span className={`text-xs ${stock <= 5 && !outOfStock ? 'text-rose-400 font-bold' : 'text-slate-400'}`}>
                          مخزن: {stock}{inTicket > 0 ? ` (${inTicket} بالفاتورة)` : ''}
                        </span>
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
                  <label htmlFor="pos-pin" className="block text-[10px] font-bold text-slate-400 mb-1">PIN المدير (للخصم فوق 100)</label>
                  <input
                    id="pos-pin"
                    type="password"
                    inputMode="numeric"
                    placeholder="••••"
                    value={managerPin}
                    onChange={(e) => { setManagerPin(e.target.value); setPinError(false); }}
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
              {pinError && <p className="text-[10px] text-rose-400">مبلغ الخصم غير صالح</p>}
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

            {/* Step 3: Payment & Confirm */}
            <div className="p-3 rounded-2xl bg-slate-950 border-2 border-amber-500/40 space-y-3 text-xs">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-amber-500 text-slate-950 font-black text-[11px] flex items-center justify-center">3</span>
                <span className="font-black text-slate-100 text-sm">الدفع وإنهاء البيع</span>
              </div>

              {/* Method tabs */}
              <div className="grid grid-cols-3 gap-2" role="tablist" aria-label="طريقة الدفع">
                {(
                  [
                    { key: 'CASH', label: 'نقداً (كاش)', cls: 'emerald' },
                    { key: 'CARD', label: 'فيزا / بطاقة', cls: 'blue' },
                    { key: 'INSTAPAY', label: 'انستا باي', cls: 'purple' },
                  ] as const
                ).map((m) => (
                  <button
                    key={m.key}
                    role="tab"
                    aria-selected={payMethod === m.key}
                    onClick={() => { setPayMethod(m.key); setSaleError(''); }}
                    className={`py-2.5 rounded-xl font-extrabold text-xs transition-all border-2 ${
                      payMethod === m.key
                        ? m.cls === 'emerald'
                          ? 'bg-emerald-600 text-white border-emerald-400 shadow-lg'
                          : m.cls === 'blue'
                            ? 'bg-blue-600 text-white border-blue-400 shadow-lg'
                            : 'bg-purple-600 text-white border-purple-400 shadow-lg'
                        : 'bg-slate-900 text-slate-400 border-slate-800 hover:border-slate-600'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>

              {/* Cash: tendered + change */}
              {payMethod === 'CASH' && (
                <div className="space-y-2 animate-fade-in">
                  <div>
                    <label htmlFor="pos-tendered" className="block text-[11px] font-bold text-slate-300 mb-1">
                      المبلغ المستلم من العميل (ج.م)
                    </label>
                    <input
                      id="pos-tendered"
                      type="number"
                      min={0}
                      inputMode="decimal"
                      placeholder={`مثال: ${Math.ceil(total).toLocaleString()}`}
                      value={tenderedInput}
                      onChange={(e) => setTenderedInput(e.target.value)}
                      className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-700 text-sm font-black text-slate-100 focus:outline-none focus:border-emerald-500 placeholder:text-slate-500 placeholder:font-normal"
                    />
                  </div>
                  <div className={`flex justify-between items-center p-2.5 rounded-xl font-black ${tenderedShort ? 'bg-rose-500/10 text-rose-400' : 'bg-emerald-500/10 text-emerald-400'}`}>
                    <span>الباقي للعميل:</span>
                    <span className="text-base">{tenderedShort ? 'المبلغ ناقص!' : `${change.toLocaleString()} ج.م`}</span>
                  </div>
                  <div className="grid grid-cols-4 gap-1.5">
                    {[total, Math.ceil(total / 10) * 10, Math.ceil(total / 50) * 50, Math.ceil(total / 100) * 100]
                      .filter((v, i, a) => a.indexOf(v) === i)
                      .map((v) => (
                        <button
                          key={v}
                          onClick={() => setTenderedInput(String(v))}
                          className="py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-[11px] font-bold text-slate-300 hover:border-emerald-500"
                        >
                          {v.toLocaleString()}
                        </button>
                      ))}
                  </div>
                </div>
              )}

              {/* Card / InstaPay: reference */}
              {payMethod !== 'CASH' && (
                <div className="animate-fade-in">
                  <label htmlFor="pos-reference" className="block text-[11px] font-bold text-slate-300 mb-1">
                    {payMethod === 'CARD' ? 'رقم الموافقة / آخر 4 أرقام (اختياري)' : 'رقم مرجع التحويل (اختياري)'}
                  </label>
                  <input
                    id="pos-reference"
                    type="text"
                    dir="ltr"
                    placeholder={payMethod === 'CARD' ? 'e.g. 4821' : 'e.g. TRX-123456'}
                    value={referenceInput}
                    onChange={(e) => setReferenceInput(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-700 text-xs text-slate-100 focus:outline-none focus:border-blue-500 placeholder:text-slate-500"
                  />
                </div>
              )}

              {/* Big confirm */}
              <button
                onClick={handleCompleteSale}
                disabled={ticketItems.length === 0 || processing || tenderedShort}
                className="w-full py-4 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 disabled:from-slate-800 disabled:to-slate-800 disabled:text-slate-500 text-slate-950 font-black text-base shadow-xl shadow-amber-500/25 transition-all flex items-center justify-center gap-2"
              >
                {processing ? (
                  'جاري حفظ الفاتورة...'
                ) : (
                  <>تأكيد البيع • {total.toLocaleString()} ج.م</>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
      )}

      {/* Close-shift wizard */}
      {showClose && closePreview && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/70" onClick={() => { if (!closeBusy) { setShowClose(false); setCloseResult(null); } }}>
          <div className="w-full max-w-md rounded-3xl bg-slate-900 border border-slate-700 p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <Stepper steps={['عد النقدية بالدرج', 'راجع الفرق', 'تأكيد الإغلاق']} active={closeResult ? 2 : 1} />
            <h3 className="font-black text-sm text-slate-100">إغلاق الوردية</h3>
            <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 text-xs space-y-1.5">
              <div className="flex justify-between text-slate-400"><span>رصيد الافتتاح:</span><span className="font-bold text-slate-200">{closePreview.openingFloat.toLocaleString()} ج.م</span></div>
              <div className="flex justify-between text-slate-400"><span>المتوقع بالدرج:</span><span className="font-black text-blue-300">{closePreview.expected.toLocaleString()} ج.م</span></div>
              <div className="text-[11px] text-slate-500">المتوقع = الافتتاح + مبيعات الكاش فقط (الفيزا والتحويل لا تدخل الدرج).</div>
            </div>
            {closeResult ? (
              <div className="p-4 rounded-2xl border text-xs text-center font-black" role="status">
                {closeResult.difference === 0 ? (
                  <span className="text-emerald-400">الدرج مضبوط تماماً ✓ — الخطوة التالية: اطبع تقرير الوردية من الإدارة</span>
                ) : (
                  <span className={closeResult.difference > 0 ? 'text-emerald-400' : 'text-rose-400'}>
                    الفرق: {closeResult.difference > 0 ? '+' : ''}{closeResult.difference.toLocaleString()} ج.م — {closeResult.difference > 0 ? 'زيادة' : 'عجز'}
                  </span>
                )}
              </div>
            ) : (
              <>
                <div>
                  <label htmlFor="actual-cash" className="block text-xs font-bold text-slate-300 mb-1">المبلغ المعدود فعلاً (ج.م) *</label>
                  <input
                    id="actual-cash"
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    value={actualCash}
                    onChange={(e) => setActualCash(e.target.value)}
                    className="w-full min-h-[44px] p-3 rounded-xl bg-slate-950 border border-slate-700 font-bold focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label htmlFor="close-note" className="block text-xs font-bold text-slate-300 mb-1">
                    تفسير الفرق {closePreview && actualCash !== '' && (Number(actualCash) - closePreview.expected) < 0 && Math.abs(Number(actualCash) - closePreview.expected) > closePreview.maxShortage ? '(إجباري — العجز فوق المسموح)' : '(اختياري)'}
                  </label>
                  <input
                    id="close-note"
                    type="text"
                    value={closeNote}
                    onChange={(e) => setCloseNote(e.target.value)}
                    className="w-full min-h-[44px] p-3 rounded-xl bg-slate-950 border border-slate-700 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </>
            )}
            {closeError && <p role="alert" className="text-xs font-bold text-rose-400">{closeError}</p>}
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => { if (!closeBusy) { setShowClose(false); setCloseResult(null); } }} disabled={closeBusy} className="min-h-[44px] rounded-xl bg-slate-800 text-slate-200 text-xs font-bold">رجوع</button>
              {!closeResult && (
                <button onClick={handleCloseShift} disabled={closeBusy || actualCash === ''} className="min-h-[44px] rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-slate-950 text-xs font-black">
                  {closeBusy ? 'جاري الإغلاق...' : 'تأكيد الإغلاق'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Printable Receipt Modal with ETA QR Code */}
      {showReceiptModal && receiptData && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 print:p-0 print:bg-white print:static print:block">
          <div id="pos-receipt" className="bg-white text-slate-900 p-6 rounded-2xl max-w-sm w-full space-y-3 shadow-2xl dir-rtl max-h-[90vh] overflow-y-auto print:max-h-none print:shadow-none print:rounded-none print:w-full print:max-w-none">
            {/* Store header */}
            <div className="text-center space-y-1 border-b-2 border-dashed border-slate-300 pb-3">
              <h2 className="font-black text-xl text-slate-900">ابطال الرياضة الإبراهيمية</h2>
              <p className="text-[11px] text-slate-600">92 شارع عمر لطفى - الإبراهيمية - الإسكندرية</p>
              <p className="text-[11px] text-slate-600">
                هاتف: <span dir="ltr" className="tabular-nums font-bold">03 5926908</span> | واتساب: <span dir="ltr" className="tabular-nums font-bold">0122 422 6876</span>
              </p>
              <p className="text-[10px] text-slate-500">سجل تجاري / ر.ض: <span dir="ltr" className="tabular-nums font-medium">123-456-789</span></p>
            </div>

            {/* Sale meta */}
            <div className="text-[11px] text-slate-700 space-y-0.5 border-b border-dashed border-slate-200 pb-2">
              <div className="flex justify-between">
                <span>رقم الفاتورة:</span>
                <span className="font-black" dir="ltr">{receiptData.saleNumber}</span>
              </div>
              <div className="flex justify-between">
                <span>التاريخ:</span>
                <span className="font-bold">{receiptData.timestamp}</span>
              </div>
              <div className="flex justify-between">
                <span>الكاشير:</span>
                <span className="font-bold">سارة فهمي</span>
              </div>
              <div className="flex justify-between">
                <span>طريقة الدفع:</span>
                <span className="font-bold">
                  {receiptData.paymentMethod === 'CASH' ? 'نقداً' : receiptData.paymentMethod === 'CARD' ? 'فيزا / بطاقة' : 'انستا باي'}
                  {receiptData.reference ? ` (${receiptData.reference})` : ''}
                </span>
              </div>
              {receiptData.customerName && (
                <div className="flex justify-between">
                  <span>العميل:</span>
                  <span className="font-bold">{receiptData.customerName} <span dir="ltr" className="tabular-nums">({receiptData.customerPhone})</span></span>
                </div>
              )}
            </div>

            {/* Items with unit prices */}
            <div className="space-y-1.5 text-xs border-b border-dashed border-slate-200 pb-2">
              {receiptData.items.map((item, idx) => (
                <div key={idx}>
                  <div className="flex justify-between font-bold text-slate-900">
                    <span className="line-clamp-1">{item.name}</span>
                    <span className="shrink-0 tabular-nums">{item.total.toLocaleString()} ج.م</span>
                  </div>
                  <div className="text-[10px] text-slate-500 tabular-nums" dir="ltr">
                    {item.qty} x {item.price.toLocaleString()} EGP
                  </div>
                </div>
              ))}
            </div>

            {/* Totals */}
            <div className="space-y-1 text-xs font-semibold">
              <div className="flex justify-between text-slate-600">
                <span>المجموع الفرعي:</span>
                <span className="tabular-nums">{receiptData.subtotal.toLocaleString()} ج.م</span>
              </div>
              {receiptData.discount > 0 && (
                <div className="flex justify-between text-emerald-700">
                  <span>خصم المدير:</span>
                  <span className="tabular-nums">- {receiptData.discount.toLocaleString()} ج.م</span>
                </div>
              )}
              <div className="flex justify-between text-slate-600">
                <span>ضريبة القيمة المضافة (14%):</span>
                <span className="tabular-nums">{receiptData.vat.toLocaleString()} ج.م</span>
              </div>
              <div className="flex justify-between text-base font-black text-slate-900 pt-1 border-t-2 border-slate-900">
                <span>الإجمالي:</span>
                <span className="tabular-nums">{receiptData.total.toLocaleString()} ج.م</span>
              </div>
              {receiptData.paymentMethod === 'CASH' && (
                <>
                  <div className="flex justify-between text-slate-600">
                    <span>المستلم:</span>
                    <span className="tabular-nums">{receiptData.tendered.toLocaleString()} ج.م</span>
                  </div>
                  <div className="flex justify-between font-black text-slate-900">
                    <span>الباقي:</span>
                    <span className="tabular-nums">{receiptData.change.toLocaleString()} ج.م</span>
                  </div>
                </>
              )}
              {receiptData.loyaltyEarned > 0 && (
                <div className="flex justify-between text-amber-700 font-bold">
                  <span>نقاط الولاء المكتسبة:</span>
                  <span>+{receiptData.loyaltyEarned} نقطة</span>
                </div>
              )}
            </div>

            {/* ETA Verification QR Code */}
            {receiptData.qrCodeUrl && (
              <div className="text-center space-y-1 pt-2 border-t border-dashed border-slate-200">
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

            <p className="text-center text-[10px] text-slate-500 pt-1">شكراً لتسوقكم معنا — نراكم قريباً!</p>

            <div className="grid grid-cols-2 gap-2 pt-2 print:hidden">
              <button
                onClick={() => window.print()}
                className="py-2.5 rounded-xl bg-slate-900 text-white font-bold text-xs flex items-center justify-center gap-1"
              >
                <Printer className="w-4 h-4" /> طباعة
              </button>
              <button
                onClick={() => { setShowReceiptModal(false); setLastChange(0); }}
                className="py-2.5 rounded-xl bg-slate-200 text-slate-800 font-bold text-xs"
              >
                بيع جديد
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

