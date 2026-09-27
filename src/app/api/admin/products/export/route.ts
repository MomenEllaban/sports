import { captureError } from '@/lib/monitor';
import { apiError } from '@/lib/api-response';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireRole } from '@/lib/auth/guards';
import { num } from '@/lib/pricing';
import { parseProductFilters, productWhere, scopedInventoryWhere } from '@/lib/products/query';

/**
 * Ceiling on one export. A larger result is refused rather than silently
 * truncated, so the file always matches the filters shown on screen.
 */
const EXPORT_LIMIT = 5000;

export async function GET(req: Request) {
  try {
    const { error, session } = await requireRole('SUPER_ADMIN', 'BRANCH_MANAGER');
    if (error) return error;

    const filters = parseProductFilters(new URL(req.url).searchParams);
    const where = productWhere(filters);
    const total = await prisma.product.count({ where });
    if (total > EXPORT_LIMIT) {
      return apiError(
        'VALIDATION_ERROR',
        `Too many products match this filter (${total}). Narrow the filter to ${EXPORT_LIMIT} or fewer.`,
        400,
      );
    }

    // The CSV is built in the browser so the escaping rules live in one place;
    // this endpoint only returns the same rows the table shows, unpaginated.
    const products = await prisma.product.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: EXPORT_LIMIT,
      include: {
        category: { select: { nameAr: true, nameEn: true } },
        brand: { select: { nameAr: true, nameEn: true } },
        inventories: { where: scopedInventoryWhere(session), select: { stockQuantity: true } },
      },
    });

    return NextResponse.json({
      success: true,
      total,
      products: products.map((p) => ({
        id: p.id,
        sku: p.sku,
        barcode: p.barcode,
        gs1Code: p.gs1Code,
        nameAr: p.nameAr,
        nameEn: p.nameEn,
        size: p.size,
        color: p.color,
        price: num(p.price),
        costPrice: num(p.costPrice),
        category: p.category,
        brand: p.brand,
        isActive: p.isActive,
        stock: p.inventories.reduce((acc, i) => acc + i.stockQuantity, 0),
      })),
    });
  } catch (e) {
    captureError('api/admin/products/export', e);
    return apiError('INTERNAL_ERROR', 'Failed to export products', 500);
  }
}
