import type { Prisma } from '@prisma/client';
import type { AppSession } from './guards';

/**
 * Branch isolation for admin resources. SUPER_ADMIN can see every active
 * branch; other roles are limited to the branches assigned by an administrator.
 * Empty assignment intentionally means no access rather than all access.
 */
export function scopedBranchIds(session: AppSession | null): string[] | null {
  if (session?.user?.role === 'SUPER_ADMIN') return null;
  return Array.isArray(session?.user?.branchIds)
    ? session.user.branchIds.filter((id): id is string => typeof id === 'string' && id.length > 0)
    : [];
}

export function canAccessBranch(session: AppSession | null, branchId: string): boolean {
  const ids = scopedBranchIds(session);
  return ids === null || ids.includes(branchId);
}

export function branchWhere(session: AppSession | null): Prisma.BranchWhereInput {
  const ids = scopedBranchIds(session);
  return ids === null ? {} : { id: { in: ids } };
}

/** A Prisma where fragment for resources carrying a branchId. */
export function branchResourceWhere(session: AppSession | null): Prisma.OrderWhereInput {
  const ids = scopedBranchIds(session);
  return ids === null ? {} : { branchId: { in: ids } };
}

export function branchResourceWhereForSale(session: AppSession | null): Prisma.SaleWhereInput {
  const ids = scopedBranchIds(session);
  return ids === null ? {} : { branchId: { in: ids } };
}
