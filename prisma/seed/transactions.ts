import type { Prisma, PrismaClient } from '@prisma/client';
import { BRANCH_MAIN_ID, BRANCH_SAMOUHA_ID } from './branches.js';
import { mulberry32, round2 } from './utils.js';

/**
 * Deterministic transactional demo data (T17) so every admin screen — orders,
 * reports, accounting, purchasing, inventory, payroll, audit — has coherent,
 * inter-linked rows.
 *
 * Idempotent + fast: all demo rows use a stable id / unique number with a
 * known prefix. On each run the previous demo rows are deleted and re-created
 * in a single batched transaction (a handful of round-trips instead of ~600).
 *
 * All rows respect the invariant checker (src/lib/invariants.ts):
 * - InventoryLog: newQuantity === previousQuantity + changeQuantity
 * - Order total  = subtotal - discount + tax + deliveryFee
 * - Sale total   = subtotal - discount + tax
 * - CANCELLED/RETURNED orders carry a RETURN inventory log
 * - no duplicate orderNumber / saleNumber / sku
 */

const DAY = 86_400_000;
const pad4 = (n: number) => String(n).padStart(4, '0');
const daysAgo = (n: number) => new Date(Date.now() - n * DAY);

type OrdStatus = 'PENDING' | 'CONFIRMED' | 'PROCESSING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED' | 'RETURNED';
type ShipProvider = 'BOSTA' | 'MYLERZ' | 'MRSOOL' | 'LOCAL_COURIER' | 'PICKUP';

