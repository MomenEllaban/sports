import { captureError } from '@/lib/monitor';
import { apiError } from '@/lib/api-response';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireRole } from '@/lib/auth/guards';
import { canAccessBranch } from '@/lib/auth/branch-scope';
import { decrementStock, incrementStock, InsufficientStockError } from '@/lib/inventory/service';
import { computeTotals, num } from '@/lib/pricing';
import { ALEXANDRIA_DELIVERY_ZONES } from '@/lib/logistics';
import { OrderStatus, PaymentStatus } from '@prisma/client';

type EditLine = { productId: string; quantity: number };
const EDITABLE_STATUSES: OrderStatus[] = [OrderStatus.PENDING, OrderStatus.CONFIRMED];

function bad(message: string, status = 400) {
  return apiError(status === 401 ? 'UNAUTHORIZED' : status === 403 ? 'FORBIDDEN' : status === 404 ? 'NOT_FOUND' : status === 409 ? 'CONFLICT' : 'VALIDATION_ERROR', message, status);
}

function isPositiveInt(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { error, session } = await requireRole('SUPER_ADMIN', 'BRANCH_MANAGER');
    if (error) return error;
    const { id } = await params;
    const body = await req.json() as {
      expectedVersion?: unknown;
      guestName?: unknown;
      guestPhone?: unknown;
      deliveryAddress?: unknown;
      notes?: unknown;
      discountAmount?: unknown;
      items?: unknown;
    };

    if (!Number.isSafeInteger(body.expectedVersion) || Number(body.expectedVersion) < 0) {
      return bad('نسخة الطلب مفقودة أو غير صالحة', 409);
    }
    if (typeof body.guestPhone !== 'string' || !body.guestPhone.trim()) return bad('رقم الموبايل مطلوب');
    if (typeof body.deliveryAddress !== 'string' || !body.deliveryAddress.trim()) return bad('عنوان التوصيل مطلوب');
    const guestPhone = body.guestPhone.trim();
    const deliveryAddress = body.deliveryAddress.trim();
    if (body.notes !== undefined && body.notes !== null && typeof body.notes !== 'string') return bad('الملاحظات غير صالحة');
    if (body.discountAmount !== undefined && (typeof body.discountAmount !== 'number' || !Number.isFinite(body.discountAmount) || body.discountAmount < 0)) {
      return bad('الخصم غير صالح');
    }
    if (!Array.isArray(body.items) || body.items.length === 0) return bad('أضف صنفاً واحداً على الأقل');
    const requested: EditLine[] = [];
    const seen = new Set<string>();
    for (const raw of body.items) {
      const line = raw as Partial<EditLine>;
      if (typeof line.productId !== 'string' || !line.productId || !isPositiveInt(line.quantity)) {
        return bad('أحد الأصناف أو الكميات غير صالح');
      }
      if (seen.has(line.productId)) return bad('لا يمكن تكرار نفس الصنف في الطلب');
      seen.add(line.productId);
      requested.push({ productId: line.productId, quantity: line.quantity });
    }

    const order = await prisma.order.findUnique({
      where: { id },
      include: { items: true, taxInvoice: true, returns: { select: { id: true } } },
    });
    if (!order) return bad('الطلب غير موجود', 404);
    if (!canAccessBranch(session, order.branchId)) return bad('الطلب خارج نطاق فروعك', 403);
    if (!EDITABLE_STATUSES.includes(order.orderStatus)) {
      return bad('لا يمكن تعديل الطلب بعد بدء التجهيز أو الشحن', 409);
    }
    if (order.paymentStatus !== PaymentStatus.PENDING || order.paymentRef || order.receiptImage) {
      return bad('لا يمكن تعديل طلب لديه إثبات دفع أو حالة دفع غير معلقة', 409);
    }
    if (order.taxInvoice || order.returns.length > 0) {
      return bad('لا يمكن تعديل طلب بعد إصدار فاتورة أو بدء مرتجع', 409);
    }
    if (num(order.couponDiscount) > 0 || num(order.loyaltyDiscount) > 0 || order.couponCode || order.loyaltyRedeemed > 0) {
      return bad('تعديل الخصم غير متاح مع كوبون أو ولاء؛ استخدم مسار التسويات الخاص', 409);
    }
    if (order.editVersion !== Number(body.expectedVersion)) {
      return bad('تم تعديل الطلب من جهاز آخر حدّث الصفحة ثم أعد المحاولة', 409);
    }

    const productIds = requested.map((line) => line.productId);
    const products = await prisma.product.findMany({
      where: { id: { in: productIds }, isActive: true },
      select: { id: true, price: true },
    });
    const productById = new Map(products.map((product) => [product.id, product]));
    if (products.length !== productIds.length) return bad('أحد الأصناف غير موجود أو موقوف');

    const oldByProduct = new Map(order.items.map((item) => [item.productId, item]));
    const lines = requested.map((line) => {
      const old = oldByProduct.get(line.productId);
      const unitPrice = old ? num(old.unitPrice) : num(productById.get(line.productId)!.price);
      return { ...line, unitPrice, totalPrice: Number((unitPrice * line.quantity).toFixed(2)) };
    });
    const deliveryFee = order.deliveryZone === 'MANUAL'
      ? 0
      : ALEXANDRIA_DELIVERY_ZONES.find((zone) => zone.id === order.deliveryZone)?.fee ?? num(order.deliveryFee);
    const totals = computeTotals({ lines, discount: body.discountAmount === undefined ? num(order.discountAmount) : body.discountAmount, deliveryFee });
    if (body.discountAmount !== undefined && totals.discount !== Number(body.discountAmount)) {
      return bad('الخصم أكبر من قيمة الأصناف');
    }

    const updated = await prisma.$transaction(async (tx) => {
      const claimed = await tx.order.updateMany({
        where: {
          id,
          editVersion: Number(body.expectedVersion),
          orderStatus: { in: [OrderStatus.PENDING, OrderStatus.CONFIRMED] },
          paymentStatus: PaymentStatus.PENDING,
        },
        data: { editVersion: { increment: 1 } },
      });
      if (claimed.count !== 1) throw new Error('STALE_ORDER');

      for (const old of order.items) {
        const next = requested.find((line) => line.productId === old.productId);
        const delta = (next?.quantity || 0) - old.quantity;
        if (delta < 0) {
          await incrementStock(tx, {
            branchId: order.branchId,
            productId: old.productId,
            quantity: Math.abs(delta),
            type: 'ADJUSTMENT',
            referenceId: `${order.orderNumber}:EDIT`,
            notes: 'استرجاع كمية بعد تعديل الطلب',
            createdById: session?.user?.id,
          });
        }
      }
      for (const line of lines) {
        const old = oldByProduct.get(line.productId);
        const delta = line.quantity - (old?.quantity || 0);
        if (delta > 0) {
          await decrementStock(tx, {
            branchId: order.branchId,
            productId: line.productId,
            quantity: delta,
            type: 'ADJUSTMENT',
            referenceId: `${order.orderNumber}:EDIT`,
            notes: 'تعديل كمية الطلب',
            createdById: session?.user?.id,
          });
        }
      }

      await tx.orderItem.deleteMany({ where: { orderId: id } });
      await tx.orderItem.createMany({
        data: lines.map((line) => ({
          orderId: id,
          productId: line.productId,
          quantity: line.quantity,
          unitPrice: line.unitPrice,
          totalPrice: line.totalPrice,
        })),
      });
      const result = await tx.order.update({
        where: { id },
        data: {
          guestName: typeof body.guestName === 'string' ? body.guestName.trim() || null : order.guestName,
          guestPhone,
          deliveryAddress,
          notes: body.notes === undefined ? order.notes : (typeof body.notes === 'string' ? body.notes.trim() || null : null),
          discountAmount: totals.discount,
          subtotal: totals.subtotal,
          taxAmount: totals.vat,
          deliveryFee: totals.deliveryFee,
          totalAmount: totals.total,
        },
        include: { items: { include: { product: { select: { nameAr: true, nameEn: true, sku: true } } } } },
      });
      await tx.auditLog.create({
        data: {
          actorId: session?.user?.id || null,
          action: 'order.edited',
          entity: 'Order',
          entityId: id,
          branchId: order.branchId,
          metadata: JSON.stringify({
            editVersion: order.editVersion + 1,
            before: { subtotal: num(order.subtotal), discount: num(order.discountAmount), total: num(order.totalAmount) },
            after: totals,
            lineCount: lines.length,
          }),
        },
      });
      return result;
    }, { maxWait: 10000, timeout: 30000 });

    return NextResponse.json({ success: true, order: updated, totals });
  } catch (error) {
    if (error instanceof InsufficientStockError) {
      return apiError('VALIDATION_ERROR', 'المخزون لا يكفي', 400, undefined, { productId: error.productId, available: error.available });
    }
    if (error instanceof Error && error.message === 'STALE_ORDER') {
      return bad('تم تعديل الطلب من جهاز آخر حدّث الصفحة ثم أعد المحاولة', 409);
    }
    captureError('api/admin/orders/[id]/edit', error);
    return apiError('INTERNAL_ERROR', 'فشل تعديل الطلب', 500);
  }
}
