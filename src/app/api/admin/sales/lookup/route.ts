import { apiError } from '@/lib/api-response';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { num } from '@/lib/pricing';
import { requireRole } from '@/lib/auth/guards';
import { branchResourceWhereForSale } from '@/lib/auth/branch-scope';
import { captureError } from '@/lib/monitor';

/** Admin sale lookup by number: full lines for manual RMA creation. */
export async function GET(req: Request) {
  try {
    const { error, session } = await requireRole('SUPER_ADMIN', 'BRANCH_MANAGER');
    if (error) return error;
    const number = (new URL(req.url).searchParams.get('number') || '').trim();
    if (!number) return apiError('VALIDATION_ERROR', 'number is required', 400);
    const sale = await prisma.sale.findFirst({
      // Scoped: a branch manager must not read another branch's customer PII
      // through a guessed sale number.
      where: { AND: [{ OR: [{ saleNumber: number }, { id: number }] }, branchResourceWhereForSale(session)] },
      include: { items: { include: { product: { select: { id: true, nameAr: true, nameEn: true, sku: true } } } } },
    });
    if (!sale) return apiError('NOT_FOUND', 'Sale not found', 404);
    return NextResponse.json({
      success: true,
      sale: {
        id: sale.id,
        number: sale.saleNumber,
        branchId: sale.branchId,
        totalAmount: num(sale.totalAmount),
        paymentStatus: sale.paymentStatus,
        items: sale.items.map((i) => ({
          refId: i.id,
          productId: i.productId,
          nameAr: i.product.nameAr,
          nameEn: i.product.nameEn,
          sku: i.product.sku,
          quantity: i.quantity,
          unitPrice: num(i.unitPrice),
        })),
      },
    });
  } catch (e) {
    captureError('admin/sales/lookup', e);
    return apiError('INTERNAL_ERROR', 'Failed to load the sale', 500);
  }
}
