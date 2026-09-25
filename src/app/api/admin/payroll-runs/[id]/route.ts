import { captureError } from '@/lib/monitor';
import { apiError } from '@/lib/api-response';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireRole } from '@/lib/auth/guards';
import { money, num } from '@/lib/pricing';

// Adjust bonus/deductions on a DRAFT item (2.4) — net recalculated server-side.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { error } = await requireRole('SUPER_ADMIN', 'FINANCE');
    if (error) return error;

    const { id } = await params;
    const body = await req.json();
    const { itemId, bonus, deductions } = body as { itemId?: string; bonus?: unknown; deductions?: unknown };
    if (!itemId) {
      return apiError('VALIDATION_ERROR', 'itemId is required', 400);
    }
    const run = await prisma.payrollRun.findUnique({ where: { id }, include: { items: true } });
    if (!run) {
      return apiError('NOT_FOUND', 'Payroll run not found', 404);
    }
    if (run.status !== 'DRAFT') {
      return apiError('VALIDATION_ERROR', 'Only DRAFT runs can be edited', 400);
    }
    const item = run.items.find((i) => i.id === itemId);
    if (!item) {
      return apiError('NOT_FOUND', 'Payroll item not found', 404);
    }
    const nextBonus = bonus === undefined ? num(item.bonus) : Number(bonus);
    const nextDeductions = deductions === undefined ? num(item.deductions) : Number(deductions);
    if (!Number.isFinite(nextBonus) || nextBonus < 0 || !Number.isFinite(nextDeductions) || nextDeductions < 0) {
      return apiError('VALIDATION_ERROR', 'bonus/deductions must be non-negative numbers', 400);
    }
    const net = money(num(item.baseSalary) + num(item.commissionAmount) + nextBonus - nextDeductions);
    if (net < 0) {
      return apiError('VALIDATION_ERROR', 'net salary cannot be negative', 400);
    }
    const updated = await prisma.payrollItem.update({
      where: { id: itemId },
      data: { bonus: nextBonus, deductions: nextDeductions, netSalary: net },
    });
    const totals = await prisma.payrollItem.aggregate({
      where: { payrollRunId: id },
      _sum: { netSalary: true },
    });
    await prisma.payrollRun.update({
      where: { id },
      data: { totalAmount: num(totals._sum.netSalary ?? 0) },
    });
    return NextResponse.json({ success: true, item: updated });
  } catch (e) {
    captureError('api/admin/payroll-runs/[id]', e);
    return apiError('INTERNAL_ERROR', 'Failed to update payroll item', 500);
  }
}
// Approve or mark a payroll run as paid
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { error } = await requireRole('SUPER_ADMIN', 'FINANCE');
    if (error) return error;

    const { id } = await params;
    const body = await req.json();
    const { action } = body; // 'approve' | 'pay'

    const run = await prisma.payrollRun.findUnique({ where: { id } });
    if (!run) {
      return apiError('NOT_FOUND', 'Payroll run not found', 404);
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
    return apiError('VALIDATION_ERROR', 'Invalid payroll transition', 400);
  } catch (e) {
    captureError('api/admin/payroll-runs/[id]', e);
    return apiError('INTERNAL_ERROR', 'Failed to update payroll run', 500);
  }
}
