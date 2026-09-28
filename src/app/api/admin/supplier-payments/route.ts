import { apiError } from '@/lib/api-response';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { money, num } from '@/lib/pricing';
import { requireRole } from '@/lib/auth/guards';
import { canAccessBranch, scopedBranchIds } from '@/lib/auth/branch-scope';
import { writeAudit } from '@/lib/audit';
import { captureError } from '@/lib/monitor';
import { paidForOrder, receivedValueOf, outstandingFor } from '@/lib/purchasing/payables';

/** Cap on the ledger page. Payments are append-only and searched by reference. */
const LEDGER_PAGE_SIZE = 100;

/** `SupplierPayment.method` is a free-text column, so the accepted set is enforced here. */
const PAYMENT_METHODS = ['CASH', 'BANK_TRANSFER', 'CHEQUE', 'VODAFONE_CASH'] as const;
type PaymentMethod = (typeof PAYMENT_METHODS)[number];

/** Unknown or missing values fall back to CASH rather than writing junk into the ledger. */
function toPaymentMethod(value: unknown): PaymentMethod {
  if (typeof value !== 'string') return 'CASH';
  const upper = value.trim().toUpperCase();
  return (PAYMENT_METHODS as readonly string[]).includes(upper) ? (upper as PaymentMethod) : 'CASH';
}

/** Supplier payments ledger: list + record a payment. */
export async function GET(req: Request) {
  try {
    const { error, session } = await requireRole('SUPER_ADMIN', 'BRANCH_MANAGER', 'FINANCE');
    if (error) return error;
    const url = new URL(req.url);
    const supplierId = url.searchParams.get('supplierId') || undefined;
    // A payment is attributed to an order, and an order lives in a branch. For
    // a branch-scoped role the payment is only visible when the order it
    // settles is inside the scope. An unattributed payment (an advance) has no
    // branch, so it stays visible: it carries no branch-specific stock or cost.
    const allowedBranchIds = scopedBranchIds(session);

    const rows = await prisma.supplierPayment.findMany({
      where: {
        ...(supplierId ? { supplierId } : {}),
        ...(allowedBranchIds === null
          ? {}
          : {
              OR: [
                { purchaseOrder: null },
                { purchaseOrder: { branchId: { in: allowedBranchIds } } },
              ],
            }),
      },
      orderBy: { createdAt: 'desc' },
      take: LEDGER_PAGE_SIZE,
      include: {
        supplier: { select: { name: true } },
        purchaseOrder: { select: { id: true, poNumber: true, branchId: true } },
      },
    });
    return NextResponse.json({
      success: true,
      payments: rows.map((r) => ({ ...r, amount: num(r.amount) })),
    });
  } catch (e) {
    captureError('admin/supplier-payments GET', e);
    return apiError('INTERNAL_ERROR', 'تعذر الجلب', 500);
  }
}

