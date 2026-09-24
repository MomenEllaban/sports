import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireRole } from '@/lib/auth/guards';
import { canAccessBranch } from '@/lib/auth/branch-scope';

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { error, session } = await requireRole('SUPER_ADMIN', 'BRANCH_MANAGER');
    if (error) return error;
    const { id } = await params;
    const body = await req.json().catch(() => ({})) as { action?: unknown };
    const po = await prisma.purchaseOrder.findUnique({ where: { id }, include: { items: true } });
    if (!po) return NextResponse.json({ success: false, error: 'Purchase order not found' }, { status: 404 });
    if (!canAccessBranch(session, po.branchId)) return NextResponse.json({ success: false, error: 'أمر التوريد خارج نطاق فروعك' }, { status: 403 });

    if (body.action === 'confirm') {
      if (po.status !== 'DRAFT') return NextResponse.json({ success: false, error: 'يمكن تأكيد المسودة فقط' }, { status: 409 });
      const updated = await prisma.$transaction(async (tx) => {
        const claimed = await tx.purchaseOrder.updateMany({ where: { id, status: 'DRAFT' }, data: { status: 'SUBMITTED' } });
        if (claimed.count !== 1) throw new Error('STALE_PO');
        await tx.auditLog.create({ data: { actorId: session?.user?.id || null, action: 'purchase_order.confirmed', entity: 'PurchaseOrder', entityId: id, branchId: po.branchId, metadata: JSON.stringify({ poNumber: po.poNumber }) } });
        return tx.purchaseOrder.findUniqueOrThrow({ where: { id } });
      });
      return NextResponse.json({ success: true, purchaseOrder: updated });
    }

    // Backwards-compatible cancel action, but drafts/submitted orders can be
    // cancelled only before any goods are received.
    if (po.status === 'RECEIVED' || po.status === 'CANCELLED') return NextResponse.json({ success: false, error: 'Purchase order already closed' }, { status: 400 });
    if (po.items.some((item) => item.quantityReceived > 0)) return NextResponse.json({ success: false, error: 'Cannot cancel: goods already received' }, { status: 400 });
    const updated = await prisma.purchaseOrder.update({ where: { id }, data: { status: 'CANCELLED' } });
    return NextResponse.json({ success: true, purchaseOrder: updated });
  } catch (error) {
    if (error instanceof Error && error.message === 'STALE_PO') return NextResponse.json({ success: false, error: 'تغيرت حالة الأمر من جهاز آخر' }, { status: 409 });
    console.error('Admin PO update error:', error);
    return NextResponse.json({ success: false, error: 'Failed to update purchase order' }, { status: 500 });
  }
}
