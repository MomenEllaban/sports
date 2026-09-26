import { NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { TransferStatus } from '@prisma/client';
import { captureError } from '@/lib/monitor';
import { apiError } from '@/lib/api-response';
import { prisma } from '@/lib/db';
import { requireRole } from '@/lib/auth/guards';
import { scopedBranchIds } from '@/lib/auth/branch-scope';
import { allowedTransferActions, createTransfer, TransferError } from '@/lib/inventory/transfers';

const STATUSES = new Set<string>(Object.values(TransferStatus));

/** Paginated transfer list with status/branch/search filters. */
export async function GET(req: Request) {
  try {
    const { session, error } = await requireRole('SUPER_ADMIN', 'BRANCH_MANAGER', 'FINANCE');
    if (error) return error;

    const url = new URL(req.url);
    const page = Math.max(1, Number.parseInt(url.searchParams.get('page') ?? '1', 10) || 1);
    const pageSize = Math.min(100, Math.max(1, Number.parseInt(url.searchParams.get('pageSize') ?? '20', 10) || 20));
    const q = (url.searchParams.get('q') ?? '').trim().slice(0, 120);
    const statusParam = url.searchParams.get('status') ?? '';
    if (statusParam && !STATUSES.has(statusParam)) {
      return apiError('VALIDATION_ERROR', `Unknown transfer status "${statusParam}"`, 400, undefined, {
        allowed: [...STATUSES],
      });
    }
    const branchParam = (url.searchParams.get('branchId') ?? '').trim();
    const allowed = scopedBranchIds(session);
    if (branchParam && allowed !== null && !allowed.includes(branchParam)) {
      return apiError('FORBIDDEN', 'This branch is outside your assignment', 403);
    }

    const where: Prisma.StockTransferWhereInput = {};
    // Filters are ANDed together: a search term must never replace the branch
    // scope, or a scoped manager could read other branches' transfers.
    const and: Prisma.StockTransferWhereInput[] = [];
    const scopeIds = branchParam ? [branchParam] : allowed;
    if (scopeIds !== null) and.push({ OR: [{ fromBranchId: { in: scopeIds } }, { toBranchId: { in: scopeIds } }] });
    if (statusParam) where.status = statusParam as TransferStatus;
    if (q) {
      and.push({
        OR: [
          { transferNumber: { contains: q, mode: 'insensitive' } },
          { notes: { contains: q, mode: 'insensitive' } },
          { items: { some: { product: { sku: { contains: q, mode: 'insensitive' } } } } },
          { items: { some: { product: { nameAr: { contains: q, mode: 'insensitive' } } } } },
          { items: { some: { product: { nameEn: { contains: q, mode: 'insensitive' } } } } },
        ],
      });
    }
    if (and.length) where.AND = and;

    const [total, rows] = await prisma.$transaction([
      prisma.stockTransfer.count({ where }),
      prisma.stockTransfer.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          fromBranch: { select: { id: true, name: true, nameEn: true } },
          toBranch: { select: { id: true, name: true, nameEn: true } },
          items: { include: { product: { select: { sku: true, nameAr: true, nameEn: true } } } },
        },
      }),
    ]);

    const actorId = (session?.user as { id?: string } | undefined)?.id;
    return NextResponse.json({
      success: true,
      rows: rows.map((t) => ({
        id: t.id,
        transferNumber: t.transferNumber,
        status: t.status,
        fromBranchId: t.fromBranchId,
        fromBranchName: t.fromBranch.name,
        fromBranchNameEn: t.fromBranch.nameEn,
        toBranchId: t.toBranchId,
        toBranchName: t.toBranch.name,
        toBranchNameEn: t.toBranch.nameEn,
        requestedById: t.requestedById,
        approvedById: t.approvedById,
        notes: t.notes,
        cancelReason: t.cancelReason,
        approvedAt: t.approvedAt?.toISOString() ?? null,
        shippedAt: t.shippedAt?.toISOString() ?? null,
        receivedAt: t.receivedAt?.toISOString() ?? null,
        createdAt: t.createdAt.toISOString(),
        itemCount: t.items.length,
        totalRequested: t.items.reduce((s, i) => s + i.quantity, 0),
        totalShipped: t.items.reduce((s, i) => s + i.quantityShipped, 0),
        totalReceived: t.items.reduce((s, i) => s + i.quantityReceived, 0),
        items: t.items.map((i) => ({
          id: i.id,
          productId: i.productId,
          sku: i.product.sku,
          nameAr: i.product.nameAr,
          nameEn: i.product.nameEn,
          quantity: i.quantity,
          quantityShipped: i.quantityShipped,
          quantityReceived: i.quantityReceived,
          outstanding: i.quantityShipped - i.quantityReceived,
        })),
        availableActions: allowedTransferActions(t.status, t.requestedById === actorId),
      })),
      total,
      page,
      pageSize,
      pageCount: Math.max(1, Math.ceil(total / pageSize)),
    });
  } catch (e) {
    captureError('api/admin/transfers GET', e);
    return apiError('INTERNAL_ERROR', 'Failed to load transfers', 500);
  }
}

export async function POST(req: Request) {
  try {
    const { session, error } = await requireRole('SUPER_ADMIN', 'BRANCH_MANAGER');
    if (error) return error;

    const body = (await req.json().catch(() => null)) as {
      fromBranchId?: unknown;
      toBranchId?: unknown;
      items?: unknown;
      notes?: unknown;
    } | null;
    if (!body) return apiError('VALIDATION_ERROR', 'A JSON body is required', 400);

    const transfer = await createTransfer(session, {
      fromBranchId: String(body.fromBranchId ?? ''),
      toBranchId: String(body.toBranchId ?? ''),
      notes: typeof body.notes === 'string' ? body.notes : null,
      items: Array.isArray(body.items)
        ? body.items.map((raw) => {
            const it = raw as { productId?: unknown; quantity?: unknown };
            return { productId: String(it?.productId ?? ''), quantity: Number(it?.quantity) };
          })
        : [],
    });

    return NextResponse.json({ success: true, transfer }, { status: 201 });
  } catch (e) {
    if (e instanceof TransferError) {
      return apiError(e.code, e.message, e.status, undefined, e.details);
    }
    captureError('api/admin/transfers', e);
    return apiError('INTERNAL_ERROR', 'Failed to create transfer', 500);
  }
}
