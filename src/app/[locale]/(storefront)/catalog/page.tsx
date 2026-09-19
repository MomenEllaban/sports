import React from 'react';
import Header from '@/components/storefront/Header';
import Footer from '@/components/storefront/Footer';
import ProductCard from '@/components/storefront/ProductCard';
import { prisma } from '@/lib/db';
import { Search } from 'lucide-react';
import { Link } from '@/i18n/routing';

export const dynamic = 'force-dynamic';

export default async function CatalogPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ category?: string; query?: string }>;
}) {
  const { locale } = await params;
  const { category, query } = await searchParams;
  const isAr = locale === 'ar';

  const categories = await prisma.category.findMany();

  const whereClause: Record<string, unknown> = {
    isActive: true,
  };

  if (category) {
    const selectedCat = categories.find((c) => c.slug === category);
    if (selectedCat) {
      whereClause.categoryId = selectedCat.id;
    }
  }

  if (query) {
    whereClause.OR = [
      { nameAr: { contains: query, mode: 'insensitive' } },
      { nameEn: { contains: query, mode: 'insensitive' } },
      { sku: { contains: query, mode: 'insensitive' } },
    ];
  }

  const products = await prisma.product.findMany({
    where: whereClause,
    orderBy: { createdAt: 'desc' },
    include: {
      category: true,
      inventories: {
        include: {
          branch: true,
        },
      },
    },
  });

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100">
      <Header />

      <main className="flex-1 max-w-7xl mx-auto px-4 py-8 space-y-8 w-full">
        {/* Header & Search */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-800 pb-6">
          <div>
            <h1 className="text-3xl font-black text-slate-100">
              ÙƒØªØ§Ù„ÙˆØ¬ Ø§Ù„Ø£Ø¬Ù‡Ø²Ø© ÙˆØ§Ù„Ù…Ø¹Ø¯Ø§Øª Ø§Ù„Ø±ÙŠØ§Ø¶ÙŠØ©
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              ØªØµÙØ­ Ø§Ù„ØªØ´ÙƒÙŠÙ„Ø© Ø§Ù„ÙƒØ§Ù…Ù„Ø© Ø¨ÙØ±Ø¹ Ø§Ù„Ø¥Ø¨Ø±Ø§Ù‡ÙŠÙ…ÙŠØ© Ø§Ù„Ø±Ø¦ÙŠØ³ÙŠ Ø¨Ø§Ù„Ø¥Ø³ÙƒÙ†Ø¯Ø±ÙŠØ© ({products.length} ØµÙ†Ù)
            </p>
          </div>

          {/* Search Form */}
          <form method="GET" className="relative w-full md:w-80" role="search">
            <label htmlFor="catalog-search" className="sr-only">Ø¨Ø­Ø« ÙÙŠ Ø§Ù„ÙƒØªØ§Ù„ÙˆØ¬</label>
            <input
              id="catalog-search"
              type="search"
              name="query"
              defaultValue={query || ''}
              placeholder="Ø¨Ø­Ø« Ø¨Ø§Ø³Ù… Ø§Ù„Ù…Ù†ØªØ¬ØŒ SKUØŒ Ø£Ùˆ Ø§Ù„Ù…Ø§Ø±ÙƒØ©..."
              aria-label="Ø¨Ø­Ø« Ø¨Ø§Ø³Ù… Ø§Ù„Ù…Ù†ØªØ¬ Ø£Ùˆ SKU Ø£Ùˆ Ø§Ù„Ù…Ø§Ø±ÙƒØ©"
              className="w-full pl-4 pr-10 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-blue-500 placeholder:text-slate-500"
            />
            <button type="submit" aria-label="Ø¨Ø­Ø«" className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-100">
              <Search className="w-4 h-4" />
            </button>
          </form>
        </div>

        {/* Category Filter Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
          <Link
            href="/catalog"
            className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
              !category ? 'bg-blue-600 text-white' : 'bg-slate-900 text-slate-400 hover:bg-slate-800'
            }`}
          >
            Ø¬Ù…ÙŠØ¹ Ø§Ù„ØªØµÙ†ÙŠÙØ§Øª
          </Link>
          {categories.map((cat) => (
            <Link
              key={cat.id}
              href={`/catalog?category=${cat.slug}`}
              className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                category === cat.slug ? 'bg-blue-600 text-white' : 'bg-slate-900 text-slate-400 hover:bg-slate-800'
              }`}
            >
              {isAr ? cat.nameAr : cat.nameEn}
            </Link>
          ))}
        </div>

        {/* Products Grid */}
        {products.length === 0 ? (
          <div className="p-12 text-center glass-panel rounded-3xl space-y-3">
            <p className="text-slate-400 text-sm">Ù„Ù… Ù†Ø¬Ø¯ Ø£ÙŠ Ù…Ù†ØªØ¬Ø§Øª ØªØ·Ø§Ø¨Ù‚ Ø§Ù„Ø¨Ø­Ø« Ø£Ùˆ Ø§Ù„ØªØµÙ†ÙŠÙ Ø§Ù„Ù…Ø­Ø¯Ø¯.</p>
            <Link href="/catalog" className="text-xs font-bold text-amber-400 hover:underline">
              Ø¹Ø±Ø¶ Ø§Ù„ÙƒØªØ§Ù„ÙˆØ¬ Ø¨Ø§Ù„ÙƒØ§Ù…Ù„
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
