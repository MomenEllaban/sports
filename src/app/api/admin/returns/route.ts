import { apiError } from '@/lib/api-response';
import { NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireRole } from '@/lib/auth/guards';
import { scopedBranchIds } from '@/lib/auth/branch-scope';
import { requestReturn, ReturnError } from '@/lib/returns/service';
import { captureError } from '@/lib/monitor';

const RETURN_STATUSES = new Set(['REQUESTED', 'APPROVED', 'REJECTED', 'RECEIVED', 'REFUND_PENDING', 'COMPLETED', 'CANCELLED']);

/** Admin RMA list, branch-scoped and paginated. */
export async function GET(req: Request) {
  try {
    const { error, session } = await requireRole('SUPER_ADMIN', 'BRANCH_MANAGER', 'FINANCE');
    if (error) return error;

    const q = new URL(req.url).searchParams;
    const page = Math.max(1, Number.parseInt(q.get('page') ?? '1', 10) || 1);
    const pageSize = Math.min(100, Math.max(1, Number.parseInt(q.get('pageSize') ?? '25', 10) || 25));

    const where: Prisma.ReturnRequestWhereInput = {};
    const status = q.get('status');
    if (status) {
      if (!RETURN_STATUSES.has(status)) {
        return apiError('VALIDATION_ERROR', `Unknown return status "${status}"`, 400, undefined, {
          allowed: [...RETURN_STATUSES],
        });
      }
      where.status = status;
    }
    if (q.get('channel')) where.channel = q.get('channel') as string;
    if (q.get('reason')) where.items = { some: { reasonCode: q.get('reason') as string } };

    // Branch isolation comes from the session, not only from the filter param.
    const allowed = scopedBranchIds(session);
    const requestedBranch = q.get('branch');
    if (requestedBranch && allowed !== null && !allowed.includes(requestedBranch)) {
      return apiError('FORBIDDEN', 'This branch is outside your assignment', 403);
    }
    if (allowed !== null) where.branchId = { in: requestedBranch ? [requestedBranch] : allowed };
    else if (requestedBranch) where.branchId = requestedBranch;

    if (q.get('from') || q.get('to')) {
      where.createdAt = {
        ...(q.get('from') ? { gte: new Date(q.get('from') as string) } : {}),
        ...(q.get('to') ? { lte: new Date(`${q.get('to')}T23:59:59.999Z`) } : {}),
      };
    }
    const search = q.get('q');
    if (search) {
      where.OR = [
        { returnNumber: { contains: search, mode: 'insensitive' } },
        { customerPhone: { contains: search } },
        { order: { orderNumber: { contains: search, mode: 'insensitive' } } },
        { sale: { saleNumber: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const [total, rows] = await prisma.$transaction([
      prisma.returnRequest.count({ where }),
      prisma.returnRequest.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          items: { include: { product: { select: { nameAr: true, nameEn: true, sku: true } } } },
          branch: { select: { name: true, nameEn: true } },
          order: { select: { orderNumber: true, totalAmount: true } },
          sale: { select: { saleNumber: true, totalAmount: true } },
          refunds: { select: { id: true, amount: true, method: true, status: true } },
        },
      }),
    ]);

    return NextResponse.json({
      success: true,
      returns: rows,
      total,
      page,
      pageSize,
      pageCount: Math.max(1, Math.ceil(total / pageSize)),
    });
  } catch (e) {
    captureError('admin/returns GET', e);
    return apiError('INTERNAL_ERROR', 'Failed to load returns', 500);
  }
}

/** Admin creates an RMA case (REQUESTED). */
export async function POST(req: Request) {
  try {
    const { error, session } = await requireRole('SUPER_ADMIN', 'BRANCH_MANAGER');
    if (error) return error;
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) return apiError('VALIDATION_ERROR', 'A JSON body is required', 400);
    try {
      const { request, replay, frequencyWarning } = await requestReturn({
        orderId: body.orderId ? String(body.orderId) : undefined,
        saleId: body.saleId ? String(body.saleId) : undefined,
        channel: 'ADMIN',
        branchId: body.branchId ? String(body.branchId) : undefined,
        items: body.items as never,
        customerPhone: body.customerPhone ? String(body.customerPhone) : undefined,
        notes: body.notes ? String(body.notes) : undefined,
        clientRequestId: body.clientRequestId ? String(body.clientRequestId) : undefined,
        actorId: (session?.user as { id?: string })?.id,
        actorRole: session?.user?.role as string,
        allowedBranchIds: scopedBranchIds(session),
      });
      return NextResponse.json({ success: true, return: request, replay: !!replay, frequencyWarning });
    } catch (e) {
      const err = e as ReturnError & { status?: number };
      return apiError('REQUEST_FAILED', String(err.message), err.status || 400);
    }
  } catch (e) {
    captureError('admin/returns POST', e);
    return apiError('INTERNAL_ERROR', 'Failed to create the return', 500);
  }
}
