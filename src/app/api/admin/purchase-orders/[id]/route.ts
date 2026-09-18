import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdminSession } from '@/lib/admin-guard';

// Cancel a purchase order (only if nothing received yet)
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { error } = await requireAdminSession();
    if (error) return error;

    const { id } = await params;
    const po = await prisma.purchaseOrder.findUnique({ where: { id }, include: { items: true } });
    if (!po) {
      return NextResponse.json({ success: false, error: 'Purchase order not found' }, { status: 404 });
    }
    if (po.status === 'RECEIVED' || po.status === 'CANCELLED') {
      return NextResponse.json({ success: false, error: 'Purchase order already closed' }, { status: 400 });
    }
    if (po.items.some((i) => i.quantityReceived > 0)) {
      return NextResponse.json({ success: false, error: 'Cannot cancel: goods already received' }, { status: 400 });
    }

    const updated = await prisma.purchaseOrder.update({ where: { id }, data: { status: 'CANCELLED' } });
    return NextResponse.json({ success: true, purchaseOrder: updated });
  } catch (e) {
    console.error('Admin PO cancel error:', e);
    return NextResponse.json({ success: false, error: 'Failed to cancel purchase order' }, { status: 500 });
  }
}
