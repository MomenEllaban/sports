import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdminSession } from '@/lib/admin-guard';

// PATCH: full update of a product
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error } = await requireAdminSession();
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
    if (body.images !== undefined) {
      data.images = Array.isArray(body.images)
        ? body.images.map((img: unknown) => String(img).trim()).filter(Boolean)
        : typeof body.images === 'string' && body.images.trim()
        ? [body.images.trim()]
        : [];
    }

    const product = await prisma.product.update({ where: { id }, data });
    return NextResponse.json({ success: true, product });
  } catch (e) {
    console.error('Admin product update error:', e);
    return NextResponse.json(
      { success: false, error: 'فشل في تحديث المنتج (قد يكون الـ SKU مكرر)' },
      { status: 500 }
    );
  }
}

// DELETE: soft-check then delete
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error } = await requireAdminSession();
    if (error) return error;

    const { id } = await params;

    const orderCount = await prisma.orderItem.count({ where: { productId: id } });
    const saleCount = await prisma.saleItem.count({ where: { productId: id } });

    if (orderCount > 0 || saleCount > 0) {
      return NextResponse.json(
        {
          success: false,
          error: `لا يمكن حذف المنتج — مرتبط بـ ${orderCount + saleCount} عملية مبيعات/طلبات`,
        },
        { status: 409 }
      );
    }

    // Delete inventory entries first
    await prisma.branchInventory.deleteMany({ where: { productId: id } });
    await prisma.inventoryLog.deleteMany({ where: { productId: id } });
    await prisma.product.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('Admin product delete error:', e);
    return NextResponse.json(
      { success: false, error: 'فشل في حذف المنتج' },
      { status: 500 }
    );
  }
}
