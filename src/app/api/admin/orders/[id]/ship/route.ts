import { apiError } from '@/lib/api-response';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { num } from '@/lib/pricing';
import { requireRole } from '@/lib/auth/guards';
import { canAccessBranch } from '@/lib/auth/branch-scope';
import { createCourierShipment } from '@/lib/logistics';
import { writeAudit } from '@/lib/audit';
import { captureError } from '@/lib/monitor';

/**
 * Retry shipment booking: for orders where the courier was not booked (manual
 * or WhatsApp), attempt the real courier call now and persist the tracking number.
 */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { error, session } = await requireRole('SUPER_ADMIN', 'BRANCH_MANAGER');
    if (error) return error;
    const { id } = await params;
    const order = await prisma.order.findUnique({ where: { id } });
    if (!order) return apiError('NOT_FOUND', 'Order not found', 404);
    // Booking a shipment is a real external call paid for by the branch, so it
    // is restricted to the branch that owns the order.
    if (!canAccessBranch(session, order.branchId)) {
      return apiError('FORBIDDEN', 'This order belongs to a branch outside your assignment', 403);
    }
    if (order.shippingProvider !== 'BOSTA' && order.shippingProvider !== 'MYLERZ') {
      return apiError('VALIDATION_ERROR', 'Manual delivery and pickup do not need a courier booking', 400);
    }
    if (order.trackingNumber && !order.trackingNumber.startsWith('MANUAL-')) {
      return apiError('CONFLICT', 'A shipment is already booked for this order', 409);
    }
    const result = await createCourierShipment({
      orderNumber: order.orderNumber,
      branchAddress: '',
      customerName: order.guestName || 'Customer',
      customerPhone: order.guestPhone,
      customerAddress: order.deliveryAddress,
      codAmount: order.paymentMethod === 'COD' ? num(order.totalAmount) : 0,
      provider: order.shippingProvider,
    });
    if (result.manual) {
      return apiError('UNCONFIGURED', 'The courier is not configured — add its API key in Settings first', 422);
    }
    const updated = await prisma.order.update({
      where: { id },
      data: { trackingNumber: result.trackingNumber },
    });
    void writeAudit({
      actorId: (session?.user as { id?: string } | undefined)?.id,
      action: 'order.shipment_booked',
      entity: 'Order',
      entityId: id,
      branchId: order.branchId,
      metadata: {
        orderNumber: order.orderNumber,
        provider: order.shippingProvider,
        previousTrackingNumber: order.trackingNumber,
        trackingNumber: result.trackingNumber,
      },
    });
    return NextResponse.json({ success: true, trackingNumber: updated.trackingNumber, labelUrl: result.labelUrl });
  } catch (e) {
    captureError('admin/orders/[id]/ship', e);
    return apiError('INTERNAL_ERROR', 'Failed to book the shipment', 500);
  }
}
