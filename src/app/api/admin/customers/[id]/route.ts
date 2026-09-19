import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireRole } from '@/lib/auth/guards.js';

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error } = await requireRole('SUPER_ADMIN', 'BRANCH_MANAGER');
    if (error) return error;

    const { id } = await params;
    const body = await req.json();
    const { phone, name, email, notes, loyaltyPoints } = body;

    const data: Record<string, unknown> = {};
    if (phone !== undefined) data.phone = String(phone).trim();
    if (name !== undefined) data.name = name ? String(name).trim() : null;
    if (email !== undefined) data.email = email ? String(email).trim() : null;
    if (notes !== undefined) data.notes = notes ? String(notes).trim() : null;
    if (loyaltyPoints !== undefined) data.loyaltyPoints = Number(loyaltyPoints);

    const customer = await prisma.customer.update({
      where: { id },
      data,
    });

    return NextResponse.json({ success: true, customer });
  } catch (e) {
    console.error('Admin customer update error:', e);
    return NextResponse.json(
      { success: false, error: 'فشل في تحديث بيانات العميل' },
      { status: 500 }
    );
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

    // Safety: check if customer has orders
    const orderCount = await prisma.order.count({ where: { customerId: id } });
    if (orderCount > 0) {
      return NextResponse.json(
        {
          success: false,
          error: `لا يمكن حذف العميل لأن لديه ${orderCount} طلب مسجل`,
        },
        { status: 409 }
      );
    }

    await prisma.customer.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('Admin customer delete error:', e);
    return NextResponse.json(
      { success: false, error: 'فشل في حذف العميل' },
      { status: 500 }
    );
  }
}
