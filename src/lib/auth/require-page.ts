import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import type { Role } from '@prisma/client';

/**
 * Server-Component page guard (T04). Redirects anonymous users to login and
 * users with the wrong role to the storefront home.
 */
export async function requirePageRole(...roles: Role[]) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: Role } | undefined)?.role;
  if (!session?.user) {
    redirect('/admin/login');
  }
  if (roles.length > 0 && (!role || !roles.includes(role))) {
    redirect('/');
  }
  return session;
}
