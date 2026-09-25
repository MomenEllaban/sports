import { prisma } from '@/lib/db';
import { num } from '@/lib/pricing';
import { apiInternalError, apiSuccess, getRequestId } from '@/lib/api-response';

/** Public: resolve product IDs (wishlist) to live cards. Max 50. */
export async function GET(request: Request) {
  const requestId = getRequestId(request);
  try {
    const ids = String(new URL(request.url).searchParams.get('ids') || '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean)
      .slice(0, 50);
    if (ids.length === 0) return apiSuccess({ products: [] }, 200, requestId);
    const flagship = await prisma.branch.findFirst({
      where: { isActive: true, OR: [{ name: { contains: 'إبراهيم', mode: 'insensitive' } }, { nameEn: { contains: 'Ibrahim', mode: 'insensitive' } }] },
      select: { id: true },
    });
    const products = await prisma.product.findMany({
      where: { id: { in: ids }, isActive: true },
      select: {
        id: true,
        sku: true,
        nameAr: true,
        nameEn: true,
        price: true,
        images: true,
        inventories: { where: flagship ? { branchId: flagship.id } : undefined, select: { stockQuantity: true } },
      },
    });
    return apiSuccess({
      products: products.map((product) => ({
        ...product,
        price: num(product.price),
        availableStock: product.inventories.reduce((sum, row) => sum + row.stockQuantity, 0),
      })),
    }, 200, requestId);
  } catch (error) {
    return apiInternalError(request, error, 'تعذر تحميل بيانات المنتجات');
  }
}
