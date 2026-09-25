'use client';

import React, { useState, useEffect, useMemo, useDeferredValue } from 'react';
import { usePosStore } from '@/store/posStore';
import { useToast } from '@/components/Toast';
import { apiRequest } from '@/lib/client-api';
import { useSession } from 'next-auth/react';
import { useLocale } from 'next-intl';
import { LocaleSwitcher, Stepper, Button, DialogFrame } from '@/components/ui/foundation';
import PosReturnWizard from '@/components/pos/ReturnWizard';
import PosPaymentModal from '@/components/pos/PosPaymentModal';
import PosReceiptModal, { type PosReceiptData } from '@/components/pos/PosReceiptModal';
import { ShoppingCart, Barcode, User, Check, X, Trash2 } from 'lucide-react';
import Image from 'next/image';

interface DbProduct {
  id: string;
  sku: string;
  barcode: string | null;
  nameAr: string;
  nameEn: string;
  price: number;
  categoryId: string;
  brandId: string | null;
  category: { id: string; nameAr: string; nameEn: string } | null;
  brand: { id: string; nameAr: string; nameEn: string } | null;
  inventories: Array<{ stockQuantity: number }>;
}

export default function PosTerminalPage() {
  const { toast } = useToast();
  const { data: session } = useSession();
  const locale = useLocale();
  const isAr = locale === 'ar';
  const L = (ar: string, en: string) => (isAr ? ar : en);
  const currencyLabel = L('ج.م', 'EGP');
  const cashierName = session?.user?.name || (session?.user?.email ? session.user.email.split('@')[0] : '');
  const [products, setProducts] = useState<DbProduct[]>([]);
  const [categoryFilters, setCategoryFilters] = useState<Array<{ id: string; nameAr: string; nameEn: string }>>([]);
  const [brandFilters, setBrandFilters] = useState<Array<{ id: string; nameAr: string; nameEn: string }>>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [selectedBrandId, setSelectedBrandId] = useState('');
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-once; later loads are explicit
  }, []);

  useEffect(() => {
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
      const data = await apiRequest<{ shift?: typeof shift }>('/api/pos/shifts', { errorKey: 'pos:shift:status' });
      setShift(data.shift || null);
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
      const data = await apiRequest<{ shift?: typeof shift; error?: string }>('/api/pos/shifts', {
        method: 'POST',
        body: JSON.stringify({
          branchId: chosenBranch || undefined,
          openingFloat: openFloat === '' ? undefined : Number(openFloat),
          openNote: openNote || undefined,
        }),
        errorKey: 'pos:shift:open',
      });
      if (data.shift) {
        toast(L('تم فتح الوردية — ابدأ أول بيعة', 'Shift opened — start the first sale'), 'success');
        setOpenFloat('');
        setOpenNote('');
        await fetchShiftStatus();
        await fetchPosProducts(chosenBranch);
      } else {
        setOpenError(data.error || L('تعذر فتح الوردية', 'Could not open the shift'));
      }
    } catch {
      setOpenError(L('تعذر الاتصال بالسيرفر', 'Could not connect to the server'));
    } finally {
      setOpenBusy(false);
    }
  };

  const openCloseWizard = async () => {
    if (!shift) return;
    setCloseError('');
    setCloseResult(null);
    try {
      const data = await apiRequest<{ expected: number; openingFloat: number; maxShortage: number }>(`/api/pos/shifts/${shift.id}`, { errorKey: `pos:shift:preview:${shift.id}` });
      setClosePreview({ expected: data.expected, openingFloat: data.openingFloat, maxShortage: data.maxShortage });
      setShowClose(true);
    } catch {
      toast(L('تعذر الاتصال بالسيرفر', 'Could not connect to the server'), 'error');
    }
  };

  const handleCloseShift = async () => {
    if (!shift || closeBusy) return;
    setCloseBusy(true);
    setCloseError('');
    try {
      const data = await apiRequest<{ expected: number; actual: number; difference: number }>(`/api/pos/shifts/${shift.id}`, {
        method: 'POST',
        body: JSON.stringify({ actualCash: Number(actualCash), closeNote: closeNote || undefined }),
        errorKey: `pos:shift:close:${shift.id}`,
      });
      setCloseResult({ expected: data.expected, actual: data.actual, difference: data.difference });
      toast(L(`أُغلقت الوردية — الفرق ${data.difference}`, `Shift closed — difference ${data.difference}`), 'success');
      clearTicket();
      await fetchShiftStatus();
    } catch {
      setCloseError(L('تعذر الاتصال بالسيرفر', 'Could not connect to the server'));
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
      const data = await apiRequest<{
        products?: DbProduct[];
        branches?: Array<{ id: string; name: string; nameEn: string }>;
        needsBranch?: boolean;
        branch?: { id: string; name: string; nameEn: string };
        filters?: { categories?: Array<{ id: string; nameAr: string; nameEn: string }>; brands?: Array<{ id: string; nameAr: string; nameEn: string }> };
        error?: string;
      }>(url, { errorKey: `pos:products:${branchId || 'default'}` });
      if (data.products) {
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

        setProducts(data.products || []);
        setCategoryFilters(Array.isArray(data.filters?.categories) ? data.filters.categories : []);
        setBrandFilters(Array.isArray(data.filters?.brands) ? data.filters.brands : []);
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
        setLoadError(data.error || L('تعذر تحميل المنتجات من السيرفر.', 'Could not load products from the server.'));
      }
    } catch {
      setLoadError(L('تعذر الاتصال بالسيرفر. تحقق من الإنترنت وحاول مجدداً.', 'Could not connect to the server. Check your connection and try again.'));
    } finally {
      setLoading(false);
    }
  };

  const deferredSearch = useDeferredValue(searchTerm);
  const filteredProducts = useMemo(() => {
    const term = deferredSearch.trim().toLowerCase();
    return products.filter((product) => {
      if (selectedCategoryId && product.categoryId !== selectedCategoryId) return false;
      if (selectedBrandId && product.brandId !== selectedBrandId) return false;
      if (!term) return true;
      return product.nameAr.toLowerCase().includes(term) || product.nameEn.toLowerCase().includes(term) || product.sku.toLowerCase().includes(term) || (product.barcode && product.barcode.toLowerCase().includes(term));
    });
  }, [products, deferredSearch, selectedCategoryId, selectedBrandId]);

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
      toast(L(`تم تسجيل خصم ${val.toLocaleString()} ج.م — يُعتمد عند التأكيد`, `Discount of ${val.toLocaleString()} EGP staged — confirmed at checkout`), 'info');
    }
  };

  const searchCustomer = async (overridePhone?: string) => {
    const phone = typeof overridePhone === 'string' ? overridePhone.trim() : customerPhone.trim();
    if (!phone || phone.length < 5) return;
    setCustomerPhone(phone);
    setCustomerSearching(true);
    setCustomerError('');
    try {
      const data = await apiRequest<{ customer?: typeof customer }>(`/api/pos/customer?phone=${encodeURIComponent(phone)}`, { errorKey: 'pos:customer:search' });
      if (data.customer) {
        setCustomer(data.customer);
        setCustomerError('');
      } else {
        setCustomer(null);
        setCustomerError(L('العميل غير مسجل — يمكنك الضغط على عميل جديد سريع', 'Customer not found — use Quick Customer to add them'));
      }
    } catch {
      setCustomerError(L('تعذر البحث', 'Search failed'));
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
      const data = await apiRequest<{ customer?: typeof customer; error?: string }>('/api/pos/customer', {
        method: 'POST',
        body: JSON.stringify({ name: newCustomerName.trim(), phone: newCustomerPhone.trim() }),
        errorKey: 'pos:customer:create',
      });
      if (data.customer) {
        setCustomer(data.customer);
        setShowQuickCustomerModal(false);
        setNewCustomerName('');
        setNewCustomerPhone('');
        setCustomerError('');
      } else {
        setCustomerError(data.error || L('فشل إضافة العميل', 'Could not add the customer'));
      }
    } catch {
      setCustomerError(L('فشل الاتصال لإضافة العميل', 'Could not connect to add the customer'));
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
      setSaleError(L(`المبلغ المستلم (${tendered.toLocaleString()}) أقل من الإجمالي (${total.toLocaleString()})`, `Tendered (${tendered.toLocaleString()}) is less than the total (${total.toLocaleString()})`));
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
      const data = await apiRequest<{
        saleNumber: string;
        paymentPending?: boolean;
        subtotal?: number;
        vatAmount?: number;
        discountAmount?: number;
        totalAmount?: number;
      }>('/api/pos/sale', {
        method: 'POST',
        body: JSON.stringify(payload),
        errorKey: 'pos:sale:create',
      });
      if (data.paymentPending) {
          const pendingMsg = L('تم تسجيل الفاتورة، لكن الدفع الإلكتروني يحتاج تسوية/تأكيد من الإدارة قبل اعتباره مدفوعاً.', 'The invoice was recorded, but the electronic payment still needs reconciliation/confirmation by management before it is marked paid.');
          setSaleError(pendingMsg);
          toast(pendingMsg, 'error');
        }
        setPosReceipt({
          saleNumber: data.saleNumber,
          branchName: activeBranch ? (isAr ? activeBranch.name : activeBranch.nameEn) : L('الفرع الرئيسي', 'Main branch'),
          cashierName: cashierName || L('الكاشير', 'Cashier'),
          createdAt: new Date().toISOString(),
          items: ticketItems.map((i) => ({
            nameAr: i.nameAr,
            nameEn: i.nameEn,
            quantity: i.quantity,
            unitPrice: i.unitPrice,
          })),
          subtotal: data.subtotal ?? getSubtotal(),
          vat: data.vatAmount ?? getVatAmount(),
          discount: data.discountAmount ?? discountAmount,
          total: data.totalAmount ?? getTotalAmount(),
          paymentMethod:
            payMethod === 'CASH'
              ? L('كاش (نقداً)', 'Cash')
              : payMethod === 'CARD'
              ? L('بطاقة / فيزا', 'Card / Visa')
              : payMethod === 'INSTAPAY'
              ? L('انستاباي', 'InstaPay')
              : payMethod === 'FAWRY'
              ? L('فوري كود', 'Fawry')
              : L('محفظة إلكترونية', 'Mobile wallet'),
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
      const queuedMsg = L('لا يوجد اتصال: حُفظت الفاتورة محلياً وستُزامن تلقائياً لاحقاً.', 'No connection: the invoice was saved locally and will sync automatically later.');
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
        await apiRequest('/api/pos/sale', {
          method: 'POST',
          body: JSON.stringify({
            paymentMethod: sale.paymentMethod,
            discountAmount: sale.discountAmount,
            customerPhone: sale.customerPhone || undefined,
            branchId: sale.branchId || undefined,
            shiftId: sale.shiftId || undefined,
            clientSaleId: sale.id,
            items: sale.items.map((i) => ({ productId: i.id, quantity: i.quantity, unitPrice: i.unitPrice })),
          }),
          errorKey: `pos:sync:${sale.id}`,
        });
      } catch {
        remaining.push(sale);
      }
    }
    clearOfflineQueue();
    remaining.forEach((s) => queueOfflineSale(s));
    if (remaining.length > 0) {
      const msg = L(`تعذر مزامنة ${remaining.length} فاتورة. سيُعاد المحاولة لاحقاً.`, `Could not sync ${remaining.length} invoices. They will be retried later.`);
      setSaleError(msg);
      toast(msg, 'error');
    } else if (queuedCount > 0) {
      toast(L('تم مزامنة كل الفواتير المعلقة بنجاح', 'All queued invoices synced successfully'), 'success');
    }
    setSyncing(false);
    fetchPosProducts();
  };

  return (
    <div className="h-dvh max-h-dvh min-h-0 w-full max-w-full bg-slate-950 text-slate-100 flex flex-col overflow-hidden font-sans" dir={isAr ? 'rtl' : 'ltr'}>
      {/* POS Top Header Bar */}
      <header className="h-14 bg-slate-900 border-b border-slate-800 px-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <Image
            src="/logo.avif"
            alt={L('أبطال الرياضة', 'Sports Champions')}
            width={960}
            height={822}
            quality={85}
            sizes="40px"
            className="h-10 w-auto rounded-lg object-contain"
          />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-bold text-sm text-slate-100 leading-tight">
                {L('كاشير', 'Cashier')} - {activeBranch ? (isAr ? activeBranch.name : activeBranch.nameEn) : branchOptions.length > 0 ? L('اختر الفرع', 'Select branch') : '...'}
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
                aria-label={L('اختيار الفرع', 'Select branch')}
                className="mt-1 text-[11px] font-bold bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-amber-300 focus:outline-none focus:border-amber-500"
              >
                <option value="" disabled>{L('اختر الفرع', 'Select branch')}</option>
                {branchOptions.map((b) => (
                  <option key={b.id} value={b.id}>{isAr ? b.name : b.nameEn}</option>
                ))}
              </select>
            ) : (
              <p className="text-[10px] text-slate-400">{L('92 شارع عمر لطفى - الإسكندرية', '92 Omar Lotfy St. — Alexandria')}</p>
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
            {L('مرتجع / استبدال', 'Return / Exchange')}
          </button>
          {shift && (
            <>
              <span className="px-2.5 py-1 rounded-full bg-blue-500/20 text-blue-300 font-bold border border-blue-500/30">
                {L('وردية مفتوحة', 'Open shift')} • {isAr ? shift.branchName : (activeBranch?.nameEn || shift.branchName)}
              </span>
              <button
                onClick={openCloseWizard}
                className="min-h-[44px] px-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 font-bold text-slate-200"
              >
                {L('إغلاق الوردية', 'Close shift')}
              </button>
            </>
          )}
          <span className="px-2.5 py-1 rounded-full bg-slate-800 border border-slate-700 text-slate-300 font-bold flex items-center gap-1">
            <Check className="w-3.5 h-3.5 text-amber-400" /> {L('مصلحة الضرائب ETA (وضع تجريبي)', 'ETA (trial mode)')}
          </span>
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-800 text-slate-300">
            <User className="w-4 h-4 text-blue-400" />
            <span>{cashierName ? `${L('كاشير', 'Cashier')}: ${cashierName}` : L('كاشير', 'Cashier')}</span>
          </div>
        </div>
      </header>

      {/* Main Grid View — gated on an open shift (T05) */}
      {!shiftLoading && !shift ? (
        <div className="app-scrollbar flex-1 overflow-y-auto p-4 flex items-start justify-center">
          <form onSubmit={handleOpenShift} className="w-full max-w-md glass-panel p-6 rounded-3xl border border-amber-500/40 space-y-4 mt-6">
            <Stepper steps={[L('عد النقدية بالدرج', 'Count cash in drawer'), L('تأكيد فتح الوردية', 'Confirm shift opening')]} active={0} />
            <h2 className="font-black text-base text-slate-100">{L('افتح وردية لبدء البيع', 'Open a shift to start selling')}</h2>
            <p className="text-xs text-slate-400 leading-relaxed">
              {L('أول مرة؟ عد الكاش الموجود بالدرج واكتبه هنا. كل فواتيرك ستُنسب لهذه الوردية، وعند الإغلاق ستقارن المتوقع بالمعدود.', 'First time? Count the cash in the drawer and enter it here. All sales will be linked to this shift, and the expected amount will be compared at closing.')}
            </p>
            {branchOptions.length > 0 && (
              <div>
                <label htmlFor="open-branch" className="block text-xs font-bold text-slate-300 mb-1">{L('الفرع *', 'Branch *')}</label>
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
                  <option value="">{L('-- اختر الفرع لبدء الوردية --', '-- Select a branch to start the shift --')}</option>
                  {branchOptions.map((b) => (
                    <option key={b.id} value={b.id}>
                      {isAr ? b.name : b.nameEn}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label htmlFor="open-float" className="block text-xs font-bold text-slate-300 mb-1">{L('رصيد الافتتاح (ج.م) *', 'Opening float (EGP) *')}</label>
              <input
                id="open-float"
                type="number"
                min="0"
                step="0.01"
                required
                value={openFloat}
                onChange={(e) => setOpenFloat(e.target.value)}
                placeholder={L('مثال: 500', 'Example: 500')}
                className="w-full min-h-[44px] p-3 rounded-xl bg-slate-900 border border-slate-700 text-slate-100 font-bold focus:outline-none focus:border-amber-500"
              />
            </div>
            <div>
              <label htmlFor="open-note" className="block text-xs font-bold text-slate-300 mb-1">{L('ملاحظة (اختياري)', 'Note (optional)')}</label>
              <input
                id="open-note"
                type="text"
                value={openNote}
                onChange={(e) => setOpenNote(e.target.value)}
                placeholder={L('مثال: استلام من الكاشير السابق', 'Example: handover from the previous cashier')}
                className="w-full min-h-[44px] p-3 rounded-xl bg-slate-900 border border-slate-700 text-slate-100 focus:outline-none focus:border-amber-500"
              />
            </div>
            {openError && <p role="alert" className="text-xs font-bold text-rose-400">{openError}</p>}
            <Button
              type="submit"
              variant="brand"
              disabled={openBusy}
              className="w-full"
            >
              {openBusy ? L('جاري الفتح...', 'Opening...') : L('فتح الوردية وبدء البيع', 'Open shift & start selling')}
            </Button>
          </form>
        </div>
      ) : (
      <div className="app-scrollbar flex-1 min-w-0 grid grid-cols-1 lg:grid-cols-12 gap-2 lg:gap-0 overflow-y-auto lg:overflow-hidden p-2 lg:p-0">
        {/* Left Side: Product Selector & Barcode Scanner */}
        <div className="lg:col-span-7 min-w-0 lg:border-e border-slate-800 p-4 flex flex-col space-y-4 bg-slate-950 lg:overflow-hidden rounded-3xl lg:rounded-none border lg:border-0 border-slate-800">
          {/* Steps indicator */}
          <div className="flex items-center gap-2 text-[11px] font-bold" aria-label={L('خطوات البيع', 'Sale steps')}>
            <span className={`px-3 py-1.5 rounded-full border ${customer ? 'bg-blue-600/20 text-blue-300 border-blue-500/40' : 'bg-slate-900 text-slate-400 border-slate-800'}`}>
              1. {L('العميل', 'Customer')} {customer ? '✓' : L('(اختياري)', '(optional)')}
            </span>
            <span className={`px-3 py-1.5 rounded-full border ${ticketItems.length > 0 ? 'bg-blue-600/20 text-blue-300 border-blue-500/40' : 'bg-slate-900 text-slate-400 border-slate-800'}`}>
              2. {L('الأصناف', 'Items')} ({ticketItems.reduce((s, i) => s + i.quantity, 0)})
            </span>
            <span className={`px-3 py-1.5 rounded-full border ${ticketItems.length > 0 ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' : 'bg-slate-900 text-slate-400 border-slate-800'}`}>
              3. {L('الدفع والتأكيد', 'Payment & confirmation')}
            </span>
          </div>
          {/* Barcode Search Input */}
          <div className="relative">
            <label htmlFor="pos-search" className="block text-[11px] font-bold text-slate-400 mb-1">
              {L('بحث المنتجات (باركود / اسم / SKU)', 'Search products (barcode / name / SKU)')}
            </label>
            <input
              id="pos-search"
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  const term = searchTerm.trim().toLowerCase();
                  if (!term) return;
                  const exact = products.find(
                    (p) =>
                      (p.barcode && p.barcode.toLowerCase() === term) ||
                      p.sku.toLowerCase() === term
                  ) || (filteredProducts.length === 1 ? filteredProducts[0] : null);
                  if (exact) {
                    const stock = exact.inventories?.[0]?.stockQuantity || 0;
                    if (stock > 0) {
                      addItemToTicket({
                        id: exact.id,
                        sku: exact.sku,
                        barcode: exact.barcode,
                        nameAr: exact.nameAr,
                        nameEn: exact.nameEn,
                        price: exact.price,
                        stockQuantity: stock,
                      });
                      setSearchTerm('');
                    } else {
                      toast(L(`الصنف ${exact.nameAr} نفد من المخزون`, `${exact.nameEn} is out of stock`), 'error');
                    }
                  }
                }
              }}
              placeholder={L('امسح البار كود أو ابحث باسم المنتج / SKU...', 'Scan a barcode or search by product name / SKU...')}
              aria-label={L('بحث المنتجات بالباركود أو الاسم', 'Search products by barcode or name')}
              className="w-full pl-10 pr-4 py-3 rounded-2xl bg-slate-900 border border-slate-800 text-sm font-semibold text-slate-100 focus:outline-none focus:border-amber-500 shadow-inner placeholder:text-slate-500"
              autoFocus
            />
            <Barcode className="w-5 h-5 text-amber-400 absolute left-3 top-9" />
          </div>

          <div className="space-y-2" aria-label={isAr ? 'فلاتر المنتجات' : 'Product filters'}>
            <div className="app-scrollbar app-scrollbar-horizontal flex gap-2 overflow-x-auto pb-1" role="group" aria-label={isAr ? 'التصنيفات' : 'Categories'}>
              <button type="button" onClick={() => setSelectedCategoryId('')} aria-pressed={!selectedCategoryId} className={`min-h-[44px] shrink-0 rounded-full border px-3 text-xs font-bold ${!selectedCategoryId ? 'status-info' : 'border-slate-700 text-slate-400'}`}>{isAr ? 'كل التصنيفات' : 'All categories'}</button>
              {categoryFilters.map((category) => <button key={category.id} type="button" onClick={() => setSelectedCategoryId(category.id)} aria-pressed={selectedCategoryId === category.id} className={`min-h-[44px] shrink-0 rounded-full border px-3 text-xs font-bold ${selectedCategoryId === category.id ? 'status-info' : 'border-slate-700 text-slate-400'}`}>{isAr ? category.nameAr : category.nameEn}</button>)}
            </div>
            <div className="app-scrollbar app-scrollbar-horizontal flex gap-2 overflow-x-auto pb-1" role="group" aria-label={isAr ? 'الماركات' : 'Brands'}>
              <button type="button" onClick={() => setSelectedBrandId('')} aria-pressed={!selectedBrandId} className={`min-h-[44px] shrink-0 rounded-full border px-3 text-xs font-bold ${!selectedBrandId ? 'status-info' : 'border-slate-700 text-slate-400'}`}>{isAr ? 'كل الماركات' : 'All brands'}</button>
              {brandFilters.map((brand) => <button key={brand.id} type="button" onClick={() => setSelectedBrandId(brand.id)} aria-pressed={selectedBrandId === brand.id} className={`min-h-[44px] shrink-0 rounded-full border px-3 text-xs font-bold ${selectedBrandId === brand.id ? 'status-info' : 'border-slate-700 text-slate-400'}`}>{isAr ? brand.nameAr : brand.nameEn}</button>)}
            </div>
            <p className="text-[10px] text-slate-500" aria-live="polite">{isAr ? `${filteredProducts.length} نتيجة` : `${filteredProducts.length} results`}</p>
          </div>

          {/* Products Quick Touch Grid */}
          <div className="app-scrollbar flex-1 overflow-y-auto pr-1 min-h-[50vh] lg:min-h-0">
            {loading ? (
              <div className="text-center text-xs text-slate-500 py-12">{L('جاري تحميل المنتجات...', 'Loading products...')}</div>
            ) : loadError ? (
              <div className="text-center text-xs py-12 space-y-3">
                <p className="text-rose-400 font-bold">{loadError}</p>
                <button onClick={() => fetchPosProducts(posBranchId || undefined)} className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold">
                  {L('إعادة المحاولة', 'Retry')}
                </button>
              </div>
            ) : !activeBranch && branchOptions.length > 0 ? (
              <div className="text-center text-xs py-12 space-y-4">
                <p className="text-amber-400 font-bold">{L('اختر الفرع لعرض المنتجات والمخزون', 'Select a branch to view products and stock')}</p>
                <select
                  value={posBranchId}
                  onChange={(e) => {
                    const id = e.target.value;
                    setBranchIdState(id);
                    if (id) void fetchPosProducts(id);
                  }}
                  aria-label={L('اختيار الفرع', 'Select branch')}
                  className="mx-auto block text-sm font-bold bg-slate-900 border border-slate-700 rounded-xl px-4 py-2 text-amber-300 focus:outline-none focus:border-amber-500"
                >
                  <option value="" disabled>{L('اختر الفرع', 'Select branch')}</option>
                  {branchOptions.map((b) => (
                    <option key={b.id} value={b.id}>{isAr ? b.name : b.nameEn}</option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
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
                      className="glass-card p-3 rounded-2xl text-start flex flex-col justify-between h-32 hover:border-amber-500/50 transition-all border border-slate-800/80 active:scale-95 disabled:opacity-50 disabled:active:scale-100"
                    >
                      <div className="space-y-1">
                        <div className="flex justify-between items-center">
                          <div className="text-[10px] text-amber-400 font-bold">SKU: {prod.sku}</div>
                          {outOfStock ? (
                            <span className="text-[9px] font-black bg-rose-500/20 text-rose-400 px-1.5 py-0.5 rounded">{L('نفد', 'Out')}</span>
                          ) : reachedCap ? (
                            <span className="text-[9px] font-black bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded">{L('الحد الأقصى', 'Max')}</span>
                          ) : null}
                        </div>
                        <h3 className="font-bold text-xs text-slate-100 line-clamp-2 leading-snug">
                          {isAr ? prod.nameAr : prod.nameEn}
                        </h3>
                      </div>

                      <div className="flex items-baseline justify-between border-t border-slate-800/80 pt-2">
                        <span className={`text-xs ${stock <= 5 && !outOfStock ? 'text-rose-400 font-bold' : 'text-slate-400'}`}>
                          {L('مخزن', 'Stock')}: {stock}{inTicket > 0 ? ` (${inTicket} ${L('في الفاتورة', 'in ticket')})` : ''}
                        </span>
                        <span className="font-black text-sm text-blue-400">
                          {prod.price.toLocaleString()} {currencyLabel}
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
        <div className="lg:col-span-5 min-w-0 p-4 flex flex-col justify-between bg-slate-900/60 lg:overflow-hidden rounded-3xl lg:rounded-none border lg:border-0 border-slate-800 min-h-[60vh] lg:min-h-0">
          <div className="space-y-3 flex-1 flex flex-col overflow-hidden">
            <div className="flex justify-between items-center border-b border-slate-800 pb-2">
              <h2 className="font-black text-sm text-slate-100 flex items-center gap-2">
                <ShoppingCart className="w-4 h-4 text-amber-400" />
                {L('تذكرة البيع الحالية', 'Current sale')} ({ticketItems.length} {L('صنف', 'items')})
              </h2>
              <button
                onClick={clearTicket}
                className="text-[11px] text-rose-400 hover:underline font-bold"
              >
                {L('إلغاء التذكرة', 'Clear ticket')}
              </button>
            </div>

            {/* Ticket Items List */}
            <div className="app-scrollbar flex-1 overflow-y-auto space-y-2 pr-1">
              {ticketItems.length === 0 ? (
                <div className="text-center text-slate-500 text-xs py-16">
                  {L('لا توجد منتجات في التذكرة حالياً. اختر من القائمة.', 'No products in the ticket yet. Choose one from the list.')}
                </div>
              ) : (
                ticketItems.map((item) => (
                  <div
                    key={item.id}
                    className="p-3 rounded-2xl bg-slate-900 border border-slate-800 flex justify-between items-center text-xs hover:border-slate-700 transition-all shadow-sm"
                  >
                    <div className="space-y-1 flex-1 pr-2">
                      <div className="font-bold text-slate-100 line-clamp-1 text-xs">{isAr ? item.nameAr : item.nameEn}</div>
                      <div className="text-[11px] text-slate-400">
                        {item.unitPrice.toLocaleString()} {currencyLabel} {L('للقطعة', 'each')}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="flex items-center bg-slate-950 rounded-xl border border-slate-800 p-0.5">
                        <button
                          type="button"
                          onClick={() => updateItemQuantity(item.id, item.quantity - 1)}
                          className="w-11 h-11 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold flex items-center justify-center text-base active:scale-95 transition-all"
                          title={L('إنقاص الكمية', 'Decrease quantity')}
                          aria-label={L('إنقاص الكمية', 'Decrease quantity')}
                        >
                          -
                        </button>
                        <span className="font-black text-sm min-w-[28px] text-center text-slate-100">{item.quantity}</span>
                        <button
                          type="button"
                          onClick={() => updateItemQuantity(item.id, item.quantity + 1)}
                          className="w-11 h-11 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold flex items-center justify-center text-base active:scale-95 transition-all"
                          title={L('زيادة الكمية', 'Increase quantity')}
                          aria-label={L('زيادة الكمية', 'Increase quantity')}
                        >
                          +
                        </button>
                      </div>

                      <span className="font-black text-amber-400 min-w-[65px] text-end text-xs tabular-nums">
                        {(item.unitPrice * item.quantity).toLocaleString()} {currencyLabel}
                      </span>

                      <button
                        type="button"
                        onClick={() => removeItemFromTicket(item.id)}
                        className="min-h-[44px] min-w-[44px] p-3 rounded-xl text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors flex items-center justify-center"
                        title={L('حذف من السلة', 'Remove from ticket')}
                        aria-label={L('حذف من السلة', 'Remove from ticket')}
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
                <span>{L('فواتير أوفلاين معلقة', 'Queued offline invoices')}: {offlineQueue.length}</span>
                <button
                  onClick={handleSyncOffline}
                  disabled={syncing}
                  className="px-3 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-slate-950 font-bold text-xs"
                >
                  {syncing ? L('مزامنة...', 'Syncing...') : L('مزامنة الآن', 'Sync now')}
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
                {L('العميل', 'Customer')}:
              </span>
              {customer ? (
                <div className="flex items-center gap-2">
                  <span className="font-bold text-blue-300">{customer.name || customer.phone}</span>
                  <span className="text-[10px] text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                    {customer.loyaltyPoints} {L('نقطة', 'points')}
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
                  + {L('تحديد عميل / نقاط ولاء', 'Add customer / loyalty points')}
                </button>
              )}
            </div>

            {/* Financial Summary */}
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between text-slate-400">
                <span>{L('المجموع الفرعي', 'Subtotal')}:</span>
                <span className="font-medium text-slate-200 tabular-nums">{getSubtotal().toLocaleString()} {currencyLabel}</span>
              </div>
              {discountAmount > 0 && (
                <div className="flex justify-between text-emerald-400 font-bold">
                  <span>{L('الخصم المطبق', 'Discount applied')}:</span>
                  <span className="tabular-nums">-{discountAmount.toLocaleString()} {currencyLabel}</span>
                </div>
              )}
              <div className="flex justify-between text-slate-400">
                <span>{L('ضريبة القيمة المضافة (14%)', 'VAT (14%)')}:</span>
                <span className="font-medium text-slate-200 tabular-nums">{getVatAmount().toLocaleString()} {currencyLabel}</span>
              </div>
              <div className="flex justify-between text-base font-black text-slate-100 pt-2 border-t border-slate-800">
                <span>{L('الإجمالي النهائي', 'Final total')}:</span>
                <span className="text-amber-400 text-xl tabular-nums">{getTotalAmount().toLocaleString()} {currencyLabel}</span>
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
              <span>{L('متابعة الدفع وإنهاء البيع (F10)', 'Continue to payment & complete sale (F10)')}</span>
              <span className="px-2 py-0.5 rounded-lg bg-slate-950/20 text-slate-950 text-xs font-mono font-bold">
                {getTotalAmount().toLocaleString()} {currencyLabel}
              </span>
            </button>
          </div>
        </div>
      </div>
      )}

      {/* Close-shift wizard */}      {showClose && closePreview && (
        <DialogFrame
          title={L('إغلاق الوردية', 'Close shift')}
          onClose={() => { if (!closeBusy) { setShowClose(false); setCloseResult(null); } }}
          panelClassName="max-w-md"
          bodyClassName="space-y-4"
        >
          <Stepper steps={[L('عد النقدية بالدرج', 'Count cash in drawer'), L('راجع الفرق', 'Review difference'), L('تأكيد الإغلاق', 'Confirm closing')]} active={closeResult ? 2 : 1} />
            <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 text-xs space-y-1.5">
              <div className="flex justify-between text-slate-400"><span>{L('رصيد الافتتاح', 'Opening balance')}:</span><span className="font-bold text-slate-200">{closePreview.openingFloat.toLocaleString()} {currencyLabel}</span></div>
              <div className="flex justify-between text-slate-400"><span>{L('المتوقع بالدرج', 'Expected in drawer')}:</span><span className="font-black text-blue-300">{closePreview.expected.toLocaleString()} {currencyLabel}</span></div>
              <div className="text-[11px] text-slate-500">{L('المتوقع = الافتتاح + مبيعات الكاش فقط (الفيزا والتحويل لا تدخل الدرج).', 'Expected = opening float + cash sales only (card and transfer payments do not enter the drawer).')}</div>
            </div>
            {closeResult ? (
              <div className="p-4 rounded-2xl border text-xs text-center font-black" role="status">
                {closeResult.difference === 0 ? (
                  <span className="text-emerald-400">{L('الدرج مضبوط تماماً ✓ — الخطوة التالية: اطبع تقرير الوردية من الإدارة', 'The drawer is balanced ✓ — next step: print the shift report from Admin')}</span>
                ) : (
                  <span className={closeResult.difference > 0 ? 'text-emerald-400' : 'text-rose-400'}>
                    {L('الفرق', 'Difference')}: {closeResult.difference > 0 ? '+' : ''}{closeResult.difference.toLocaleString()} {currencyLabel} — {closeResult.difference > 0 ? L('زيادة', 'Surplus') : L('عجز', 'Shortage')}
                  </span>
                )}
              </div>
            ) : (
              <>
                <div>
                  <label htmlFor="actual-cash" className="block text-xs font-bold text-slate-300 mb-1">{L('المبلغ المعدود فعلاً (ج.م) *', 'Actual counted cash (EGP) *')}</label>
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
                    {L('تفسير الفرق', 'Difference explanation')} {closePreview && actualCash !== '' && (Number(actualCash) - closePreview.expected) < 0 && Math.abs(Number(actualCash) - closePreview.expected) > closePreview.maxShortage ? L('(إجباري — العجز فوق المسموح)', '(required — shortage exceeds the allowed amount)') : L('(اختياري)', '(optional)')}
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
              <button onClick={() => { if (!closeBusy) { setShowClose(false); setCloseResult(null); } }} disabled={closeBusy} className="min-h-[44px] rounded-xl bg-slate-800 text-slate-200 text-xs font-bold">{L('رجوع', 'Back')}</button>
              {!closeResult && (
                <button onClick={handleCloseShift} disabled={closeBusy || actualCash === ''} className="min-h-[44px] rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-slate-950 text-xs font-black">
                  {closeBusy ? L('جاري الإغلاق...', 'Closing...') : L('تأكيد الإغلاق', 'Confirm closing')}
                </button>
              )}
            </div>
          </DialogFrame>
      )}

      {/* T-RMA return/exchange wizard */}
      {showReturnWizard && (
        <PosReturnWizard onClose={() => setShowReturnWizard(false)} onDone={() => { fetchPosProducts(); }} />
      )}



      {/* Quick Customer Modal */}
      {showQuickCustomerModal && (
        <DialogFrame
          title={L('إضافة عميل سريع', 'Add customer quickly')}
          onClose={() => setShowQuickCustomerModal(false)}
          panelClassName="max-w-sm"
          bodyClassName="space-y-4"
        >
          <form onSubmit={handleCreateQuickCustomer} className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1">
                  {L('اسم العميل *', 'Customer name *')}
                </label>
                <input
                  type="text"
                  required
                  placeholder={L('مثال: أحمد مصطفى', 'Example: Ahmed Mostafa')}
                  value={newCustomerName}
                  onChange={(e) => setNewCustomerName(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100 focus:border-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1">
                  {L('رقم الموبايل *', 'Mobile number *')}
                </label>
                <input
                  type="tel"
                  required
                  placeholder={L('مثال: 01012345678', 'Example: 01012345678')}
                  value={newCustomerPhone}
                  onChange={(e) => setNewCustomerPhone(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100 focus:border-blue-500 outline-none"
                  dir="ltr"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  type="submit"
                  variant="primary"
                  disabled={newCustomerLoading}
                  className="flex-1"
                >
                  {newCustomerLoading ? L('جاري الحفظ...', 'Saving...') : L('حفظ وتثبيت بالفاتورة', 'Save & attach to sale')}
                </Button>
                <button
                  type="button"
                  onClick={() => setShowQuickCustomerModal(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs"
                >
                  {L('إلغاء', 'Cancel')}
                </button>
              </div>
            </form>
          </DialogFrame>
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

