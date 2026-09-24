import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { num } from '@/lib/pricing';

/** Public: resolve product IDs (wishlist) to live cards. Max 50. */
export async function GET(req: Request) {
  try {
    const ids = String(new URL(req.url).searchParams.get('ids') || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 50);
    if (ids.length === 0) return NextResponse.json({ success: true, products: [] });
    const flagship = await prisma.branch.findFirst({ where: { isActive: true, OR: [{ name: { contains: 'إبراهيم', mode: 'insensitive' } }, { nameEn: { contains: 'Ibrahim', mode: 'insensitive' } }] }, select: { id: true } });
    const products = await prisma.product.findMany({
      where: { id: { in: ids }, isActive: true },
      select: { id: true, sku: true, nameAr: true, nameEn: true, price: true, images: true, inventories: { where: flagship ? { branchId: flagship.id } : undefined, select: { stockQuantity: true } } },
    });
    return NextResponse.json({
      success: true,
      products: products.map((p) => ({ ...p, price: num(p.price), availableStock: p.inventories.reduce((sum, row) => sum + row.stockQuantity, 0) })),
    });
  } catch {
    return NextResponse.json({ success: false, error: 'failed' }, { status: 500 });
  }
}
