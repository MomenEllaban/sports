import React from 'react';
import Header from '@/components/storefront/Header';
import HeroBanner from '@/components/storefront/HeroBanner';
import Footer from '@/components/storefront/Footer';
import ProductCard from '@/components/storefront/ProductCard';
import { prisma } from '@/lib/db';
import { Link } from '@/i18n/routing';
import { Trophy, Activity, Waves, Dumbbell, Shield, MapPin, Phone, ArrowLeft, ArrowRight } from 'lucide-react';
import { getTranslations } from 'next-intl/server';

export const revalidate = 60; // ISR 60s

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
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100">
      <Header />
      
      <main className="flex-1 space-y-16 pb-16">
        <HeroBanner />

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
            {categories.map((cat) => (
              <Link
                key={cat.id}
                href={`/catalog?category=${cat.slug}`}
                className="glass-card p-5 rounded-2xl border border-slate-800 flex flex-col items-center text-center gap-3 group"
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
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </section>

        {/* Flagship Branch Highlight Section */}
        <section className="max-w-7xl mx-auto px-4">
          <div className="glass-panel p-8 rounded-3xl border border-slate-800 bg-gradient-to-r from-slate-900 via-slate-950 to-blue-950/40 grid md:grid-cols-12 gap-8 items-center">
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
                <div className="flex items-center gap-1.5">
                  <Phone className="w-4 h-4 text-blue-400" />
                  <span dir="ltr">03 5926908</span>
                </div>
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
        </section>
      </main>

      <Footer />
    </div>
  );
}
