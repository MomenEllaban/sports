import { captureError } from '@/lib/monitor';
import { apiError } from '@/lib/api-response';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireRole } from '@/lib/auth/guards';

export async function GET() {
  try {
    const { error } = await requireRole('SUPER_ADMIN', 'BRANCH_MANAGER');
    if (error) return error;

    const employees = await prisma.employee.findMany({
      orderBy: { createdAt: 'desc' },
      include: { branch: { select: { id: true, name: true, nameEn: true } } },
    });
    return NextResponse.json({ success: true, employees });
  } catch {
    return apiError('INTERNAL_ERROR', 'Failed', 500);
  }
}

export async function POST(req: Request) {
  try {
    const { error } = await requireRole('SUPER_ADMIN', 'BRANCH_MANAGER');
    if (error) return error;

    const body = await req.json();
    const { name, phone, roleTitle, salary, salaryType = 'MONTHLY', commissionRate = 0, branchId } = body;

    if (!name || !phone || !roleTitle || salary === undefined || !branchId) {
      return apiError('VALIDATION_ERROR', 'الاسم، الموبايل، المسمى الوظيفي، الراتب، والفرع مطلوبة', 400);
    }

    const commissionPercent = Number(commissionRate);
    if (!Number.isFinite(commissionPercent) || commissionPercent < 0 || commissionPercent > 100) {
      return apiError('VALIDATION_ERROR', 'Commission must be between 0 and 100 percent', 400);
    }

    const employee = await prisma.employee.create({
      data: {
        name: String(name).trim(),
        phone: String(phone).trim(),
        roleTitle: String(roleTitle).trim(),
        salary: Number(salary),
        salaryType,
        commissionRate: commissionPercent / 100,
        branchId,
        isActive: true,
      },
      include: { branch: { select: { id: true, name: true, nameEn: true } } },
    });

    return NextResponse.json({ success: true, employee });
  } catch (e) {
    captureError('api/admin/employees', e);
    return apiError('INTERNAL_ERROR', 'فشل في إضافة الموظف', 500);
  }
}
