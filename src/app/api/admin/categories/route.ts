import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdminSession } from '@/lib/admin-guard';

export async function GET() {
  try {
    const categories = await prisma.category.findMany({ orderBy: { nameAr: 'asc' } });
    return NextResponse.json({ success: true, categories });
  } catch {
    return NextResponse.json({ success: false, error: 'Failed' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { error } = await requireAdminSession();
    if (error) return error;

    const body = await req.json();
    const { nameAr, nameEn, description } = body;

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

    const category = await prisma.category.create({
      data: {
        slug: `${slug}-${Date.now()}`,
        nameAr: String(nameAr).trim(),
        nameEn: String(nameEn).trim(),
        description: description || null,
      },
    });

    return NextResponse.json({ success: true, category });
  } catch (e) {
    console.error('Category create error:', e);
    return NextResponse.json(
      { success: false, error: 'فشل في إضافة التصنيف' },
      { status: 500 }
    );
  }
}
