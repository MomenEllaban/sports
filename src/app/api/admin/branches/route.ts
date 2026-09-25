import { apiError } from '@/lib/api-response';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireRole } from '@/lib/auth/guards';

export async function GET() {
  try {
    const { error } = await requireRole('SUPER_ADMIN');
    if (error) return error;

    const branches = await prisma.branch.findMany({
      orderBy: { createdAt: 'asc' },
      include: {
        _count: {
          select: {
            employees: true,
            inventories: true,
            orders: true,
          },
        },
      },
    });
    return NextResponse.json({ success: true, branches });
  } catch {
    return apiError('INTERNAL_ERROR', 'فشل تحميل الفروع', 500);
  }
}

export async function POST(req: Request) {
  try {
    const { error } = await requireRole('SUPER_ADMIN');
    if (error) return error;

    const body = await req.json();
    const { name, nameEn, address, addressEn, phone, city, workingHours } = body;

    if (!name || !address || !phone) {
      return apiError('VALIDATION_ERROR', 'اسم الفرع والعنوان ورقم الهاتف حقول مطلوبة', 400);
    }

    // Creating a branch backfills zero-qty inventory rows for all products (T12/T15 rule).
    const branch = await prisma.branch.create({
      data: {
        name,
        nameEn: nameEn || name,
        address,
        addressEn: addressEn || address,
        phone,
        city: city || 'Alexandria',
        workingHours: workingHours || 'السبت-الأربعاء 10ص-10م، الخميس-الجمعة 10ص-11م',
        isActive: true,
      },
    });

    const products = await prisma.product.findMany({ select: { id: true } });
    if (products.length > 0) {
      await prisma.branchInventory.createMany({
        data: products.map((p) => ({ branchId: branch.id, productId: p.id, stockQuantity: 0, lowStockThreshold: 5 })),
        skipDuplicates: true,
      });
    }

    return NextResponse.json({ success: true, branch }, { status: 201 });
  } catch (err: unknown) {
    return apiError('INTERNAL_ERROR', String((err as Error).message || 'فشل إضافة الفرع'), 500);
  }
}
