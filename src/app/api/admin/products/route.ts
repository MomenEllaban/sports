import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdminSession } from '@/lib/admin-guard';

export async function POST(req: Request) {
  try {
    const { error } = await requireAdminSession();
    if (error) return error;

    const body = await req.json();
    const {
      sku,
      nameAr,
      nameEn,
      price,
      costPrice = 0,
      categoryId,
      brandId,
      initialStock = 0,
      images = [],
      size,
      color,
      barcode,
    } = body;

    if (!sku || !nameAr || !nameEn || price === undefined || !categoryId) {
      return NextResponse.json({ success: false, error: 'SKU, names, price and category are required' }, { status: 400 });
    }
    if (Number(price) < 0 || Number(costPrice) < 0) {
      return NextResponse.json({ success: false, error: 'Prices must be non-negative' }, { status: 400 });
    }

    const flagship = await prisma.branch.findFirst({ where: { isActive: true } });
    if (!flagship) {
      return NextResponse.json({ success: false, error: 'No active branch' }, { status: 500 });
    }

    const formattedImages = Array.isArray(images)
      ? images.map((img: unknown) => String(img).trim()).filter(Boolean)
      : typeof images === 'string' && images.trim()
      ? [images.trim()]
      : [];

    const product = await prisma.product.create({
      data: {
        sku: String(sku).trim(),
        nameAr: String(nameAr).trim(),
        nameEn: String(nameEn).trim(),
        price: Number(price),
        costPrice: Number(costPrice),
        categoryId,
        brandId: brandId || null,
        barcode: barcode ? String(barcode).trim() : null,
        size: size ? String(size).trim() : null,
        color: color ? String(color).trim() : null,
        isActive: true,
        images: formattedImages,
      },
    });

    const qty = Math.max(0, Math.floor(Number(initialStock) || 0));
    await prisma.branchInventory.create({
      data: { branchId: flagship.id, productId: product.id, stockQuantity: qty, lowStockThreshold: 5 },
    });

    if (qty > 0) {
      await prisma.inventoryLog.create({
        data: {
          branchId: flagship.id,
          productId: product.id,
          type: 'RESTOCK',
          changeQuantity: qty,
          previousQuantity: 0,
          newQuantity: qty,
          notes: 'Opening stock',
        },
      });
    }

    return NextResponse.json({ success: true, product });
  } catch (e) {
    console.error('Admin product create error:', e);
    return NextResponse.json({ success: false, error: 'Failed to create product (SKU may already exist)' }, { status: 500 });
  }
}
