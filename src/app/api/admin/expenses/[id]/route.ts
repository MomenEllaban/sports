import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdminSession } from '@/lib/admin-guard';
import { ExpenseCategory } from '@prisma/client';

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { error } = await requireAdminSession();
    if (error) return error;

    const { id } = await params;
    const body = await req.json();
    const data: { branchId?: string; category?: ExpenseCategory; description?: string; amount?: number } = {};

    if (body.branchId) data.branchId = body.branchId;
    if (body.category) {
      if (!Object.values(ExpenseCategory).includes(body.category)) {
        return NextResponse.json({ success: false, error: 'Invalid expense category' }, { status: 400 });
      }
      data.category = body.category;
    }
    if (body.description !== undefined) {
      if (!String(body.description).trim()) {
        return NextResponse.json({ success: false, error: 'Description is required' }, { status: 400 });
      }
      data.description = String(body.description).trim();
    }
    if (body.amount !== undefined) {
      if (!(Number(body.amount) > 0)) {
        return NextResponse.json({ success: false, error: 'Amount must be positive' }, { status: 400 });
      }
      data.amount = Number(body.amount);
    }
    if (Object.keys(data).length === 0) {
      return NextResponse.json({ success: false, error: 'Nothing to update' }, { status: 400 });
    }

    const expense = await prisma.expense.update({ where: { id }, data });
    return NextResponse.json({ success: true, expense });
  } catch (e) {
    console.error('Admin expense update error:', e);
    return NextResponse.json({ success: false, error: 'Failed to update expense' }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { error } = await requireAdminSession();
    if (error) return error;

    const { id } = await params;
    await prisma.expense.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('Admin expense delete error:', e);
    return NextResponse.json({ success: false, error: 'Failed to delete expense' }, { status: 500 });
  }
}
