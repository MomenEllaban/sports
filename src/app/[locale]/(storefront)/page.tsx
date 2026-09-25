import React from 'react';
import HeroBanner from '@/components/storefront/HeroBanner';
import ProductCard from '@/components/storefront/ProductCard';
import Reveal from '@/components/storefront/Reveal';
import { prisma } from '@/lib/db';
import { num } from '@/lib/pricing';
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

  // Fetch featured products with flagship branch inventory
  const products = await prisma.product.findMany({
    where: { isActive: true },
    take: 8,
    orderBy: { isFeatured: 'desc' },
    include: {
      category: true,
      inventories: {
        include: {
          branch: true,
        },
      },
    },
  });

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

  const categories = await prisma.category.findMany({
    take: 5,
  });

  const categoryIcons: Record<string, React.ReactNode> = {
    'cardio-fitness': <Activity className="w-6 h-6 text-blue-400" />,
    'swimming-gear': <Waves className="w-6 h-6 text-cyan-400" />,
    'gym-accessories': <Dumbbell className="w-6 h-6 text-amber-400" />,
    'apparel-footwear': <Trophy className="w-6 h-6 text-emerald-400" />,
    'medical-protection': <Shield className="w-6 h-6 text-rose-400" />,
  };

  return (
      
      <main className="flex-1 space-y-16 pb-16">
        <HeroBanner />

        {/* ERP Showcase CTA */}
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

        {/* Categories Section */}
        <section className="max-w-7xl mx-auto px-4">
          <div className="flex justify-between items-end mb-8">
            <div>
              <span className="text-xs font-bold text-blue-400 uppercase tracking-wider">
                التصنيفات الرياضية
              </span>
              <h2 className="text-2xl sm:text-3xl font-black text-slate-100 mt-1">
                تسوق حسب الرياضة والنشاط
              </h2>
            </div>
            <Link
              href="/catalog"
              className="text-sm font-bold text-amber-400 hover:underline flex items-center gap-1"
            >
              عرض الكل {isAr ? <ArrowLeft className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
            </Link>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
            {categories.map((cat, index) => (
              <Reveal key={cat.id} delay={Math.min(index * 70, 280)}>
              <Link
                href={`/catalog?category=${cat.slug}`}
                className="glass-card p-5 rounded-2xl border border-slate-800 flex flex-col items-center text-center gap-3 group hover:-translate-y-1 transition-transform duration-300"
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

        {/* Featured Products Catalog Grid */}
        <section className="max-w-7xl mx-auto px-4">
          <div className="flex justify-between items-end mb-8">
            <div>
              <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">
                المعدات والأدوات الأكثر طلباً
              </span>
              <h2 className="text-2xl sm:text-3xl font-black text-slate-100 mt-1">
                {t('featuredProducts')}
              </h2>
            </div>
            <Link
              href="/catalog"
              className="text-sm font-bold text-blue-400 hover:underline flex items-center gap-1"
            >
              تصفح الكتالوج بالكامل
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {cardProducts.map((product, index) => (
              <Reveal key={product.id} delay={Math.min(index * 70, 280)}>
                <ProductCard product={product} />
              </Reveal>
            ))}
          </div>
        </section>

        {/* Flagship Branch Highlight Section */}
        <section className="max-w-7xl mx-auto px-4">
          <Reveal>
          <div className="glass-panel p-8 rounded-3xl border border-slate-800 bg-gradient-to-r from-slate-900 via-slate-950 to-blue-950/40 grid md:grid-cols-12 gap-8 items-center hover:border-amber-500/30 transition-colors duration-300">
            <div className="md:col-span-8 space-y-4">
              <span className="px-3 py-1 rounded-full bg-amber-500/20 text-amber-400 text-xs font-bold border border-amber-500/30">
                الفرع الرئيسي والمخزن بالإسكندرية
              </span>
              <h3 className="text-2xl sm:text-3xl font-black text-slate-100">
                فرع الإبراهيمية (92 شارع عمر لطفى)
              </h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                يسعدنا استقبالكم لتجربة المشايات الكهربائية، العجل الرياضي، قياس ملابس وأحذية السباحة والباليه، أو الشراء المباشر واستلام الطلبات الإلكترونية بدون رسوم شحن.
              </p>
              <div className="flex flex-wrap items-center gap-4 text-xs font-semibold text-slate-300">
                <div className="flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-amber-400" />
                  <span>الإبراهيمية بحري، سيدي جابر، باب شرقي</span>
                </div>
                <a href="tel:035926908" className="flex items-center gap-1.5 hover:text-white transition-colors">
                  <Phone className="w-4 h-4 text-blue-400" />
                  <span dir="ltr" className="tabular-nums font-bold">03 5926908</span>
                </a>
                <a
                  href="https://wa.me/201224226876"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/25 transition-colors font-bold"
                  title="تواصل واتساب: 01224226876"
                >
                  <WhatsAppIcon className="w-4 h-4 text-emerald-400" />
                  <span className="hidden sm:inline">واتساب:</span>
                  <span dir="ltr" className="tabular-nums font-black">0122 422 6876</span>
                </a>
              </div>
            </div>
            <div className="md:col-span-4 flex justify-center">
              <Link
                href="/branches"
                className="px-6 py-3.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-sm transition-all shadow-lg shadow-amber-500/20"
              >
                معلومات الوصول وتوجيهات الخريطة
              </Link>
            </div>
          </div>
          </Reveal>
        </section>
      </main>
  );
}
