import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdminSession } from '@/lib/admin-guard';

export async function GET() {
  try {
    const brands = await prisma.brand.findMany({ orderBy: { nameAr: 'asc' } });
    return NextResponse.json({ success: true, brands });
  } catch {
    return NextResponse.json({ success: false, error: 'Failed' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { error } = await requireAdminSession();
    if (error) return error;

    const { nameAr, nameEn } = await req.json();
    if (!nameAr || !nameEn) {
      return NextResponse.json(
        { success: false, error: 'الاسم بالعربي والإنجليزي مطلوبان' },
        { status: 400 }
      );
    }

    const slug = nameEn
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '');

    const brand = await prisma.brand.create({
      data: {
        slug: `${slug}-${Date.now()}`,
        nameAr: String(nameAr).trim(),
        nameEn: String(nameEn).trim(),
      },
    });

    return NextResponse.json({ success: true, brand });
  } catch (e) {
    console.error('Brand create error:', e);
    return NextResponse.json({ success: false, error: 'فشل في إضافة الماركة' }, { status: 500 });
  }
}
