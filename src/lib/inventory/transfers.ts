import { Prisma, type TransferStatus } from '@prisma/client';
import { prisma } from '@/lib/db';
import { canAccessBranch } from '@/lib/auth/branch-scope';
import type { AppSession } from '@/lib/auth/guards';
import { decrementStock, incrementStock, InsufficientStockError } from '@/lib/inventory/service';

/**
 * Stock transfer lifecycle. Stock moves on exactly two business events:
 *
 *   PENDING ─approve─▶ APPROVED ─ship─▶ IN_TRANSIT ─receive─▶ COMPLETED
 *      │                  │                                    ▲
 *      ├─reject─▶ REJECTED └─cancel─▶ CANCELLED                │
 *      └─cancel─▶ CANCELLED              PARTIALLY_RECEIVED ────┘
 *
 * - `ship`    debits the source branch and creates goods-in-transit.
 * - `receive` credits the destination branch for what was physically received,
 *              so partial/lost shipments stay visible instead of being rounded
 *              into a single blind move.
 *
 * Requester and approver are separate actors: the requester cannot approve,
 * ship, receive or cancel their own request (separation of duties).
 */

export class TransferError extends Error {
  code: string;
  status: number;
  details?: Record<string, unknown>;
  constructor(code: string, message: string, status = 400, details?: Record<string, unknown>) {
    super(message);
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

/** Actions that move money-free stock, keyed by the required starting status. */
const TRANSITIONS: Record<string, TransferStatus[]> = {
  approve: ['PENDING'],
  reject: ['PENDING'],
  cancel: ['PENDING', 'APPROVED'],
  ship: ['APPROVED'],
  receive: ['IN_TRANSIT', 'PARTIALLY_RECEIVED'],
};

export function allowedTransferActions(status: TransferStatus, isRequester: boolean): string[] {
  return Object.entries(TRANSITIONS)
    .filter(([, from]) => from.includes(status))
    // A requester may withdraw their own request before it is shipped, but may
    // never approve it, ship it, or receive their own goods.
    .filter(([action]) => !(isRequester && (action === 'approve' || action === 'ship' || action === 'reject')))
    .filter(([action]) => !(isRequester && action === 'cancel' && status !== 'PENDING'))
    .map(([action]) => action);
}

function actorIdOf(session: AppSession | null): string {
  const id = (session?.user as { id?: string } | undefined)?.id;
  if (!id) throw new TransferError('UNAUTHORIZED', 'Session user id missing', 401);
  return id;
}

function assertBothBranchesAllowed(session: AppSession | null, fromBranchId: string, toBranchId: string): void {
  // A branch manager must be able to act on BOTH ends, otherwise they could
  // push stock into a branch they do not own, or drain one they do.
  if (!canAccessBranch(session, fromBranchId) || !canAccessBranch(session, toBranchId)) {
    throw new TransferError('FORBIDDEN', 'Transfer touches a branch outside your assignment', 403);
  }
}

/**
 * Read guard for transfer reads. Split from `assertBothBranchesAllowed` so a
 * detail GET can scope on the branches the session can actually see: a manager
 * who only owns the destination may inspect the transfer, but may not act on
 * it (actions keep the stricter two-sided check).
 */
export function assertTransferBranchAccess(
  session: AppSession | null,
  fromBranchId: string,
  toBranchId: string,
): void {
  if (!canAccessBranch(session, fromBranchId) && !canAccessBranch(session, toBranchId)) {
    throw new TransferError('FORBIDDEN', 'Transfer touches a branch outside your assignment', 403);
  }
}

export interface CreateTransferInput {
  fromBranchId: string;
  toBranchId: string;
  notes?: string | null;
  items: Array<{ productId: string; quantity: number }>;
}

export async function createTransfer(session: AppSession | null, input: CreateTransferInput) {
  const { fromBranchId, toBranchId, notes, items } = input;
  if (!fromBranchId || !toBranchId) {
    throw new TransferError('VALIDATION_ERROR', 'Source and destination branches are required', 400);
  }
  if (fromBranchId === toBranchId) {
    throw new TransferError('VALIDATION_ERROR', 'Source and destination branches must differ', 400);
  }
  if (!items.length) {
    throw new TransferError('VALIDATION_ERROR', 'Add at least one item', 400);
  }

  // One line per product: the UI previously allowed the same product twice,
  // which applied the same movement pair twice.
  const merged = new Map<string, number>();
  for (const it of items) {
    if (!it.productId) throw new TransferError('VALIDATION_ERROR', 'Every line needs a product', 400);
    if (!Number.isSafeInteger(it.quantity) || it.quantity <= 0) {
      throw new TransferError('VALIDATION_ERROR', 'Line quantity must be a positive whole number', 400);
    }
    merged.set(it.productId, (merged.get(it.productId) ?? 0) + it.quantity);
  }

  assertBothBranchesAllowed(session, fromBranchId, toBranchId);

  const branches = await prisma.branch.findMany({
    where: { id: { in: [fromBranchId, toBranchId] } },
    select: { id: true, isActive: true },
  });
  if (branches.length !== 2) {
    throw new TransferError('VALIDATION_ERROR', 'Unknown branch', 400);
  }
  const inactive = branches.find((b) => !b.isActive);
  if (inactive) {
    throw new TransferError('VALIDATION_ERROR', 'Transfers cannot use an inactive branch', 400);
  }

  const productIds = [...merged.keys()];
  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
    select: { id: true, isActive: true },
  });
  if (products.length !== productIds.length) {
    const found = new Set(products.map((p) => p.id));
    throw new TransferError(
      'VALIDATION_ERROR',
      'One or more products no longer exist',
      400,
      { productIds: productIds.filter((id) => !found.has(id)) },
    );
  }
  const archived = products.filter((p) => !p.isActive).map((p) => p.id);
  if (archived.length) {
    throw new TransferError('VALIDATION_ERROR', 'Cannot transfer an inactive product', 400, { productIds: archived });
  }

