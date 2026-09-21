import crypto from 'node:crypto';
import { cookies } from 'next/headers';

export const PORTAL_COOKIE = 'sc_portal';
const MAX_AGE = 7 * 24 * 60 * 60; // 7 days

function secret(): string {
  return process.env.NEXTAUTH_SECRET || 'dev-portal-secret';
}

export interface PortalSession {
  customerId: string;
  exp: number;
}

function sign(payload: string): string {
  return crypto.createHmac('sha256', secret()).update(payload).digest('hex');
}

/** Create a signed portal token for a customer (4.3). */
export function issuePortalToken(customerId: string): string {
  const payload = Buffer.from(JSON.stringify({ customerId, exp: Date.now() + MAX_AGE * 1000 })).toString('base64url');
  return `${payload}.${sign(payload)}`;
}

/** Verify a portal token; returns null when missing/tampered/expired. */
export function verifyPortalToken(token: string | undefined): PortalSession | null {
  if (!token || !token.includes('.')) return null;
  const [payload, sig] = token.split('.');
  if (sign(payload) !== sig) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString()) as PortalSession;
    if (!data.customerId || data.exp < Date.now()) return null;
    return data;
  } catch {
    return null;
  }
}

export async function readPortalSession(): Promise<PortalSession | null> {
  const store = await cookies();
  return verifyPortalToken(store.get(PORTAL_COOKIE)?.value);
}

export function portalCookieHeader(token: string): string {
  return `${PORTAL_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${MAX_AGE}; Secure`;
}

export function clearPortalCookieHeader(): string {
  return `${PORTAL_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}
