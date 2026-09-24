import crypto from 'node:crypto';

/** Constant-time string comparison (length differences short-circuit as false). */
export function timingSafeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

/**
 * Fail-closed shared-secret verification for public webhooks. A missing
 * provider secret is never treated as valid, including in local development;
 * development tests must provide a deterministic secret explicitly.
 */
export function verifyWebhookSecret(secret: string | undefined, provided: string | null | undefined): boolean {
  if (!secret || !secret.trim() || !provided) return false;
  return timingSafeEqual(provided, secret);
}

/** Fail-closed HMAC verification over the raw request body. */
export function verifyWebhookHmac(
  algorithm: 'sha256' | 'sha512',
  secret: string | undefined,
  rawBody: string,
  provided: string | null | undefined,
): boolean {
  if (!secret || !secret.trim() || !provided) return false;
  const expected = crypto.createHmac(algorithm, secret).update(rawBody).digest('hex');
  return timingSafeEqual(expected, provided);
}
