import type { Prisma, PrismaClient } from '@prisma/client';

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

export interface StockMove {
  branchId: string;
  productId: string;
  quantity: number;
  type: 'SALE' | 'RESTOCK' | 'TRANSFER' | 'ADJUSTMENT' | 'RETURN';
  referenceId?: string;
  notes?: string;
  createdById?: string;
}

function assertPositiveQuantity(quantity: number): void {
  if (!Number.isSafeInteger(quantity) || quantity <= 0) {
    throw new RangeError('Stock quantity must be a positive integer');
  }
}

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

export async function incrementStock(tx: Tx, move: StockMove): Promise<{ previous: number; next: number }> {
  assertPositiveQuantity(move.quantity);
  const inv = await tx.branchInventory.findUnique({
    where: { branchId_productId: { branchId: move.branchId, productId: move.productId } },
  });
  if (inv) {
    const updated = await tx.branchInventory.update({
      where: { branchId_productId: { branchId: move.branchId, productId: move.productId } },
      data: { stockQuantity: { increment: move.quantity } },
    });
    await tx.inventoryLog.create({
      data: {
        branchId: move.branchId,
        productId: move.productId,
        type: move.type,
        changeQuantity: move.quantity,
        previousQuantity: inv.stockQuantity,
        newQuantity: updated.stockQuantity,
        referenceId: move.referenceId,
        notes: move.notes,
        createdById: move.createdById,
      },
    });
    return { previous: inv.stockQuantity, next: updated.stockQuantity };
  }
  await tx.branchInventory.create({
    data: { branchId: move.branchId, productId: move.productId, stockQuantity: move.quantity, lowStockThreshold: 5 },
  });
  await tx.inventoryLog.create({
    data: {
      branchId: move.branchId,
      productId: move.productId,
      type: move.type,
      changeQuantity: move.quantity,
      previousQuantity: 0,
      newQuantity: move.quantity,
      referenceId: move.referenceId,
      notes: move.notes,
      createdById: move.createdById,
    },
  });
  return { previous: 0, next: move.quantity };
}

export type PlainClient = Pick<PrismaClient, '$transaction'>;
