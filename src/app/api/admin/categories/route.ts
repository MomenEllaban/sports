import { captureError } from '@/lib/monitor';
import { apiError } from '@/lib/api-response';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireRole } from '@/lib/auth/guards';

export async function GET() {
  try {
    const { error } = await requireRole('SUPER_ADMIN', 'BRANCH_MANAGER');
    if (error) return error;

    const categories = await prisma.category.findMany({ orderBy: { nameAr: 'asc' } });
    return NextResponse.json({ success: true, categories });
  } catch {
    return apiError('INTERNAL_ERROR', 'Failed', 500);
  }
}

export async function POST(req: Request) {
  try {
    const { error } = await requireRole('SUPER_ADMIN', 'BRANCH_MANAGER');
    if (error) return error;

    const body = await req.json();
    const { nameAr, nameEn, description } = body;

    if (!nameAr || !nameEn) {
      return apiError('VALIDATION_ERROR', 'الاسم بالعربي والإنجليزي مطلوبان', 400);
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
    captureError('api/admin/categories', e);
    return apiError('INTERNAL_ERROR', 'فشل في إضافة التصنيف', 500);
  }
}
