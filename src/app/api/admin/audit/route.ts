import { apiError } from '@/lib/api-response';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireRole } from '@/lib/auth/guards';

export async function GET(req: Request) {
  try {
    const { error } = await requireRole('SUPER_ADMIN');
    if (error) return error;

    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action') || undefined;
    const entity = searchParams.get('entity') || undefined;
    const take = Math.min(Number(searchParams.get('take')) || 100, 500);

    const logs = await prisma.auditLog.findMany({
      where: {
        ...(action ? { action: { contains: action } } : {}),
        ...(entity ? { entity } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take,
    });
    return NextResponse.json({ success: true, logs });
  } catch {
    return apiError('INTERNAL_ERROR', 'Failed to load audit log', 500);
  }
}
