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
    console.error('Admin notifications read-all error:', e);
    return NextResponse.json({ success: false, error: 'Failed to update notifications' }, { status: 500 });
  }
}
