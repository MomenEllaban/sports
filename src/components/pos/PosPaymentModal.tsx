'use client';

import React, { useState } from 'react';
import {
  X,
  CreditCard,
  Banknote,
  Zap,
  Phone,
  Tag,
  Award,
  User,
  Search,
  CheckCircle2,
  AlertTriangle,
  Receipt,
  Plus,
} from 'lucide-react';
import { Button } from '@/components/ui/foundation';

export interface PosPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  subtotal: number;
  vat: number;
  discountAmount: number;
  total: number;
  customer: { id?: string; name?: string | null; phone: string; loyaltyPoints: number } | null;
  onSearchCustomer: (phone: string) => Promise<void>;
  onClearCustomer: () => void;
  onOpenNewCustomer: () => void;
  customerSearching: boolean;
  customerError: string;
  // Discounts
  discountInput: string;
  setDiscountInput: (val: string) => void;
  managerPin: string;
  setManagerPin: (val: string) => void;
  onApplyDiscount: () => void;
  pinError: boolean;
  couponInput: string;
  setCouponInput: (val: string) => void;
  loyaltyInput: string;
  setLoyaltyInput: (val: string) => void;
  // Payment
  payMethod: 'CASH' | 'CARD' | 'INSTAPAY' | 'FAWRY' | 'VODAFONE_CASH';
  setPayMethod: (m: 'CASH' | 'CARD' | 'INSTAPAY' | 'FAWRY' | 'VODAFONE_CASH') => void;
  tenderedInput: string;
  setTenderedInput: (val: string) => void;
  referenceInput: string;
  setReferenceInput: (val: string) => void;
  processing: boolean;
  onCompleteSale: () => Promise<void>;
  saleError: string;
}

