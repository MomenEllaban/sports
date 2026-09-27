import { captureError } from '@/lib/monitor';
import { apiError } from '@/lib/api-response';
import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/guards';
import { scopedBranchIds } from '@/lib/auth/branch-scope';
import { prisma } from '@/lib/db';
import {
  countStocktakeCandidates,
  createStocktake,
  StocktakeError,
  type StocktakeScope,
} from '@/lib/inventory/stocktake';

export async function GET(req: Request) {
  try {
    const { error, session } = await requireRole('SUPER_ADMIN', 'BRANCH_MANAGER');
    if (error) return error;
    const url = new URL(req.url);
    const allowed = scopedBranchIds(session);
    const requested = url.searchParams.get('branch') || undefined;
    const branchId =
      allowed === null
        ? requested
        : requested && allowed.includes(requested)
          ? requested
          : allowed[0] || '__no_branch__';
    const rows = await prisma.stocktakeSession.findMany({
      where: { branchId },
      include: {
        branch: { select: { id: true, name: true, nameEn: true } },
        _count: { select: { lines: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return NextResponse.json({
      success: true,
      sessions: rows.map((row) => ({
        ...row,
        createdAt: row.createdAt.toISOString(),
        startedAt: row.startedAt.toISOString(),
        approvedAt: row.approvedAt?.toISOString() || null,
      })),
    });
  } catch (error) {
    captureError('api/admin/stocktakes', error);
    return apiError('INTERNAL_ERROR', 'تعذر تحميل الجلسات', 500);
  }
}

export async function POST(req: Request) {
  try {
    const { error, session } = await requireRole('SUPER_ADMIN', 'BRANCH_MANAGER');
    if (error) return error;
    const body = (await req.json()) as {
      branchId?: unknown;
      productIds?: unknown;
      categoryId?: unknown;
      brandId?: unknown;
      onlyStockedItems?: unknown;
      notes?: unknown;
    };
    if (typeof body.branchId !== 'string' || !body.branchId) {
      return apiError('VALIDATION_ERROR', 'الفرع مطلوب', 400);
    }
    // productIds is optional: omitting it counts everything the branch stocks,
    // which keeps the browser from having to post the whole catalogue.
    if (body.productIds !== undefined && !Array.isArray(body.productIds)) {
      return apiError('VALIDATION_ERROR', 'قائمة الأصناف غير صالحة', 400);
    }
    const scope: StocktakeScope = {
      productIds: Array.isArray(body.productIds) ? (body.productIds as string[]) : undefined,
      categoryId: typeof body.categoryId === 'string' && body.categoryId ? body.categoryId : undefined,
      brandId: typeof body.brandId === 'string' && body.brandId ? body.brandId : undefined,
      onlyStockedItems: body.onlyStockedItems === true,
    };
    const created = await createStocktake({
      session,
      branchId: body.branchId,
      notes: typeof body.notes === 'string' ? body.notes : undefined,
      ...scope,
    });
    return NextResponse.json({
      success: true,
      stocktake: {
        ...created,
        createdAt: created.createdAt.toISOString(),
        startedAt: created.startedAt.toISOString(),
        updatedAt: created.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    if (error instanceof StocktakeError) {
      return apiError('REQUEST_FAILED', String(error.message), error.status);
    }
    captureError('api/admin/stocktakes', error);
    return apiError('INTERNAL_ERROR', 'تعذر إنشاء جلسة الجرد', 500);
  }
}

/** Preview how many lines a session would produce before committing to it. */
export async function PUT(req: Request) {
  try {
    const { error, session } = await requireRole('SUPER_ADMIN', 'BRANCH_MANAGER');
    if (error) return error;
    const body = (await req.json()) as {
      branchId?: unknown;
      productIds?: unknown;
      categoryId?: unknown;
      brandId?: unknown;
      onlyStockedItems?: unknown;
    };
    if (typeof body.branchId !== 'string' || !body.branchId) {
      return apiError('VALIDATION_ERROR', 'الفرع مطلوب', 400);
    }
    const lineCount = await countStocktakeCandidates(session, {
      branchId: body.branchId,
      productIds: Array.isArray(body.productIds) ? (body.productIds as string[]) : undefined,
      categoryId: typeof body.categoryId === 'string' && body.categoryId ? body.categoryId : undefined,
      brandId: typeof body.brandId === 'string' && body.brandId ? body.brandId : undefined,
      onlyStockedItems: body.onlyStockedItems === true,
    });
    return NextResponse.json({ success: true, lineCount });
  } catch (error) {
    if (error instanceof StocktakeError) {
      return apiError('REQUEST_FAILED', String(error.message), error.status);
    }
    captureError('api/admin/stocktakes#preview', error);
    return apiError('INTERNAL_ERROR', 'تعذر حساب نطاق الجرد', 500);
  }
}
