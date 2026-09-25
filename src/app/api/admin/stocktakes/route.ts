import { captureError } from '@/lib/monitor';
import { apiError } from '@/lib/api-response';
import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/guards';
import { scopedBranchIds } from '@/lib/auth/branch-scope';
import { prisma } from '@/lib/db';
import { createStocktake, StocktakeError } from '@/lib/inventory/stocktake';

export async function GET(req: Request) {
  try {
    const { error, session } = await requireRole('SUPER_ADMIN', 'BRANCH_MANAGER');
    if (error) return error;
    const url = new URL(req.url); const allowed = scopedBranchIds(session); const requested = url.searchParams.get('branch') || undefined;
    const branchId = allowed === null ? requested : requested && allowed.includes(requested) ? requested : allowed[0] || '__no_branch__';
    const rows = await prisma.stocktakeSession.findMany({ where: { branchId }, include: { branch: { select: { id: true, name: true } }, _count: { select: { lines: true } } }, orderBy: { createdAt: 'desc' }, take: 50 });
    return NextResponse.json({ success: true, sessions: rows.map((row) => ({ ...row, createdAt: row.createdAt.toISOString(), startedAt: row.startedAt.toISOString(), approvedAt: row.approvedAt?.toISOString() || null })) });
  } catch (error) { captureError('api/admin/stocktakes', error); return apiError('INTERNAL_ERROR', 'تعذر تحميل الجلسات', 500); }
}

export async function POST(req: Request) {
  try {
    const { error, session } = await requireRole('SUPER_ADMIN', 'BRANCH_MANAGER');
    if (error) return error;
    const body = await req.json() as { branchId?: unknown; productIds?: unknown; notes?: unknown };
    if (typeof body.branchId !== 'string' || !Array.isArray(body.productIds)) return apiError('VALIDATION_ERROR', 'الفرع والأصناف مطلوبة', 400);
    const created = await createStocktake({ session, branchId: body.branchId, productIds: body.productIds as string[], notes: typeof body.notes === 'string' ? body.notes : undefined });
    return NextResponse.json({ success: true, stocktake: { ...created, createdAt: created.createdAt.toISOString(), startedAt: created.startedAt.toISOString(), updatedAt: created.updatedAt.toISOString() } });
  } catch (error) { if (error instanceof StocktakeError) return apiError('REQUEST_FAILED', String(error.message), error.status); captureError('api/admin/stocktakes', error); return apiError('INTERNAL_ERROR', 'تعذر إنشاء جلسة الجرد', 500); }
}
