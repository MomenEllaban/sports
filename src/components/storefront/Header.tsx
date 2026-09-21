'use client';

import React from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { Link, usePathname, useRouter } from '@/i18n/routing';
import { ShoppingBag, MapPin, Phone, Globe, ShieldCheck, Monitor, User, Menu, X, Heart } from 'lucide-react';
import { useCartStore } from '@/store/cartStore';
import ThemeToggle from '@/components/admin/ThemeToggle';
import Image from 'next/image';
import { WhatsAppIcon } from './WhatsAppButton';
import NavPending from '@/components/layout/NavPending';
import { useWishlistCount } from './WishlistButton';

function WishlistCount() {
  const count = useWishlistCount();
  if (count === 0) return null;
  return (
    <span className="absolute -top-1.5 -end-1.5 w-5 h-5 rounded-full bg-rose-500 text-white font-bold text-xs flex items-center justify-center border-2 border-slate-950 tabular-nums">
      {count > 99 ? '99+' : count}
    </span>
  );
}

export default function Header() {
  const t = useTranslations('common');
  const tNav = useTranslations('nav');
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const items = useCartStore((s) => s.items);
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const isAr = locale === 'ar';

  const totalItemsCount = items.reduce((acc, i) => acc + i.quantity, 0);

  const toggleLanguage = () => {
    const nextLocale = locale === 'ar' ? 'en' : 'ar';
    router.replace(pathname, { locale: nextLocale });
  };

  const navLinks = [
    { href: '/', label: tNav('home') },
    { href: '/catalog', label: tNav('catalog') },
    { href: '/branches', label: tNav('branches') },
    { href: '/tracking', label: tNav('trackOrder') },
    { href: '/account', label: isAr ? 'حسابي' : 'My account' },
  ];

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-800 bg-slate-950/85 backdrop-blur-md">
      {/* Top Announcement Bar */}
      <div className="bg-gradient-to-r from-blue-900 via-slate-900 to-amber-950 px-3 sm:px-4 py-1.5 text-xs text-slate-300 border-b border-slate-800/60">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 sm:gap-4 min-w-0">
            <span className="flex items-center gap-1 text-amber-400 font-medium min-w-0">
              <MapPin className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{t('flagshipAddress')}</span>
            </span>
            <span className="hidden md:inline-block text-slate-600">|</span>
            <a
              href="tel:035926908"
              className="hidden md:flex items-center gap-1.5 text-slate-300 hover:text-white transition-colors shrink-0"
              title={isAr ? 'اتصل بفرع الإبراهيمية: 03 5926908' : 'Call store: 03 5926908'}
            >
              <Phone className="w-3.5 h-3.5 text-blue-400 shrink-0" />
              <span dir="ltr" className="tabular-nums font-semibold tracking-wider text-slate-200 whitespace-nowrap">
                03 5926908
              </span>
            </a>
            <span className="hidden lg:inline-block text-slate-600">|</span>
            <a
              href="https://wa.me/201224226876"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden lg:flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-400 hover:text-emerald-300 transition-all font-bold text-[11px] group whitespace-nowrap"
              title={isAr ? 'تواصل معنا واتساب: 01224226876' : 'WhatsApp Us: 01224226876'}
            >
              <WhatsAppIcon className="w-3.5 h-3.5 text-emerald-400 group-hover:scale-110 transition-transform shrink-0" />
              <span dir="ltr" className="tabular-nums font-extrabold tracking-wider">
                0122 422 6876
              </span>
            </a>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <span className="text-emerald-400 hidden xl:flex items-center gap-1 font-semibold text-[11px] whitespace-nowrap">
              <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
              {t('workingHours')}
            </span>
            <button
              onClick={toggleLanguage}
              className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-200 transition-colors border border-slate-700 whitespace-nowrap"
            >
              <Globe className="w-3 h-3 text-blue-400" />
              {locale === 'ar' ? t('english') : t('arabic')}
            </button>
          </div>
        </div>
      </div>

      {/* Main Navbar */}
      <div className="max-w-7xl mx-auto px-3 sm:px-4 py-3 flex items-center justify-between gap-3">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 group shrink-0 min-w-0">
          <Image
            src="/logo.avif"
            alt={t('appName')}
            width={960}
            height={822}
            priority
            quality={80}
            sizes="44px"
            className="h-10 w-auto rounded-lg object-contain drop-shadow-[0_0_10px_rgba(245,166,35,0.35)] transition-transform group-hover:scale-105 shrink-0"
          />
          <div className="hidden md:block min-w-0">
            <h1 className="text-base lg:text-lg font-extrabold text-slate-100 tracking-tight leading-tight whitespace-nowrap group-hover:text-blue-400 transition-colors">
              {t('appName')}
            </h1>
            <p className="hidden xl:block text-[10px] text-slate-400 font-medium tracking-wide whitespace-nowrap">
              {t('tagline')}
            </p>
          </div>
        </Link>

        {/* Navigation Links */}
        <nav className="hidden lg:flex items-center gap-1 text-sm font-semibold" aria-label="Main">
          {navLinks.map((link) => {
            const active = isActive(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? 'page' : undefined}
                className={`px-3 py-2 rounded-xl whitespace-nowrap transition-colors ${
                  active
                    ? 'text-blue-400 bg-blue-500/10'
                    : 'text-slate-300 hover:text-blue-400 hover:bg-white/5'
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        {/* Actions */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Quick Staff Shortcuts */}
          <Link
            href="/pos"
            className="hidden sm:flex items-center gap-1.5 text-xs font-semibold px-2.5 py-2 xl:px-3 rounded-lg bg-slate-900 hover:bg-slate-800 text-amber-400 border border-amber-500/30 transition-all whitespace-nowrap"
            title="Cashier POS Terminal"
          >
            <Monitor className="w-4 h-4 text-amber-400 shrink-0" />
            <span className="hidden xl:inline">{t('pos')}</span>
          </Link>

          <Link
            href="/admin"
            className="hidden sm:flex items-center gap-1.5 text-xs font-semibold px-2.5 py-2 xl:px-3 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 transition-all whitespace-nowrap"
            title="ERP Admin Dashboard"
          >
            <User className="w-4 h-4 text-blue-400 shrink-0" />
            <span className="hidden xl:inline">{t('admin')}</span>
          </Link>

          {/* Wishlist Icon */}
          <Link
            href="/wishlist"
            className="relative flex items-center justify-center w-10 h-10 min-h-[44px] rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 hover:bg-rose-500 hover:text-white transition-all shadow-md shrink-0"
            aria-label={isAr ? 'قائمة الأمنيات' : 'Wishlist'}
          >
            <Heart className="w-5 h-5" />
            <WishlistCount />
          </Link>

          {/* Cart Icon */}
          <Link
            href="/cart"
            className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/40 text-blue-400 hover:bg-blue-600 hover:text-white transition-all shadow-md shrink-0"
            aria-label={isAr ? 'سلة المشتريات' : 'Shopping cart'}
          >
            <ShoppingBag className="w-5 h-5" />
            {totalItemsCount > 0 && (
              <span className="absolute -top-1.5 -end-1.5 w-5 h-5 rounded-full bg-amber-500 text-slate-950 font-bold text-xs flex items-center justify-center border-2 border-slate-950 tabular-nums">
                {totalItemsCount > 99 ? '99+' : totalItemsCount}
              </span>
            )}
          </Link>

          {/* Theme toggle (dark / light) */}
          <ThemeToggle />

          {/* Mobile menu toggle */}
          <button
            onClick={() => setMobileOpen((v) => !v)}
            className="lg:hidden flex items-center justify-center w-10 h-10 rounded-xl bg-slate-900 border border-slate-700 text-slate-200 hover:bg-slate-800 transition-all shrink-0"
            aria-label={isAr ? 'القائمة' : 'Toggle menu'}
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Navigation */}
      {mobileOpen && (
        <nav className="lg:hidden border-t border-slate-800 bg-slate-950/95 backdrop-blur-md animate-fade-in" aria-label="Mobile">
          <div className="max-w-7xl mx-auto px-4 py-3 grid gap-1 text-sm font-bold text-slate-200">
            {[...navLinks, { href: '/pos', label: t('pos') }, { href: '/admin', label: t('admin') }].map((link) => {
              const active = isActive(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  aria-current={active ? 'page' : undefined}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-xl transition-colors ${
                    active ? 'bg-blue-500/10 text-blue-400' : 'hover:bg-slate-800 hover:text-blue-400'
                  }`}
                >
                  <NavPending className="text-blue-400" />
                  {link.label}
                </Link>
              );
            })}

            {/* Direct Contact in Mobile Menu */}
            <div className="pt-2 mt-2 border-t border-slate-800/80 grid grid-cols-1 gap-2 text-xs">
              <a
                href="https://wa.me/201224226876"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-bold"
              >
                <span className="flex items-center gap-2">
                  <WhatsAppIcon className="w-4 h-4 text-emerald-400" />
                  <span>{isAr ? 'تواصل واتساب مباشر' : 'Direct WhatsApp'}</span>
                </span>
                <span dir="ltr" className="tabular-nums font-black whitespace-nowrap">0122 422 6876</span>
              </a>
              <a
                href="tel:035926908"
                className="flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white font-bold"
              >
                <span className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-blue-400" />
                  <span>{isAr ? 'هاتف فرع الإبراهيمية' : 'Call Flagship Store'}</span>
                </span>
                <span dir="ltr" className="tabular-nums font-black whitespace-nowrap">03 5926908</span>
              </a>
            </div>
          </div>
        </nav>
      )}
    </header>
  );
}
