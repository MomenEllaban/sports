import { prisma } from '@/lib/db';
import { num } from '@/lib/pricing';

export async function getReorderRows(query: { q?: string; branchId?: string; page: number; pageSize: number; requested?: 'requested' | 'unrequested' }) {
  const search = query.q ? { OR: [
    { nameAr: { contains: query.q, mode: 'insensitive' as const } },
    { nameEn: { contains: query.q, mode: 'insensitive' as const } },
    { sku: { contains: query.q, mode: 'insensitive' as const } },
    { barcode: { contains: query.q, mode: 'insensitive' as const } },
  ] } : undefined;
  const rows = await prisma.branchInventory.findMany({
    where: { ...(query.branchId ? { branchId: query.branchId } : {}), ...(search ? { product: search } : {}) },
    include: { branch: { select: { id: true, name: true, nameEn: true } }, product: { select: { id: true, nameAr: true, nameEn: true, sku: true, barcode: true, price: true, costPrice: true, category: { select: { nameAr: true, nameEn: true } }, brand: { select: { nameAr: true, nameEn: true } } } }, reorderRequests: { where: { status: 'REQUESTED' }, orderBy: { requestedAt: 'desc' }, take: 1 } },
    orderBy: { stockQuantity: 'asc' },
    take: 5000,
  });
  const lowStockRows = rows.filter((row) => row.stockQuantity <= row.reorderPoint);
  const filtered = lowStockRows.filter((row) => query.requested === 'requested' ? row.reorderRequests.length > 0 : query.requested === 'unrequested' ? row.reorderRequests.length === 0 : true);
  // Category, brand and branch carry both languages so the client can render
  // the active locale instead of Arabic on the English routes.
  const mapped = filtered.map((row) => ({ id: row.id, inventoryId: row.id, branchId: row.branchId, branchName: row.branch.name, branchNameEn: row.branch.nameEn || row.branch.name, productId: row.productId, nameAr: row.product.nameAr, nameEn: row.product.nameEn, sku: row.product.sku, barcode: row.product.barcode, category: row.product.category?.nameAr || '—', categoryEn: row.product.category?.nameEn || row.product.category?.nameAr || '—', brand: row.product.brand?.nameAr || '—', brandEn: row.product.brand?.nameEn || row.product.brand?.nameAr || '—', stockQuantity: row.stockQuantity, lowStockThreshold: row.lowStockThreshold, reorderPoint: row.reorderPoint, reorderQuantity: row.reorderQuantity, suggestedQuantity: Math.max(1, row.reorderPoint + row.reorderQuantity - row.stockQuantity), costPrice: num(row.product.costPrice), estimatedCost: num(row.product.costPrice) * Math.max(1, row.reorderPoint + row.reorderQuantity - row.stockQuantity), requested: row.reorderRequests.length > 0, request: row.reorderRequests[0] ? { id: row.reorderRequests[0].id, supplierId: row.reorderRequests[0].supplierId, requestedById: row.reorderRequests[0].requestedById, requestedAt: row.reorderRequests[0].requestedAt.toISOString(), note: row.reorderRequests[0].note, quantity: row.reorderRequests[0].quantity } : null }));
  const start = (query.page - 1) * query.pageSize;
  return { rows: mapped.slice(start, start + query.pageSize), total: mapped.length, page: query.page, pageSize: query.pageSize, totalPages: Math.max(1, Math.ceil(mapped.length / query.pageSize)) };
}
