import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireRole } from '@/lib/auth/guards';

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error } = await requireRole('SUPER_ADMIN', 'BRANCH_MANAGER');
    if (error) return error;

    const { id } = await params;
    const body = await req.json();

    const data: Record<string, unknown> = {};
    if (body.name !== undefined) data.name = String(body.name).trim();
    if (body.phone !== undefined) data.phone = String(body.phone).trim();
    if (body.roleTitle !== undefined) data.roleTitle = String(body.roleTitle).trim();
    if (body.salary !== undefined) data.salary = Number(body.salary);
    if (body.salaryType !== undefined) data.salaryType = body.salaryType;
    if (body.commissionRate !== undefined) data.commissionRate = Number(body.commissionRate);
    if (body.branchId !== undefined) data.branchId = body.branchId;
    if (body.isActive !== undefined) data.isActive = Boolean(body.isActive);

    const employee = await prisma.employee.update({ where: { id }, data });
    return NextResponse.json({ success: true, employee });
  } catch (e) {
    console.error('Employee update error:', e);
    return NextResponse.json({ success: false, error: 'فشل في تحديث بيانات الموظف' }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error } = await requireRole('SUPER_ADMIN', 'BRANCH_MANAGER');
    if (error) return error;

    const { id } = await params;

    // Don't delete if has payroll items
    const payrollCount = await prisma.payrollItem.count({ where: { employeeId: id } });
    if (payrollCount > 0) {
      return NextResponse.json(
        { success: false, error: `لا يمكن حذف الموظف — لديه ${payrollCount} سجل مرتبات` },
        { status: 409 }
      );
    }

    await prisma.employee.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('Employee delete error:', e);
    return NextResponse.json({ success: false, error: 'فشل في حذف الموظف' }, { status: 500 });
  }
}
