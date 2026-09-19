import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from './auth';
import { requireRole } from './auth/guards';

/** @deprecated Use requireRole/requireSession from ./auth/guards. Kept for existing imports. */
export async function requireAdminSession() {
  return requireRole();
}

// Re-export so existing `import { getServerSession }` sites keep working if needed.
export { getServerSession, NextResponse, authOptions };
