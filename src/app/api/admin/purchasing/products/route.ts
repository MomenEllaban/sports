import { apiError } from '@/lib/api-response';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { num } from '@/lib/pricing';
import { requireRole } from '@/lib/auth/guards';
import { captureError } from '@/lib/monitor';
import { parseProductFilters, productWhere } from '@/lib/products/query';

/**
 * Ceiling on a single typeahead response. The purchase-order line picker used to
 * be handed every active product from the page, which grows without bound and
 * grows the server-rendered payload with it.
 */
const LOOKUP_LIMIT = 20;

/**
 * Product lookup for the purchase-order line picker.
 *
 * A PO line is not a sale line: it needs `costPrice` (the default unit cost the
 * order is raised at) and it is scoped to the whole catalogue rather than to one
 * branch, because a PO is the request for goods that arrive later.
 */
export async function GET(req: Request) {
  try {
    const { error } = await requireRole('SUPER_ADMIN', 'BRANCH_MANAGER');
    if (error) return error;

    const url = new URL(req.url);
    const rawQuery = url.searchParams.get('query') || '';
    const filters = parseProductFilters(url.searchParams);
    // Only active products can be ordered, and the picker's own search is the
    // only filter worth honouring here.
    const where = { ...productWhere({ ...filters, status: 'active' }) };

    if (!rawQuery.trim() && url.searchParams.get('query') === null) {
      // A missing query would otherwise return an arbitrary slice of the
      // catalogue ordered by nothing in particular.
      return NextResponse.json({ success: true, products: [], truncated: false });
    }

    const take = Math.min(Number(url.searchParams.get('limit')) || LOOKUP_LIMIT, LOOKUP_LIMIT);
    const rows = await prisma.product.findMany({
      where,
      orderBy: [{ nameAr: 'asc' }, { sku: 'asc' }],
      take: take + 1,
      select: { id: true, nameAr: true, nameEn: true, sku: true, barcode: true, costPrice: true },
    });

    const truncated = rows.length > take;
    return NextResponse.json({
      success: true,
      truncated,
      products: rows.slice(0, take).map((p) => ({ ...p, costPrice: num(p.costPrice) })),
    });
  } catch (e) {
    captureError('admin/purchasing/products-lookup', e);
    return apiError('INTERNAL_ERROR', 'تعذر البحث عن الأصناف', 500);
  }
}
