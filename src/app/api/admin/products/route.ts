import { captureError } from '@/lib/monitor';
import { apiError } from '@/lib/api-response';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireRole } from '@/lib/auth/guards';
import { writeAudit } from '@/lib/audit';
import { num } from '@/lib/pricing';
import { normalizeGtin, optionalText, finiteNumber, integerValue } from '@/lib/api-validation';
import { branchWhere } from '@/lib/auth/branch-scope';

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
    if (!finiteNumber(price) || !finiteNumber(costPrice)) {
      return apiError('VALIDATION_ERROR', 'Prices must be numbers', 400);
    }
    if (Number(price) < 0 || Number(costPrice) < 0) {
      return apiError('VALIDATION_ERROR', 'Prices must be non-negative', 400);
    }
    if (!integerValue(initialStock)) {
      return apiError('VALIDATION_ERROR', 'Opening stock must be a whole number', 400);
    }

    // Same rule as PATCH, so a product is never created with a GTIN that the
    // update route would later refuse to save.
    const gtin = normalizeGtin(gs1Code);
    if (gtin.invalid) {
      return apiError('VALIDATION_ERROR', 'GS1 code must be 8/12/13/14 digits', 400);
    }

    // A Branch Manager may only seed stock inside their own branches. Creating
    // rows for every active branch both leaked the branch list and could place
    // the opening quantity in a branch the actor cannot even see.
    const branches = await prisma.branch.findMany({
      where: { isActive: true, ...branchWhere(session) },
      select: { id: true },
      orderBy: { name: 'asc' },
    });
    if (branches.length === 0) {
      return apiError('FORBIDDEN', 'You have no active branch to stock this product in', 403);
    }

    const qty = Math.max(0, Math.floor(Number(initialStock) || 0));
    // The opening quantity belongs to one branch. Accept an explicit choice and
    // otherwise fall back to the actor's first branch, which is what a
    // SUPER_ADMIN saw before (the alphabetically first active branch).
    const requestedBranchId = typeof body.branchId === 'string' ? body.branchId.trim() : '';
    const openingBranch =
      branches.find((b) => b.id === requestedBranchId) ??
      (requestedBranchId && qty > 0 ? null : branches[0]);
    if (!openingBranch) {
      return apiError('VALIDATION_ERROR', 'Opening stock branch is not one of your branches', 400);
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
        gs1Code: gtin.value,
        size: optionalText(size, 100),
        color: optionalText(color, 100),
        isActive: true,
        images: formattedImages,
      },
    });

    // Seed a zero row for each branch the actor can see, so downstream stock
    // reads do not have to special-case "not stocked here yet".
    await prisma.branchInventory.createMany({
      data: branches.map((b) => ({
        branchId: b.id,
        productId: product.id,
        stockQuantity: b.id === openingBranch.id ? qty : 0,
        lowStockThreshold: 5,
      })),
      skipDuplicates: true,
    });

    if (qty > 0) {
      await prisma.inventoryLog.create({
        data: {
          branchId: openingBranch.id,
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