export async function POST(req: Request) {
  try {
    const { error, session } = await requireRole('SUPER_ADMIN', 'BRANCH_MANAGER', 'FINANCE');
    if (error) return error;
    const body = (await req.json().catch(() => null)) as {
      supplierId?: unknown;
      purchaseOrderId?: unknown;
      amount?: unknown;
      method?: unknown;
      reference?: unknown;
      notes?: unknown;
    } | null;
    if (!body) return apiError('VALIDATION_ERROR', 'A JSON body is required', 400);

    const supplierId = typeof body.supplierId === 'string' ? body.supplierId.trim() : '';
    if (!supplierId) return apiError('VALIDATION_ERROR', 'المورد مطلوب', 400);

    const amount = money(Number(body.amount));
    if (!Number.isFinite(amount) || amount <= 0) {
      return apiError('VALIDATION_ERROR', 'المبلغ غير صالح', 400);
    }

    const method = toPaymentMethod(body.method);

    const supplier = await prisma.supplier.findUnique({ where: { id: supplierId }, select: { id: true } });
    if (!supplier) return apiError('NOT_FOUND', 'المورد غير موجود', 404);

    const purchaseOrderId =
      typeof body.purchaseOrderId === 'string' && body.purchaseOrderId.trim()
        ? body.purchaseOrderId.trim()
        : null;

    // Overpaying an order is what made the old balance wrong in the other
    // direction, so the order is loaded with everything needed to check.
    let orderForAudit: { poNumber: string; branchId: string } | undefined;
    let created: Awaited<ReturnType<typeof prisma.supplierPayment.create>>;

    if (purchaseOrderId) {
      const order = await prisma.purchaseOrder.findUnique({
        where: { id: purchaseOrderId },
        include: { items: true, payments: { select: { amount: true, createdAt: true, purchaseOrderId: true } } },
      });
      if (!order) return apiError('NOT_FOUND', 'أمر التوريد غير موجود', 404);
      if (order.supplierId !== supplier.id) {
        return apiError('VALIDATION_ERROR', 'أمر التوريد لا يخص هذا المورد', 400);
      }
      if (!canAccessBranch(session, order.branchId)) {
        return apiError('FORBIDDEN', 'أمر التوريد خارج نطاق فروعك', 403);
      }
      if (order.status === 'CANCELLED' || order.status === 'DRAFT') {
        return apiError('VALIDATION_ERROR', 'لا يمكن الدفع لأمر ملغى أو مسودة', 400);
      }

      // The check and the insert run in one transaction at SERIALIZABLE, so two
      // concurrent payments cannot both observe the same remaining balance and
      // together overpay the order.
      const settled = await prisma.$transaction(
        async (tx) => {
          const fresh = await tx.purchaseOrder.findUniqueOrThrow({
            where: { id: purchaseOrderId },
            include: {
              items: true,
              payments: { select: { amount: true, createdAt: true, purchaseOrderId: true } },
            },
          });
          if (fresh.status === 'CANCELLED' || fresh.status === 'DRAFT') {
            return { error: apiError('VALIDATION_ERROR', 'لا يمكن الدفع لأمر ملغى أو مسودة', 400) };
          }

          const attributed = new Map<string, number>();
          for (const payment of fresh.payments) {
            if (payment.purchaseOrderId === fresh.id) {
              attributed.set(fresh.id, (attributed.get(fresh.id) ?? 0) + num(payment.amount));
            }
          }
          const totalAmount = num(fresh.totalAmount);
          const alreadyPaid = paidForOrder({ id: fresh.id, totalAmount }, attributed);
          const committed = receivedValueOf(
            { totalAmount },
            // T10: Decimal is converted at the boundary, never in the pure helper.
            fresh.items.map((item) => ({
              quantityOrdered: item.quantityOrdered,
              quantityReceived: item.quantityReceived,
              unitCost: num(item.unitCost),
            })),
          );
          const outstanding = outstandingFor(committed, alreadyPaid);

          if (outstanding <= 0) {
            return { error: apiError('CONFLICT', 'هذا الأمر مسدد بالكامل', 409) };
          }
          if (amount > outstanding) {
            return {
              error: apiError(
                'VALIDATION_ERROR',
                `المبلغ يتجاوز الرصيد المتبقي (${outstanding.toFixed(2)})`,
                400,
                undefined,
                { outstanding, alreadyPaid, committed },
              ),
            };
          }

          const payment = await tx.supplierPayment.create({
            data: {
              supplierId: supplier.id,
              purchaseOrderId,
              amount,
              method,
              reference: typeof body.reference === 'string' ? body.reference.slice(0, 100) : null,
              notes: typeof body.notes === 'string' ? body.notes.slice(0, 500) : null,
              createdById: (session?.user as { id?: string })?.id,
            },
          });
          return { payment, order: fresh };
        },
        { isolationLevel: 'Serializable' },
      );

      if ('error' in settled && settled.error) return settled.error;
      if (!('payment' in settled) || !settled.payment) {
        return apiError('INTERNAL_ERROR', 'تعذر الحفظ', 500);
      }
      created = settled.payment;
      orderForAudit = { poNumber: settled.order.poNumber, branchId: settled.order.branchId };
    } else {
      // An advance or credit note with no order attached. There is no balance to
      // validate against, so it is recorded as-is and reported as unattributed.
      created = await prisma.supplierPayment.create({
        data: {
          supplierId: supplier.id,
          purchaseOrderId: null,
          amount,
          method,
          reference: typeof body.reference === 'string' ? body.reference.slice(0, 100) : null,
          notes: typeof body.notes === 'string' ? body.notes.slice(0, 500) : null,
          createdById: (session?.user as { id?: string })?.id,
        },
      });
    }

    void writeAudit({
      actorId: (session?.user as { id?: string })?.id,
      action: 'supplier.pay',
      entity: 'Supplier',
      entityId: supplier.id,
      branchId: orderForAudit?.branchId,
      metadata: { amount, purchaseOrderId, poNumber: orderForAudit?.poNumber ?? null },
    });

    return NextResponse.json({ success: true, payment: { ...created, amount: num(created.amount) } });
  } catch (e) {
    captureError('admin/supplier-payments POST', e);
    return apiError('INTERNAL_ERROR', 'تعذر الحفظ', 500);
  }
}
