import { apiError } from '@/lib/api-response';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireRole } from '@/lib/auth/guards';
import { canAccessBranch } from '@/lib/auth/branch-scope';

/** Current on-hand quantity for one (branch, product) pair. */
export async function GET(req: Request) {
  const { error, session } = await requireRole('SUPER_ADMIN', 'BRANCH_MANAGER');
  if (error) return error;
  const { searchParams } = new URL(req.url);
  const branchId = searchParams.get('branchId');
  const productId = searchParams.get('productId');
  if (!branchId || !productId) return apiError('VALIDATION_ERROR', 'branchId and productId are required', 400);
  if (!canAccessBranch(session, branchId)) {
    return apiError('FORBIDDEN', 'This branch is outside your assignment', 403);
  }
  const inv = await prisma.branchInventory.findUnique({
    where: { branchId_productId: { branchId, productId } },
    select: { stockQuantity: true, lowStockThreshold: true, reorderPoint: true, reorderQuantity: true },
  });
  return NextResponse.json({
    success: true,
    qty: inv?.stockQuantity ?? 0,
    lowStockThreshold: inv?.lowStockThreshold ?? 5,
    reorderPoint: inv?.reorderPoint ?? 5,
    reorderQuantity: inv?.reorderQuantity ?? 10,
    exists: inv !== null,
  });
}
