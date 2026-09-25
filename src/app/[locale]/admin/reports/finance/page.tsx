import React from 'react';
import { getLocale } from 'next-intl/server';
import { requirePageRole } from '@/lib/auth/require-page';
import { getReportPage } from '@/lib/reports/page-data';
import ReportTableClient from '@/components/admin/ReportTableClient';
import type { AppSession } from '@/lib/auth/guards';

export const dynamic = 'force-dynamic';
export default async function FinanceReportPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const session = await requirePageRole('SUPER_ADMIN', 'BRANCH_MANAGER', 'FINANCE') as AppSession;
  const isAr = (await getLocale()) === 'ar';
  const page = await getReportPage('finance', searchParams, session);
  return <><div className="border-b border-slate-800 pb-4"><h1 className="text-2xl font-black text-slate-100">{isAr ? 'التقرير المالي والربحية' : 'Financial & profitability report'}</h1><p className="text-xs text-slate-400">{isAr ? 'إجماليات الإيراد والتكلفة والربح على مستوى الأصناف مع تصدير الفلاتر.' : 'Revenue, cost, and profit totals by product with filter export.'}</p></div><ReportTableClient type="finance" rows={page.result.rows} total={page.result.total} page={page.result.page} pageSize={page.result.pageSize} totalPages={page.result.totalPages} branches={page.branches} filters={page.filters} /></>;
}
