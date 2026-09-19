import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { submitToEta } from '@/lib/eta';
import { PaymentMethod, PaymentStatus } from '@prisma/client';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { paymentMethod, discountAmount = 0, items, customerId } = body;

    const flagshipBranch = await prisma.branch.findFirst({
      where: { isActive: true },
    });

    const cashierUser = await prisma.user.findFirst({
      where: { role: 'CASHIER' },
    });

    if (!flagshipBranch || !cashierUser) {
      return NextResponse.json({ success: false, error: 'الفرع أو الكاشير غير متاح' }, { status: 500 });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ success: false, error: 'الفاتورة فارغة: أضف صنفاً واحداً على الأقل' }, { status: 400 });
    }
    if (!['CASH', 'CARD', 'INSTAPAY'].includes(paymentMethod)) {
      return NextResponse.json({ success: false, error: 'طريقة الدفع غير صالحة' }, { status: 400 });
    }

    let subtotal = 0;
    const saleItemsData = [];
    const saleNumber = `POS-2026-${Math.floor(10000 + Math.random() * 90000)}`;

    for (const item of items) {
      const qty = Math.floor(Number(item.quantity) || 0);
      if (qty <= 0) {
        return NextResponse.json({ success: false, error: 'كمية غير صالحة في الفاتورة' }, { status: 400 });
      }
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

      const itemTotal = dbProduct.price * qty;
      subtotal += itemTotal;

      saleItemsData.push({
        productId: dbProduct.id,
        unitPrice: dbProduct.price,
        quantity: qty,
        totalPrice: itemTotal,
      });

      // Deduct stock in branch
      const newStock = currentStock - qty;

      await prisma.branchInventory.updateMany({
        where: { branchId: flagshipBranch.id, productId: dbProduct.id },
        data: { stockQuantity: newStock },
      });

      // Log Inventory audit (linked to the sale via referenceId)
      await prisma.inventoryLog.create({
        data: {
          branchId: flagshipBranch.id,
          productId: dbProduct.id,
          type: 'SALE',
          changeQuantity: -qty,
          previousQuantity: currentStock,
          newQuantity: newStock,
          referenceId: saleNumber,
          createdById: cashierUser.id,
        },
      });
    }

    const discount = Math.max(0, Number(discountAmount) || 0);
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
        items: {
          create: saleItemsData,
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
