'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import { ShoppingCart, MapPin, ShieldCheck, Truck, Clock } from 'lucide-react';

export default function HeroBanner() {
  const tHero = useTranslations('hero');
  const tCommon = useTranslations('common');

  return (
    <div className="relative overflow-hidden bg-slate-950 border-b border-slate-800 py-16 lg:py-24">
      {/* Dynamic Background Effects */}
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-blue-600/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 relative z-10 grid lg:grid-cols-12 gap-12 items-center">
        {/* Left Column: Headlines & Action Buttons */}
        <div className="lg:col-span-7 space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-400 text-xs font-bold tracking-wide animate-fade-up">
            <MapPin className="w-4 h-4 text-amber-400" />
            <span>فرع الإبراهيمية الرئيسي: 92 شارع عمر لطفى - سيدي جابر</span>
          </div>

          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black text-slate-100 tracking-tight leading-tight animate-fade-up stagger-1">
            <span className="block">{tHero('title')}</span>
            <span className="gold-gradient-text block mt-2">ابطال الرياضة الإبراهيمية</span>
          </h1>

          <p className="text-slate-400 text-base sm:text-lg leading-relaxed max-w-2xl animate-fade-up stagger-2">
            {tHero('subtitle')}
          </p>

          {/* Key Value Badges */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2 animate-fade-up stagger-3">
            <div className="glass-panel p-3 rounded-xl flex items-center gap-2 text-xs font-semibold text-slate-300">
              <Truck className="w-4 h-4 text-blue-400 shrink-0" />
              <span>توصيل فوري بالإسكندرية</span>
            </div>
            <div className="glass-panel p-3 rounded-xl flex items-center gap-2 text-xs font-semibold text-slate-300">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>منتجات أصلية 100%</span>
            </div>
            <div className="glass-panel p-3 rounded-xl flex items-center gap-2 text-xs font-semibold text-slate-300 col-span-2 sm:col-span-1">
              <Clock className="w-4 h-4 text-amber-400 shrink-0" />
              <span>فواتير وإيصالات معتمدة</span>
            </div>
          </div>

          {/* Action CTAs */}
          <div className="flex flex-wrap items-center gap-4 pt-4 animate-fade-up stagger-4">
            <Link
              href="/catalog"
              className="px-6 py-3.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-base shadow-control flex items-center gap-2 transition-all"
            >
              <ShoppingCart className="w-5 h-5" />
              {tHero('ctaShop')}
            </Link>

            <Link
              href="/branches"
              className="px-6 py-3.5 rounded-xl glass-panel hover:bg-slate-800 text-slate-200 font-bold text-base flex items-center gap-2 border border-slate-700 transition-all"
            >
              <MapPin className="w-5 h-5 text-amber-400" />
              {tHero('ctaBranches')}
            </Link>
          </div>
        </div>

        {/* Right Column: Visual Showcase */}
        <div className="lg:col-span-5 relative animate-fade-up stagger-2">
          <div className="glass-panel p-6 rounded-3xl border border-slate-800 space-y-4 shadow-2xl relative">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-amber-400 uppercase tracking-widest">
                الفرع الرئيسي الحكيم
              </span>
              <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-[11px] font-bold border border-emerald-500/30">
                مفتوح الآن
              </span>
            </div>

            <div className="space-y-2">
              <h3 className="text-xl font-bold text-slate-100">
                {tCommon('appName')}
              </h3>
              <p className="text-xs text-slate-400">
                {tCommon('flagshipAddress')}
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800/80 text-xs text-slate-300 space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-400">مواعيد العمل:</span>
                <span className="font-semibold text-slate-200">السبت–الأربعاء 10ص–10م</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">الخميس والجمعة:</span>
                <span className="font-semibold text-amber-400">10ص–11م</span>
              </div>
              <div className="flex justify-between items-center pt-1 border-t border-slate-800">
                <span className="text-slate-400">هاتف الفرع:</span>
                <a href="tel:035926908" className="font-bold text-blue-400 hover:underline tabular-nums" dir="ltr">03 5926908</a>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">واتساب مباشر:</span>
                <a href="https://wa.me/201224226876" target="_blank" rel="noopener noreferrer" className="font-bold text-emerald-400 hover:underline tabular-nums" dir="ltr">0122 422 6876</a>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-center text-xs font-bold text-slate-300">
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                <div className="text-amber-400 text-base font-extrabold">+12</div>
                <div className="text-[11px] text-slate-400">فئة ومستلزمات</div>
              </div>
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                <div className="text-blue-400 text-base font-extrabold">100%</div>
                <div className="text-[11px] text-slate-400">تغطية الإسكندرية</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
