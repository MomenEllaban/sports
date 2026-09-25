import { apiError } from '@/lib/api-response';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireRole } from '@/lib/auth/guards';
import { incrementStock, decrementStock, InsufficientStockError } from '@/lib/inventory/service';
import { writeAudit } from '@/lib/audit';
import { captureError } from '@/lib/monitor';

/**
 * Stocktake adjustment (T13 wizard): set counted qty with a MANDATORY
 * reason. Positive diffs RESTOCK-up, negative diffs decrement — all as
 * ADJUSTMENT logs with actor + audit trail.
 */
export async function POST(req: Request) {
  try {
    const { error, session } = await requireRole('SUPER_ADMIN', 'BRANCH_MANAGER');
    if (error) return error;
    const body = await req.json();
    const { branchId, productId, countedQty, reason } = body as {
      branchId?: string; productId?: string; countedQty?: number; reason?: string;
    };
    if (!branchId || !productId) {
      return apiError('VALIDATION_ERROR', 'الفرع والصنف مطلوبان', 400);
    }
    if (!Number.isInteger(countedQty) || (countedQty as number) < 0) {
      return apiError('VALIDATION_ERROR', 'الكمية المعدودة غير صالحة', 400);
    }
    if (!reason || !String(reason).trim()) {
      return apiError('VALIDATION_ERROR', 'سبب التسوية إجباري', 400);
    }
    const actorId = (session?.user as { id?: string })?.id;
    const result = await prisma.$transaction(async (tx) => {
      const inv = await tx.branchInventory.findUnique({ where: { branchId_productId: { branchId, productId } } });
      const previous = inv?.stockQuantity || 0;
      const diff = (countedQty as number) - previous;
      if (diff === 0) return { previous, next: previous, diff: 0 };
      if (diff > 0) {
        const r = await incrementStock(tx, {
          branchId, productId, quantity: diff, type: 'ADJUSTMENT',
          referenceId: 'STOCKTAKE', notes: String(reason).slice(0, 500), createdById: actorId,
        });
        return { previous, next: r.next, diff };
      }
      try {
        const r = await decrementStock(tx, {
          branchId, productId, quantity: -diff, type: 'ADJUSTMENT',
          referenceId: 'STOCKTAKE', notes: String(reason).slice(0, 500), createdById: actorId,
        });
        return { previous, next: r.next, diff };
      } catch (e) {
        if (e instanceof InsufficientStockError) {
          throw Object.assign(new Error('الكمية المعدودة تتجاوز المنطق — حدّث المخزون أولاً'), { status: 422 });
        }
        throw e;
      }
    }, { maxWait: 10000, timeout: 20000 });
    writeAudit({ actorId, action: 'stock.adjust', entity: 'BranchInventory', entityId: `${branchId}:${productId}`, metadata: result }).catch(() => null);
    return NextResponse.json({ success: true, ...result });
  } catch (e) {
    const st = (e as { status?: number }).status;
    if (typeof st === 'number') return apiError('REQUEST_FAILED', String((e as Error).message), st);
    captureError('admin/inventory/adjust', e);
    return apiError('INTERNAL_ERROR', 'تعذر التسوية', 500);
  }
}
