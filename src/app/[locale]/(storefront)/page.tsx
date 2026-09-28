import React from 'react';
import HeroBanner from '@/components/storefront/HeroBanner';
import ProductCard from '@/components/storefront/ProductCard';
import Reveal from '@/components/storefront/Reveal';
import { prisma } from '@/lib/db';
import { num } from '@/lib/pricing';
import { getStoreInfo } from '@/lib/settings';
import { Link } from '@/i18n/routing';
import { Trophy, Activity, Waves, Dumbbell, Shield, MapPin, Phone, ArrowLeft, ArrowRight, Monitor } from 'lucide-react';
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

  const categoryIcons: Record<string, React.ReactNode> = {
    'cardio-fitness': <Activity className="w-6 h-6 text-blue-400" />,
    'swimming-gear': <Waves className="w-6 h-6 text-cyan-400" />,
    'gym-accessories': <Dumbbell className="w-6 h-6 text-amber-400" />,
    'apparel-footwear': <Trophy className="w-6 h-6 text-emerald-400" />,
    'medical-protection': <Shield className="w-6 h-6 text-rose-400" />,
  };

  // Digits only, so a formatted landline still produces a dialable tel: link.
  const telHref = `tel:${store.landline.replace(/[^\d+]/g, '')}`;
  const waHref = `https://wa.me/20${store.whatsapp.replace(/[^\d]/g, '').replace(/^20/, '')}`;

  return (
    <main className="flex-1 space-y-16 pb-16">
      <HeroBanner />

      {/* Brand strip — the fastest way to signal "real sports retailer". */}
      {brands.length > 0 && (
        <section className="max-w-7xl mx-auto px-4">
          <p className="text-center text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500 mb-5">
            {isAr ? 'ماركات عالمية معتمدة' : 'Authorised global brands'}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-4">
            {brands.map((brand, i) => (
              <Reveal key={brand.id} delay={Math.min(i * 40, 200)}>
                <span className="text-lg sm:text-xl font-black text-slate-400 hover:text-slate-200 transition-colors cursor-default">
                  {isAr ? brand.nameAr : brand.nameEn}
                </span>
              </Reveal>
            ))}
          </div>
        </section>
      )}

      {/* Categories */}
      <section className="max-w-7xl mx-auto px-4">
        <div className="flex justify-between items-end mb-8">
          <div>
            <span className="text-xs font-bold text-blue-400 uppercase tracking-wider">
              {isAr ? 'التصنيفات الرياضية' : 'Sports categories'}
            </span>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-100 mt-1">
              {isAr ? 'تسوق حسب الرياضة والنشاط' : 'Shop by sport and activity'}
            </h2>
          </div>
          <Link
            href="/catalog"
            className="text-sm font-bold text-amber-400 hover:underline flex items-center gap-1"
          >
            {isAr ? 'عرض الكل' : 'View all'} {isAr ? <ArrowLeft className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
          </Link>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
          {categories.map((cat, index) => (
            <Reveal key={cat.id} delay={Math.min(index * 70, 280)}>
              <Link
                href={`/catalog?category=${cat.slug}`}
                className="glass-card p-5 rounded-2xl border border-slate-800 flex flex-col items-center text-center gap-3 group hover:-translate-y-1 hover:border-blue-500/40 transition-all duration-300"
              >
                <div className="p-3 rounded-2xl bg-slate-900 group-hover:scale-110 transition-transform">
                  {categoryIcons[cat.slug] || <Dumbbell className="w-6 h-6 text-blue-400" />}
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-100 group-hover:text-blue-400 transition-colors">
                    {isAr ? cat.nameAr : cat.nameEn}
                  </h3>
                </div>
              </Link>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Featured products */}
      <section className="max-w-7xl mx-auto px-4">
        <div className="flex justify-between items-end mb-8">
          <div>
            <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">
              {isAr ? 'المعدات والأدوات الأكثر طلباً' : 'Most requested equipment & tools'}
            </span>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-100 mt-1">
              {t('featuredProducts')}
            </h2>
          </div>
          <Link
            href="/catalog"
            className="text-sm font-bold text-blue-400 hover:underline flex items-center gap-1"
          >
            {isAr ? 'تصفح الكتالوج بالكامل' : 'Browse the full catalog'}
          </Link>
        </div>

        {cardProducts.length === 0 ? (
          <p className="text-sm text-slate-400 glass-panel rounded-2xl border border-slate-800 p-8 text-center">
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
            className="glass-panel p-6 sm:p-8 rounded-3xl border border-blue-500/25 bg-gradient-to-r from-blue-950/40 via-slate-950 to-amber-950/30 grid md:grid-cols-12 gap-6 items-center hover:border-amber-500/40 transition-colors duration-300 block"
          >
            <div className="md:col-span-8 space-y-2">
              <span className="px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 text-xs font-bold border border-blue-500/30 inline-flex items-center gap-1.5">
                <Monitor className="w-3.5 h-3.5" />
                {isAr ? 'نظام إدارة متكامل ERP' : 'All-in-one ERP'}
              </span>
              <h2 className="text-xl sm:text-2xl font-black text-slate-100">
                {isAr ? 'تشتغل متجرك بنظام واحد: كاشير + مخزون + محاسبة + ضرائب' : 'Run your store on one system: POS, inventory, accounting & taxes'}
              </h2>
              <p className="text-sm text-slate-400 leading-relaxed">
                {isAr
                  ? 'شوف كل مميزات النظام بالتفصيل — المرتجعات، الورديات، التقارير، المتجر الإلكتروني، وأكثر.'
                  : 'See every feature in detail — returns, shifts, reports, the online store, and more.'}
              </p>
            </div>
            <div className="md:col-span-4 flex md:justify-end">
              <span className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-sm transition-all shadow-lg shadow-amber-500/20">
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
          <div className="glass-panel p-8 rounded-3xl border border-slate-800 bg-gradient-to-r from-slate-900 via-slate-950 to-blue-950/40 grid md:grid-cols-12 gap-8 items-center hover:border-amber-500/30 transition-colors duration-300">
            <div className="md:col-span-8 space-y-4">
              <span className="px-3 py-1 rounded-full bg-amber-500/20 text-amber-400 text-xs font-bold border border-amber-500/30">
                {isAr ? 'الفرع الرئيسي' : 'Flagship store'}
              </span>
              <h3 className="text-2xl sm:text-3xl font-black text-slate-100">
                {isAr ? store.nameAr : store.nameEn}
              </h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                {isAr
                  ? 'يسعدنا استقبالكم لتجربة المشايات الكهربائية، العجل الرياضي، قياس ملابس وأحذية السباحة والباليه، أو الشراء المباشر واستلام الطلبات الإلكترونية بدون رسوم شحن.'
                  : 'Visit us to try electric treadmills, sports wheels, swimwear and ballet shoes, or order online and collect your purchases with no shipping fee.'}
              </p>
              <div className="flex flex-wrap items-center gap-4 text-xs font-semibold text-slate-300">
                <div className="flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>{isAr ? store.addressAr : store.addressEn}</span>
                </div>
                <a href={telHref} className="flex items-center gap-1.5 hover:text-slate-100 transition-colors">
                  <Phone className="w-4 h-4 text-blue-400 shrink-0" />
                  <span dir="ltr" className="tabular-nums font-bold">{store.landline}</span>
                </a>
                <a
                  href={waHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/25 transition-colors font-bold"
                  title={isAr ? `تواصل واتساب: ${store.whatsapp}` : `WhatsApp: ${store.whatsapp}`}
                >
                  <WhatsAppIcon className="w-4 h-4 text-emerald-400" />
                  <span className="hidden sm:inline">{isAr ? 'واتساب:' : 'WhatsApp:'}</span>
                  <span dir="ltr" className="tabular-nums font-black">{store.whatsapp}</span>
                </a>
              </div>
            </div>
            <div className="md:col-span-4 flex justify-center">
              <Link
                href="/branches"
                className="px-6 py-3.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-sm transition-all shadow-lg shadow-amber-500/20"
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
