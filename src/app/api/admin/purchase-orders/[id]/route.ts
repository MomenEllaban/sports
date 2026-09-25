import { captureError } from '@/lib/monitor';
import { apiError } from '@/lib/api-response';
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
    if (!po) return apiError('NOT_FOUND', 'Purchase order not found', 404);
    if (!canAccessBranch(session, po.branchId)) return apiError('FORBIDDEN', 'أمر التوريد خارج نطاق فروعك', 403);

    if (body.action === 'confirm') {
      if (po.status !== 'DRAFT') return apiError('CONFLICT', 'يمكن تأكيد المسودة فقط', 409);
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
    if (po.status === 'RECEIVED' || po.status === 'CANCELLED') return apiError('VALIDATION_ERROR', 'Purchase order already closed', 400);
    if (po.items.some((item) => item.quantityReceived > 0)) return apiError('VALIDATION_ERROR', 'Cannot cancel: goods already received', 400);
    const updated = await prisma.purchaseOrder.update({ where: { id }, data: { status: 'CANCELLED' } });
    return NextResponse.json({ success: true, purchaseOrder: updated });
  } catch (error) {
    if (error instanceof Error && error.message === 'STALE_PO') return apiError('CONFLICT', 'تغيرت حالة الأمر من جهاز آخر', 409);
    captureError('api/admin/purchase-orders/[id]', error);
    return apiError('INTERNAL_ERROR', 'Failed to update purchase order', 500);
  }
}
