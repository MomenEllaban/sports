'use client';

import React, { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from '@/i18n/routing';
import { useTranslations, useLocale } from 'next-intl';
import {
  Lock,
  Mail,
  Zap,
  ShieldCheck,
  Building2,
  DollarSign,
  Monitor,
  Package,
  ArrowLeft,
  Loader2,
  Sparkles,
} from 'lucide-react';
import Image from 'next/image';

interface QuickAccount {
  id: string;
  role: 'SUPER_ADMIN' | 'BRANCH_MANAGER' | 'FINANCE' | 'CASHIER' | 'STAFF';
  roleNameAr: string;
  roleNameEn: string;
  badgeStyle: string;
  nameAr: string;
  nameEn: string;
  email: string;
  password: string;
  scopeAr: string;
  scopeEn: string;
  targetUrl: string;
  icon: React.ReactNode;
}

// Demo credentials are useful for local QA but must never be exposed in a production bundle.
const SHOW_DEMO_ACCOUNTS = process.env.NODE_ENV !== 'production';
const DEMO_ACCOUNTS: QuickAccount[] = SHOW_DEMO_ACCOUNTS ? [
  {
    id: 'super-admin',
    role: 'SUPER_ADMIN',
    roleNameAr: 'المدير العام (صلاحيات كاملة 100%)',
    roleNameEn: 'General Manager (full permissions, 100%)',
    badgeStyle: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    nameAr: 'المدير العام',
    nameEn: 'General Manager',
    email: 'admin@sports-champions.local',
    password: 'Test@123456',
    scopeAr: 'تحكم مطلق في كل الشاشات · المستخدمين · الإعدادات · الضرائب ETA · الحسابات',
    scopeEn: 'Full control of every screen · Users · Settings · ETA taxes · Accounting',
    targetUrl: '/admin',
    icon: <ShieldCheck className="w-4 h-4 text-emerald-400" />,
  },
  {
    id: 'mgr-ibrahimeyah',
    role: 'BRANCH_MANAGER',
    roleNameAr: 'مدير فرع الإبراهيمية',
    roleNameEn: 'El Ibrahimia Branch Manager',
    badgeStyle: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
    nameAr: 'مدير فرع الإبراهيمية',
    nameEn: 'El Ibrahimia Branch Manager',
    email: 'manager.ibrahimeyah@sports-champions.local',
    password: 'Test@123456',
    scopeAr: 'الفرع الرئيسي · المبيعات · المخزون والجرد · الورديات والدرج · المرتجعات',
    scopeEn: 'Flagship branch · Sales · Inventory and stocktake · Shifts and cash drawer · Returns',
    targetUrl: '/admin',
    icon: <Building2 className="w-4 h-4 text-blue-400" />,
  },
  {
    id: 'mgr-smouha',
    role: 'BRANCH_MANAGER',
    roleNameAr: 'مدير فرع سموحة',
    roleNameEn: 'Smouha Branch Manager',
    badgeStyle: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
    nameAr: 'مدير فرع سموحة',
    nameEn: 'Smouha Branch Manager',
    email: 'manager.smouha@sports-champions.local',
    password: 'Test@123456',
    scopeAr: 'فرع سموحة · أوامر التوريد · تحويلات المخزون · تقارير الفرع',
    scopeEn: 'Smouha branch · Purchase orders · Stock transfers · Branch reports',
    targetUrl: '/admin',
    icon: <Building2 className="w-4 h-4 text-blue-400" />,
  },
  {
    id: 'finance-mgr',
    role: 'FINANCE',
    roleNameAr: 'مدير المالية والحسابات',
    roleNameEn: 'Finance & Accounting Manager',
    badgeStyle: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
    nameAr: 'مدير الحسابات والمالية',
    nameEn: 'Accounting & Finance Manager',
    email: 'finance@sports-champions.local',
    password: 'Test@123456',
    scopeAr: 'الأرباح والخسائر · المرتبات والعمولات · تسوية الكاش COD · ضرائب ETA',
    scopeEn: 'P&L · Payroll and commissions · COD cash settlement · ETA taxes',
    targetUrl: '/admin/accounting',
    icon: <DollarSign className="w-4 h-4 text-purple-400" />,
  },
  {
    id: 'pos-cashier',
    role: 'CASHIER',
    roleNameAr: 'كاشير نقطة البيع (POS)',
    roleNameEn: 'Point of Sale Cashier (POS)',
    badgeStyle: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    nameAr: 'كاشير الإبراهيمية',
    nameEn: 'El Ibrahimia Cashier',
    email: 'cashier.ibrahimeyah@sports-champions.local',
    password: 'Test@123456',
    scopeAr: 'فتح/إغلاق الوردية · البيع السريع · فئات الكاش · طباعة الفاتورة 80mm',
    scopeEn: 'Open/close shifts · Fast selling · Cash denominations · 80mm receipt printing',
    targetUrl: '/pos',
    icon: <Monitor className="w-4 h-4 text-amber-400" />,
  },
  {
    id: 'warehouse-staff',
    role: 'STAFF',
    roleNameAr: 'موظف مبيعات ومخزن',
    roleNameEn: 'Sales & Warehouse Staff',
    badgeStyle: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30',
    nameAr: 'موظف الإبراهيمية',
    nameEn: 'Ibrahimia Staff',
    email: 'staff.ibrahimeyah@sports-champions.local',
    password: 'Test@123456',
    scopeAr: 'جرد المخزون · فحص كميات الأصناف · استلام التوريدات',
    scopeEn: 'Stocktaking · Item quantity checks · Receiving deliveries',
    targetUrl: '/admin/inventory',
    icon: <Package className="w-4 h-4 text-cyan-400" />,
  },
] : [];

export function LoginForm({ callbackUrl }: { callbackUrl: string }) {
  const t = useTranslations('auth');
  const isAr = useLocale() === 'ar';
  const L = (ar: string, en: string) => (isAr ? ar : en);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [quickLoadingId, setQuickLoadingId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const router = useRouter();

  const handleLoginWithCredentials = async (loginEmail: string, loginPass: string, destination?: string) => {
    setLoading(true);
    setErrorMsg('');

    try {
      const result = await signIn('credentials', {
        redirect: false,
        email: loginEmail,
        password: loginPass,
      });

      if (result?.error) {
        setErrorMsg(t('invalidCredentials'));
        setLoading(false);
        setQuickLoadingId(null);
      } else {
        const rawTarget = destination || callbackUrl || '/admin';
        let target = rawTarget.startsWith('//') ? '/admin' : rawTarget.replace(/^https?:\/\/[^\/]+/, '');
        target = target.replace(/^\/(?:ar|en)(?=\/|$)+/g, '') || '/admin';
        if (!target.startsWith('/') || target.startsWith('//')) target = '/admin';
        router.push(target);
        router.refresh();
      }
    } catch {
      setErrorMsg(t('connectionError'));
      setLoading(false);
      setQuickLoadingId(null);
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await handleLoginWithCredentials(email, password);
  };

  const handleQuickLogin = async (account: QuickAccount) => {
    setQuickLoadingId(account.id);
    setEmail(account.email);
    setPassword(account.password);
    await handleLoginWithCredentials(account.email, account.password, account.targetUrl);
  };

  const handleFillOnly = (account: QuickAccount) => {
    setEmail(account.email);
    setPassword(account.password);
    setErrorMsg('');
  };

  return (
    <div className={`max-w-5xl w-full grid grid-cols-1 gap-6 items-start animate-fade-up ${SHOW_DEMO_ACCOUNTS ? 'lg:grid-cols-12' : 'mx-auto lg:max-w-md'}`}>
      {/* ── Left Column: Manual Login Form ─────────────────────── */}
      <div className="lg:col-span-5 glass-panel p-6 sm:p-8 rounded-3xl border border-slate-800 space-y-6 shadow-2xl">
        <div className="text-center space-y-2">
          <Image
            src="/logo.avif"
            alt={L('أبطال الرياضة الإبراهيمية', 'Sports Champions Alexandria')}
            width={960}
            height={822}
            priority
            quality={85}
            sizes="64px"
            className="h-14 w-auto rounded-xl object-contain mx-auto"
          />
          <h1 className="text-xl sm:text-2xl font-black text-slate-100">{t('title')}</h1>
          <p className="text-xs text-slate-400">{t('subtitle')}</p>
        </div>

        {errorMsg && (
          <div role="alert" className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs text-center animate-fade-in font-bold">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleFormSubmit} className="space-y-4 text-xs">
          <div>
            <label htmlFor="login-email" className="block font-bold text-slate-300 mb-1">{t('emailLabel')}</label>
            <div className="relative">
              <input
                id="login-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@sports-champions.local"
                autoComplete="email"
                className="w-full p-3 pl-10 rounded-xl bg-slate-900 border border-slate-800 text-slate-100 focus:outline-none focus:border-blue-500 font-semibold placeholder:text-slate-500"
              />
              <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-3.5" />
            </div>
          </div>

          <div>
            <label htmlFor="login-password" className="block font-bold text-slate-300 mb-1">{t('passwordLabel')}</label>
            <div className="relative">
              <input
                id="login-password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                placeholder="••••••••"
                className="w-full p-3 pl-10 rounded-xl bg-slate-900 border border-slate-800 text-slate-100 focus:outline-none focus:border-blue-500 font-semibold placeholder:text-slate-500"
              />
              <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-3.5" />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white font-black text-xs shadow-control transition-all flex items-center justify-center gap-2"
          >
            {loading && !quickLoadingId ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>{t('loading')}</span>
              </>
            ) : (
              <span>{t('submit')}</span>
            )}
          </button>
        </form>

        {SHOW_DEMO_ACCOUNTS && (
          <div className="pt-2 border-t border-slate-800/80 text-center">
            <p className="text-[11px] text-slate-400">
              {L('حسابات QA المحلية فقط — لا تُفعّل هذه القائمة في production.', 'Local QA accounts only — this list stays disabled in production.')}
            </p>
          </div>
        )}
      </div>

      {SHOW_DEMO_ACCOUNTS && (
        <div className="lg:col-span-7 glass-panel p-6 rounded-3xl border border-slate-800 space-y-4 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <Zap className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-black text-slate-100 flex items-center gap-2">
                {L('دخول سريع حسب الصلاحيات', 'Quick sign-in by role')}
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              </h2>
              <p className="text-[11px] text-slate-400">{L('اختر رتبتك للدخول الفوري وتجربة الشاشات المخصصة', 'Pick a role to sign in instantly and explore the screens built for it')}</p>
            </div>
          </div>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
            {L('6 حسابات جاهزة', '6 accounts ready')}
          </span>
        </div>

        <div className="app-scrollbar grid grid-cols-1 gap-2.5 max-h-[520px] overflow-y-auto pr-1">
          {DEMO_ACCOUNTS.map((acc) => {
            const isThisLoading = quickLoadingId === acc.id;
            return (
              <div
                key={acc.id}
                className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800/90 hover:border-slate-700 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 group"
              >
                <div className="space-y-1 min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-md border flex items-center gap-1 ${acc.badgeStyle}`}>
                      {acc.icon}
                      {acc.role}
                      <span className="sr-only">{isAr ? acc.roleNameAr : acc.roleNameEn}</span>
                    </span>
                    <span className="text-xs font-black text-slate-200">{isAr ? acc.nameAr : acc.nameEn}</span>
                  </div>
                  <p className="text-[11px] text-slate-400 line-clamp-1">{isAr ? acc.scopeAr : acc.scopeEn}</p>
                  <p className="text-[10px] text-slate-400 font-mono" dir="ltr">{acc.email}</p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleFillOnly(acc)}
                    disabled={loading}
                    title={L('تعبئة البريد وكلمة المرور في النموذج', 'Fill the email and password in the form')}
                    className="px-2.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-slate-100 font-bold text-[11px] border border-slate-700 transition-all"
                  >
                    {L('تعبئة', 'Fill')}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleQuickLogin(acc)}
                    disabled={loading}
                    className={`min-h-[38px] px-3.5 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all shadow-md ${
                      acc.role === 'SUPER_ADMIN'
                        ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-emerald-500/20'
                        : acc.role === 'CASHIER'
                        ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-amber-500/20'
                        : acc.role === 'FINANCE'
                        ? 'bg-purple-600 hover:bg-purple-500 text-white shadow-purple-600/20'
                        : 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-600/20'
                    } disabled:opacity-50`}
                  >
                    {isThisLoading ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>{L('جاري الدخول...', 'Signing in...')}</span>
                      </>
                    ) : (
                      <>
                        <Zap className="w-3.5 h-3.5" />
                        <span>{L('دخول سريع', 'Quick sign-in')}</span>
                        <ArrowLeft className="w-3 h-3 group-hover:-translate-x-0.5 transition-transform" />
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
        </div>
      )}
    </div>
  );
}
