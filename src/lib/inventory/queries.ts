import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { branchWhere, scopedBranchIds } from '@/lib/auth/branch-scope';
import type { AppSession } from '@/lib/auth/guards';

/**
 * Read side of the inventory domain. Every list is server-paginated and
 * branch-scoped from the session, so the admin pages stop loading whole
 * tables and a branch manager can never read another branch's balances.
 *
 * Every filter and every aggregate is evaluated in SQL. Row-level comparisons
 * that Prisma cannot express against a sibling column (`stockQuantity` vs
 * `reorderPoint`) use Prisma field references, and cross-table sums use
 * `$queryRaw`, so no list depends on post-paging JavaScript filtering.
 */

export const MAX_PAGE_SIZE = 200;

export interface ListParams {
  page?: number;
  pageSize?: number;
  q?: string;
  branchId?: string;
  categoryId?: string;
  /** 0 = all, 1 = in stock, 2 = at/below reorder point, 3 = out of stock */
  stockState?: number;
  sort?: string;
  dir?: 'asc' | 'desc';
}

export function parseListParams(url: URL): ListParams {
  const p = url.searchParams;
  const page = Math.max(1, Number.parseInt(p.get('page') ?? '1', 10) || 1);
  const pageSize = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, Number.parseInt(p.get('pageSize') ?? '25', 10) || 25),
  );
  return {
    page,
    pageSize,
    q: (p.get('q') ?? '').trim().slice(0, 120),
    branchId: (p.get('branchId') ?? '').trim() || undefined,
    categoryId: (p.get('categoryId') ?? '').trim() || undefined,
    stockState: Number.parseInt(p.get('stockState') ?? '0', 10) || 0,
    sort: (p.get('sort') ?? '').trim() || undefined,
    dir: p.get('dir') === 'asc' ? 'asc' : 'desc',
  };
}

export interface Page<T> {
  rows: T[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

export function paginate<T>(rows: T[], total: number, page: number, pageSize: number): Page<T> {
  return { rows, total, page, pageSize, pageCount: Math.max(1, Math.ceil(total / pageSize)) };
}

/** Raised when a caller asks for a branch outside its own assignment. */
export class InventoryScopeError extends Error {
  status = 403;
  constructor(message = 'This branch is outside your assignment') {
    super(message);
  }
}

/**
 * Resolves the branch filter from the session. A requested branch outside the
 * caller's assignment is an explicit 403, never a silent widening to "all".
 */
export function resolveBranchFilter(
  session: AppSession | null,
  requested?: string,
): { allowedIds: string[] | null; branchId?: string } {
  const allowed = scopedBranchIds(session);
  if (!requested) return { allowedIds: allowed };
  if (allowed !== null && !allowed.includes(requested)) {
    throw new InventoryScopeError();
  }
  return { allowedIds: allowed, branchId: requested };
}

function productTextFilter(q: string): Prisma.ProductWhereInput {
  return {
    OR: [
      { nameAr: { contains: q, mode: 'insensitive' } },
      { nameEn: { contains: q, mode: 'insensitive' } },
      { sku: { contains: q, mode: 'insensitive' } },
      { barcode: { contains: q, mode: 'insensitive' } },
    ],
  };
}

/** Normalizes optional page params so paging math is never `NaN`. */
function paging(params: ListParams): { page: number; pageSize: number } {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, params.pageSize ?? 25));
  return { page, pageSize };
}

/**
 * Branch stock rows joined to their product. A row exists for every
 * (branch, product) pair the branch has ever stocked; products absent from a
 * branch are reported through `absent` on the overview rather than invented here.
 */
