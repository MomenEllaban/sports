import React from 'react';
import { getLocale } from 'next-intl/server';
import { prisma } from '@/lib/db';
import { requirePageRole } from '@/lib/auth/require-page';
import BrandsManager, { BrandItem } from '@/components/admin/BrandsManager';

export const dynamic = 'force-dynamic';

export default async function AdminProductBrandsPage() {
  await requirePageRole('SUPER_ADMIN', 'BRANCH_MANAGER');
  const isAr = (await getLocale()) === 'ar';

  const rawBrands = await prisma.brand.findMany({
    orderBy: { nameAr: 'asc' },
    include: {
      _count: {
        select: { products: true },
      },
    },
  });

  const brands: BrandItem[] = rawBrands.map((b) => ({
    id: b.id,
    nameAr: b.nameAr,
    nameEn: b.nameEn,
    slug: (b as unknown as { slug?: string }).slug || null,
    description: (b as unknown as { description?: string }).description || null,
    logo: (b as unknown as { logo?: string }).logo || null,
    productsCount: b._count.products,
  }));

  return (
    <>
      <div className="border-b border-slate-800 pb-4">
        <h1 className="text-2xl font-black text-slate-100">
          {isAr ? 'العلامات التجارية والماركات الرياضية' : 'Sports Brands & Manufacturers'}
        </h1>
        <p className="text-xs text-slate-400 mt-0.5">
          {isAr
            ? 'إدارة الماركات العالمية والمحلية (نايكي، أديداس، بوما...) والشعارات وتصنيف المنتجات حسب البراند'
            : 'Manage sports brands, logos, manufacturers, and product associations'}
        </p>
      </div>

      <div className="glass-panel rounded-3xl border border-slate-800 overflow-hidden p-6 animate-fade-up">
        <BrandsManager brands={brands} />
      </div>
    </>
  );
}
