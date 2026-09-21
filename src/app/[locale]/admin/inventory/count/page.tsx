import React from 'react';
import { prisma } from '@/lib/db';
import { requirePageRole } from '@/lib/auth/require-page';
import StocktakeClient from '@/components/admin/StocktakeClient';

export const dynamic = 'force-dynamic';

export default async function StocktakePage() {
  await requirePageRole('SUPER_ADMIN', 'BRANCH_MANAGER');
  const [branches, products] = await Promise.all([
    prisma.branch.findMany({ where: { isActive: true }, select: { id: true, name: true } }),
    prisma.product.findMany({ where: { isActive: true }, select: { id: true, nameAr: true, sku: true }, take: 2000 }),
  ]);
  return (
    <>
      <div className="border-b border-slate-800 pb-4">
        <h1 className="text-2xl font-black text-slate-100">جرد وتسوية المخزون</h1>
        <p className="text-xs text-slate-400 mt-0.5">عد فعلي → سبب إجباري → تسوية بسجل تدقيق دائم</p>
      </div>
      <StocktakeClient branches={branches} products={products} />
    </>
  );
}