export async function listStock(
  session: AppSession | null,
  params: ListParams,
): Promise<Page<Record<string, unknown>>> {
  const { allowedIds, branchId } = resolveBranchFilter(session, params.branchId);
  const { page, pageSize } = paging(params);

  const productWhere: Prisma.ProductWhereInput = params.categoryId
    ? { categoryId: params.categoryId, isActive: true }
    : { isActive: true };
  if (params.q) {
    productWhere.AND = [productTextFilter(params.q)];
  }

  const where: Prisma.BranchInventoryWhereInput = {
    branch: { ...branchWhere(session), ...(branchId ? { id: branchId } : {}), isActive: true },
    product: productWhere,
  };
  if (allowedIds !== null) where.branchId = { in: allowedIds };

  // Field references make these comparisons happen inside the query, so both
  // the page window and `total` agree with the filter.
  if (params.stockState === 3) where.stockQuantity = { equals: 0 };
  if (params.stockState === 1) where.stockQuantity = { gt: 0 };
  if (params.stockState === 2) {
    where.stockQuantity = { lte: prisma.branchInventory.fields.reorderPoint };
  }

  const orderBy: Prisma.BranchInventoryOrderByWithRelationInput =
    params.sort === 'quantity'
      ? { stockQuantity: params.dir ?? 'desc' }
      : params.sort === 'updated'
        ? { updatedAt: params.dir ?? 'desc' }
        : { product: { sku: params.dir ?? 'asc' } };

  const [total, rows] = await prisma.$transaction([
    prisma.branchInventory.count({ where }),
    prisma.branchInventory.findMany({
      where,
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        branch: { select: { id: true, name: true, nameEn: true } },
        product: {
          select: {
            id: true,
            sku: true,
            barcode: true,
            nameAr: true,
            nameEn: true,
            costPrice: true,
            price: true,
            size: true,
            color: true,
            category: { select: { id: true, nameAr: true, nameEn: true } },
          },
        },
      },
    }),
  ]);

  const out = rows.map((r) => ({
    id: r.id,
    branchId: r.branchId,
    branchName: r.branch.name,
    branchNameEn: r.branch.nameEn,
    productId: r.productId,
    sku: r.product.sku,
    barcode: r.product.barcode,
    nameAr: r.product.nameAr,
    nameEn: r.product.nameEn,
    size: r.product.size,
    color: r.product.color,
    categoryAr: r.product.category.nameAr,
    categoryEn: r.product.category.nameEn,
    stockQuantity: r.stockQuantity,
    lowStockThreshold: r.lowStockThreshold,
    reorderPoint: r.reorderPoint,
    reorderQuantity: r.reorderQuantity,
    costPrice: Number(r.product.costPrice),
    sellPrice: Number(r.product.price),
    stockValue: Number((Number(r.product.costPrice) * r.stockQuantity).toFixed(2)),
    isLow: r.stockQuantity <= r.reorderPoint && r.stockQuantity > 0,
    isOut: r.stockQuantity === 0,
    updatedAt: r.updatedAt.toISOString(),
  }));

  return paginate(out, total, page, pageSize);
}

export interface MovementParams extends ListParams {
  productId?: string;
  type?: string;
  from?: string;
  to?: string;
}

export async function listMovements(
  session: AppSession | null,
  params: MovementParams,
): Promise<Page<Record<string, unknown>>> {
  const { allowedIds, branchId } = resolveBranchFilter(session, params.branchId);
  const { page, pageSize } = paging(params);

  const where: Prisma.InventoryLogWhereInput = {};
  if (params.productId) where.productId = params.productId;
  if (params.type) where.type = params.type as Prisma.InventoryLogWhereInput['type'];
  if (allowedIds !== null) where.branchId = { in: branchId ? [branchId] : allowedIds };
  else if (branchId) where.branchId = branchId;
  if (params.q) {
    where.OR = [
      { product: { sku: { contains: params.q, mode: 'insensitive' } } },
      { product: { nameAr: { contains: params.q, mode: 'insensitive' } } },
      { product: { nameEn: { contains: params.q, mode: 'insensitive' } } },
      { referenceId: { contains: params.q, mode: 'insensitive' } },
      { notes: { contains: params.q, mode: 'insensitive' } },
    ];
  }
  if (params.from || params.to) {
    where.createdAt = {
      ...(params.from ? { gte: new Date(params.from) } : {}),
      ...(params.to ? { lte: new Date(`${params.to}T23:59:59.999Z`) } : {}),
    };
  }

  const orderBy: Prisma.InventoryLogOrderByWithRelationInput =
    params.sort === 'quantity'
      ? { changeQuantity: params.dir ?? 'desc' }
      : { createdAt: params.dir ?? 'desc' };

  const [total, rows] = await prisma.$transaction([
    prisma.inventoryLog.count({ where }),
    prisma.inventoryLog.findMany({
      where,
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        branch: { select: { id: true, name: true, nameEn: true } },
        product: { select: { id: true, sku: true, nameAr: true, nameEn: true } },
      },
    }),
  ]);

  return paginate(
    rows.map((r) => ({
      id: r.id,
      branchId: r.branchId,
      branchName: r.branch.name,
      branchNameEn: r.branch.nameEn,
      productId: r.productId,
      sku: r.product.sku,
      nameAr: r.product.nameAr,
      nameEn: r.product.nameEn,
      type: r.type,
      changeQuantity: r.changeQuantity,
      previousQuantity: r.previousQuantity,
      newQuantity: r.newQuantity,
      referenceId: r.referenceId,
      notes: r.notes,
      createdById: r.createdById,
      createdAt: r.createdAt.toISOString(),
    })),
    total,
    page,
    pageSize,
  );
}

