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
    const products = await prisma.product.findMany({
      where: { id: { in: ids }, isActive: true },
      select: { id: true, sku: true, nameAr: true, nameEn: true, price: true, images: true },
    });
    return NextResponse.json({
      success: true,
      products: products.map((p) => ({ ...p, price: num(p.price) })),
    });
  } catch {
    return NextResponse.json({ success: false, error: 'failed' }, { status: 500 });
  }
}
