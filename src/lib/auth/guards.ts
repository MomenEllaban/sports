import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from '../auth';
import { apiError } from '@/lib/api-response';
import type { Role } from '@prisma/client';

/** Roles allowed on POS terminals (pages + APIs). */
export const POS_ROLES: Role[] = ['CASHIER', 'BRANCH_MANAGER', 'SUPER_ADMIN'];

export interface AppSession {
  user?: {
    id?: string;
    name?: string | null;
    email?: string | null;
    role?: Role;
    branchIds?: string[];
    branchId?: string | null;
  };
}

export interface GuardResult {
  session: AppSession | null;
  error: NextResponse | null;
}

/** Session + role guard for API routes. Returns 401 (anonymous) or 403 (wrong role). */
export async function requireRole(...roles: Role[]): Promise<GuardResult> {
  const raw = (await getServerSession(authOptions)) as AppSession | null;
  if (!raw?.user) {
    return { session: null, error: apiError('UNAUTHORIZED', 'يجب تسجيل الدخول للوصول إلى هذه الصفحة', 401) };
  }
  const session: AppSession = raw;
  const role = session.user?.role;
  if (roles.length > 0 && (!role || !roles.includes(role))) {
    return { session: null, error: apiError('FORBIDDEN', 'لا تملك صلاحية للوصول إلى هذه الصفحة', 403) };
  }
  return { session, error: null };
}

/** Role hierarchy rank (higher = more privilege). Used for anti-escalation checks. */
export const ROLE_RANK: Record<Role, number> = {
  STAFF: 1,
  CASHIER: 2,
  FINANCE: 3,
  BRANCH_MANAGER: 4,
  SUPER_ADMIN: 5,
};

/** True if `actor` may grant `target` role (never above their own). */
export function canGrantRole(actor: Role | undefined, target: Role): boolean {
  if (!actor) return false;
  return (ROLE_RANK[target] ?? 0) <= (ROLE_RANK[actor] ?? 0);
}

/** Back-compat: any authenticated session (used until T04 assigns minimal roles). */
export async function requireSession(): Promise<GuardResult> {
  return requireRole();
}
