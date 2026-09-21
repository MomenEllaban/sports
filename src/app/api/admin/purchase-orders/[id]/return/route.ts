import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireRole } from '@/lib/auth/guards';
import { decrementStock, InsufficientStockError } from '@/lib/inventory/service';
import { writeAudit } from '@/lib/audit';
import { captureError } from '@/lib/monitor';

/**
 * Supplier return (T13): send received goods back — decrements the branch
 * stock with an ADJUSTMENT log referencing the PO. Partial returns allowed.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { error, session } = await requireRole('SUPER_ADMIN', 'BRANCH_MANAGER');
    if (error) return error;
    const { id } = await params;
    const body = (await req.json()) as { productId?: string; quantity?: number; reason?: string };
    const qty = Math.floor(Number(body.quantity));
    if (!body.productId || !Number.isInteger(qty) || qty <= 0) {
      return NextResponse.json({ success: false, error: 'الصنف والكمية مطلوبان' }, { status: 400 });
    }
    if (!body.reason || !String(body.reason).trim()) {
      return NextResponse.json({ success: false, error: 'سبب الإرجاع إجباري' }, { status: 400 });
    }
    const po = await prisma.purchaseOrder.findUnique({ where: { id }, include: { items: true } });
    if (!po) return NextResponse.json({ success: false, error: 'أمر الشراء غير موجود' }, { status: 404 });
    const item = po.items.find((i) => i.productId === body.productId);
    if (!item || item.quantityReceived < qty) {
      return NextResponse.json({ success: false, error: 'الكمية تتجاوز المستلم من هذا الصنف' }, { status: 400 });
    }
    const actorId = (session?.user as { id?: string })?.id;
    try {
      await prisma.$transaction(async (tx) => {
        await decrementStock(tx, {
          branchId: po.branchId,
          productId: body.productId as string,
          quantity: qty,
          type: 'ADJUSTMENT',
          referenceId: po.poNumber,
          notes: `مرتجع مورد: ${String(body.reason).slice(0, 400)}`,
          createdById: actorId,
        });
        await tx.purchaseOrderItem.update({
          where: { id: item.id },
          data: { quantityReceived: item.quantityReceived - qty },
        });
      }, { maxWait: 10000, timeout: 20000 });
    } catch (e) {
      if (e instanceof InsufficientStockError) {
        return NextResponse.json({ success: false, error: `المخزون الحالي (${e.available}) لا يغطي المرتجع` }, { status: 422 });
      }
      throw e;
    }
    writeAudit({ actorId, action: 'po.return', entity: 'PurchaseOrder', entityId: id, metadata: { productId: body.productId, qty } }).catch(() => null);
    return NextResponse.json({ success: true });
  } catch (e) {
    captureError('admin/purchase-orders/[id]/return', e);
    return NextResponse.json({ success: false, error: 'تعذر تسجيل المرتجع' }, { status: 500 });
  }
}
