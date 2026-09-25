import { captureError } from '@/lib/monitor';
import { apiError } from '@/lib/api-response';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireRole } from '@/lib/auth/guards';
import { writeAudit } from '@/lib/audit';

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
    captureError('api/admin/customers/[id]', e);
    return apiError('INTERNAL_ERROR', 'فشل في تحديث بيانات العميل', 500);
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error, session } = await requireRole('SUPER_ADMIN', 'BRANCH_MANAGER');
    if (error) return error;

    const { id } = await params;

    // Safety: check if customer has orders
    const orderCount = await prisma.order.count({ where: { customerId: id } });
    if (orderCount > 0) {
      return apiError('CONFLICT', `لا يمكن حذف العميل لأن لديه ${orderCount} طلب مسجل`, 409);
    }

    const target = await prisma.customer.findUnique({
      where: { id },
      select: { name: true, phone: true },
    });

    await prisma.customer.delete({ where: { id } });

    // Deleting a customer removes personal data, so the trail keeps the phone
    // and name to answer a later "who was removed and why" question.
    void writeAudit({
      actorId: (session?.user as { id?: string } | undefined)?.id,
      action: 'customer.deleted',
      entity: 'Customer',
      entityId: id,
      metadata: { name: target?.name, phone: target?.phone },
    });

    return NextResponse.json({ success: true });
  } catch (e) {
    captureError('api/admin/customers/[id]', e);
    return apiError('INTERNAL_ERROR', 'فشل في حذف العميل', 500);
  }
}
