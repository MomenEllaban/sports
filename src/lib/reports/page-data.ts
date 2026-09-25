import { prisma } from '@/lib/db';
import { parseReportQuery, getReport, type ReportType } from './data';
import { branchWhere } from '@/lib/auth/branch-scope';
import type { AppSession } from '@/lib/auth/guards';

export async function getReportPage(type: ReportType, searchParams: Promise<Record<string, string | string[] | undefined>>, session: AppSession) {
  const params = await searchParams;
  const parsed = parseReportQuery(params);
  const allowed = session.user?.role === 'SUPER_ADMIN' ? undefined : (session.user?.branchIds || []);
  const query = { ...parsed, branchId: allowed ? (parsed.branchId && allowed.includes(parsed.branchId) ? parsed.branchId : allowed[0] || '__no_branch__') : parsed.branchId };
  const [result, branches] = await Promise.all([
    getReport(type, query),
    prisma.branch.findMany({ where: { isActive: true, ...branchWhere(session) }, select: { id: true, name: true, nameEn: true }, orderBy: { name: 'asc' } }),
  ]);
  return {
    result,
    branches,
    filters: {
      from: query.from.toISOString().slice(0, 10),
      to: query.to.toISOString().slice(0, 10),
      branch: query.branchId || '',
      q: query.q || '',
    },
  };
}
