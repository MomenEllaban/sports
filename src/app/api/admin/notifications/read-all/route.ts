import { captureError } from '@/lib/monitor';
import { apiError } from '@/lib/api-response';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireRole } from '@/lib/auth/guards';
import { notificationScope } from '@/lib/admin/notification-scope';

export async function POST() {
  try {
    const { session, error } = await requireRole('SUPER_ADMIN', 'FINANCE', 'BRANCH_MANAGER', 'CASHIER', 'STAFF');
    if (error) return error;

    const result = await prisma.notification.updateMany({
      where: { isRead: false, ...notificationScope(session) },
      data: { isRead: true },
    });
    return NextResponse.json({ success: true, updated: result.count });
  } catch (e) {
    captureError('api/admin/notifications/read-all', e);
    return apiError('INTERNAL_ERROR', 'Failed to update notifications', 500);
  }
}
