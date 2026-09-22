'use client';

import React, { useState, useEffect } from 'react';
import { usePosStore } from '@/store/posStore';
import { useToast } from '@/components/Toast';
import { useSession } from 'next-auth/react';
import { LocaleSwitcher, Stepper } from '@/components/ui/foundation';
import PosReturnWizard from '@/components/pos/ReturnWizard';
import PosPaymentModal from '@/components/pos/PosPaymentModal';
import PosReceiptModal, { type PosReceiptData } from '@/components/pos/PosReceiptModal';
import { ShoppingCart, Barcode, Printer, User, Check, X, Trash2 } from 'lucide-react';
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
  const { data: session } = useSession();
  const cashierName = session?.user?.name || (session?.user?.email ? session.user.email.split('@')[0] : '');
  const [products, setProducts] = useState<DbProduct[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [posReceipt, setPosReceipt] = useState<PosReceiptData | null>(null);

  // Discount & coupon state
  const [discountInput, setDiscountInput] = useState('');
  const [managerPin, setManagerPin] = useState('');
  const [pinError, setPinError] = useState(false);
  // T16: coupon + loyalty inputs (server recomputes authoritatively).
  const [couponInput, setCouponInput] = useState('');
  const [loyaltyInput, setLoyaltyInput] = useState('');

  // Payment step state: method tabs + tendered/change + confirm
  const [payMethod, setPayMethod] = useState<'CASH' | 'CARD' | 'INSTAPAY' | 'FAWRY' | 'VODAFONE_CASH'>('CASH');
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
    fetchShiftStatus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F10') {
        e.preventDefault();
        if (ticketItems.length > 0) {
          setShowPaymentModal(true);
        }
      } else if (e.key === 'Escape') {
        setShowPaymentModal(false);
        setShowReceiptModal(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [ticketItems.length]);

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
  // T-RMA return/exchange wizard.
  const [showReturnWizard, setShowReturnWizard] = useState(false);

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
    const chosenBranch = posBranchId || (branchOptions.length > 0 ? branchOptions[0].id : undefined);
    try {
      const res = await fetch('/api/pos/shifts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          branchId: chosenBranch || undefined,
          openingFloat: openFloat === '' ? undefined : Number(openFloat),
          openNote: openNote || undefined,
        }),
      });
      const data = await res.json();
      if (data.success && data.shift) {
        toast('تم فتح الوردية — ابدأ أول بيعة', 'success');
        setOpenFloat('');
        setOpenNote('');
        await fetchShiftStatus();
        await fetchPosProducts(chosenBranch);
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

  const searchCustomer = async (overridePhone?: string) => {
    const phone = typeof overridePhone === 'string' ? overridePhone.trim() : customerPhone.trim();
    if (!phone || phone.length < 5) return;
    setCustomerPhone(phone);
    setCustomerSearching(true);
    setCustomerError('');
    try {
      const res = await fetch(`/api/pos/customer?phone=${encodeURIComponent(phone)}`);
      const data = await res.json();
      if (data.success && data.customer) {
        setCustomer(data.customer);
        setCustomerError('');
      } else {
        setCustomer(null);
        setCustomerError('العميل غير مسجل — يمكنك الضغط على عميل جديد سريع');
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

    const total = getTotalAmount();
    const tendered = Number(tenderedInput) || 0;

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
      couponCode: couponInput.trim() || undefined,
      loyaltyPoints: Math.max(0, Math.floor(Number(loyaltyInput) || 0)) || undefined,
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
        setPosReceipt({
          saleNumber: data.saleNumber,
          branchName: activeBranch?.name || 'الفرع الرئيسي',
          cashierName: cashierName || 'الكاشير',
          createdAt: new Date().toISOString(),
          items: ticketItems.map((i) => ({
            nameAr: i.nameAr,
            quantity: i.quantity,
            unitPrice: i.unitPrice,
          })),
          subtotal: data.subtotal ?? getSubtotal(),
          vat: data.vatAmount ?? getVatAmount(),
          discount: data.discountAmount ?? discountAmount,
          total: data.totalAmount ?? getTotalAmount(),
          paymentMethod:
            payMethod === 'CASH'
              ? 'كاش (نقداً)'
              : payMethod === 'CARD'
              ? 'بطاقة / فيزا'
              : payMethod === 'INSTAPAY'
              ? 'انستاباي'
              : payMethod === 'FAWRY'
              ? 'فوري كود'
              : 'محفظة إلكترونية',
          tendered: payMethod === 'CASH' && tenderedInput ? Number(tenderedInput) : undefined,
          change: payMethod === 'CASH' && tenderedInput ? paidChange : undefined,
          customerName: customer?.name || undefined,
          customerPhone: customer?.phone || undefined,
        });

        setShowReceiptModal(true);
        setShowPaymentModal(false);
        clearTicket();
        setTenderedInput('');
        setReferenceInput('');
        setCouponInput('');
        setLoyaltyInput('');
        fetchPosProducts(posBranchId || undefined); // Refresh stock
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
      const queuedMsg = 'لا يوجد اتصال: حُفظت الفاتورة محلياً وستُزامن تلقائياً لاحقاً.';
      setSaleError(queuedMsg);
      toast(queuedMsg, 'error');
    } finally {
      setProcessing(false);
    }
  };

  const handleSyncOffline = async () => {
    if (offlineQueue.length === 0 || syncing) return;
    setSyncing(true);
    setSaleError('');
    const queuedCount = offlineQueue.length;
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
    } else if (queuedCount > 0) {
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
          <button
            onClick={() => setShowReturnWizard(true)}
            className="min-h-[44px] px-3 rounded-xl bg-rose-600/20 hover:bg-rose-600/40 border border-rose-500/40 text-rose-300 font-bold flex items-center gap-1"
          >
            مرتجع / استبدال
          </button>
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
          <span className="px-2.5 py-1 rounded-full bg-slate-800 border border-slate-700 text-slate-300 font-bold flex items-center gap-1">
            <Check className="w-3.5 h-3.5 text-amber-400" /> مصلحة الضرائب ETA (وضع تجريبي)
          </span>
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-800 text-slate-300">
            <User className="w-4 h-4 text-blue-400" />
            <span>{cashierName ? `كاشير: ${cashierName}` : 'كاشير'}</span>
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
            {branchOptions.length > 0 && (
              <div>
                <label htmlFor="open-branch" className="block text-xs font-bold text-slate-300 mb-1">الفرع *</label>
                <select
                  id="open-branch"
                  value={posBranchId}
                  onChange={(e) => {
                    const chosen = e.target.value;
                    setBranchIdState(chosen);
                    try { localStorage.setItem('pos:branchId', chosen); } catch {}
                    const found = branchOptions.find((b) => b.id === chosen);
                    if (found) setActiveBranch(found);
                  }}
                  className="w-full min-h-[44px] p-3 rounded-xl bg-slate-900 border border-slate-700 text-slate-100 font-bold focus:outline-none focus:border-amber-500 text-xs"
                >
                  <option value="">-- اختر الفرع لبدء الوردية --</option>
                  {branchOptions.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
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
                    className="p-3 rounded-2xl bg-slate-900 border border-slate-800 flex justify-between items-center text-xs hover:border-slate-700 transition-all shadow-sm"
                  >
                    <div className="space-y-1 flex-1 pr-2">
                      <div className="font-bold text-slate-100 line-clamp-1 text-xs">{item.nameAr}</div>
                      <div className="text-[11px] text-slate-400">
                        {item.unitPrice.toLocaleString()} ج.م للقطعة
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="flex items-center bg-slate-950 rounded-xl border border-slate-800 p-0.5">
                        <button
                          type="button"
                          onClick={() => updateItemQuantity(item.id, item.quantity - 1)}
                          className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold flex items-center justify-center text-sm active:scale-95 transition-all"
                          title="إنقاص الكمية"
                        >
                          -
                        </button>
                        <span className="font-black text-sm min-w-[28px] text-center text-slate-100">{item.quantity}</span>
                        <button
                          type="button"
                          onClick={() => updateItemQuantity(item.id, item.quantity + 1)}
                          className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold flex items-center justify-center text-sm active:scale-95 transition-all"
                          title="زيادة الكمية"
                        >
                          +
                        </button>
                      </div>

                      <span className="font-black text-amber-400 min-w-[65px] text-left text-xs tabular-nums">
                        {(item.unitPrice * item.quantity).toLocaleString()} ج.م
                      </span>

                      <button
                        type="button"
                        onClick={() => removeItemFromTicket(item.id)}
                        className="p-2 rounded-xl text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                        title="حذف من السلة"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Tablet Ergonomic Order Summary Panel */}
          <div className="p-4 rounded-3xl bg-slate-950 border border-slate-800 space-y-3 shrink-0 shadow-2xl">
            {/* Offline sync alert if queued */}
            {offlineQueue.length > 0 && (
              <div className="p-2.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 text-xs font-bold flex justify-between items-center">
                <span>فواتير أوفلاين معلقة: {offlineQueue.length}</span>
                <button
                  onClick={handleSyncOffline}
                  disabled={syncing}
                  className="px-3 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-slate-950 font-bold text-xs"
                >
                  {syncing ? 'مزامنة...' : 'مزامنة الآن'}
                </button>
              </div>
            )}

            {saleError && (
              <div role="alert" className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-bold">
                {saleError}
              </div>
            )}

            {/* Quick Customer Pill */}
            <div className="flex items-center justify-between text-xs pb-2 border-b border-slate-800/80">
              <span className="text-slate-400 flex items-center gap-1.5 font-semibold">
                <User className="w-3.5 h-3.5 text-blue-400" />
                العميل:
              </span>
              {customer ? (
                <div className="flex items-center gap-2">
                  <span className="font-bold text-blue-300">{customer.name || customer.phone}</span>
                  <span className="text-[10px] text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                    {customer.loyaltyPoints} نقطة
                  </span>
                  <button onClick={clearCustomer} className="text-slate-500 hover:text-rose-400 p-0.5">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowPaymentModal(true)}
                  className="text-blue-400 hover:text-blue-300 font-bold text-[11px] hover:underline"
                >
                  + تحديد عميل / نقاط ولاء
                </button>
              )}
            </div>

            {/* Financial Summary */}
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between text-slate-400">
                <span>المجموع الفرعي:</span>
                <span className="font-medium text-slate-200 tabular-nums">{getSubtotal().toLocaleString()} ج.م</span>
              </div>
              {discountAmount > 0 && (
                <div className="flex justify-between text-emerald-400 font-bold">
                  <span>الخصم المطبق:</span>
                  <span className="tabular-nums">-{discountAmount.toLocaleString()} ج.م</span>
                </div>
              )}
              <div className="flex justify-between text-slate-400">
                <span>ضريبة القيمة المضافة (14%):</span>
                <span className="font-medium text-slate-200 tabular-nums">{getVatAmount().toLocaleString()} ج.م</span>
              </div>
              <div className="flex justify-between text-base font-black text-slate-100 pt-2 border-t border-slate-800">
                <span>الإجمالي النهائي:</span>
                <span className="text-amber-400 text-xl tabular-nums">{getTotalAmount().toLocaleString()} ج.م</span>
              </div>
            </div>

            {/* Action Touch Button */}
            <button
              type="button"
              onClick={() => {
                if (ticketItems.length > 0) setShowPaymentModal(true);
              }}
              disabled={ticketItems.length === 0}
              className="w-full min-h-[52px] py-3.5 px-4 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 disabled:from-slate-800 disabled:to-slate-800 disabled:text-slate-600 text-slate-950 font-black text-sm md:text-base shadow-xl shadow-amber-500/20 active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed"
            >
              <span>متابعة الدفع وإنهاء البيع (F10)</span>
              <span className="px-2 py-0.5 rounded-lg bg-slate-950/20 text-slate-950 text-xs font-mono font-bold">
                {getTotalAmount().toLocaleString()} ج.م
              </span>
            </button>
          </div>
        </div>
      </div>
      )}

      {/* Close-shift wizard */}      {showClose && closePreview && (
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

      {/* T-RMA return/exchange wizard */}
      {showReturnWizard && (
        <PosReturnWizard onClose={() => setShowReturnWizard(false)} onDone={() => { fetchPosProducts(); }} />
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

      {/* Modern Dedicated Tablet Payment Modal */}
      <PosPaymentModal
        isOpen={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        subtotal={getSubtotal()}
        vat={getVatAmount()}
        discountAmount={discountAmount}
        total={getTotalAmount()}
        customer={customer}
        onSearchCustomer={searchCustomer}
        onClearCustomer={clearCustomer}
        onOpenNewCustomer={() => {
          setNewCustomerPhone(customerPhone);
          setShowQuickCustomerModal(true);
        }}
        customerSearching={customerSearching}
        customerError={customerError}
        discountInput={discountInput}
        setDiscountInput={setDiscountInput}
        managerPin={managerPin}
        setManagerPin={setManagerPin}
        onApplyDiscount={handleApplyDiscount}
        pinError={pinError}
        couponInput={couponInput}
        setCouponInput={setCouponInput}
        loyaltyInput={loyaltyInput}
        setLoyaltyInput={setLoyaltyInput}
        payMethod={payMethod}
        setPayMethod={setPayMethod}
        tenderedInput={tenderedInput}
        setTenderedInput={setTenderedInput}
        referenceInput={referenceInput}
        setReferenceInput={setReferenceInput}
        processing={processing}
        onCompleteSale={handleCompleteSale}
        saleError={saleError}
      />

      {/* Modern Thermal Receipt Modal */}
      <PosReceiptModal
        isOpen={showReceiptModal}
        onClose={() => setShowReceiptModal(false)}
        data={posReceipt}
        onNewSale={() => {
          clearTicket();
          setShowReceiptModal(false);
        }}
      />
    </div>
  );
}

