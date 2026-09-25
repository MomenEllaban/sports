import React from 'react';
import { getLocale } from 'next-intl/server';
import { requirePageRole } from '@/lib/auth/require-page';
import { getReportPage } from '@/lib/reports/page-data';
import ReportTableClient from '@/components/admin/ReportTableClient';
import type { AppSession } from '@/lib/auth/guards';

export const dynamic = 'force-dynamic';
export default async function SalesReportPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const session = await requirePageRole('SUPER_ADMIN', 'BRANCH_MANAGER', 'FINANCE') as AppSession;
  const isAr = (await getLocale()) === 'ar';
  const page = await getReportPage('sales', searchParams, session);
  return <><div className="border-b border-slate-800 pb-4"><h1 className="text-2xl font-black text-slate-100">{isAr ? 'مبيعات الفروع حسب الفترة' : 'Branch sales by period'}</h1><p className="text-xs text-slate-400">{isAr ? 'مبيعات المنتجات المدفوعة، الإيراد، والتكلفة والربح مع فلاتر الخادم.' : 'Paid product sales, revenue, cost, and profit with server-side filters.'}</p></div><ReportTableClient type="sales" rows={page.result.rows} total={page.result.total} page={page.result.page} pageSize={page.result.pageSize} totalPages={page.result.totalPages} branches={page.branches} filters={page.filters} /></>;
}
