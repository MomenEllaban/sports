import { captureError } from '@/lib/monitor';
import { apiError } from '@/lib/api-response';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireRole } from '@/lib/auth/guards';
import { writeAudit } from '@/lib/audit';
import { num } from '@/lib/pricing';

export async function POST(req: Request) {
  try {
    const { error, session } = await requireRole('SUPER_ADMIN', 'BRANCH_MANAGER');
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
      gs1Code,
    } = body;

    if (!sku || !nameAr || !nameEn || price === undefined || !categoryId) {
      return apiError('VALIDATION_ERROR', 'SKU, names, price and category are required', 400);
    }
    if (Number(price) < 0 || Number(costPrice) < 0) {
      return apiError('VALIDATION_ERROR', 'Prices must be non-negative', 400);
    }

    const branches = await prisma.branch.findMany({ where: { isActive: true } });
    if (branches.length === 0) {
      return apiError('INTERNAL_ERROR', 'No active branch', 500);
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
        gs1Code: gs1Code ? String(gs1Code).trim().replace(/\D/g, '') || null : null,
        size: size ? String(size).trim() : null,
        color: color ? String(color).trim() : null,
        isActive: true,
        images: formattedImages,
      },
    });

    const qty = Math.max(0, Math.floor(Number(initialStock) || 0));
    // 2.2: init inventory rows for ALL active branches (first branch holds opening stock).
    const flagship = branches[0];
    await prisma.branchInventory.createMany({
      data: branches.map((b) => ({
        branchId: b.id,
        productId: product.id,
        stockQuantity: b.id === flagship.id ? qty : 0,
        lowStockThreshold: 5,
      })),
      skipDuplicates: true,
    });

    if (qty > 0) {
      await prisma.inventoryLog.create({
        data: {
          branchId: flagship.id,
          productId: product.id,
          type: 'OPENING',
          changeQuantity: qty,
          previousQuantity: 0,
          newQuantity: qty,
          notes: 'Opening stock',
        },
      });
    }

    // The opening price/cost is the baseline every later margin figure is
    // measured against, so it belongs in the trail from the start.
    void writeAudit({
      actorId: (session?.user as { id?: string } | undefined)?.id,
      action: 'product.created',
      entity: 'Product',
      entityId: product.id,
      metadata: {
        sku: product.sku,
        nameAr: product.nameAr,
        nameEn: product.nameEn,
        price: num(product.price),
        costPrice: num(product.costPrice),
        openingQuantity: qty,
      },
    });

    return NextResponse.json({ success: true, product });
  } catch (e) {
    captureError('api/admin/products', e);
    return apiError('INTERNAL_ERROR', 'Failed to create product (SKU may already exist)', 500);
  }
}
