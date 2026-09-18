import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdminSession } from '@/lib/admin-guard';

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { error } = await requireAdminSession();
    if (error) return error;

    const { id } = await params;
    const body = await req.json();
    const { isActive } = body;

    if (typeof isActive !== 'boolean') {
      return NextResponse.json({ success: false, error: 'isActive must be boolean' }, { status: 400 });
    }

    const product = await prisma.product.update({ where: { id }, data: { isActive } });
    return NextResponse.json({ success: true, product });
  } catch (e) {
    console.error('Admin product toggle error:', e);
    return NextResponse.json({ success: false, error: 'Failed to update product' }, { status: 500 });
  }
}
