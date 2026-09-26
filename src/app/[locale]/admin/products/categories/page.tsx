import React from 'react';
import { getLocale } from 'next-intl/server';
import { prisma } from '@/lib/db';
import { requirePageRole } from '@/lib/auth/require-page';
import CategoriesManager, { CategoryItem } from '@/components/admin/CategoriesManager';

export const dynamic = 'force-dynamic';

export default async function AdminProductCategoriesPage() {
  await requirePageRole('SUPER_ADMIN', 'BRANCH_MANAGER');
  const isAr = (await getLocale()) === 'ar';

  const rawCategories = await prisma.category.findMany({
    orderBy: { nameAr: 'asc' },
    include: {
      _count: {
        select: { products: true },
      },
    },
  });

  const categories: CategoryItem[] = rawCategories.map((c) => ({
    id: c.id,
    nameAr: c.nameAr,
    nameEn: c.nameEn,
    slug: c.slug,
    description: c.description,
    productsCount: c._count.products,
  }));

  return (
    <>
      <div className="border-b border-slate-800 pb-4">
        <h1 className="text-2xl font-black text-slate-100">
          {isAr ? 'تصنيفات وأقسام المنتجات' : 'Product Categories'}
        </h1>
        <p className="text-xs text-slate-400 mt-0.5">
          {isAr
            ? 'إدارة هيكل التصنيفات الرياضية، إضافة أقسام جديدة، وتتبع عدد المنتجات في كل قسم'
            : 'Organize sports product categories, create new groups, and monitor items per category'}
        </p>
      </div>

      <div className="glass-panel rounded-3xl border border-slate-800 overflow-hidden p-6 animate-fade-up">
        <CategoriesManager categories={categories} />
      </div>
    </>
  );
}
