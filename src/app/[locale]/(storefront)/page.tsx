import React from 'react';
import HeroBanner from '@/components/storefront/HeroBanner';
import ProductCard from '@/components/storefront/ProductCard';
import Reveal from '@/components/storefront/Reveal';
import { prisma } from '@/lib/db';
import { num } from '@/lib/pricing';
import { getStoreInfo } from '@/lib/settings';
import { Link } from '@/i18n/routing';
import { Trophy, Activity, Waves, Dumbbell, Shield, MapPin, Phone, ArrowLeft, ArrowRight, Monitor, Zap } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { WhatsAppIcon } from '@/components/storefront/WhatsAppButton';

export const dynamic = 'force-dynamic';

export default async function StorefrontHomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const isAr = locale === 'ar';
  const t = await getTranslations({ locale, namespace: 'storefront' });

  const [products, categories, brands, store] = await Promise.all([
    prisma.product.findMany({
      where: { isActive: true },
      take: 8,
      orderBy: [{ isFeatured: 'desc' }, { createdAt: 'desc' }],
      select: {
        id: true,
        sku: true,
        barcode: true,
        nameAr: true,
        nameEn: true,
        descriptionAr: true,
        descriptionEn: true,
        price: true,
        isFeatured: true,
        images: true,
        // Only the two branch name columns are rendered, so the full branch
        // row (address, tax number, timestamps, …) is no longer fetched for
        // every product's stock rows.
        category: { select: { nameAr: true, nameEn: true } },
        inventories: {
          select: {
            stockQuantity: true,
            branch: { select: { name: true, nameEn: true } },
          },
        },
      },
    }),
    prisma.category.findMany({
      take: 5,
      select: { id: true, slug: true, nameAr: true, nameEn: true },
    }),
    prisma.brand.findMany({
      take: 8,
      // Brand has no isActive column — only brands that actually have something
      // to sell belong in the strip.
      where: { products: { some: { isActive: true } } },
      select: { id: true, nameAr: true, nameEn: true },
      orderBy: { nameAr: 'asc' },
    }),
    getStoreInfo(),
  ]);

  const cardProducts = products.map((product) => ({
    id: product.id,
    sku: product.sku,
    barcode: product.barcode,
    nameAr: product.nameAr,
    nameEn: product.nameEn,
    descriptionAr: product.descriptionAr,
    descriptionEn: product.descriptionEn,
    price: num(product.price),
    isFeatured: product.isFeatured,
    images: product.images,
    category: { nameAr: product.category.nameAr, nameEn: product.category.nameEn },
    inventories: product.inventories.map((inventory) => ({
      branch: { name: inventory.branch.name, nameEn: inventory.branch.nameEn },
      stockQuantity: inventory.stockQuantity,
    })),
  }));

  const categoryMeta: Record<string, { icon: React.ReactNode; bg: string; border: string }> = {
    'cardio-fitness': {
      icon: <Activity className="w-6 h-6 text-blue-400 group-hover:text-blue-300" />,
      bg: 'bg-blue-500/10 group-hover:bg-blue-500/20',
      border: 'group-hover:border-blue-500/50',
    },
    'swimming-gear': {
      icon: <Waves className="w-6 h-6 text-cyan-400 group-hover:text-cyan-300" />,
      bg: 'bg-cyan-500/10 group-hover:bg-cyan-500/20',
      border: 'group-hover:border-cyan-500/50',
    },
    'gym-accessories': {
      icon: <Dumbbell className="w-6 h-6 text-amber-400 group-hover:text-amber-300" />,
      bg: 'bg-amber-500/10 group-hover:bg-amber-500/20',
      border: 'group-hover:border-amber-500/50',
    },
    'apparel-footwear': {
      icon: <Trophy className="w-6 h-6 text-emerald-400 group-hover:text-emerald-300" />,
      bg: 'bg-emerald-500/10 group-hover:bg-emerald-500/20',
      border: 'group-hover:border-emerald-500/50',
    },
    'medical-protection': {
      icon: <Shield className="w-6 h-6 text-rose-400 group-hover:text-rose-300" />,
      bg: 'bg-rose-500/10 group-hover:bg-rose-500/20',
      border: 'group-hover:border-rose-500/50',
    },
  };

  // Digits only, so a formatted landline still produces a dialable tel: link.
  const telHref = `tel:${store.landline.replace(/[^\d+]/g, '')}`;
  const waHref = `https://wa.me/20${store.whatsapp.replace(/[^\d]/g, '').replace(/^20/, '')}`;

  return (
    <main className="flex-1 space-y-16 pb-16">
      <HeroBanner />

      {/* Brand strip — dynamic athletic marquee */}
      {brands.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 overflow-hidden">
          <div className="flex items-center justify-between mb-4">
            <span className="text-[11px] font-black uppercase tracking-[0.2em] text-ink-muted flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
              {isAr ? 'ماركات عالمية معتمدة ووكلاء رسميون' : 'Authorised global sports brands'}
            </span>
            <span className="text-xs text-ink-muted hidden sm:inline">
              {isAr ? 'أصلية 100% معتمدة' : '100% Genuine Guaranteed'}
            </span>
          </div>

          <div className="relative py-2 overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_10%,black_90%,transparent)]">
            <div className="animate-marquee flex items-center gap-4 whitespace-nowrap">
              {[...brands, ...brands].map((brand, i) => (
                <div
                  key={`${brand.id}-${i}`}
                  className="px-5 py-2.5 rounded-2xl glass-card border border-line flex items-center gap-2 hover:border-amber-400/50 hover:scale-105 transition-all duration-300 shadow-sm cursor-default"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                  <span className="text-sm font-black text-ink tracking-wide">
                    {isAr ? brand.nameAr : brand.nameEn}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Categories */}
      <section className="max-w-7xl mx-auto px-4">
        <div className="flex justify-between items-end mb-8">
          <div>
            <span className="text-xs font-black text-blue-500 uppercase tracking-widest flex items-center gap-1.5">
              <Trophy className="w-3.5 h-3.5 text-amber-400" />
              {isAr ? 'التصنيفات الرياضية المتخصصة' : 'Sports categories'}
            </span>
            <h2 className="text-2xl sm:text-3xl font-black text-ink mt-1">
              {isAr ? 'تسوق حسب الرياضة والنشاط' : 'Shop by sport and activity'}
            </h2>
          </div>
          <Link
            href="/catalog"
            className="text-sm font-bold text-amber-500 hover:text-amber-400 hover:underline flex items-center gap-1 group transition-colors"
          >
            <span>{isAr ? 'عرض الكل' : 'View all'}</span>
            {isAr ? <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" /> : <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />}
          </Link>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
          {categories.map((cat, index) => {
            const meta = categoryMeta[cat.slug] || {
              icon: <Dumbbell className="w-6 h-6 text-blue-400 group-hover:text-blue-300" />,
              bg: 'bg-blue-500/10 group-hover:bg-blue-500/20',
              border: 'group-hover:border-blue-500/50',
            };
            return (
              <Reveal key={cat.id} delay={Math.min(index * 70, 280)}>
                <Link
                  href={`/catalog?category=${cat.slug}`}
                  className={`glass-card p-5 rounded-2xl border border-line flex flex-col items-center text-center gap-3.5 group hover:-translate-y-2 hover:shadow-xl transition-all duration-300 relative overflow-hidden ${meta.border}`}
                >
                  <div className={`p-3.5 rounded-2xl ${meta.bg} transition-all duration-300 group-hover:scale-110 shadow-sm`}>
                    {meta.icon}
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-ink group-hover:text-blue-500 transition-colors">
                      {isAr ? cat.nameAr : cat.nameEn}
                    </h3>
                  </div>
                </Link>
              </Reveal>
            );
          })}
        </div>
      </section>

      {/* Featured products */}
      <section className="max-w-7xl mx-auto px-4">
        <div className="flex justify-between items-end mb-8">
          <div>
            <span className="text-xs font-black text-amber-500 uppercase tracking-widest flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              {isAr ? 'المعدات والأدوات الأكثر طلباً' : 'Most requested equipment & tools'}
            </span>
            <h2 className="text-2xl sm:text-3xl font-black text-ink mt-1">
              {t('featuredProducts')}
            </h2>
          </div>
          <Link
            href="/catalog"
            className="text-sm font-bold text-amber-500 hover:text-amber-400 hover:underline flex items-center gap-1 group transition-colors"
          >
            <span>{isAr ? 'تصفح الكتالوج بالكامل' : 'Browse the full catalog'}</span>
            {isAr ? <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" /> : <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />}
          </Link>
        </div>

        {cardProducts.length === 0 ? (
          <p className="text-sm text-ink-muted glass-panel rounded-2xl border border-line p-8 text-center">
            {isAr ? 'لا توجد منتجات معروضة حالياً.' : 'No products are published yet.'}
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {cardProducts.map((product, index) => (
              <Reveal key={product.id} delay={Math.min(index * 70, 280)}>
                <ProductCard product={product} />
              </Reveal>
            ))}
          </div>
        )}
      </section>

      {/* ERP showcase */}
      <section className="max-w-7xl mx-auto px-4">
        <Reveal>
          <Link
            href="/features"
            className="glass-panel p-6 sm:p-8 rounded-3xl border border-blue-500/30 bg-gradient-to-r from-blue-950/25 via-surface to-amber-950/20 grid md:grid-cols-12 gap-6 items-center hover:border-amber-500/40 transition-all duration-300 block group"
          >
            <div className="md:col-span-8 space-y-2.5">
              <span className="px-3 py-1 rounded-full bg-blue-500/15 text-blue-400 text-xs font-black border border-blue-500/30 inline-flex items-center gap-1.5 shadow-sm">
                <Monitor className="w-3.5 h-3.5" />
                {isAr ? 'نظام إدارة متكامل ERP' : 'All-in-one ERP'}
              </span>
              <h2 className="text-xl sm:text-2xl font-black text-ink leading-snug">
                {isAr ? 'تشتغل متجرك بنظام واحد: كاشير + مخزون + محاسبة + ضرائب' : 'Run your store on one system: POS, inventory, accounting & taxes'}
              </h2>
              <p className="text-sm text-ink-soft leading-relaxed max-w-2xl">
                {isAr
                  ? 'شوف كل مميزات النظام بالتفصيل — المرتجعات، الورديات، التقارير، المتجر الإلكتروني، وأكثر.'
                  : 'See every feature in detail — returns, shifts, reports, the online store, and more.'}
              </p>
            </div>
            <div className="md:col-span-4 flex md:justify-end">
              <span className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-black text-sm transition-all duration-300 shadow-lg shadow-amber-500/25 group-hover:scale-105 active:scale-95 shimmer-hover">
                {isAr ? 'استكشف المميزات' : 'Explore features'}
                {isAr ? <ArrowLeft className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
              </span>
            </div>
          </Link>
        </Reveal>
      </section>

      {/* Flagship store */}
      <section className="max-w-7xl mx-auto px-4">
        <Reveal>
          <div className="glass-panel p-8 rounded-3xl border border-line bg-gradient-to-r from-surface via-surface to-blue-950/15 grid md:grid-cols-12 gap-8 items-center hover:border-amber-500/40 transition-colors duration-300">
            <div className="md:col-span-8 space-y-4">
              <span className="px-3.5 py-1.5 rounded-full bg-amber-500/15 text-amber-500 text-xs font-black border border-amber-500/30 inline-flex items-center gap-1.5 shadow-sm">
                <MapPin className="w-3.5 h-3.5 text-amber-500" />
                {isAr ? 'الفرع الرئيسي بالإسكندرية' : 'Flagship Store Alexandria'}
              </span>
              <h3 className="text-2xl sm:text-3xl font-black text-ink">
                {isAr ? store.nameAr : store.nameEn}
              </h3>
              <p className="text-sm text-ink-soft leading-relaxed max-w-2xl">
                {isAr
                  ? 'يسعدنا استقبالكم لتجربة المشايات الكهربائية، العجل الرياضي، قياس ملابس وأحذية السباحة والباليه، أو الشراء المباشر واستلام الطلبات الإلكترونية بدون رسوم شحن.'
                  : 'Visit us to try electric treadmills, sports wheels, swimwear and ballet shoes, or order online and collect your purchases with no shipping fee.'}
              </p>
              <div className="flex flex-wrap items-center gap-4 text-xs font-semibold">
                <div className="flex items-center gap-1.5 text-ink-soft">
                  <MapPin className="w-4 h-4 text-amber-500 shrink-0" />
                  <span>{isAr ? store.addressAr : store.addressEn}</span>
                </div>
                <a href={telHref} className="flex items-center gap-1.5 text-ink hover:text-blue-400 transition-colors">
                  <Phone className="w-4 h-4 text-blue-400 shrink-0" />
                  <span dir="ltr" className="tabular-nums font-bold">{store.landline}</span>
                </a>
                <a
                  href={waHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-500 hover:bg-emerald-500/25 transition-all font-bold shadow-sm"
                  title={isAr ? `تواصل واتساب: ${store.whatsapp}` : `WhatsApp: ${store.whatsapp}`}
                >
                  <WhatsAppIcon className="w-4 h-4 text-emerald-500" />
                  <span className="hidden sm:inline">{isAr ? 'واتساب:' : 'WhatsApp:'}</span>
                  <span dir="ltr" className="tabular-nums font-black">{store.whatsapp}</span>
                </a>
              </div>
            </div>
            <div className="md:col-span-4 flex justify-center md:justify-end">
              <Link
                href="/branches"
                className="px-7 py-3.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-black text-sm transition-all duration-300 shadow-lg shadow-amber-500/20 hover:scale-105 active:scale-95 shimmer-hover text-center"
              >
                {isAr ? 'معلومات الوصول وتوجيهات الخريطة' : 'Access information & map directions'}
              </Link>
            </div>
          </div>
        </Reveal>
      </section>
    </main>
  );
}
