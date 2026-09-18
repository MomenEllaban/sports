import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdminSession } from '@/lib/admin-guard';

export async function GET() {
  try {
    const { error } = await requireAdminSession();
    if (error) return error;

    const unreadCount = await prisma.notification.count({ where: { isRead: false } });
    return NextResponse.json({ success: true, unreadCount });
  } catch (e) {
    console.error('Admin notifications count error:', e);
    return NextResponse.json({ success: false, error: 'Failed' }, { status: 500 });
  }
}
