import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdminSession } from '@/lib/admin-guard';

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { error } = await requireAdminSession();
    if (error) return error;

    const { id } = await params;
    const notification = await prisma.notification.update({ where: { id }, data: { isRead: true } });
    return NextResponse.json({ success: true, notification });
  } catch (e) {
    console.error('Admin notification update error:', e);
    return NextResponse.json({ success: false, error: 'Failed to update notification' }, { status: 500 });
  }
}
