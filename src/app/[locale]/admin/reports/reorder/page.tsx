import React from 'react';
import { getLocale } from 'next-intl/server';
import { requirePageRole } from '@/lib/auth/require-page';
import { prisma } from '@/lib/db';
import { getReorderRows } from '@/lib/reports/reorder';
import { scopedBranchIds } from '@/lib/auth/branch-scope';
import ReorderClient from '@/components/admin/ReorderClient';
import type { AppSession } from '@/lib/auth/guards';

export const dynamic = 'force-dynamic';
export default async function ReorderReportPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const session = await requirePageRole('SUPER_ADMIN', 'BRANCH_MANAGER', 'FINANCE') as AppSession;
  const isAr = (await getLocale()) === 'ar';
  const params = await searchParams;
  const value = (key: string) => { const item = params[key]; return Array.isArray(item) ? item[0] : item; };
  const allowed = scopedBranchIds(session);
  const requestedBranch = value('branch');
  const branchId = allowed === null ? requestedBranch : requestedBranch && allowed.includes(requestedBranch) ? requestedBranch : allowed[0] || '__no_branch__';
  const page = Math.max(1, Number(value('page') || 1));
  const pageSize = 25;
  const [result, branches, suppliers] = await Promise.all([
    getReorderRows({ q: value('q') || undefined, branchId, page, pageSize, requested: value('requested') === 'requested' || value('requested') === 'unrequested' ? value('requested') as 'requested' | 'unrequested' : undefined }),
    prisma.branch.findMany({ where: { isActive: true, ...(allowed === null ? {} : { id: { in: allowed } }) }, select: { id: true, name: true, nameEn: true }, orderBy: { name: 'asc' } }),
    prisma.supplier.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } }),
  ]);
  return <><div className="border-b border-slate-800 pb-4"><h1 className="text-2xl font-black text-slate-100">{isAr ? 'كشكول النواقص' : 'Reorder list'}</h1><p className="text-xs text-slate-400">{isAr ? 'أصناف تحت حد إعادة الطلب، الكمية المقترحة، ومتابعة من طلبها ومتى.' : 'Items below reorder threshold, suggested quantities, and request tracking.'}</p></div><ReorderClient rows={result.rows} total={result.total} page={result.page} totalPages={result.totalPages} branches={branches} suppliers={suppliers} filters={{ q: value('q') || '', branch: requestedBranch || '', requested: value('requested') || '' }} /></>;
}
