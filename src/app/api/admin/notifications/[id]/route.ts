import { captureError } from '@/lib/monitor';
import { apiError } from '@/lib/api-response';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireRole } from '@/lib/auth/guards';
import { notificationScope } from '@/lib/admin/notification-scope';

async function scopedNotification(id: string, session: Parameters<typeof notificationScope>[0]) {
  return prisma.notification.findFirst({ where: { id, ...notificationScope(session) } });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { session, error } = await requireRole('SUPER_ADMIN', 'FINANCE', 'BRANCH_MANAGER', 'CASHIER', 'STAFF');
    if (error) return error;

    const { id } = await params;
    const existing = await scopedNotification(id, session);
    if (!existing) return apiError('NOT_FOUND', 'Notification not found', 404);
    const notification = await prisma.notification.update({ where: { id }, data: { isRead: true } });
    return NextResponse.json({ success: true, notification });
  } catch (e) {
    captureError('api/admin/notifications/[id]', e);
    return apiError('INTERNAL_ERROR', 'Failed to update notification', 500);
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { session, error } = await requireRole('SUPER_ADMIN', 'FINANCE', 'BRANCH_MANAGER', 'CASHIER', 'STAFF');
    if (error) return error;

    const { id } = await params;
    const existing = await scopedNotification(id, session);
    if (!existing) return apiError('NOT_FOUND', 'Notification not found', 404);
    await prisma.notification.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (e) {
    captureError('api/admin/notifications/[id]', e);
    return apiError('INTERNAL_ERROR', 'Failed to delete notification', 500);
  }
}
