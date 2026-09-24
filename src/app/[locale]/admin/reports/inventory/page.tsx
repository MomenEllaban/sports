import React from 'react';
import { requirePageRole } from '@/lib/auth/require-page';
import { getReportPage } from '@/lib/reports/page-data';
import ReportTableClient from '@/components/admin/ReportTableClient';
import type { AppSession } from '@/lib/auth/guards';

export const dynamic = 'force-dynamic';
export default async function InventoryReportPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const session = await requirePageRole('SUPER_ADMIN', 'BRANCH_MANAGER', 'FINANCE') as AppSession;
  const page = await getReportPage('inventory', searchParams, session);
  return <><div className="border-b border-slate-800 pb-4"><h1 className="text-2xl font-black text-slate-100">حركة المخزون التفصيلية</h1><p className="text-xs text-slate-400">الأرصدة الحالية، valued inventory، والكمية لكل فرع مع فلاتر server-side.</p></div><ReportTableClient type="inventory" rows={page.result.rows} total={page.result.total} page={page.result.page} pageSize={page.result.pageSize} totalPages={page.result.totalPages} branches={page.branches} filters={page.filters} /></>;
}
