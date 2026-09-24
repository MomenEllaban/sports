import type { Prisma } from '@prisma/client';
import type { AppSession } from '@/lib/auth/guards';

/**
 * Notifications are branch-aware even though the model has no per-user row.
 * System-wide notifications (branchId=null) are visible to every role; a
 * branch manager/cashier/staff sees only notifications for assigned branches.
 * The same predicate is used for reads and mutations to prevent IDOR.
 */
export function notificationScope(session: AppSession | null): Prisma.NotificationWhereInput {
  const user = session?.user;
  const role = user?.role;
  if (role === 'SUPER_ADMIN') return {};

  const branchIds = Array.isArray(user?.branchIds) ? user.branchIds.filter((id): id is string => typeof id === 'string' && id.length > 0) : [];
  const branchScope: Prisma.NotificationWhereInput = branchIds.length
    ? { OR: [{ branchId: null }, { branchId: { in: branchIds } }] }
    : { branchId: null };
  const roleScope: Prisma.NotificationWhereInput = role
    ? { OR: [{ targetRole: null }, { targetRole: role }] }
    : { targetRole: null };

  return { AND: [branchScope, roleScope] };
}
