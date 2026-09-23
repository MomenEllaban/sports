'use client';

import React from 'react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { MapPin, Phone, Clock, ShieldCheck, CreditCard, Heart } from 'lucide-react';
import { Link } from '@/i18n/routing';
import WhatsAppButton, { WhatsAppIcon } from './WhatsAppButton';

export default function Footer() {
  const tCommon = useTranslations('common');

  return (
    <footer className="bg-slate-950 border-t border-slate-800 text-slate-400 text-sm">
      <div className="max-w-7xl mx-auto px-4 py-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
        {/* Col 1: About & Flagship Location */}
        <div className="space-y-4">
          <Link href="/" className="flex items-center gap-3 group">
            <Image
              src="/logo.avif"
              alt={tCommon('appName')}
              width={960}
              height={822}
              quality={80}
              sizes="48px"
              className="h-11 w-auto rounded-lg object-contain group-hover:scale-105 transition-transform"
            />
            <div>
              <h3 className="font-extrabold text-slate-100 text-base group-hover:text-blue-400 transition-colors">
                {tCommon('appName')}
              </h3>
              <p className="text-[10px] text-amber-400 font-semibold">
                {tCommon('tagline')}
              </p>
            </div>
          </Link>
          <p className="text-xs text-slate-400 leading-relaxed">
            المقر الرئيسي لبيع الملابس والمعدات الرياضية ومستلزمات السباحة، الكارديو، الجيم والباليه بالإسكندرية.
          </p>
          <div className="text-xs space-y-2 text-slate-300">
            <div className="flex items-start gap-2">
              <MapPin className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <span>{tCommon('flagshipAddress')}</span>
            </div>
            <div className="flex items-center gap-2">
              <Phone className="w-4 h-4 text-blue-400 shrink-0" />
              <a href="tel:035926908" className="hover:text-blue-400 transition-colors">
                <span dir="ltr" className="tabular-nums font-semibold tracking-wide">{tCommon('phone')}</span>
              </a>
            </div>
            <div className="flex items-center gap-2">
              <WhatsAppIcon className="w-4 h-4 text-emerald-400 shrink-0" />
              <a
                href="https://wa.me/201224226876"
                target="_blank"
                rel="noopener noreferrer"
                className="text-emerald-400 hover:text-emerald-300 font-bold transition-colors flex items-center gap-1.5"
              >
                <span dir="ltr" className="tabular-nums font-bold">0122 422 6876</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/30">واتساب</span>
              </a>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{tCommon('workingHours')}</span>
            </div>
          </div>
        </div>

        {/* Col 2: Quick Links */}
        <div className="space-y-3">
          <h4 className="font-bold text-slate-200 text-sm">روابط سريعة</h4>
          <ul className="space-y-2 text-xs">
            <li>
              <Link href="/catalog" className="hover:text-blue-400 transition-colors">
                معدات الكارديو واللياقة
              </Link>
            </li>
            <li>
              <Link href="/catalog" className="hover:text-blue-400 transition-colors">
                أدوات ومستلزمات السباحة
              </Link>
            </li>
            <li>
              <Link href="/catalog" className="hover:text-blue-400 transition-colors">
                أحزمة وحبال TRX وأدوات الجيم
              </Link>
            </li>
            <li>
              <Link href="/catalog" className="hover:text-blue-400 transition-colors">
                أحذية الباليه والكروكس الطبي
              </Link>
            </li>
            <li>
              <Link href="/tracking" className="hover:text-amber-400 transition-colors">
                تتبع حالة الشحنة
              </Link>
            </li>
          </ul>
        </div>

        {/* Col 3: Staff & System Access */}
        <div className="space-y-3">
          <h4 className="font-bold text-slate-200 text-sm">أنظمة الإدارة والكاشير</h4>
          <ul className="space-y-2 text-xs">
            <li>
              <Link href="/pos" className="text-amber-400 hover:underline flex items-center gap-1">
                • كاشير ونقطة البيع POS (للفروع)
              </Link>
            </li>
            <li>
              <Link href="/admin" className="text-blue-400 hover:underline flex items-center gap-1">
                • لوحة التحكم الإدارية ERP (المديرين والحسابات)
              </Link>
            </li>
            <li>
              <Link href="/admin/login" className="hover:text-slate-300 transition-colors">
                • تسجيل دخول الموظفين
              </Link>
            </li>
          </ul>

          <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-[11px] space-y-1 mt-4">
            <div className="flex items-center gap-1.5 font-bold text-emerald-400">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>منظومة الفاتورة الإلكترونية ETA</span>
            </div>
            <p className="text-slate-400">
              متوافق مع معايير مصلحة الضرائب المصرية للإيصال والفاتورة الإلكترونية.
            </p>
          </div>
        </div>

        {/* Col 4: Payments & Delivery */}
        <div className="space-y-3">
          <h4 className="font-bold text-slate-200 text-sm">طرق الدفع والشحن المتاحة</h4>
          <div className="flex flex-wrap gap-2 text-xs text-slate-300">
            <span className="px-2.5 py-1 rounded-chip bg-slate-900 border border-slate-800 flex items-center gap-1">
              <CreditCard className="w-3.5 h-3.5 text-blue-400" /> Paymob / كروت البنوك
            </span>
            <span className="px-2.5 py-1 rounded-chip bg-slate-900 border border-slate-800">
              فودافون كاش / اتصالات / أورانج
            </span>
            <span className="px-2.5 py-1 rounded-chip bg-slate-900 border border-slate-800">
              فوري Fawry
            </span>
            <span className="px-2.5 py-1 rounded-chip bg-slate-900 border border-slate-800 text-amber-400">
              الدفع عند الاستلام COD
            </span>
            <span className="px-2.5 py-1 rounded-chip bg-slate-900 border border-slate-800">
              InstaPay انستا باي
            </span>
          </div>

          <p className="text-xs text-slate-500 pt-2">
            شركاء الشحن: بوسطة (Bosta)، مايلرز (Mylerz)، مرسول الإسكندرية (Mrsool).
          </p>
        </div>
      </div>

      {/* Sub-footer */}
      <div className="border-t border-slate-900 bg-slate-950/90 py-4 px-4 text-center text-xs text-slate-500 flex flex-wrap items-center justify-between gap-2 max-w-7xl mx-auto">
        <p>© 2026 ابطال الرياضة الإبراهيمية - جميع الحقوق محفوظة.</p>
        <p className="flex items-center gap-1">
          مصمم بالإسكندرية <Heart className="w-3 h-3 text-rose-500 fill-rose-500" />
        </p>
      </div>

      {/* Floating WhatsApp Quick Contact Button */}
      <WhatsAppButton />
    </footer>
  );
}
