import { captureError } from '@/lib/monitor';
import { apiError } from '@/lib/api-response';
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
    if (body.commissionRate !== undefined) {
      const commissionPercent = Number(body.commissionRate);
      if (!Number.isFinite(commissionPercent) || commissionPercent < 0 || commissionPercent > 100) {
        return apiError('VALIDATION_ERROR', 'Commission must be between 0 and 100 percent', 400);
      }
      data.commissionRate = commissionPercent / 100;
    }
    if (body.branchId !== undefined) data.branchId = body.branchId;
    if (body.isActive !== undefined) data.isActive = Boolean(body.isActive);

    const employee = await prisma.employee.update({ where: { id }, data });
    return NextResponse.json({ success: true, employee });
  } catch (e) {
    captureError('api/admin/employees/[id]', e);
    return apiError('INTERNAL_ERROR', 'فشل في تحديث بيانات الموظف', 500);
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
      return apiError('CONFLICT', `لا يمكن حذف الموظف — لديه ${payrollCount} سجل مرتبات`, 409);
    }

    await prisma.employee.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (e) {
    captureError('api/admin/employees/[id]', e);
    return apiError('INTERNAL_ERROR', 'فشل في حذف الموظف', 500);
  }
}
