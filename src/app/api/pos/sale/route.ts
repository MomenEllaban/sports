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

    let subtotal = 0;
    const saleItemsData = [];

    for (const item of items) {
      const dbProduct = await prisma.product.findUnique({
        where: { id: item.productId },
        include: { inventories: { where: { branchId: flagshipBranch.id } } },
      });

      if (!dbProduct) continue;

      const itemTotal = dbProduct.price * item.quantity;
      subtotal += itemTotal;

      saleItemsData.push({
        productId: dbProduct.id,
        unitPrice: dbProduct.price,
        quantity: item.quantity,
        totalPrice: itemTotal,
      });

      // Deduct stock in branch
      const currentStock = dbProduct.inventories[0]?.stockQuantity || 0;
      const newStock = Math.max(0, currentStock - item.quantity);

      await prisma.branchInventory.updateMany({
        where: { branchId: flagshipBranch.id, productId: dbProduct.id },
        data: { stockQuantity: newStock },
      });

      // Log Inventory audit
      await prisma.inventoryLog.create({
        data: {
          branchId: flagshipBranch.id,
          productId: dbProduct.id,
          type: 'SALE',
          changeQuantity: -item.quantity,
          previousQuantity: currentStock,
          newQuantity: newStock,
          createdById: cashierUser.id,
        },
      });
    }

    const netAmount = Math.max(0, subtotal - Number(discountAmount));
    const vatAmount = Math.round(netAmount * 0.14 * 100) / 100;
    const totalAmount = netAmount + vatAmount;

    const saleNumber = `POS-2026-${Math.floor(10000 + Math.random() * 90000)}`;

    // Validate customer if provided
    let resolvedCustomerId: string | null = null;
    if (customerId) {
      const customer = await prisma.customer.findUnique({ where: { id: customerId } });
      if (customer) resolvedCustomerId = customerId;
    }

    const sale = await prisma.sale.create({
      data: {
        saleNumber,
        branchId: flagshipBranch.id,
        cashierId: cashierUser.id,
        customerId: resolvedCustomerId,
        subtotal,
        discountAmount: Number(discountAmount),
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
    if (resolvedCustomerId) {
      const pointsEarned = Math.floor(totalAmount / 10);
      if (pointsEarned > 0) {
        await prisma.customer.update({
          where: { id: resolvedCustomerId },
          data: { loyaltyPoints: { increment: pointsEarned } },
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
      qrCodeDataUrl: etaRes.qrCodeDataUrl,
    });
  } catch (error) {
    console.error('POS Sale API error:', error);
    return NextResponse.json({ success: false, error: 'تعذر تنفيذ عملية البيع' }, { status: 500 });
  }
}
