import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireRole } from '@/lib/auth/guards';
import { canAccessBranch } from '@/lib/auth/branch-scope';
import { computeTotals, num } from '@/lib/pricing';
import { decrementStock, InsufficientStockError } from '@/lib/inventory/service';

const genOrderNumber = () => `ORD-2026-${Math.floor(100000 + Math.random() * 900000)}`;

export async function POST(req: Request) {
  try {
    const { error, session } = await requireRole('SUPER_ADMIN', 'BRANCH_MANAGER');
    if (error) return error;

    const body = await req.json();
    const {
      guestName,
      guestPhone,
      deliveryAddress,
      paymentMethod = 'COD',
      orderSource = 'WHATSAPP',
      branchId,
      notes,
      items,
    } = body;

    if (!guestPhone || !deliveryAddress || !branchId || !items || items.length === 0) {
      return NextResponse.json(
        { success: false, error: 'الموبايل، العنوان، الفرع، والمنتجات مطلوبة' },
        { status: 400 }
      );
    }

    const branch = await prisma.branch.findFirst({ where: { id: branchId, isActive: true } });
    if (!branch) {
      return NextResponse.json({ success: false, error: 'الفرع غير صالح' }, { status: 400 });
    }
    if (!canAccessBranch(session, branchId)) {
      return NextResponse.json({ success: false, error: 'لا تملك صلاحية إنشاء طلب في هذا الفرع' }, { status: 403 });
    }

    // Validate item shape first so we can load all products in one query.
    const requested: Array<{ productId: string; quantity: number }> = [];
    for (const item of items) {
      if (typeof item.quantity !== 'number' || !Number.isInteger(item.quantity) || item.quantity <= 0) {
        return NextResponse.json({ success: false, error: 'كمية غير صالحة في الطلب' }, { status: 400 });
      }
      if (typeof item.productId !== 'string' || !item.productId) {
        return NextResponse.json({ success: false, error: 'صنف غير صالح في الطلب' }, { status: 400 });
      }
      requested.push({ productId: item.productId, quantity: item.quantity });
    }

    // T06/T09: server recomputes from DB; client prices ignored.
    const products = await prisma.product.findMany({
      where: { id: { in: [...new Set(requested.map((r) => r.productId))] } },
    });
    const byId = new Map(products.map((p) => [p.id, p]));

    const orderItemsData: Array<{ productId: string; unitPrice: number; quantity: number; totalPrice: number }> = [];
    for (const line of requested) {
      const product = byId.get(line.productId);
      if (!product || !product.isActive) {
        return NextResponse.json({ success: false, error: 'صنف غير موجود أو موقوف' }, { status: 400 });
      }
      const price = num(product.price);
      orderItemsData.push({
        productId: product.id,
        unitPrice: price,
        quantity: line.quantity,
        totalPrice: price * line.quantity,
      });
    }

    // T09: central pricing (exclusive VAT).
    const totals = computeTotals({ lines: orderItemsData });

    // ONE transaction: stock + logs + order. Numbers retried on collision (T07).
    let order: { id: string; orderNumber: string } | null = null;
    let lastErr: unknown = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      const orderNumber = genOrderNumber();
      try {
        order = await prisma.$transaction(async (tx) => {
          for (const line of orderItemsData) {
            await decrementStock(tx, {
              branchId,
              productId: line.productId,
              quantity: line.quantity,
              type: 'SALE',
              referenceId: orderNumber,
            });
          }
          const created = await tx.order.create({
            data: {
              orderNumber,
              orderSource: orderSource as 'WHATSAPP' | 'ONLINE' | 'POS',
              guestName: guestName || null,
              guestPhone: String(guestPhone).trim(),
              deliveryAddress: String(deliveryAddress).trim(),
              branchId,
              paymentMethod: paymentMethod as 'COD' | 'PAYMOB' | 'FAWRY' | 'INSTAPAY' | 'VODAFONE_CASH' | 'KASHIER' | 'CASH' | 'CARD',
              subtotal: totals.subtotal,
              taxAmount: totals.vat,
              deliveryFee: 0,
              deliveryZone: 'MANUAL',
              totalAmount: totals.total,
              paymentStatus: 'PENDING',
              notes: notes || null,
              items: { create: orderItemsData },
            },
          });
          return { id: created.id, orderNumber };
        }, { maxWait: 10000, timeout: 20000 });
        lastErr = null;
        break;
      } catch (e) {
        lastErr = e;
        if ((e as { code?: string }).code === 'P2002') continue;
        if (e instanceof InsufficientStockError) {
          return NextResponse.json(
            {
              success: false,
              error: 'المخزون لا يكفي',
              items: [{ productId: e.productId, available: e.available }],
            },
            { status: 400 }
          );
        }
        throw e;
      }
    }
    if (lastErr || !order) {
      throw lastErr || new Error('Order failed');
    }

    const created = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    return NextResponse.json({ success: true, order: created });
  } catch (e) {
    console.error('Admin order create error:', e);
    return NextResponse.json({ success: false, error: 'فشل في إنشاء الطلب' }, { status: 500 });
  }
}