  const requestedById = actorIdOf(session);
  // Number allocation and the row land in ONE transaction so a failed create
  // cannot burn a document number.
  const { nextDocumentNumber } = await import('@/lib/documents');
  const transfer = await prisma.$transaction(
    async (tx) => {
      const transferNumber = await nextDocumentNumber(tx, 'TRF');
      return tx.stockTransfer.create({
        data: {
          transferNumber,
          fromBranchId,
          toBranchId,
          requestedById,
          notes: notes ? String(notes).slice(0, 1000) : null,
          status: 'PENDING',
          items: {
            create: [...merged.entries()].map(([productId, quantity]) => ({ productId, quantity })),
          },
        },
        include: { items: true },
      });
    },
    { maxWait: 10000, timeout: 20000 },
  );

  await txAudit({
    actorId: requestedById,
    action: 'transfer.requested',
    entity: 'StockTransfer',
    entityId: transfer.id,
    branchId: fromBranchId,
    metadata: {
      transferNumber: transfer.transferNumber,
      fromBranchId,
      toBranchId,
      itemCount: transfer.items.length,
      totalQuantity: transfer.items.reduce((s, i) => s + i.quantity, 0),
    },
  });

  return transfer;
}

async function txAudit(entry: {
  actorId: string;
  action: string;
  entity: string;
  entityId: string;
  branchId: string | null;
  metadata: Record<string, unknown>;
}): Promise<void> {
  const { writeAudit } = await import('@/lib/audit');
  await writeAudit(entry);
}

export interface ReceiveLine {
  itemId: string;
  quantityReceived: number;
}

/**
 * Applies a single transfer action. Every branch check, status claim and stock
 * movement happens inside one transaction with a compare-and-swap on the
 * transfer status, so a double-click or a second approver cannot double-move.
 */
