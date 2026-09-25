import { captureError } from '@/lib/monitor';
import { apiError } from '@/lib/api-response';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireRole } from '@/lib/auth/guards';
import { writeAudit } from '@/lib/audit';
import { num } from '@/lib/pricing';
import { ExpenseCategory } from '@prisma/client';

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { error, session } = await requireRole('SUPER_ADMIN', 'FINANCE');
    if (error) return error;

    const { id } = await params;
    const body = await req.json();
    const data: { branchId?: string; category?: ExpenseCategory; description?: string; amount?: number } = {};

    if (body.branchId) data.branchId = body.branchId;
    if (body.category) {
      if (!Object.values(ExpenseCategory).includes(body.category)) {
        return apiError('VALIDATION_ERROR', 'Invalid expense category', 400);
      }
      data.category = body.category;
    }
    if (body.description !== undefined) {
      if (!String(body.description).trim()) {
        return apiError('VALIDATION_ERROR', 'Description is required', 400);
      }
      data.description = String(body.description).trim();
    }
    if (body.amount !== undefined) {
      if (!(Number(body.amount) > 0)) {
        return apiError('VALIDATION_ERROR', 'Amount must be positive', 400);
      }
      data.amount = Number(body.amount);
    }
    if (Object.keys(data).length === 0) {
      return apiError('VALIDATION_ERROR', 'Nothing to update', 400);
    }

    const before = await prisma.expense.findUnique({
      where: { id },
      select: { expenseNumber: true, amount: true, category: true, branchId: true, description: true },
    });
    if (!before) {
      return apiError('NOT_FOUND', 'المصروف غير موجود', 404);
    }

    const expense = await prisma.expense.update({ where: { id }, data });

    // Editing an already-recorded expense rewrites history in the P&L, so the
    // previous figures are kept.
    void writeAudit({
      actorId: (session?.user as { id?: string } | undefined)?.id,
      action: 'expense.updated',
      entity: 'Expense',
      entityId: id,
      branchId: expense.branchId,
      metadata: {
        expenseNumber: before.expenseNumber,
        amount: { from: num(before.amount), to: num(expense.amount) },
        category: { from: before.category, to: expense.category },
        description: { from: before.description, to: expense.description },
      },
    });

    return NextResponse.json({ success: true, expense });
  } catch (e) {
    captureError('api/admin/expenses/[id]', e);
    return apiError('INTERNAL_ERROR', 'Failed to update expense', 500);
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { error, session } = await requireRole('SUPER_ADMIN', 'FINANCE');
    if (error) return error;

    const { id } = await params;
    const before = await prisma.expense.findUnique({
      where: { id },
      select: { expenseNumber: true, amount: true, category: true, branchId: true, description: true },
    });
    await prisma.expense.delete({ where: { id } });
    void writeAudit({
      actorId: (session?.user as { id?: string } | undefined)?.id,
      action: 'expense.deleted',
      entity: 'Expense',
      entityId: id,
      branchId: before?.branchId ?? null,
      metadata: {
        expenseNumber: before?.expenseNumber,
        amount: before ? num(before.amount) : null,
        category: before?.category,
        description: before?.description,
      },
    });
    return NextResponse.json({ success: true });
  } catch (e) {
    captureError('api/admin/expenses/[id]', e);
    return apiError('INTERNAL_ERROR', 'Failed to delete expense', 500);
  }
}
