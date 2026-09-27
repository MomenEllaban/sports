import type { Prisma } from '@prisma/client';
import { scopedBranchIds } from '@/lib/auth/branch-scope';
import type { AppSession } from '@/lib/auth/guards';

/** The filters the product list page exposes, taken from the query string. */
export type ProductFilters = {
  query?: string;
  categoryId?: string;
  brandId?: string;
  status?: string;
};

export function parseProductFilters(params: URLSearchParams | ProductFilters): ProductFilters {
  const get = (key: keyof ProductFilters) => {
    if (params instanceof URLSearchParams) return params.get(key) || undefined;
    return params[key];
  };
  return {
    query: get('query')?.trim() || undefined,
    categoryId: get('categoryId') || undefined,
    brandId: get('brandId') || undefined,
    status: get('status') || undefined,
  };
}

/**
 * The single source of truth for how the catalogue is filtered.
 *
 * The list page and the CSV export endpoint both build on this, so an export can
 * never cover a different set of rows than the table the user was looking at.
 */
export function productWhere(filters: ProductFilters): Prisma.ProductWhereInput {
  return {
    ...(filters.query
      ? {
          OR: [
            { nameAr: { contains: filters.query, mode: 'insensitive' } },
            { nameEn: { contains: filters.query, mode: 'insensitive' } },
            { sku: { contains: filters.query, mode: 'insensitive' } },
            { barcode: { contains: filters.query, mode: 'insensitive' } },
            { gs1Code: { contains: filters.query, mode: 'insensitive' } },
          ],
        }
      : {}),
    ...(filters.categoryId ? { categoryId: filters.categoryId } : {}),
    ...(filters.brandId ? { brandId: filters.brandId } : {}),
    ...(filters.status === 'active'
      ? { isActive: true }
      : filters.status === 'inactive'
        ? { isActive: false }
        : {}),
  };
}

/**
 * Restricts `BranchInventory` rows to the branches the actor may see, so a
 * BRANCH_MANAGER cannot read a stock total that includes another branch.
 */
export function scopedInventoryWhere(session: AppSession | null): Prisma.BranchInventoryWhereInput {
  const allowedBranchIds = scopedBranchIds(session);
  return allowedBranchIds === null ? {} : { branchId: { in: allowedBranchIds } };
}
