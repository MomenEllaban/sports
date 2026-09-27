import { apiError } from '@/lib/api-response';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { num } from '@/lib/pricing';
import { requireRole } from '@/lib/auth/guards';
import { captureError } from '@/lib/monitor';

const MAX_RESULTS = 20;

/**
 * Typeahead for the barcode label page. The catalogue is not branch-scoped
 * data, so this only needs the role guard — but it replaces shipping up to
 * 2000 products to the browser just to filter them client-side.
 *
 * Each result reports the code that will actually be printed: `gs1Code` is a
 * GTIN and is preferred, `barcode` is the legacy field.
 */
export async function GET(req: Request) {
  try {
    const { error } = await requireRole('SUPER_ADMIN', 'BRANCH_MANAGER');
    if (error) return error;
    const term = (new URL(req.url).searchParams.get('q') || '').trim();
    if (term.length < 2) {
      return NextResponse.json({ success: true, products: [] });
    }
    const products = await prisma.product.findMany({
      where: {
        isActive: true,
        OR: [
          { nameAr: { contains: term, mode: 'insensitive' } },
          { nameEn: { contains: term, mode: 'insensitive' } },
          { sku: { contains: term, mode: 'insensitive' } },
          { barcode: { contains: term, mode: 'insensitive' } },
          { gs1Code: { contains: term, mode: 'insensitive' } },
        ],
      },
      select: { id: true, nameAr: true, nameEn: true, sku: true, barcode: true, gs1Code: true, price: true },
      orderBy: { nameAr: 'asc' },
      take: MAX_RESULTS,
    });
    return NextResponse.json({
      success: true,
      products: products.map((p) => ({ ...p, price: num(p.price) })),
    });
  } catch (e) {
    captureError('admin/labels/search', e);
    return apiError('INTERNAL_ERROR', 'Failed to search products', 500);
  }
}