export interface InventoryOverview {
  branches: number;
  totalSkus: number;
  stockedSkus: number;
  totalQuantity: number;
  lowStockCount: number;
  outOfStockCount: number;
  stockValue: number;
  retailValue: number;
  pendingTransfers: number;
  inTransitTransfers: number;
  openStocktakes: number;
  recentMovements: Array<Record<string, unknown>>;
  topMovers: Array<Record<string, unknown>>;
}

/**
 * Branch restriction for the raw aggregate.
 * - `null`  → the caller may see every branch, so the clause is dropped.
 * - `[]`    → a scoped caller with no assignment must see nothing, so the
 *             clause becomes a predicate that matches no row. Treating an empty
 *             list as "unrestricted" would leak the whole company's numbers.
 * - `[id…]` → a bound `IN` list, never a string-joined identifier list.
 */
function branchScopeSql(column: string, scopeIds: string[] | null): Prisma.Sql {
  if (scopeIds === null) return Prisma.sql`TRUE`;
  if (!scopeIds.length) return Prisma.sql`FALSE`;
  return Prisma.sql`${Prisma.raw(column)} IN (${Prisma.join(scopeIds)})`;
}

interface InventoryTotalsRow {
  totalQuantity: bigint | number | null;
  stockedSkus: bigint | number | null;
  lowStockCount: bigint | number | null;
  outOfStockCount: bigint | number | null;
  stockValue: bigint | number | null;
  retailValue: bigint | number | null;
}

/** Every number on the overview screen is aggregated in SQL, never in JS. */
export async function getInventoryOverview(
  session: AppSession | null,
  opts: { branchId?: string } = {},
): Promise<InventoryOverview> {
  const { allowedIds, branchId } = resolveBranchFilter(session, opts.branchId);
  // A requested branch narrows the assignment; it never widens it.
  const scopeIds: string[] | null = branchId ? [branchId] : allowedIds;

  const logWhere: Prisma.InventoryLogWhereInput = {};
  if (scopeIds !== null) logWhere.branchId = { in: scopeIds };

  const transferWhere: Prisma.StockTransferWhereInput = {};
  if (scopeIds !== null) {
    transferWhere.OR = [{ fromBranchId: { in: scopeIds } }, { toBranchId: { in: scopeIds } }];
  }

  const stocktakeWhere: Prisma.StocktakeSessionWhereInput = { status: 'DRAFT' };
  if (scopeIds !== null) stocktakeWhere.branchId = { in: scopeIds };

  // One grouped aggregate computes the quantities, the low/out counts and both
  // valuations in the database, instead of streaming rows into JavaScript.
  const totals = await prisma.$queryRaw<InventoryTotalsRow[]>`
    SELECT
      COALESCE(SUM(bi."stockQuantity"), 0)::bigint                                        AS "totalQuantity",
      COUNT(DISTINCT bi."productId") FILTER (WHERE bi."stockQuantity" > 0)::bigint       AS "stockedSkus",
      COUNT(*) FILTER (WHERE bi."stockQuantity" > 0 AND bi."stockQuantity" <= bi."reorderPoint")::bigint AS "lowStockCount",
      COUNT(*) FILTER (WHERE bi."stockQuantity" = 0)::bigint                               AS "outOfStockCount",
      COALESCE(SUM(bi."stockQuantity" * p."costPrice"), 0)::numeric                        AS "stockValue",
      COALESCE(SUM(bi."stockQuantity" * p."price"), 0)::numeric                            AS "retailValue"
    FROM "BranchInventory" bi
    INNER JOIN "Product" p ON p."id" = bi."productId"
    INNER JOIN "Branch" b ON b."id" = bi."branchId"
    WHERE b."isActive" = true
      AND p."isActive" = true
      AND ${branchScopeSql('bi."branchId"', scopeIds)}
  `;

  const t = totals[0];
  const [
    branchCount,
    skuCount,
    pendingTransfers,
    inTransitTransfers,
    openStocktakes,
    recentMovements,
    groupedMovements,
  ] = await prisma.$transaction([
    prisma.branch.count({
      where: { isActive: true, ...branchWhere(session), ...(branchId ? { id: branchId } : {}) },
    }),
    prisma.product.count({
      where: { isActive: true, ...(scopeIds !== null ? { inventories: { some: { branchId: { in: scopeIds } } } } : {}) },
    }),
    prisma.stockTransfer.count({ where: { ...transferWhere, status: 'PENDING' } }),
    prisma.stockTransfer.count({
      where: { ...transferWhere, status: { in: ['APPROVED', 'IN_TRANSIT', 'PARTIALLY_RECEIVED'] } },
    }),
    prisma.stocktakeSession.count({ where: stocktakeWhere }),
    prisma.inventoryLog.findMany({
      where: logWhere,
      orderBy: { createdAt: 'desc' },
      take: 8,
      include: {
        branch: { select: { name: true, nameEn: true } },
        product: { select: { sku: true, nameAr: true, nameEn: true } },
      },
    }),
    prisma.inventoryLog.groupBy({
      by: ['productId'],
      where: { ...logWhere, createdAt: { gte: new Date(Date.now() - 30 * 864e5) } },
      _count: true,
      orderBy: { _count: { productId: 'desc' } },
      take: 8,
    }),
  ]);

  const moverIds = groupedMovements.map((g) => g.productId);
  const moverProducts = moverIds.length
    ? await prisma.product.findMany({
        where: { id: { in: moverIds } },
        select: { id: true, sku: true, nameAr: true, nameEn: true },
      })
    : [];
  const moverById = new Map(moverProducts.map((p) => [p.id, p]));

  return {
    branches: branchCount,
    totalSkus: skuCount,
    stockedSkus: Number(t?.stockedSkus ?? 0),
    totalQuantity: Number(t?.totalQuantity ?? 0),
    lowStockCount: Number(t?.lowStockCount ?? 0),
    outOfStockCount: Number(t?.outOfStockCount ?? 0),
    stockValue: Number(t?.stockValue ?? 0),
    retailValue: Number(t?.retailValue ?? 0),
    pendingTransfers,
    inTransitTransfers,
    openStocktakes,
    recentMovements: recentMovements.map((m) => ({
      id: m.id,
      sku: m.product.sku,
      nameAr: m.product.nameAr,
      nameEn: m.product.nameEn,
      branchName: m.branch.name,
      branchNameEn: m.branch.nameEn,
      type: m.type,
      changeQuantity: m.changeQuantity,
      newQuantity: m.newQuantity,
      referenceId: m.referenceId,
      createdAt: m.createdAt.toISOString(),
    })),
    topMovers: groupedMovements
      .map((g) => {
        const p = moverById.get(g.productId);
        return p
          ? {
              productId: g.productId,
              sku: p.sku,
              nameAr: p.nameAr,
              nameEn: p.nameEn,
              movements: g._count,
            }
          : null;
      })
      .filter((x): x is NonNullable<typeof x> => x !== null),
  };
}