export default function PosPaymentModal({
  isOpen,
  onClose,
  subtotal,
  vat,
  discountAmount,
  total,
  customer,
  onSearchCustomer,
  onClearCustomer,
  onOpenNewCustomer,
  customerSearching,
  customerError,
  discountInput,
  setDiscountInput,
  managerPin,
  setManagerPin,
  onApplyDiscount,
  pinError,
  couponInput,
  setCouponInput,
  loyaltyInput,
  setLoyaltyInput,
  payMethod,
  setPayMethod,
  tenderedInput,
  setTenderedInput,
  referenceInput,
  setReferenceInput,
  processing,
  onCompleteSale,
  saleError,
}: PosPaymentModalProps) {
  const [loyaltyPoints, setLoyaltyPoints] = useState<number>(0);
  const [loyaltyChecking, setLoyaltyChecking] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'PAYMENT' | 'DISCOUNTS'>('PAYMENT');
  const [phoneSearch, setPhoneSearch] = useState('');

  if (!isOpen) return null;

  const tendered = parseFloat(tenderedInput) || 0;
  const change = Math.max(0, Math.round((tendered - total) * 100) / 100);
  const tenderedShort = payMethod === 'CASH' && tendered > 0 && tendered < total;

  const handleQuickAddCash = (amountToAdd: number) => {
    const current = parseFloat(tenderedInput) || 0;
    setTenderedInput(String(Math.round((current + amountToAdd) * 100) / 100));
  };

  const handleExactCash = () => {
    setTenderedInput(String(total));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6 bg-black/80 backdrop-blur-md animate-fade-in">
      <div
        className="w-full max-w-4xl max-h-[92vh] glass-panel rounded-3xl border border-slate-700 shadow-2xl flex flex-col overflow-hidden bg-slate-950 text-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-4 md:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg md:text-xl font-black text-slate-100 flex items-center gap-2">
                إتمام عملية البيع والدفع
              </h2>
              <p className="text-xs text-slate-400">
                اختر طريقة الدفع أو طبق الخصومات للعميل ثم أكد الفاتورة
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-end bg-slate-900 px-4 py-2 rounded-2xl border border-slate-800">
              <span className="text-[10px] text-slate-400 block">المطلوب سداده</span>
              <span className="text-xl font-black text-amber-400 tabular-nums">
                {total.toLocaleString()} <span className="text-xs font-normal">ج.م</span>
              </span>
            </div>
            <button
              onClick={onClose}
              disabled={processing}
              className="w-10 h-10 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-100 flex items-center justify-center transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Tabs (For Tablets / Mobile Switch) */}
        <div className="flex border-b border-slate-800 bg-slate-900/40 px-4">
          <button
            onClick={() => setActiveTab('PAYMENT')}
            className={`py-3 px-6 text-xs md:text-sm font-black border-b-2 transition-all flex items-center gap-2 ${
              activeTab === 'PAYMENT'
                ? 'border-amber-400 text-amber-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Banknote className="w-4 h-4" />
            <span>طريقة الدفع والنقدية</span>
          </button>
          <button
            onClick={() => setActiveTab('DISCOUNTS')}
            className={`py-3 px-6 text-xs md:text-sm font-black border-b-2 transition-all flex items-center gap-2 ${
              activeTab === 'DISCOUNTS'
                ? 'border-amber-400 text-amber-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Tag className="w-4 h-4" />
            <span>العميل والخصومات والكوبونات</span>
            {(customer || discountAmount > 0 || couponInput) && (
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
            )}
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
          {saleError && (
            <div className="p-3.5 rounded-2xl bg-rose-500/15 border border-rose-500/40 text-rose-300 text-xs font-bold flex items-center gap-2 animate-shake">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{saleError}</span>
            </div>
          )}

          {activeTab === 'PAYMENT' ? (
            <div className="space-y-6">
              {/* Payment Methods Touch Grid */}
              <div>
                <label className="block text-xs font-bold text-slate-400 mb-2.5">
                  اختر طريقة التحصيل:
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                  {[
                    { key: 'CASH', label: 'كاش (نقداً)', icon: <Banknote className="w-5 h-5" />, color: 'emerald' },
                    { key: 'CARD', label: 'بطاقة / فيزا', icon: <CreditCard className="w-5 h-5" />, color: 'blue' },
                    { key: 'INSTAPAY', label: 'إنستاباي', icon: <Zap className="w-5 h-5" />, color: 'purple' },
                    { key: 'FAWRY', label: 'فوري كود', icon: <Award className="w-5 h-5" />, color: 'amber' },
                    { key: 'VODAFONE_CASH', label: 'محفظة إلكترونية', icon: <Phone className="w-5 h-5" />, color: 'rose' },
                  ].map((m) => {
                    const isSelected = payMethod === m.key;
                    return (
                      <button
                        key={m.key}
                        type="button"
                        onClick={() => setPayMethod(m.key as 'CASH' | 'CARD' | 'INSTAPAY' | 'FAWRY' | 'VODAFONE_CASH')}
                        className={`min-h-[58px] p-3 rounded-2xl font-black text-xs flex flex-col items-center justify-center gap-1.5 transition-all border-2 ${
                          isSelected
                            ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-lg shadow-amber-500/20 scale-[1.02]'
                            : 'bg-slate-900/80 hover:bg-slate-800 text-slate-300 border-slate-800'
                        }`}
                      >
                        {m.icon}
                        <span>{m.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Cash Section */}
              {payMethod === 'CASH' && (
                <div className="p-4 md:p-5 rounded-3xl bg-slate-900/90 border border-slate-800 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <label htmlFor="modal-tendered" className="block text-xs font-bold text-slate-300 mb-1">
                        المبلغ المدفوع من العميل (ج.م):
                      </label>
                      <input
                        id="modal-tendered"
                        type="number"
                        min="0"
                        step="1"
                        inputMode="decimal"
                        placeholder={String(total)}
                        value={tenderedInput}
                        onChange={(e) => setTenderedInput(e.target.value)}
                        className="w-full sm:w-64 p-3 rounded-2xl bg-slate-950 border border-slate-700 text-xl font-black text-slate-100 focus:outline-none focus:border-amber-500"
                        autoFocus
                      />
                    </div>

                    <div className="flex-1 sm:max-w-xs p-3 rounded-2xl bg-slate-950/80 border border-slate-800 flex items-center justify-between">
                      <span className="text-xs text-slate-400 font-bold">الباقي للعميل:</span>
                      <span
                        className={`text-2xl font-black tabular-nums ${
                          tenderedShort
                            ? 'text-rose-400'
                            : change > 0
                            ? 'text-emerald-400'
                            : 'text-slate-200'
                        }`}
                      >
                        {tenderedShort ? 'المبلغ غير كافٍ' : `${change.toLocaleString()} ج.م`}
                      </span>
                    </div>
                  </div>

                  {/* Quick Denominations */}
                  <div>
                    <span className="text-[11px] text-slate-400 font-bold block mb-1.5">
                      فئات كاش سريعة (اضغط للإضافة السريعة):
                    </span>
                    <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                      <button
                        type="button"
                        onClick={handleExactCash}
                        className="py-2.5 px-3 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-black"
                      >
                        المبلغ بالضبط
                      </button>
                      {[20, 50, 100, 200, 500].map((denom) => (
                        <button
                          key={denom}
                          type="button"
                          onClick={() => handleQuickAddCash(denom)}
                          className="py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold"
                        >
                          +{denom} ج.م
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Card / Electronic Reference */}
              {payMethod !== 'CASH' && (
                <div className="p-4 md:p-5 rounded-3xl bg-slate-900/90 border border-slate-800 space-y-3">
                  <label htmlFor="modal-reference" className="block text-xs font-bold text-slate-300">
                    {payMethod === 'CARD'
                      ? 'رقم إيصال ماكينة الدفع POS / آخر 4 أرقام من البطاقة:'
                      : 'رقم مرجع المعاملة أو رقم المحفظة:'}
                  </label>
                  <input
                    id="modal-reference"
                    type="text"
                    dir="ltr"
                    placeholder="مثال: REF-92841"
                    value={referenceInput}
                    onChange={(e) => setReferenceInput(e.target.value)}
                    className="w-full p-3 rounded-2xl bg-slate-950 border border-slate-700 text-sm font-bold text-slate-100 focus:outline-none focus:border-blue-500"
                  />
                  <p className="text-[11px] text-slate-500">
                    يتم تسجيل رقم المرجع في الفاتورة للرجوع إليه عند مطابقة الحسابات وكشف الحساب البنكي.
                  </p>
                </div>
              )}

              {/* Order Quick Summary Strip */}
              <div className="p-4 rounded-2xl bg-slate-900/40 border border-slate-800/80 flex flex-wrap items-center justify-between text-xs gap-3">
                <div className="flex items-center gap-4 text-slate-400">
                  <span>المجموع الفرعي: <strong className="text-slate-200">{subtotal.toLocaleString()} ج.م</strong></span>
                  {discountAmount > 0 && (
                    <span>خصم مطبق: <strong className="text-emerald-400">-{discountAmount.toLocaleString()} ج.م</strong></span>
                  )}
                  <span>الضريبة (14%): <strong className="text-slate-200">{vat.toLocaleString()} ج.م</strong></span>
                </div>
                {customer && (
                  <span className="text-blue-400 font-bold flex items-center gap-1">
                    <User className="w-3.5 h-3.5" />
                    العميل: {customer.name || customer.phone}
                  </span>
                )}
              </div>
            </div>
          ) : (
            /* Discounts & Customer Tab */
            <div className="space-y-5">
              {/* Customer Selector */}
              <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                    <User className="w-4 h-4 text-blue-400" />
                    بيانات العميل وبرنامج الولاء:
                  </span>
                  {customer && (
                    <button
                      type="button"
                      onClick={onClearCustomer}
                      className="text-xs text-rose-400 hover:text-rose-300 font-bold"
                    >
                      إلغاء ربط العميل
                    </button>
                  )}
                </div>

                {customer ? (
                  <div className="p-3.5 rounded-2xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-between">
                    <div>
                      <div className="text-sm font-black text-blue-300">{customer.name || 'عميل مسجل'}</div>
                      <div className="text-xs text-slate-400 mt-0.5">{customer.phone}</div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-start">
                        <span className="text-[10px] text-slate-400 block">رصيد الولاء</span>
                        <span className="text-sm font-black text-amber-400 flex items-center gap-1">
                          <Award className="w-4 h-4" />
                          {customer.loyaltyPoints} نقطة
                        </span>
                      </div>
                      {customer.loyaltyPoints >= 100 && (
                        <button
                          type="button"
                          onClick={() => setLoyaltyInput(String(Math.min(customer.loyaltyPoints, 500)))}
                          className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs"
                        >
                          استبدال النقاط
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <input
                        type="tel"
                        placeholder="اكتب رقم موبايل العميل للبحث أو التسجيل..."
                        value={phoneSearch}
                        onChange={(e) => setPhoneSearch(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && onSearchCustomer(phoneSearch)}
                        className="flex-1 p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-slate-100"
                        dir="ltr"
                      />
                      <Button
                        type="button"
                        variant="primary"
                        onClick={() => onSearchCustomer(phoneSearch)}
                        disabled={customerSearching || !phoneSearch.trim()}
                      >
                        {customerSearching ? '...' : <><Search className="w-3.5 h-3.5" /> بحث</>}
                      </Button>
                      <button
                        type="button"
                        onClick={onOpenNewCustomer}
                        className="px-3.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold rounded-xl text-xs flex items-center gap-1"
                      >
                        <Plus className="w-3.5 h-3.5" /> عميل جديد
                      </button>
                    </div>
                    {customerError && <p className="text-xs text-amber-400">{customerError}</p>}
                  </div>
                )}
              </div>

              {/* Coupon Code Section */}
              <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
                <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <Tag className="w-4 h-4 text-purple-400" />
                  كود الخصم (كوبون ترويجي):
                </span>
                <div className="flex gap-2">
                  <input
                    type="text"
                    dir="ltr"
                    placeholder="مثال: CHAMPION10"
                    value={couponInput}
                    onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                    className="flex-1 p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs font-mono font-bold text-slate-100 placeholder:text-slate-600"
                  />
                  {couponInput && (
                    <button
                      type="button"
                      onClick={() => setCouponInput('')}
                      className="px-3 rounded-xl bg-slate-800 text-slate-400 hover:text-slate-200 text-xs font-bold"
                    >
                      مسح
                    </button>
                  )}
                </div>
                <p className="text-[11px] text-slate-500">
                  يتم التحقق من الكوبون وحدود الاستخدام والخصم المطبق في نفس المعاملة البنكية عند التأكيد.
                </p>
              </div>

              {/* Manager Discount Section */}
              <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
                <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <Award className="w-4 h-4 text-amber-400" />
                  خصم استثنائي بموافقة المدير (PIN):
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
                  <div className="sm:col-span-6">
                    <label className="block text-[10px] text-slate-400 mb-1">مبلغ الخصم الإضافي (ج.م)</label>
                    <input
                      type="number"
                      min="0"
                      placeholder="0"
                      value={discountInput}
                      onChange={(e) => setDiscountInput(e.target.value)}
                      className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-slate-100"
                    />
                  </div>
                  <div className="sm:col-span-6">
                    <label className="block text-[10px] text-slate-400 mb-1">رمز PIN للمدير</label>
                    <input
                      type="password"
                      inputMode="numeric"
                      placeholder="••••"
                      value={managerPin}
                      onChange={(e) => setManagerPin(e.target.value)}
                      className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-slate-100"
                    />
                  </div>
                </div>
                {pinError && <p className="text-xs text-rose-400 font-bold">مبلغ الخصم أو الرمز غير صالح</p>}
                <button
                  type="button"
                  onClick={onApplyDiscount}
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs"
                >
                  تطبيق الخصم
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 md:p-5 border-t border-slate-800 bg-slate-900/80 flex flex-col sm:flex-row items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={processing}
            className="w-full sm:w-auto px-5 py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold"
          >
            الرجوع لتعديل الأصناف
          </button>

          <button
            type="button"
            onClick={onCompleteSale}
            disabled={processing || tenderedShort}
            className="w-full sm:w-auto px-8 py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 disabled:opacity-50 disabled:pointer-events-none text-slate-950 font-black text-sm shadow-xl shadow-amber-500/20 flex items-center justify-center gap-2"
          >
            {processing ? (
              'جاري تأكيد الفاتورة...'
            ) : (
              <>
                <CheckCircle2 className="w-5 h-5" />
                <span>تأكيد الفاتورة واستخراج الإيصال • {total.toLocaleString()} ج.م</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
