import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdminSession } from '@/lib/admin-guard';

// Approve or mark a payroll run as paid
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { error } = await requireAdminSession();
    if (error) return error;

    const { id } = await params;
    const body = await req.json();
    const { action } = body; // 'approve' | 'pay'

    const run = await prisma.payrollRun.findUnique({ where: { id } });
    if (!run) {
      return NextResponse.json({ success: false, error: 'Payroll run not found' }, { status: 404 });
    }

    if (action === 'approve' && run.status === 'DRAFT') {
      const updated = await prisma.payrollRun.update({ where: { id }, data: { status: 'APPROVED' } });
      await prisma.payrollItem.updateMany({ where: { payrollRunId: id }, data: { status: 'APPROVED' } });
      return NextResponse.json({ success: true, payrollRun: updated });
    }
    if (action === 'pay' && run.status === 'APPROVED') {
      const updated = await prisma.payrollRun.update({ where: { id }, data: { status: 'PAID' } });
      await prisma.payrollItem.updateMany({ where: { payrollRunId: id }, data: { status: 'PAID' } });
      return NextResponse.json({ success: true, payrollRun: updated });
    }
    return NextResponse.json({ success: false, error: 'Invalid payroll transition' }, { status: 400 });
  } catch (e) {
    console.error('Admin payroll action error:', e);
    return NextResponse.json({ success: false, error: 'Failed to update payroll run' }, { status: 500 });
  }
}
