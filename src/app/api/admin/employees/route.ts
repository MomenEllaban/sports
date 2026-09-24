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
    return NextResponse.json({ success: false, error: 'Failed' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { error } = await requireRole('SUPER_ADMIN', 'BRANCH_MANAGER');
    if (error) return error;

    const body = await req.json();
    const { name, phone, roleTitle, salary, salaryType = 'MONTHLY', commissionRate = 0, branchId } = body;

    if (!name || !phone || !roleTitle || salary === undefined || !branchId) {
      return NextResponse.json(
        { success: false, error: 'الاسم، الموبايل، المسمى الوظيفي، الراتب، والفرع مطلوبة' },
        { status: 400 }
      );
    }

    const commissionPercent = Number(commissionRate);
    if (!Number.isFinite(commissionPercent) || commissionPercent < 0 || commissionPercent > 100) {
      return NextResponse.json({ success: false, error: 'Commission must be between 0 and 100 percent' }, { status: 400 });
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
    console.error('Employee create error:', e);
    return NextResponse.json({ success: false, error: 'فشل في إضافة الموظف' }, { status: 500 });
  }
}
