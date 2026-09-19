import { prisma } from '@/lib/db';
import type { AppSession } from '@/lib/auth/guards';
import type { Role } from '@prisma/client';

export class PosContextError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export interface PosContext {
  branch: { id: string; name: string; nameEn: string };
  cashierId: string;
  role: Role;
}

/**
 * Single source of truth for "which branch + who" on POS (T05).
 * - CASHIER: sells ONLY in their assigned home branch (User.branchId, server-read).
 *   Passing another branchId -> 403. Missing assignment -> 422.
 * - BRANCH_MANAGER / SUPER_ADMIN: MUST pass an explicit active branchId (never
 *   silently falls back). BM limited to their branchIds; SA may use any active branch.
 */
export async function resolvePosContext(
  session: AppSession,
  requestedBranchId?: string | null
): Promise<PosContext> {
  const userId = session.user?.id;
  const role = session.user?.role;
  if (!userId || !role) {
    throw new PosContextError(401, 'Unauthorized');
  }

  const me = await prisma.user.findUnique({ where: { id: userId } });
  if (!me || !me.isActive) {
    throw new PosContextError(401, 'Unauthorized');
  }

  if (role === 'CASHIER') {
    if (!me.branchId) {
      throw new PosContextError(422, 'لا يوجد فرع مسند لهذا الكاشير');
    }
    if (requestedBranchId && requestedBranchId !== me.branchId) {
      throw new PosContextError(403, 'غير مصرح بالبيع في فرع آخر');
    }
    const branch = await prisma.branch.findFirst({ where: { id: me.branchId, isActive: true } });
    if (!branch) {
      throw new PosContextError(422, 'فرع الكاشير غير نشط');
    }
    return { branch: { id: branch.id, name: branch.name, nameEn: branch.nameEn }, cashierId: me.id, role };
  }

  if (role === 'BRANCH_MANAGER' || role === 'SUPER_ADMIN') {
    if (!requestedBranchId) {
      throw new PosContextError(422, 'حدد الفرع أولاً');
    }
    const branch = await prisma.branch.findFirst({ where: { id: requestedBranchId, isActive: true } });
    if (!branch) {
      throw new PosContextError(422, 'الفرع المحدد غير نشط');
    }
    if (role === 'BRANCH_MANAGER' && !(me.branchIds || []).includes(branch.id)) {
      throw new PosContextError(403, 'غير مصرح بالبيع في هذا الفرع');
    }
    return { branch: { id: branch.id, name: branch.name, nameEn: branch.nameEn }, cashierId: me.id, role };
  }

  throw new PosContextError(403, 'Forbidden');
}