export async function applyTransferAction(
  session: AppSession | null,
  transferId: string,
  action: string,
  payload: { reason?: string; lines?: ReceiveLine[] } = {},
) {
  const allowedFrom = TRANSITIONS[action];
  if (!allowedFrom) {
    throw new TransferError('VALIDATION_ERROR', `Unsupported transfer action "${action}"`, 400);
  }

  const transfer = await prisma.stockTransfer.findUnique({
    where: { id: transferId },
    include: { items: { include: { product: { select: { sku: true, nameAr: true, nameEn: true } } } } },
  });
  if (!transfer) throw new TransferError('NOT_FOUND', 'Transfer not found', 404);

  assertBothBranchesAllowed(session, transfer.fromBranchId, transfer.toBranchId);

  if (!allowedFrom.includes(transfer.status)) {
    throw new TransferError(
      'TRANSFER_NOT_PROCESSABLE',
      `A transfer in status ${transfer.status} cannot be ${action === 'receive' ? 'received' : `${action}ed`}`,
      409,
      { status: transfer.status, allowedActions: allowedTransferActions(transfer.status, transfer.requestedById === actorIdOf(session)) },
    );
  }

  const actorId = actorIdOf(session);
  const isRequester = transfer.requestedById === actorId;
  if (isRequester && (action === 'approve' || action === 'reject' || action === 'ship')) {
    throw new TransferError('FORBIDDEN', 'A transfer cannot be actioned by the user who requested it', 403);
  }
  if (isRequester && action === 'cancel' && transfer.status !== 'PENDING') {
    throw new TransferError('FORBIDDEN', 'Only the requester can cancel, and only before it ships', 403);
  }
  if (action === 'cancel' && !payload.reason) {
    throw new TransferError('VALIDATION_ERROR', 'A cancellation reason is required', 400);
  }

  const now = new Date();

  try {
    const updated = await prisma.$transaction(
      async (tx) => {
        // Compare-and-swap on the expected status: the exactly-once lock.
        const claim = await tx.stockTransfer.updateMany({
          where: { id: transferId, status: { in: allowedFrom } },
          data: {
            status: nextStatus(action, transfer.status),
            approvedById: action === 'approve' || action === 'reject' ? actorId : transfer.approvedById,
            approvedAt: action === 'approve' ? now : transfer.approvedAt,
            cancelledAt: action === 'cancel' ? now : transfer.cancelledAt,
            cancelReason: action === 'cancel' ? String(payload.reason).slice(0, 500) : transfer.cancelReason,
          },
        });
        if (claim.count !== 1) throw new TransferError('TRANSFER_NOT_PROCESSABLE', 'Transfer already processed', 409);

        const summary: Record<string, unknown> = {};
        // Status the transfer actually ends this action in, for the audit row.
        let finalStatus = nextStatus(action, transfer.status);

        if (action === 'ship') {
          for (const item of transfer.items) {
            // Stock leaves the source only at shipment, so goods in transit are
            // neither counted at the source nor at the destination.
            await decrementStock(tx, {
              branchId: transfer.fromBranchId,
              productId: item.productId,
              quantity: item.quantity,
              type: 'TRANSFER_OUT',
              referenceId: transfer.transferNumber,
              createdById: actorId,
            });
            await tx.stockTransferItem.update({
              where: { id: item.id },
              data: { quantityShipped: item.quantity, shippedAt: now },
            });
          }
          await tx.stockTransfer.update({ where: { id: transferId }, data: { shippedAt: now } });
          summary.totalQuantity = transfer.items.reduce((s, i) => s + i.quantity, 0);
        }

        if (action === 'receive') {
          const lines = payload.lines ?? [];
          const byId = new Map(lines.map((l) => [l.itemId, l.quantityReceived]));
          if (byId.size !== lines.length) {
            throw new TransferError('VALIDATION_ERROR', 'Duplicate receiving lines for the same item', 400);
          }
          const known = new Set(transfer.items.map((i) => i.id));
          for (const id of byId.keys()) {
            if (!known.has(id)) throw new TransferError('VALIDATION_ERROR', 'Unknown receiving line', 400);
          }

          let receivedTotal = 0;
          let receivedRows = 0;
          for (const item of transfer.items) {
            const qty = byId.get(item.id) ?? 0;
            if (!Number.isSafeInteger(qty) || qty < 0) {
              throw new TransferError('VALIDATION_ERROR', 'Received quantity must be a non-negative whole number', 400);
            }
            const outstanding = item.quantityShipped - item.quantityReceived;
            if (qty > outstanding) {
              throw new TransferError(
                'VALIDATION_ERROR',
                `Cannot receive more than was shipped for ${item.product.sku}`,
                400,
                { itemId: item.id, productId: item.productId, shipped: item.quantityShipped, alreadyReceived: item.quantityReceived },
              );
            }
            if (qty > 0) {
              await incrementStock(tx, {
                branchId: transfer.toBranchId,
                productId: item.productId,
                quantity: qty,
                type: 'TRANSFER_IN',
                referenceId: transfer.transferNumber,
                createdById: actorId,
              });
              receivedTotal += qty;
              receivedRows += 1;
            }
            if (qty !== item.quantityReceived) {
              await tx.stockTransferItem.update({
                where: { id: item.id },
                data: {
                  quantityReceived: item.quantityReceived + qty,
                  ...(qty > 0 ? { receivedAt: now } : {}),
                },
              });
            }
          }

          const fullyReceived = transfer.items.every(
            (i) => i.quantityReceived + (byId.get(i.id) ?? 0) >= i.quantityShipped,
          );
          // Receiving nothing at all leaves the transfer in transit; anything
          // short of the shipped quantity stays PARTIALLY_RECEIVED.
          if (receivedTotal === 0) {
            await tx.stockTransfer.update({
              where: { id: transferId },
              data: { status: transfer.status },
            });
            finalStatus = transfer.status;
          } else {
            finalStatus = fullyReceived ? 'COMPLETED' : 'PARTIALLY_RECEIVED';
            await tx.stockTransfer.update({
              where: { id: transferId },
              data: fullyReceived
                ? { status: 'COMPLETED', receivedAt: now }
                : { status: 'PARTIALLY_RECEIVED' },
            });
          }
          summary.receivedQuantity = receivedTotal;
          summary.receivedRows = receivedRows;
          summary.fullyReceived = fullyReceived;
        }

        await tx.auditLog.create({
          data: {
            actorId,
            action: `transfer.${pastTense(action)}`,
            entity: 'StockTransfer',
            entityId: transferId,
            branchId: transfer.fromBranchId,
            metadata: JSON.stringify({
              transferNumber: transfer.transferNumber,
              fromStatus: transfer.status,
              toStatus: finalStatus,
              fromBranchId: transfer.fromBranchId,
              toBranchId: transfer.toBranchId,
              ...summary,
              ...(action === 'cancel' ? { reason: payload.reason } : {}),
            }),
          },
        });

        return tx.stockTransfer.findUniqueOrThrow({
          where: { id: transferId },
          include: { items: { include: { product: { select: { sku: true, nameAr: true, nameEn: true } } } } },
        });
      },
      { maxWait: 10000, timeout: 30000 },
    );

    return updated;
  } catch (e) {
    if (e instanceof TransferError) throw e;
    if (e instanceof InsufficientStockError) {
      throw new TransferError('INSUFFICIENT_STOCK', 'Source branch does not hold the requested quantity', 400, {
        items: [{ productId: e.productId, available: e.available }],
      });
    }
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2028') {
      throw new TransferError('CONCURRENT_UPDATE', 'The transfer is being processed by someone else, retry', 409);
    }
    throw e;
  }
}

function nextStatus(action: string, from: TransferStatus): TransferStatus {
  switch (action) {
    case 'approve':
      return 'APPROVED';
    case 'reject':
      return 'REJECTED';
    case 'cancel':
      return 'CANCELLED';
    case 'ship':
      return 'IN_TRANSIT';
    case 'receive':
      // Receiving is not known to be the last one at claim time, so the claim
      // parks the transfer in the honest interim state. The transaction below
      // promotes it to COMPLETED only when every line is fully received.
      return 'PARTIALLY_RECEIVED';
    default:
      return from;
  }
}

function pastTense(action: string): string {
  switch (action) {
    case 'approve':
      return 'approved';
    case 'reject':
      return 'rejected';
    case 'cancel':
      return 'cancelled';
    case 'ship':
      return 'shipped';
    case 'receive':
      return 'received';
    default:
      return action;
  }
}