export async function seedTransactions(db: PrismaClient) {
  const counts: Record<string, number> = {};
  const rand = mulberry32(2026);

  const products = await db.product.findMany({
    where: { isActive: true },
    select: { id: true, price: true, costPrice: true },
  });
  if (products.length === 0) return counts;

  const [cashiers, admins, employees, customers, suppliers, stockRows, vatSetting] = await Promise.all([
    db.user.findMany({ where: { role: 'CASHIER' }, select: { id: true, branchId: true } }),
    db.user.findMany({ where: { role: { in: ['BRANCH_MANAGER', 'SUPER_ADMIN'] } }, select: { id: true } }),
    db.employee.findMany({ where: { isActive: true }, select: { id: true, salary: true, commissionRate: true } }),
    db.customer.findMany({ include: { addresses: true } }),
    db.supplier.findMany(),
    db.branchInventory.findMany({ select: { branchId: true, productId: true, stockQuantity: true } }),
    db.setting.findUnique({ where: { key: 'vat.rate' } }),
  ]);

  const adminId = admins[0]?.id ?? 'seed-admin';
  const cashierFor = (branchId: string) =>
    (cashiers.find((c) => c.branchId === branchId) ?? cashiers[0])?.id ?? adminId;

  let vatRate = 0.14;
  try {
    const parsed = JSON.parse(vatSetting?.value ?? '0.14');
    if (typeof parsed === 'number' && parsed >= 0 && parsed < 1) vatRate = parsed;
  } catch {
    /* keep default */
  }

  const stock = new Map<string, number>();
  for (const r of stockRows) stock.set(`${r.branchId}:${r.productId}`, r.stockQuantity);

  const saleRows: Prisma.SaleCreateManyInput[] = [];
  const saleItemRows: Prisma.SaleItemCreateManyInput[] = [];
  const orderRows: Prisma.OrderCreateManyInput[] = [];
  const orderItemRows: Prisma.OrderItemCreateManyInput[] = [];
  const poRows: Prisma.PurchaseOrderCreateManyInput[] = [];
  const poItemRows: Prisma.PurchaseOrderItemCreateManyInput[] = [];
  const trfRows: Prisma.StockTransferCreateManyInput[] = [];
  const trfItemRows: Prisma.StockTransferItemCreateManyInput[] = [];
  const payrollRunRows: Prisma.PayrollRunCreateManyInput[] = [];
  const payrollItemRows: Prisma.PayrollItemCreateManyInput[] = [];
  const invLogRows: Prisma.InventoryLogCreateManyInput[] = [];
  const taxInvoiceRows: Prisma.TaxInvoiceCreateManyInput[] = [];
  const auditRows: Prisma.AuditLogCreateManyInput[] = [];
  const shiftRows: Prisma.ShiftCreateManyInput[] = [];
  const couponRows: Prisma.CouponCreateManyInput[] = [
    { id: 'coupon-D-SAVE10', code: 'SAVE10', kind: 'PERCENT', value: 10, capAmount: 200, minTotal: 500, usageLimit: 100, usedCount: 12, isActive: true, createdById: adminId },
    { id: 'coupon-D-FLAT50', code: 'FLAT50', kind: 'FIXED', value: 50, minTotal: 300, usedCount: 5, isActive: true, createdById: adminId },
    { id: 'coupon-D-OLD', code: 'OLD20', kind: 'PERCENT', value: 20, usedCount: 3, isActive: false, createdById: adminId },
  ];
  const reviewRows: Prisma.ReviewCreateManyInput[] = [];

  // ------------------------------------------------- Shifts (T05 demo)
  // One OPEN shift per branch (today) + 3 CLOSED shifts per branch with
  // realistic differences (exact / shortage with note / over).
  const shiftCashierMain = cashierFor(BRANCH_MAIN_ID);
  const shiftCashierSam = cashierFor(BRANCH_SAMOUHA_ID);
  const closedShiftIds: Record<string, string[]> = { [BRANCH_MAIN_ID]: [], [BRANCH_SAMOUHA_ID]: [] };
  const shiftSalesCount: Record<string, number> = {};
  for (const [b, c] of [[BRANCH_MAIN_ID, shiftCashierMain], [BRANCH_SAMOUHA_ID, shiftCashierSam]] as const) {
    for (let s = 1; s <= 3; s++) {
      const sid = `shift-D-${b === BRANCH_MAIN_ID ? 'main' : 'sam'}-closed-${s}`;
      closedShiftIds[b].push(sid);
      const openedAt = daysAgo(30 - s * 7);
      shiftRows.push({
        id: sid,
        branchId: b,
        cashierId: c,
        status: 'CLOSED',
        openedAt,
        closedAt: new Date(openedAt.getTime() + 8 * 3600_000),
        openingFloat: 500,
        expectedCash: 500, // recomputed below from CASH sales
        actualCash: 500,
        difference: 0,
        openNote: 'وردية تجريبية',
        closeNote: s === 2 ? 'عجز معتمد من المدير' : null,
      });
    }
    const openId = `shift-D-${b === BRANCH_MAIN_ID ? 'main' : 'sam'}-open`;
    shiftRows.push({
      id: openId,
      branchId: b,
      cashierId: c,
      status: 'OPEN',
      openedAt: new Date(Date.now() - 2 * 3600_000),
      openingFloat: 500,
      expectedCash: 500,
      actualCash: 0,
      difference: 0,
      openNote: 'وردية اليوم',
    });
  }
  const shiftForSale = (branchId: string): string => {
    const n = (shiftSalesCount[branchId] = (shiftSalesCount[branchId] || 0) + 1);
    const list = closedShiftIds[branchId];
    return list[Math.min(list.length - 1, Math.floor((n - 1) / 7))];
  };

  // ---------------------------------------------------------------- Sales (POS)
  const sim = new Map(stock);
  for (let i = 1; i <= 40; i++) {
    const num = pad4(i);
    const saleId = `sale-D-${num}`;
    const branchId = i % 2 === 0 ? BRANCH_SAMOUHA_ID : BRANCH_MAIN_ID;
    const date = daysAgo(90 - Math.floor((i / 40) * 86) - Math.floor(rand() * 3));

    const picks: Array<{ productId: string; quantity: number; unitPrice: number; previous: number; next: number }> = [];
    for (let k = 0, n = 1 + Math.floor(rand() * 3); k < n; k++) {
      const p = products[Math.floor(rand() * products.length)];
      const key = `${branchId}:${p.id}`;
      const avail = sim.get(key) ?? 0;
      if (avail <= 0) continue;
      const quantity = 1 + Math.floor(rand() * Math.min(3, avail));
      sim.set(key, avail - quantity);
      picks.push({ productId: p.id, quantity, unitPrice: Number(p.price), previous: avail, next: avail - quantity });
    }
    if (picks.length === 0) continue;

    const subtotal = round2(picks.reduce((s, x) => s + x.unitPrice * x.quantity, 0));
    const discount = i % 7 === 0 ? round2(subtotal * 0.05) : 0;
    const tax = round2((subtotal - discount) * vatRate);
    const total = round2(subtotal - discount + tax);
    const method = (['CASH', 'CARD', 'INSTAPAY'] as const)[Math.floor(rand() * 3)];
    const customerId = i % 3 === 0 ? customers[Math.floor(rand() * customers.length)]?.id ?? null : null;

    saleRows.push({
      id: saleId,
      saleNumber: `SALE-D-${num}`,
      branchId,
      cashierId: cashierFor(branchId),
      shiftId: shiftForSale(branchId),
      customerId,
      subtotal,
      taxAmount: tax,
      discountAmount: discount,
      totalAmount: total,
      paymentMethod: method,
      paymentStatus: 'PAID',
      status: 'COMPLETED',
      createdAt: date,
    });

    picks.forEach((pick, idx) => {
      saleItemRows.push({
        id: `saleitem-D-${num}-${idx}`,
        saleId,
        productId: pick.productId,
        unitPrice: pick.unitPrice,
        quantity: pick.quantity,
        discount: 0,
        totalPrice: round2(pick.unitPrice * pick.quantity),
      });
      invLogRows.push({
        id: `invlog-sale-${num}-${idx}`,
        branchId,
        productId: pick.productId,
        type: 'SALE',
        changeQuantity: -pick.quantity,
        previousQuantity: pick.previous,
        newQuantity: pick.next,
        referenceId: `SALE-D-${num}`,
        notes: 'فاتورة كاشير',
        createdById: cashierFor(branchId),
        createdAt: date,
      });
    });

    if (i % 4 === 0) {
      taxInvoiceRows.push({
        id: `taxinv-S-${num}`,
        invoiceNumber: `INV-S-${num}`,
        etaUuid: `eta-sale-${num}-0000-0000-000000000000`,
        saleId,
        branchId,
        totalAmount: total,
        vatAmount: tax,
        status: 'VALID',
        qrCodeData: `ETA|SALE-D-${num}|${total}|${tax}`,
        createdAt: date,
      });
    }
  }

  // Reconcile closed shifts: expected = float + CASH sales; variants exact/short/over.
  const cashByShift = new Map<string, number>();
  for (const s of saleRows) {
    if (s.paymentMethod === 'CASH' && s.shiftId) {
      cashByShift.set(s.shiftId, round2((cashByShift.get(s.shiftId) || 0) + Number(s.totalAmount)));
    }
  }
  shiftRows.forEach((sh, idx) => {
    if (sh.status !== 'CLOSED' || !sh.id) return;
    const expected = round2(500 + (cashByShift.get(sh.id as string) || 0));
    sh.expectedCash = expected;
    const variant = idx % 3;
    sh.actualCash = variant === 0 ? expected : variant === 1 ? round2(expected - 35) : round2(expected + 20);
    sh.difference = round2(Number(sh.actualCash) - expected);
  });

  // ------------------------------------------------------------- Orders (online)
  const orderStatuses: OrdStatus[] = [
    'PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED',
    'DELIVERED', 'CANCELLED', 'RETURNED', 'DELIVERED', 'CONFIRMED',
  ];
  const shipProviders: ShipProvider[] = ['BOSTA', 'MYLERZ', 'MRSOOL', 'LOCAL_COURIER', 'PICKUP'];

  for (let i = 1; i <= 30; i++) {
    const num = pad4(i);
    const orderId = `order-D-${num}`;
    const orderNumber = `ORD-D-${num}`;
    const branchId = i % 2 === 0 ? BRANCH_SAMOUHA_ID : BRANCH_MAIN_ID;
    const status = orderStatuses[(i - 1) % orderStatuses.length];
    const customer = customers[(i * 7) % customers.length];
    const addr = customer?.addresses?.[0];
    const date = daysAgo(80 - Math.floor((i / 30) * 76) - Math.floor(rand() * 3));

    const picks: Array<{ productId: string; quantity: number; unitPrice: number }> = [];
    for (let k = 0, n = 1 + Math.floor(rand() * 3); k < n; k++) {
      const p = products[Math.floor(rand() * products.length)];
      picks.push({ productId: p.id, quantity: 1 + Math.floor(rand() * 2), unitPrice: Number(p.price) });
    }
    const subtotal = round2(picks.reduce((s, x) => s + x.unitPrice * x.quantity, 0));
    const discount = i % 5 === 0 ? round2(subtotal * 0.1) : 0;
    const tax = round2((subtotal - discount) * vatRate);
    const provider = shipProviders[i % shipProviders.length];
    const deliveryFee = provider === 'PICKUP' ? 0 : 30;
    const total = round2(subtotal - discount + tax + deliveryFee);
    const method = (['PAYMOB', 'COD', 'INSTAPAY', 'FAWRY'] as const)[i % 4];
    // T02: one FAWRY order stays PENDING (expiry/reconciliation demo).
    const paymentStatus =
      method === 'COD' ? (status === 'DELIVERED' ? 'PAID' : 'PENDING')
      : method === 'FAWRY' && i % 8 === 7 ? 'PENDING'
      : 'PAID';
    const shipped = status === 'SHIPPED' || status === 'DELIVERED';

    orderRows.push({
      id: orderId,
      orderNumber,
      orderSource: i % 4 === 0 ? 'WHATSAPP' : 'ONLINE',
      customerId: customer?.id ?? null,
      guestPhone: customer?.phone ?? `0111111${pad4(i)}`,
      guestName: customer?.name ?? 'عميل زائر',
      deliveryAddress: addr ? `${addr.street}، ${addr.city}` : 'الإسكندرية',
      branchId,
      deliveryZone: addr?.governorate ?? 'Alexandria Central',
      deliveryFee,
      shippingProvider: provider,
      trackingNumber: shipped ? `TRK-${num}-EG` : null,
      paymentMethod: method,
      paymentStatus,
      orderStatus: status,
      subtotal,
      taxAmount: tax,
      discountAmount: discount,
      totalAmount: total,
      codRemitted: status === 'DELIVERED' && method === 'COD' ? total : 0,
      createdAt: date,
    });

    picks.forEach((pick, idx) => {
      orderItemRows.push({
        id: `orderitem-D-${num}-${idx}`,
        orderId,
        productId: pick.productId,
        unitPrice: pick.unitPrice,
        quantity: pick.quantity,
        totalPrice: round2(pick.unitPrice * pick.quantity),
      });

      if (status === 'CANCELLED' || status === 'RETURNED') {
        const previous = stock.get(`${branchId}:${pick.productId}`) ?? 0;
        invLogRows.push({
          id: `invlog-return-${num}-${idx}`,
          branchId,
          productId: pick.productId,
          type: 'RETURN',
          changeQuantity: pick.quantity,
          previousQuantity: previous,
          newQuantity: previous + pick.quantity,
          referenceId: orderNumber,
          notes: status === 'CANCELLED' ? 'إلغاء طلب' : 'مرتجع',
          createdById: adminId,
          createdAt: date,
        });
      }
    });

    if (status === 'DELIVERED' && i % 3 === 0) {
      taxInvoiceRows.push({
        id: `taxinv-O-${num}`,
        invoiceNumber: `INV-O-${num}`,
        etaUuid: `eta-order-${num}-0000-0000-000000000000`,
        orderId,
        branchId,
        totalAmount: total,
        vatAmount: tax,
        status: 'VALID',
        qrCodeData: `ETA|${orderNumber}|${total}|${tax}`,
        createdAt: date,
      });
    }
  }

  // --------------------------------------------------------- Purchase orders
  for (let i = 1; i <= 8; i++) {
    const num = pad4(i);
    const poId = `po-D-${num}`;
    const supplier = suppliers[(i - 1) % Math.max(suppliers.length, 1)];
    if (!supplier) break;
    const branchId = i % 2 === 0 ? BRANCH_SAMOUHA_ID : BRANCH_MAIN_ID;
    const status = (['DRAFT', 'SUBMITTED', 'RECEIVED', 'RECEIVED'] as const)[(i - 1) % 4];
    const date = daysAgo(70 - i * 6);

    const picks: Array<{ productId: string; unitCost: number; qty: number }> = [];
    for (let k = 0, n = 2 + Math.floor(rand() * 4); k < n; k++) {
      const p = products[Math.floor(rand() * products.length)];
      picks.push({
        productId: p.id,
        unitCost: Number(p.costPrice) || round2(Number(p.price) * 0.6),
        qty: 5 + Math.floor(rand() * 20),
      });
    }
    const total = round2(picks.reduce((s, x) => s + x.unitCost * x.qty, 0));

    poRows.push({
      id: poId,
      poNumber: `PO-D-${num}`,
      supplierId: supplier.id,
      branchId,
      status,
      totalAmount: total,
      notes: status === 'RECEIVED' ? 'تم الاستلام بالكامل' : 'طلب توريد',
      createdById: adminId,
      createdAt: date,
    });

    picks.forEach((pick, idx) => {
      poItemRows.push({
        id: `poitem-D-${num}-${idx}`,
        purchaseOrderId: poId,
        productId: pick.productId,
        unitCost: pick.unitCost,
        quantityOrdered: pick.qty,
        quantityReceived: status === 'RECEIVED' ? pick.qty : 0,
      });
    });
  }

  // ----------------------------------------------------------- Stock transfers
  const transferStatuses = ['PENDING', 'APPROVED', 'COMPLETED', 'COMPLETED', 'REJECTED', 'CANCELLED'] as const;
  for (let i = 1; i <= 6; i++) {
    const num = pad4(i);
    const trfId = `trf-D-${num}`;
    const forward = i % 2 === 1;
    const fromBranchId = forward ? BRANCH_MAIN_ID : BRANCH_SAMOUHA_ID;
    const toBranchId = forward ? BRANCH_SAMOUHA_ID : BRANCH_MAIN_ID;
    const status = transferStatuses[(i - 1) % transferStatuses.length];
    const date = daysAgo(45 - i * 4);

    trfRows.push({
      id: trfId,
      transferNumber: `TRF-D-${num}`,
      fromBranchId,
      toBranchId,
      status,
      requestedById: adminId,
      approvedById: status === 'APPROVED' || status === 'COMPLETED' ? adminId : null,
      notes: 'تحويل مخزون بين الفرعين',
      createdAt: date,
    });

    for (let k = 0, n = 2 + Math.floor(rand() * 3); k < n; k++) {
      const p = products[Math.floor(rand() * products.length)];
      trfItemRows.push({
        id: `trfitem-D-${num}-${k}`,
        transferId: trfId,
        productId: p.id,
        quantity: 1 + Math.floor(rand() * 5),
      });
    }
  }

  // ------------------------------------------------------------------ Payroll
  for (let m = 1; m <= 2; m++) {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - m);
    const periodMonth = d.getMonth() + 1;
    const periodYear = d.getFullYear();
    const runId = `payroll-${periodYear}-${String(periodMonth).padStart(2, '0')}`;
    const status = m === 1 ? 'APPROVED' : 'PAID';

    let total = 0;
    for (const e of employees) {
      const base = Number(e.salary);
      const bonus = round2(base * 0.05);
      const deductions = round2(base * 0.02);
      const commission = round2(base * (e.commissionRate || 0));
      const net = round2(base + bonus + commission - deductions);
      total += net;
      payrollItemRows.push({
        id: `${runId}-${e.id}`,
        payrollRunId: runId,
        employeeId: e.id,
        baseSalary: base,
        bonus,
        deductions,
        commissionAmount: commission,
        netSalary: net,
        status,
      });
    }

    payrollRunRows.push({
      id: runId,
      periodMonth,
      periodYear,
      status,
      totalAmount: round2(total),
      createdById: adminId,
      createdAt: d,
    });
  }

  // ---------------------------------------------------------------- Audit log
  const actions: Array<{ action: string; entity: string }> = [
    { action: 'ORDER_STATUS_UPDATE', entity: 'Order' },
    { action: 'PRODUCT_UPDATE', entity: 'Product' },
    { action: 'STOCK_ADJUSTMENT', entity: 'BranchInventory' },
    { action: 'USER_LOGIN', entity: 'User' },
    { action: 'DISCOUNT_APPROVED', entity: 'Sale' },
    { action: 'SETTINGS_UPDATE', entity: 'Setting' },
    { action: 'TRANSFER_APPROVED', entity: 'StockTransfer' },
    { action: 'PO_RECEIVED', entity: 'PurchaseOrder' },
  ];
  for (let i = 1; i <= 25; i++) {
    const a = actions[(i - 1) % actions.length];
    auditRows.push({
      id: `audit-D-${pad4(i)}`,
      actorId: adminId,
      action: a.action,
      entity: a.entity,
      entityId: `${a.entity}-${pad4(i)}`,
      branchId: i % 2 === 0 ? BRANCH_SAMOUHA_ID : BRANCH_MAIN_ID,
      metadata: JSON.stringify({ seed: true, index: i, note: 'demo activity' }),
      createdAt: daysAgo(60 - i * 2),
    });
  }

  // ---------------------------------------------- extra restock/adjust logs
  for (let i = 1; i <= 12; i++) {
    const p = products[(i * 3) % products.length];
    const branchId = i % 2 === 0 ? BRANCH_SAMOUHA_ID : BRANCH_MAIN_ID;
    const previous = stock.get(`${branchId}:${p.id}`);
    if (previous === undefined) continue;
    const change = i % 3 === 0 ? -1 : 10 + Math.floor(rand() * 20);
    const type = i % 3 === 0 ? 'ADJUSTMENT' : 'RESTOCK';
    invLogRows.push({
      id: `invlog-extra-${pad4(i)}`,
      branchId,
      productId: p.id,
      type,
      changeQuantity: change,
      previousQuantity: previous,
      newQuantity: previous + change,
      referenceId: type === 'RESTOCK' ? `PO-D-${pad4(1 + (i % 8))}` : null,
      notes: type === 'RESTOCK' ? 'توريد مخزون' : 'تسوية جرد',
      createdById: adminId,
      createdAt: daysAgo(40 - i),
    });
  }

  const reviewTexts = ['ممتاز وخامة أصلية', 'تجربة شراء رائعة', 'السعر مناسب والجودة عالية', 'مقاس مظبوط وتوصيل سريع', 'أنصح به بشدة'];
  for (let i = 0; i < 10 && i < products.length; i++) {
    const p = products[(i * 7) % products.length];
    reviewRows.push({
      id: `review-D-${pad4(i + 1)}`,
      productId: p.id,
      rating: 3 + ((i * 2) % 3),
      text: reviewTexts[i % reviewTexts.length],
      phone: customers[i % Math.max(customers.length, 1)]?.phone ?? null,
      approved: i % 3 !== 2, // every third stays pending for the queue demo
      createdAt: daysAgo(20 - i),
    });
  }

  // ------------------------------------------- replace previous demo rows
  await db.$transaction([
    db.supplierPayment.deleteMany({ where: { reference: { startsWith: 'SEED-' } } }),
    db.review.deleteMany({ where: { id: { startsWith: 'review-D-' } } }),
    db.couponUse.deleteMany({ where: { couponId: { startsWith: 'coupon-D-' } } }),
    db.coupon.deleteMany({ where: { id: { startsWith: 'coupon-D-' } } }),
    db.shift.deleteMany({ where: { id: { startsWith: 'shift-D-' } } }),
    db.taxInvoice.deleteMany({
      where: { OR: [{ invoiceNumber: { startsWith: 'INV-S-' } }, { invoiceNumber: { startsWith: 'INV-O-' } }] },
    }),
    db.inventoryLog.deleteMany({ where: { id: { startsWith: 'invlog-' } } }),
    db.saleItem.deleteMany({ where: { id: { startsWith: 'saleitem-D-' } } }),
    db.sale.deleteMany({ where: { saleNumber: { startsWith: 'SALE-D-' } } }),
    db.orderItem.deleteMany({ where: { id: { startsWith: 'orderitem-D-' } } }),
    db.order.deleteMany({ where: { orderNumber: { startsWith: 'ORD-D-' } } }),
    db.purchaseOrderItem.deleteMany({ where: { id: { startsWith: 'poitem-D-' } } }),
    db.purchaseOrder.deleteMany({ where: { poNumber: { startsWith: 'PO-D-' } } }),
    db.stockTransferItem.deleteMany({ where: { id: { startsWith: 'trfitem-D-' } } }),
    db.stockTransfer.deleteMany({ where: { transferNumber: { startsWith: 'TRF-D-' } } }),
    db.payrollItem.deleteMany({ where: { id: { startsWith: 'payroll-' } } }),
    db.payrollRun.deleteMany({ where: { id: { startsWith: 'payroll-' } } }),
    db.auditLog.deleteMany({ where: { id: { startsWith: 'audit-D-' } } }),
    db.sale.createMany({ data: saleRows, skipDuplicates: true }),
    db.saleItem.createMany({ data: saleItemRows, skipDuplicates: true }),
    db.order.createMany({ data: orderRows, skipDuplicates: true }),
    db.orderItem.createMany({ data: orderItemRows, skipDuplicates: true }),
    db.purchaseOrder.createMany({ data: poRows, skipDuplicates: true }),
    db.purchaseOrderItem.createMany({ data: poItemRows, skipDuplicates: true }),
    db.stockTransfer.createMany({ data: trfRows, skipDuplicates: true }),
    db.stockTransferItem.createMany({ data: trfItemRows, skipDuplicates: true }),
    db.payrollRun.createMany({ data: payrollRunRows, skipDuplicates: true }),
    db.payrollItem.createMany({ data: payrollItemRows, skipDuplicates: true }),
    db.inventoryLog.createMany({ data: invLogRows, skipDuplicates: true }),
    db.taxInvoice.createMany({ data: taxInvoiceRows, skipDuplicates: true }),
    db.auditLog.createMany({ data: auditRows, skipDuplicates: true }),
    db.shift.createMany({ data: shiftRows, skipDuplicates: true }),
    db.coupon.createMany({ data: couponRows, skipDuplicates: true }),
    db.review.createMany({ data: reviewRows, skipDuplicates: true }),
  ]);

  // T13: demo supplier payments (created separately — needs supplier ids).
  const paySuppliers = await db.supplier.findMany({ take: 2, select: { id: true } });
  for (let i = 0; i < paySuppliers.length; i++) {
    await db.supplierPayment.upsert({
      where: { id: `pay-D-${i + 1}` },
      create: {
        id: `pay-D-${i + 1}`,
        supplierId: paySuppliers[i].id,
        amount: 1500 + i * 750,
        method: i === 0 ? 'BANK' : 'CASH',
        reference: `SEED-PAY-${i + 1}`,
        notes: 'دفعة مورد تجريبية',
        createdById: adminId,
        createdAt: daysAgo(10 - i * 3),
      },
      update: {},
    });
  }
  counts.supplierPayments = paySuppliers.length;
  counts.reviews = reviewRows.length;
  counts.coupons = couponRows.length;
  counts.shifts = shiftRows.length;
  counts.sales = saleRows.length;
  counts.saleItems = saleItemRows.length;
  counts.orders = orderRows.length;
  counts.orderItems = orderItemRows.length;
  counts.purchaseOrders = poRows.length;
  counts.purchaseOrderItems = poItemRows.length;
  counts.transfers = trfRows.length;
  counts.transferItems = trfItemRows.length;
  counts.payrollRuns = payrollRunRows.length;
  counts.payrollItems = payrollItemRows.length;
  counts.inventoryLogs = invLogRows.length;
  counts.taxInvoices = taxInvoiceRows.length;
  counts.auditLogs = auditRows.length;

  return counts;
}
