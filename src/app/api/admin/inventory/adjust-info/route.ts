import { apiError } from '@/lib/api-response';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireRole } from '@/lib/auth/guards';

/** Current on-hand qty for the stocktake wizard (T13). */
export async function GET(req: Request) {
  const { error } = await requireRole('SUPER_ADMIN', 'BRANCH_MANAGER');
  if (error) return error;
  const { searchParams } = new URL(req.url);
  const branchId = searchParams.get('branchId');
  const productId = searchParams.get('productId');
  if (!branchId || !productId) return apiError('VALIDATION_ERROR', 'missing params', 400);
  const inv = await prisma.branchInventory.findUnique({ where: { branchId_productId: { branchId, productId } } });
  return NextResponse.json({ success: true, qty: inv?.stockQuantity || 0 });
}
