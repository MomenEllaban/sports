import React from 'react';
import { getLocale } from 'next-intl/server';
import { prisma } from '@/lib/db';
import { Star } from 'lucide-react';
import { requirePageRole } from '@/lib/auth/require-page';
import ReviewsManager from '@/components/admin/ReviewsManager';

export const dynamic = 'force-dynamic';

export default async function AdminReviewsPage() {
  await requirePageRole('SUPER_ADMIN', 'BRANCH_MANAGER');
  const isAr = (await getLocale()) === 'ar';
  const reviews = await prisma.review.findMany({
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: { product: { select: { nameAr: true, nameEn: true, sku: true } } },
  });
  return (
    <>
      <div className="border-b border-slate-800 pb-4">
        <h1 className="text-2xl font-black text-slate-100 flex items-center gap-2">
          <Star className="w-6 h-6 text-amber-400" />
          {isAr ? 'تقييمات العملاء' : 'Customer reviews'}
        </h1>
        <p className="text-xs text-slate-400 mt-0.5">{isAr ? 'الاعتماد قبل الظهور — لا يظهر أي تقييم دون موافقة' : 'Approval required — reviews are hidden until approved'}</p>
      </div>
      <ReviewsManager
        initial={reviews.map((r) => ({
          id: r.id,
          rating: r.rating,
          text: r.text,
          phone: r.phone,
          approved: r.approved,
          createdAt: r.createdAt.toISOString(),
          product: r.product,
        }))}
      />
    </>
  );
}
