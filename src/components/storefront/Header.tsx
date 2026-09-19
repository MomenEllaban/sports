'use client';

import React from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { Link, usePathname, useRouter } from '@/i18n/routing';
import { ShoppingBag, MapPin, Phone, Globe, ShieldCheck, Monitor, User, Menu, X } from 'lucide-react';
import { useCartStore } from '@/store/cartStore';
import ThemeToggle from '@/components/admin/ThemeToggle';
import Image from 'next/image';

export default function Header() {
  const t = useTranslations('common');
  const tNav = useTranslations('nav');
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const items = useCartStore((s) => s.items);
  const [mobileOpen, setMobileOpen] = React.useState(false);

  const totalItemsCount = items.reduce((acc, i) => acc + i.quantity, 0);

  const toggleLanguage = () => {
    const nextLocale = locale === 'ar' ? 'en' : 'ar';
    router.replace(pathname, { locale: nextLocale });
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-800 bg-slate-950/85 backdrop-blur-md">
      {/* Top Announcement Bar */}
      <div className="bg-gradient-to-r from-blue-900 via-slate-900 to-amber-950 px-4 py-1.5 text-xs text-slate-300 border-b border-slate-800/60">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1 text-amber-400 font-medium">
              <MapPin className="w-3.5 h-3.5" />
              {t('flagshipAddress')}
            </span>
            <span className="hidden sm:inline-block text-slate-500">|</span>
            <span className="hidden md:flex items-center gap-1 text-slate-300">
              <Phone className="w-3.5 h-3.5 text-blue-400" />
              {t('phone')}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-emerald-400 flex items-center gap-1 font-semibold text-[11px]">
              <ShieldCheck className="w-3.5 h-3.5" />
              {t('workingHours')}
            </span>
            <button
              onClick={toggleLanguage}
              className="flex items-center gap-1 text-xs px-2 py-0.5 rounded bg-slate-800/80 hover:bg-slate-700 text-slate-200 transition-colors border border-slate-700"
            >
              <Globe className="w-3 h-3 text-blue-400" />
              {locale === 'ar' ? t('english') : t('arabic')}
            </button>
          </div>
        </div>
      </div>

      {/* Main Navbar */}
      <div className="max-w-7xl mx-auto px-4 py-3.5 flex items-center justify-between gap-4">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-3 group">
          <Image
            src="/logo.avif"
            alt={t('appName')}
            width={960}
            height={822}
            priority
            quality={80}
            sizes="48px"
            className="h-11 w-auto rounded-lg object-contain drop-shadow-[0_0_10px_rgba(245,166,35,0.35)] group-hover:scale-105 transition-transform"
          />
          <div>
            <h1 className="text-lg md:text-xl font-extrabold text-slate-100 tracking-tight leading-tight group-hover:text-blue-400 transition-colors">
              {t('appName')}
            </h1>
            <p className="text-[10px] text-slate-400 font-medium tracking-wide">
              {t('tagline')}
            </p>
          </div>
        </Link>

        {/* Navigation Links */}
        <nav className="hidden lg:flex items-center gap-6 text-sm font-semibold text-slate-300">
          <Link href="/" className="hover:text-blue-400 transition-colors">
            {tNav('home')}
          </Link>
          <Link href="/catalog" className="hover:text-blue-400 transition-colors">
            {tNav('catalog')}
          </Link>
          <Link href="/branches" className="hover:text-blue-400 transition-colors">
            {tNav('branches')}
          </Link>
          <Link href="/tracking" className="hover:text-blue-400 transition-colors">
            {tNav('trackOrder')}
          </Link>
        </nav>

        {/* Actions */}
        <div className="flex items-center gap-3">
          {/* Quick Staff Shortcuts */}
          <Link
            href="/pos"
            className="hidden sm:flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-amber-400 border border-amber-500/30 transition-all"
            title="Cashier POS Terminal"
          >
            <Monitor className="w-4 h-4 text-amber-400" />
            {t('pos')}
          </Link>

          <Link
            href="/admin"
            className="hidden sm:flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 transition-all"
            title="ERP Admin Dashboard"
          >
            <User className="w-4 h-4 text-blue-400" />
            {t('admin')}
          </Link>

          {/* Cart Icon */}
          <Link
            href="/cart"
            className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/40 text-blue-400 hover:bg-blue-600 hover:text-white transition-all shadow-md"
            aria-label="Shopping Cart"
          >
            <ShoppingBag className="w-5 h-5" />
            {totalItemsCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-amber-500 text-slate-950 font-bold text-xs flex items-center justify-center border-2 border-slate-950 animate-pulse">
                {totalItemsCount}
              </span>
            )}
          </Link>

          {/* Theme toggle (dark / light) */}
          <ThemeToggle />

          {/* Mobile menu toggle */}
          <button
            onClick={() => setMobileOpen((v) => !v)}
            className="lg:hidden flex items-center justify-center w-10 h-10 rounded-xl bg-slate-900 border border-slate-700 text-slate-200 hover:bg-slate-800 transition-all"
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Navigation */}
      {mobileOpen && (
        <nav className="lg:hidden border-t border-slate-800 bg-slate-950/95 backdrop-blur-md animate-fade-in">
          <div className="max-w-7xl mx-auto px-4 py-3 grid gap-1 text-sm font-bold text-slate-200">
            {[
              { href: '/', label: tNav('home') },
              { href: '/catalog', label: tNav('catalog') },
              { href: '/branches', label: tNav('branches') },
              { href: '/tracking', label: tNav('trackOrder') },
              { href: '/pos', label: t('pos') },
              { href: '/admin', label: t('admin') },
            ].map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className="px-3 py-2.5 rounded-xl hover:bg-slate-800 hover:text-blue-400 transition-colors"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </nav>
      )}
    </header>
  );
}
