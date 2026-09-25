import { captureError } from '@/lib/monitor';
import { apiError } from '@/lib/api-response';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireRole } from '@/lib/auth/guards';

export async function GET() {
  try {
    const { error } = await requireRole('SUPER_ADMIN', 'BRANCH_MANAGER');
    if (error) return error;

    const brands = await prisma.brand.findMany({ orderBy: { nameAr: 'asc' } });
    return NextResponse.json({ success: true, brands });
  } catch {
    return apiError('INTERNAL_ERROR', 'Failed', 500);
  }
}

export async function POST(req: Request) {
  try {
    const { error } = await requireRole('SUPER_ADMIN', 'BRANCH_MANAGER');
    if (error) return error;

    const { nameAr, nameEn } = await req.json();
    if (!nameAr || !nameEn) {
      return apiError('VALIDATION_ERROR', 'الاسم بالعربي والإنجليزي مطلوبان', 400);
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
    captureError('api/admin/brands', e);
    return apiError('INTERNAL_ERROR', 'فشل في إضافة الماركة', 500);
  }
}
