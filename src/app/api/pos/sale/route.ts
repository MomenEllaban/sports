import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { submitToEta } from '@/lib/eta';
import { PaymentMethod, PaymentStatus } from '@prisma/client';
import { requireRole, POS_ROLES } from '@/lib/auth/guards.js';
import { resolvePosContext, PosContextError } from '@/lib/pos/context.js';
import { authorizeDiscount, DiscountAuthError } from '@/lib/pos/discount.js';

export async function POST(req: Request) {
  try {
    const { error, session } = await requireRole(...POS_ROLES);
    if (error) return error;

    const body = await req.json();
    const { paymentMethod, items, customerId, branchId } = body;

    let ctx;
    try {
      ctx = await resolvePosContext(session!, branchId ?? null);
    } catch (e) {
      const err = e as PosContextError;
      return NextResponse.json({ success: false, error: err.message }, { status: err.status || 400 });
    }
    const flagshipBranch = { id: ctx.branch.id };
    const cashierUser = { id: ctx.cashierId };

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ success: false, error: 'الفاتورة فارغة: أضف صنفاً واحداً على الأقل' }, { status: 400 });
    }
    if (!['CASH', 'CARD', 'INSTAPAY'].includes(paymentMethod)) {
      return NextResponse.json({ success: false, error: 'طريقة الدفع غير صالحة' }, { status: 400 });
    }

    let subtotal = 0;
    const saleItemsData: Array<{ productId: string; unitPrice: number; quantity: number; totalPrice: number; currentStock: number }> = [];
    const saleNumber = `POS-2026-${Math.floor(10000 + Math.random() * 90000)}`;

    // Pass 1 — validate everything (products, integer qty, stock). No writes.
    for (const item of items) {
      if (typeof item.quantity !== 'number' || !Number.isInteger(item.quantity) || item.quantity <= 0) {
        return NextResponse.json({ success: false, error: 'كمية غير صالحة في الفاتورة' }, { status: 400 });
      }
      const qty = item.quantity;
      const dbProduct = await prisma.product.findUnique({
        where: { id: item.productId },
        include: { inventories: { where: { branchId: flagshipBranch.id } } },
      });

      if (!dbProduct || !dbProduct.isActive) {
        return NextResponse.json({ success: false, error: 'صنف غير موجود أو موقوف' }, { status: 400 });
      }

      // Strict stock guard: never oversell
      const currentStock = dbProduct.inventories[0]?.stockQuantity || 0;
      if (currentStock < qty) {
        return NextResponse.json(
          { success: false, error: `المخزون لا يكفي: ${dbProduct.nameAr} (المتاح ${currentStock})` },
          { status: 400 }
        );
      }

      // NOTE: client unitPrice is IGNORED — server recomputes from DB (T06).
      const itemTotal = dbProduct.price * qty;
      subtotal += itemTotal;

      saleItemsData.push({
        productId: dbProduct.id,
        unitPrice: dbProduct.price,
        quantity: qty,
        totalPrice: itemTotal,
        currentStock,
      });
    }

    // Pass 2 — strict discount validation + manager authorization (T06), before any write.
    const rawDiscount = (body as { discountAmount?: unknown }).discountAmount ?? 0;
    if (typeof rawDiscount !== 'number' || !Number.isFinite(rawDiscount) || rawDiscount < 0 || rawDiscount > subtotal) {
      return NextResponse.json({ success: false, error: 'مبلغ الخصم غير صالح' }, { status: 400 });
    }
    const discount = Math.round(rawDiscount * 100) / 100;
    let approvedById: string | null = null;
    try {
      const decision = await authorizeDiscount(
        ctx.cashierId,
        ctx.role,
        discount,
        typeof body.managerPin === 'string' ? body.managerPin : null
      );
      approvedById = decision.approvedById;
    } catch (e) {
      const err = e as DiscountAuthError;
      return NextResponse.json({ success: false, error: err.message }, { status: err.status || 400 });
    }

    // Pass 3 — writes: deduct stock + logs.
    for (const line of saleItemsData) {
      const newStock = line.currentStock - line.quantity;

      await prisma.branchInventory.updateMany({
        where: { branchId: flagshipBranch.id, productId: line.productId },
        data: { stockQuantity: newStock },
      });

      // Log Inventory audit (linked to the sale via referenceId)
      await prisma.inventoryLog.create({
        data: {
          branchId: flagshipBranch.id,
          productId: line.productId,
          type: 'SALE',
          changeQuantity: -line.quantity,
          previousQuantity: line.currentStock,
          newQuantity: newStock,
          referenceId: saleNumber,
          createdById: cashierUser.id,
        },
      });
    }

    const netAmount = Math.max(0, subtotal - discount);
    const vatAmount = Math.round(netAmount * 0.14 * 100) / 100;
    const totalAmount = netAmount + vatAmount;

    // Validate customer if provided (by id, or phone fallback for offline-synced sales)
    let resolvedCustomerId: string | null = null;
    if (customerId) {
      const customer = await prisma.customer.findUnique({ where: { id: customerId } });
      if (customer) resolvedCustomerId = customerId;
    } else if (body.customerPhone) {
      const customer = await prisma.customer.findUnique({ where: { phone: String(body.customerPhone) } });
      if (customer) resolvedCustomerId = customer.id;
    }

    const sale = await prisma.sale.create({
      data: {
        saleNumber,
        branchId: flagshipBranch.id,
        cashierId: cashierUser.id,
        customerId: resolvedCustomerId,
        subtotal,
        discountAmount: discount,
        taxAmount: vatAmount,
        totalAmount,
        paymentMethod: paymentMethod as PaymentMethod,
        paymentStatus: PaymentStatus.PAID,
        approvedById,
        items: {
          create: saleItemsData.map((l) => ({
            productId: l.productId,
            unitPrice: l.unitPrice,
            quantity: l.quantity,
            totalPrice: l.totalPrice,
          })),
        },
      },
    });

    // Add loyalty points to customer (1 point per 10 EGP spent)
    let loyaltyEarned = 0;
    if (resolvedCustomerId) {
      loyaltyEarned = Math.floor(totalAmount / 10);
      if (loyaltyEarned > 0) {
        await prisma.customer.update({
          where: { id: resolvedCustomerId },
          data: { loyaltyPoints: { increment: loyaltyEarned } },
        });
      }
    }

    // Submit ETA e-receipt
    const etaRes = await submitToEta({
      branchId: flagshipBranch.id,
      saleId: sale.id,
      invoiceNumber: saleNumber,
      totalAmount,
      vatAmount,
      items: saleItemsData.map((i) => ({
        name: 'منتج رياضي',
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        totalPrice: i.totalPrice,
        vatAmount: Math.round(i.totalPrice * 0.14 * 100) / 100,
      })),
    });

    return NextResponse.json({
      success: true,
      saleId: sale.id,
      saleNumber,
      totalAmount,
      subtotal,
      vatAmount,
      discountAmount: discount,
      loyaltyEarned,
      qrCodeDataUrl: etaRes.qrCodeDataUrl,
    });
  } catch (error) {
    console.error('POS Sale API error:', error);
    return NextResponse.json({ success: false, error: 'تعذر تنفيذ عملية البيع' }, { status: 500 });
  }
}
