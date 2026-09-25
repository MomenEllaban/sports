import { apiError } from '@/lib/api-response';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { num } from '@/lib/pricing';
import { requireRole } from '@/lib/auth/guards';
import { captureError } from '@/lib/monitor';

/** Admin sale lookup by number (T-RMA): full lines for manual RMA creation. */
export async function GET(req: Request) {
  try {
    const { error } = await requireRole('SUPER_ADMIN', 'BRANCH_MANAGER');
    if (error) return error;
    const number = (new URL(req.url).searchParams.get('number') || '').trim();
    if (!number) return apiError('VALIDATION_ERROR', 'number required', 400);
    const sale = await prisma.sale.findFirst({
      where: { OR: [{ saleNumber: number }, { id: number }] },
      include: { items: { include: { product: { select: { id: true, nameAr: true } } } } },
    });
    if (!sale) return apiError('NOT_FOUND', 'الفاتورة غير موجودة', 404);
    return NextResponse.json({
      success: true,
      sale: {
        id: sale.id,
        number: sale.saleNumber,
        items: sale.items.map((i) => ({
          refId: i.id, productId: i.productId, nameAr: i.product.nameAr,
          quantity: i.quantity, unitPrice: num(i.unitPrice),
        })),
      },
    });
  } catch (e) {
    captureError('admin/sales/lookup', e);
    return apiError('INTERNAL_ERROR', 'failed', 500);
  }
}
