import { apiError } from '@/lib/api-response';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireRole } from '@/lib/auth/guards';
import { canAccessBranch } from '@/lib/auth/branch-scope';
import { incrementStock, decrementStock, InsufficientStockError } from '@/lib/inventory/service';
import { captureError } from '@/lib/monitor';

/**
 * Manual stock adjustment (increase or decrease) for damage, expiry, theft or
 * a receiving error. Every adjustment writes an ADJUSTMENT ledger row and an
 * AuditLog row, so stock can never change without a traceable reason.
 */
export async function POST(req: Request) {
  try {
    const { error, session } = await requireRole('SUPER_ADMIN', 'BRANCH_MANAGER');
    if (error) return error;

    const body = (await req.json().catch(() => null)) as {
      branchId?: unknown;
      productId?: unknown;
      countedQty?: unknown;
      reason?: unknown;
    } | null;
    if (!body) return apiError('VALIDATION_ERROR', 'A JSON body is required', 400);

    const branchId = String(body.branchId ?? '');
    const productId = String(body.productId ?? '');
    const countedQty = Number(body.countedQty);
    const reason = typeof body.reason === 'string' ? body.reason.trim() : '';

    if (!branchId || !productId) {
      return apiError('VALIDATION_ERROR', 'Branch and product are required', 400);
    }
    if (!Number.isSafeInteger(countedQty) || countedQty < 0) {
      return apiError('VALIDATION_ERROR', 'Counted quantity must be a non-negative whole number', 400);
    }
    if (!reason) {
      return apiError('VALIDATION_ERROR', 'A reason is required for every adjustment', 400);
    }
    if (!canAccessBranch(session, branchId)) {
      return apiError('FORBIDDEN', 'This branch is outside your assignment', 403);
    }

    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, sku: true, isActive: true },
    });
    if (!product) return apiError('NOT_FOUND', 'Product not found', 404);
    if (!product.isActive) {
      return apiError('VALIDATION_ERROR', 'Cannot adjust an inactive product', 400);
    }

    const actorId = (session?.user as { id?: string } | undefined)?.id;
    const notes = reason.slice(0, 500);

    const result = await prisma.$transaction(
      async (tx) => {
        const inv = await tx.branchInventory.findUnique({
          where: { branchId_productId: { branchId, productId } },
          select: { id: true, stockQuantity: true },
        });
        const previous = inv?.stockQuantity ?? 0;
        const diff = countedQty - previous;
        if (diff === 0) {
          return { previous, next: previous, diff: 0 };
        }
        const move = diff > 0
          ? await incrementStock(tx, {
              branchId, productId, quantity: diff, type: 'ADJUSTMENT',
              referenceId: 'STOCKTAKE', notes, createdById: actorId,
            })
          : await decrementStock(tx, {
              branchId, productId, quantity: -diff, type: 'ADJUSTMENT',
              referenceId: 'STOCKTAKE', notes, createdById: actorId,
            });

        await tx.auditLog.create({
          data: {
            actorId,
            action: 'stock.adjust',
            entity: 'BranchInventory',
            entityId: inv?.id ?? null,
            branchId,
            metadata: JSON.stringify({
              productId,
              sku: product.sku,
              previous,
              next: move.next,
              difference: diff,
              countedQty,
              reason,
            }),
          },
        });
        return { previous, next: move.next, diff };
      },
      { maxWait: 10000, timeout: 20000 },
    );

    return NextResponse.json({ success: true, ...result });
  } catch (e) {
    if (e instanceof InsufficientStockError) {
      return apiError('VALIDATION_ERROR', 'The counted quantity is below the current on-hand balance', 400, undefined, {
        items: [{ productId: e.productId, available: e.available }],
      });
    }
    captureError('admin/inventory/adjust', e);
    return apiError('INTERNAL_ERROR', 'Could not apply the adjustment', 500);
  }
}
