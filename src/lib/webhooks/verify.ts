import crypto from 'node:crypto';
import { getAppEnv } from '@/lib/env-guard';

/** Constant-time string comparison (length differences short-circuit as false). */
export function timingSafeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

/**
 * Fail-closed shared-secret verification for public webhooks.
 * - No secret configured: reject outside development (never trust an open hook).
 * - Secret configured: a value MUST be provided and match in constant time.
 */
export function verifyWebhookSecret(secret: string | undefined, provided: string | null | undefined): boolean {
  if (!secret) return getAppEnv() === 'development';
  if (!provided) return false;
  return timingSafeEqual(provided, secret);
}

/** Fail-closed HMAC verification over the raw request body. */
export function verifyWebhookHmac(
  algorithm: 'sha256' | 'sha512',
  secret: string | undefined,
  rawBody: string,
  provided: string | null | undefined
): boolean {
  if (!secret) return getAppEnv() === 'development';
  if (!provided) return false;
  const expected = crypto.createHmac(algorithm, secret).update(rawBody).digest('hex');
  return timingSafeEqual(expected, provided);
}
