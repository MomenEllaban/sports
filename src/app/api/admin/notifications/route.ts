import { captureError } from '@/lib/monitor';
import { apiError } from '@/lib/api-response';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireRole } from '@/lib/auth/guards';
import { notificationScope } from '@/lib/admin/notification-scope';

export async function GET() {
  try {
    const { session, error } = await requireRole('SUPER_ADMIN', 'FINANCE', 'BRANCH_MANAGER', 'CASHIER', 'STAFF');
    if (error) return error;

    const unreadCount = await prisma.notification.count({
      where: { isRead: false, ...notificationScope(session) },
    });
    return NextResponse.json({ success: true, unreadCount });
  } catch (e) {
    captureError('api/admin/notifications', e);
    return apiError('INTERNAL_ERROR', 'Failed', 500);
  }
}
