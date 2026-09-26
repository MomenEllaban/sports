import type { InventoryLogType, Prisma, PrismaClient } from '@prisma/client';
import { Prisma as PrismaNS } from '@prisma/client';

export type Tx = Prisma.TransactionClient;

export class InsufficientStockError extends Error {
  productId: string;
  available: number;
  constructor(productId: string, available: number) {
    super(`Insufficient stock (available ${available})`);
    this.productId = productId;
    this.available = available;
  }
}

/**
 * Movement types recorded in the ledger. RESTOCK/TRANSFER/RETURN are legacy
 * values kept so historical rows stay valid; new call sites must use the
 * precise type (PURCHASE, SALE_RETURN, TRANSFER_OUT, TRANSFER_IN, CYCLE_COUNT).
 */
export type MovementType = InventoryLogType;

export interface StockMove {
  branchId: string;
  productId: string;
  quantity: number;
  type: MovementType;
  referenceId?: string;
  notes?: string;
  createdById?: string;
}

function assertPositiveQuantity(quantity: number): void {
  if (!Number.isSafeInteger(quantity) || quantity <= 0) {
    throw new RangeError('Stock quantity must be a positive integer');
  }
}

/** New stock rows start with these defaults; the per-branch editor can override. */
export const DEFAULT_LOW_STOCK_THRESHOLD = 5;
export const DEFAULT_REORDER_QUANTITY = 10;

/**
 * SINGLE SOURCE OF TRUTH for stock changes (T07). All mutations MUST go through
 * here inside the caller's prisma.$transaction. Decrement is race-safe via a
 * conditional updateMany (quantity >= qty); a count of 0 means insufficient stock.
 */
export async function decrementStock(tx: Tx, move: StockMove): Promise<{ previous: number; next: number }> {
  assertPositiveQuantity(move.quantity);
  const res = await tx.branchInventory.updateMany({
    where: {
      branchId: move.branchId,
      productId: move.productId,
      stockQuantity: { gte: move.quantity },
    },
    data: { stockQuantity: { decrement: move.quantity } },
  });
  if (res.count !== 1) {
    const inv = await tx.branchInventory.findUnique({
      where: { branchId_productId: { branchId: move.branchId, productId: move.productId } },
    });
    throw new InsufficientStockError(move.productId, inv?.stockQuantity ?? 0);
  }
  const after = await tx.branchInventory.findUniqueOrThrow({
    where: { branchId_productId: { branchId: move.branchId, productId: move.productId } },
  });
  const previous = after.stockQuantity + move.quantity;
  await tx.inventoryLog.create({
    data: {
      branchId: move.branchId,
      productId: move.productId,
      type: move.type,
      changeQuantity: -move.quantity,
      previousQuantity: previous,
      newQuantity: after.stockQuantity,
      referenceId: move.referenceId,
      notes: move.notes,
      createdById: move.createdById,
    },
  });
  return { previous, next: after.stockQuantity };
}

/**
 * Increment is written with a conditional updateMany (same shape as
 * decrement) and the previous balance is DERIVED from the post-update read,
 * never from a stale pre-read. A plain read-then-increment could emit two
 * ledger rows with the same previousQuantity under concurrency, breaking the
 * `newQuantity === previousQuantity + changeQuantity` chain invariant.
 */
export async function incrementStock(tx: Tx, move: StockMove): Promise<{ previous: number; next: number }> {
  assertPositiveQuantity(move.quantity);
  const key = { branchId: move.branchId, productId: move.productId };

  let res = await tx.branchInventory.updateMany({
    where: key,
    data: { stockQuantity: { increment: move.quantity } },
  });

  if (res.count === 0) {
    // No stock row yet: create it, then let a concurrent creator win the race.
    try {
      await tx.branchInventory.create({
        data: {
          ...key,
          stockQuantity: move.quantity,
          lowStockThreshold: DEFAULT_LOW_STOCK_THRESHOLD,
          reorderPoint: DEFAULT_LOW_STOCK_THRESHOLD,
          reorderQuantity: DEFAULT_REORDER_QUANTITY,
        },
      });
    } catch (e) {
      if (!(e instanceof PrismaNS.PrismaClientKnownRequestError) || e.code !== 'P2002') throw e;
      res = await tx.branchInventory.updateMany({
        where: key,
        data: { stockQuantity: { increment: move.quantity } },
      });
      if (res.count !== 1) throw new Error('STOCK_ROW_UNAVAILABLE');
    }
  }

  const after = await tx.branchInventory.findUniqueOrThrow({ where: { branchId_productId: key } });
  const previous = after.stockQuantity - move.quantity;
  await tx.inventoryLog.create({
    data: {
      branchId: move.branchId,
      productId: move.productId,
      type: move.type,
      changeQuantity: move.quantity,
      previousQuantity: previous,
      newQuantity: after.stockQuantity,
      referenceId: move.referenceId,
      notes: move.notes,
      createdById: move.createdById,
    },
  });
  return { previous, next: after.stockQuantity };
}

export type PlainClient = Pick<PrismaClient, '$transaction'>;
