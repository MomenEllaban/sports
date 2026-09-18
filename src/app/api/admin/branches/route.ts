import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdminSession } from '@/lib/admin-guard';

export async function GET() {
  try {
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
    return NextResponse.json({ success: false, error: 'فشل تحميل الفروع' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { error } = await requireAdminSession();
    if (error) return error;

    const body = await req.json();
    const { name, nameEn, address, addressEn, phone, city, workingHours } = body;

    if (!name || !address || !phone) {
      return NextResponse.json(
        { success: false, error: 'اسم الفرع والعنوان ورقم الهاتف حقول مطلوبة' },
        { status: 400 }
      );
    }

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

    return NextResponse.json({ success: true, branch }, { status: 201 });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: (err as Error).message || 'فشل إضافة الفرع' },
      { status: 500 }
    );
  }
}