/** Low/out-of-stock reorder suggestions for the session's branches. */
export async function listTransferAlerts(
  session: AppSession | null,
  params: ListParams,
): Promise<Page<Record<string, unknown>>> {
  const { allowedIds, branchId } = resolveBranchFilter(session, params.branchId);
  const { page, pageSize } = paging(params);

  const productWhere: Prisma.ProductWhereInput = { isActive: true };
  if (params.categoryId) productWhere.categoryId = params.categoryId;
  if (params.q) {
    productWhere.OR = [
      { sku: { contains: params.q, mode: 'insensitive' } },
      { nameAr: { contains: params.q, mode: 'insensitive' } },
      { nameEn: { contains: params.q, mode: 'insensitive' } },
    ];
  }

  const where: Prisma.BranchInventoryWhereInput = {
    product: productWhere,
    branch: { isActive: true, ...branchWhere(session) },
    // Alerts are exactly the rows at or below their own reorder point.
    stockQuantity: { lte: prisma.branchInventory.fields.reorderPoint },
  };
  if (allowedIds !== null) where.branchId = { in: allowedIds };
  if (branchId) where.branchId = branchId;

  const [total, rows] = await prisma.$transaction([
    prisma.branchInventory.count({ where }),
    prisma.branchInventory.findMany({
      where,
      orderBy: { stockQuantity: 'asc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        branch: { select: { id: true, name: true, nameEn: true } },
        product: {
          select: {
            id: true,
            sku: true,
            nameAr: true,
            nameEn: true,
            costPrice: true,
            category: { select: { nameAr: true, nameEn: true } },
          },
        },
      },
    }),
  ]);

  return paginate(
    rows.map((c) => ({
      id: c.id,
      branchId: c.branchId,
      branchName: c.branch.name,
      branchNameEn: c.branch.nameEn,
      productId: c.productId,
      sku: c.product.sku,
      nameAr: c.product.nameAr,
      nameEn: c.product.nameEn,
      categoryAr: c.product.category.nameAr,
      categoryEn: c.product.category.nameEn,
      stockQuantity: c.stockQuantity,
      reorderPoint: c.reorderPoint,
      lowStockThreshold: c.lowStockThreshold,
      reorderQuantity: c.reorderQuantity,
      suggestedQuantity: Math.max(1, c.reorderPoint + c.reorderQuantity - c.stockQuantity),
      isOut: c.stockQuantity === 0,
      shortfallValue: Number(
        (Number(c.product.costPrice) * Math.max(0, c.reorderPoint - c.stockQuantity)).toFixed(2),
      ),
    })),
    total,
    page,
    pageSize,
  );
}
