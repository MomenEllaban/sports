import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from '../auth.js';
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
    return { session: null, error: NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 }) };
  }
  const session: AppSession = raw;
  const role = session.user?.role;
  if (roles.length > 0 && (!role || !roles.includes(role))) {
    return { session: null, error: NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 }) };
  }
  return { session, error: null };
}

/** Back-compat: any authenticated session (used until T04 assigns minimal roles). */
export async function requireSession(): Promise<GuardResult> {
  return requireRole();
}
