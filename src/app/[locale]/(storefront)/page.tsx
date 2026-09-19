import React from 'react';
import Header from '@/components/storefront/Header';
import HeroBanner from '@/components/storefront/HeroBanner';
import Footer from '@/components/storefront/Footer';
import ProductCard from '@/components/storefront/ProductCard';
import Reveal from '@/components/storefront/Reveal';
import { prisma } from '@/lib/db';
import { Link } from '@/i18n/routing';
import { Trophy, Activity, Waves, Dumbbell, Shield, MapPin, Phone, ArrowLeft, ArrowRight } from 'lucide-react';
import { getTranslations } from 'next-intl/server';

export const dynamic = 'force-dynamic'; // ISR 60s

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
                Ø§Ù„ØªØµÙ†ÙŠÙØ§Øª Ø§Ù„Ø±ÙŠØ§Ø¶ÙŠØ©
              </span>
              <h2 className="text-2xl sm:text-3xl font-black text-slate-100 mt-1">
                ØªØ³ÙˆÙ‚ Ø­Ø³Ø¨ Ø§Ù„Ø±ÙŠØ§Ø¶Ø© ÙˆØ§Ù„Ù†Ø´Ø§Ø·
              </h2>
            </div>
            <Link
              href="/catalog"
              className="text-sm font-bold text-amber-400 hover:underline flex items-center gap-1"
            >
              Ø¹Ø±Ø¶ Ø§Ù„ÙƒÙ„ {isAr ? <ArrowLeft className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
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
                Ø§Ù„Ù…Ø¹Ø¯Ø§Øª ÙˆØ§Ù„Ø£Ø¯ÙˆØ§Øª Ø§Ù„Ø£ÙƒØ«Ø± Ø·Ù„Ø¨Ø§Ù‹
              </span>
              <h2 className="text-2xl sm:text-3xl font-black text-slate-100 mt-1">
                {t('featuredProducts')}
              </h2>
            </div>
            <Link
              href="/catalog"
              className="text-sm font-bold text-blue-400 hover:underline flex items-center gap-1"
            >
              ØªØµÙØ­ Ø§Ù„ÙƒØªØ§Ù„ÙˆØ¬ Ø¨Ø§Ù„ÙƒØ§Ù…Ù„
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {products.map((product, index) => (
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
                Ø§Ù„ÙØ±Ø¹ Ø§Ù„Ø±Ø¦ÙŠØ³ÙŠ ÙˆØ§Ù„Ù…Ø®Ø²Ù† Ø¨Ø§Ù„Ø¥Ø³ÙƒÙ†Ø¯Ø±ÙŠØ©
              </span>
              <h3 className="text-2xl sm:text-3xl font-black text-slate-100">
                ÙØ±Ø¹ Ø§Ù„Ø¥Ø¨Ø±Ø§Ù‡ÙŠÙ…ÙŠØ© (92 Ø´Ø§Ø±Ø¹ Ø¹Ù…Ø± Ù„Ø·ÙÙ‰)
              </h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                ÙŠØ³Ø¹Ø¯Ù†Ø§ Ø§Ø³ØªÙ‚Ø¨Ø§Ù„ÙƒÙ… Ù„ØªØ¬Ø±Ø¨Ø© Ø§Ù„Ù…Ø´Ø§ÙŠØ§Øª Ø§Ù„ÙƒÙ‡Ø±Ø¨Ø§Ø¦ÙŠØ©ØŒ Ø§Ù„Ø¹Ø¬Ù„ Ø§Ù„Ø±ÙŠØ§Ø¶ÙŠØŒ Ù‚ÙŠØ§Ø³ Ù…Ù„Ø§Ø¨Ø³ ÙˆØ£Ø­Ø°ÙŠØ© Ø§Ù„Ø³Ø¨Ø§Ø­Ø© ÙˆØ§Ù„Ø¨Ø§Ù„ÙŠÙ‡ØŒ Ø£Ùˆ Ø§Ù„Ø´Ø±Ø§Ø¡ Ø§Ù„Ù…Ø¨Ø§Ø´Ø± ÙˆØ§Ø³ØªÙ„Ø§Ù… Ø§Ù„Ø·Ù„Ø¨Ø§Øª Ø§Ù„Ø¥Ù„ÙƒØªØ±ÙˆÙ†ÙŠØ© Ø¨Ø¯ÙˆÙ† Ø±Ø³ÙˆÙ… Ø´Ø­Ù†.
              </p>
              <div className="flex flex-wrap items-center gap-4 text-xs font-semibold text-slate-300">
                <div className="flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-amber-400" />
                  <span>Ø§Ù„Ø¥Ø¨Ø±Ø§Ù‡ÙŠÙ…ÙŠØ© Ø¨Ø­Ø±ÙŠØŒ Ø³ÙŠØ¯ÙŠ Ø¬Ø§Ø¨Ø±ØŒ Ø¨Ø§Ø¨ Ø´Ø±Ù‚ÙŠ</span>
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
                Ù…Ø¹Ù„ÙˆÙ…Ø§Øª Ø§Ù„ÙˆØµÙˆÙ„ ÙˆØªÙˆØ¬ÙŠÙ‡Ø§Øª Ø§Ù„Ø®Ø±ÙŠØ·Ø©
              </Link>
            </div>
          </div>
          </Reveal>
        </section>
      </main>

      <Footer />
    </div>
  );
}
