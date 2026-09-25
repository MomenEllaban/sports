import { captureError } from '@/lib/monitor';
import { apiError } from '@/lib/api-response';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireRole } from '@/lib/auth/guards';
import { writeAudit } from '@/lib/audit';
import { num } from '@/lib/pricing';

// PATCH: full update of a product
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error, session } = await requireRole('SUPER_ADMIN', 'BRANCH_MANAGER');
    if (error) return error;

    const { id } = await params;
    const body = await req.json();

    const data: Record<string, unknown> = {};
    if (body.sku !== undefined) data.sku = String(body.sku).trim();
    if (body.nameAr !== undefined) data.nameAr = String(body.nameAr).trim();
    if (body.nameEn !== undefined) data.nameEn = String(body.nameEn).trim();
    if (body.price !== undefined) data.price = Number(body.price);
    if (body.costPrice !== undefined) data.costPrice = Number(body.costPrice);
    if (body.categoryId !== undefined) data.categoryId = body.categoryId;
    if (body.brandId !== undefined) data.brandId = body.brandId || null;
    if (body.isActive !== undefined) data.isActive = Boolean(body.isActive);
    if (body.size !== undefined) data.size = body.size || null;
    if (body.color !== undefined) data.color = body.color || null;
    if (body.barcode !== undefined) data.barcode = body.barcode || null;
    // T14: GS1 GTIN for ETA production (digits only, 8/12/13/14).
    if (body.gs1Code !== undefined) {
      const gs1 = String(body.gs1Code).trim().replace(/\D/g, '');
      if (gs1 && ![8, 12, 13, 14].includes(gs1.length)) {
        return apiError('VALIDATION_ERROR', 'GS1 code must be 8/12/13/14 digits', 400);
      }
      data.gs1Code = gs1 || null;
    }
    if (body.images !== undefined) {
      data.images = Array.isArray(body.images)
        ? body.images.map((img: unknown) => String(img).trim()).filter(Boolean)
        : typeof body.images === 'string' && body.images.trim()
        ? [body.images.trim()]
        : [];
    }

    // Pricing is the sensitive part: record the previous money values so a
    // margin change is reconstructable from the audit trail alone.
    const before = await prisma.product.findUnique({
      where: { id },
      select: { sku: true, nameAr: true, price: true, costPrice: true, isActive: true },
    });
    if (!before) {
      return apiError('NOT_FOUND', 'المنتج غير موجود', 404);
    }

    const product = await prisma.product.update({ where: { id }, data });

    const actorId = (session?.user as { id?: string } | undefined)?.id;
    const base = { actorId, entity: 'Product', entityId: id };
    const oldPrice = num(before.price);
    const newPrice = num(product.price);
    const oldCost = num(before.costPrice);
    const newCost = num(product.costPrice);
    if (oldPrice !== newPrice || oldCost !== newCost) {
      void writeAudit({
        ...base,
        action: 'product.price_changed',
        metadata: {
          sku: product.sku,
          price: { from: oldPrice, to: newPrice },
          costPrice: { from: oldCost, to: newCost },
        },
      });
    }
    if (before.isActive !== product.isActive) {
      void writeAudit({ ...base, action: 'product.availability_changed', metadata: { isActive: { from: before.isActive, to: product.isActive } } });
    }
    if (before.sku !== product.sku) {
      void writeAudit({ ...base, action: 'product.sku_changed', metadata: { from: before.sku, to: product.sku } });
    }

    return NextResponse.json({ success: true, product });
  } catch (e) {
    captureError('api/admin/products/[id]', e);
    return apiError('INTERNAL_ERROR', 'فشل في تحديث المنتج (قد يكون الـ SKU مكرر)', 500);
  }
}

// DELETE: soft-check then delete
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error, session } = await requireRole('SUPER_ADMIN', 'BRANCH_MANAGER');
    if (error) return error;

    const { id } = await params;

    const orderCount = await prisma.orderItem.count({ where: { productId: id } });
    const saleCount = await prisma.saleItem.count({ where: { productId: id } });

    if (orderCount > 0 || saleCount > 0) {
      return apiError('CONFLICT', `لا يمكن حذف المنتج — مرتبط بـ ${orderCount + saleCount} عملية مبيعات/طلبات`, 409);
    }

    const target = await prisma.product.findUnique({
      where: { id },
      select: { sku: true, nameAr: true, nameEn: true, price: true, costPrice: true },
    });

    // Delete inventory entries first
    await prisma.branchInventory.deleteMany({ where: { productId: id } });
    await prisma.inventoryLog.deleteMany({ where: { productId: id } });
    await prisma.product.delete({ where: { id } });

    if (target) {
      void writeAudit({
        actorId: (session?.user as { id?: string } | undefined)?.id,
        action: 'product.deleted',
        entity: 'Product',
        entityId: id,
        metadata: { sku: target.sku, nameAr: target.nameAr, nameEn: target.nameEn, price: num(target.price), costPrice: num(target.costPrice) },
      });
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    captureError('api/admin/products/[id]', e);
    return apiError('INTERNAL_ERROR', 'فشل في حذف المنتج', 500);
  }
}
