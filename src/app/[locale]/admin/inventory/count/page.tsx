import React from 'react';
import { getLocale } from 'next-intl/server';
import { prisma } from '@/lib/db';
import { requirePageRole } from '@/lib/auth/require-page';
import StocktakeClient from '@/components/admin/StocktakeClient';
import { scopedBranchIds } from '@/lib/auth/branch-scope';
import type { AppSession } from '@/lib/auth/guards';

export const dynamic = 'force-dynamic';

export default async function StocktakePage() {
  const session = await requirePageRole('SUPER_ADMIN', 'BRANCH_MANAGER') as AppSession;
  const isAr = (await getLocale()) === 'ar';
  const allowed = scopedBranchIds(session);
  const [branches, products, sessions] = await Promise.all([
    prisma.branch.findMany({ where: { isActive: true, ...(allowed === null ? {} : { id: { in: allowed } }) }, select: { id: true, name: true, nameEn: true }, orderBy: { name: 'asc' } }),
    prisma.product.findMany({ where: { isActive: true }, select: { id: true, nameAr: true, nameEn: true, sku: true, barcode: true, category: { select: { nameAr: true } }, brand: { select: { nameAr: true } } }, orderBy: { nameAr: 'asc' }, take: 5000 }),
    prisma.stocktakeSession.findMany({ where: allowed === null ? {} : { branchId: { in: allowed } }, include: { branch: { select: { id: true, name: true, nameEn: true } }, _count: { select: { lines: true } } }, orderBy: { createdAt: 'desc' }, take: 30 }),
  ]);
  return <><div className="border-b border-slate-800 pb-4"><h1 className="text-2xl font-black text-slate-100">{isAr ? 'الجرد وتسوية المخزون' : 'Stocktake & inventory reconciliation'}</h1><p className="text-xs text-slate-400">{isAr ? 'جلسة batch لكل أصناف الفرع: حفظ مسودة، مراجعة الفروقات، ثم اعتماد ذري مع سجل InventoryLog.' : 'A batch session per branch: save a draft, review variances, then atomically approve with an InventoryLog trail.'}</p></div><StocktakeClient branches={branches} products={products} sessions={sessions.map((item) => ({ ...item, createdAt: item.createdAt.toISOString(), startedAt: item.startedAt.toISOString(), approvedAt: item.approvedAt?.toISOString() || null }))} /></>;
}
