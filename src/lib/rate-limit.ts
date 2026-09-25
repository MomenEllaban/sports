import { apiError } from '@/lib/api-response';

/**
 * In-memory fixed-window rate limiter (F1).
 * Per-process, per-instance: sufficient for single-instance hobby deploy;
 * front with Vercel/edge throttling in production.
 */
interface Bucket { count: number; resetAt: number }
const buckets = new Map<string, Bucket>();

export function clientIp(req: Request): string {
  const h = (name: string) => req.headers.get(name);
  const fwd = h('x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim();
  return h('x-real-ip') || 'unknown';
}

export function checkRateLimit(key: string, limit: number, windowMs: number): { ok: boolean; retryAfterSec: number } {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || now >= bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfterSec: 0 };
  }
  bucket.count += 1;
  if (bucket.count > limit) return { ok: false, retryAfterSec: Math.ceil((bucket.resetAt - now) / 1000) };
  return { ok: true, retryAfterSec: 0 };
}

export function rateLimitedResponse(retryAfterSec: number, message = 'طلبات كثيرة — حاول بعد قليل') {
  const response = apiError('RATE_LIMITED', message, 429);
  response.headers.set('Retry-After', String(retryAfterSec));
  return response;
}

/** Test hook: reset all buckets. */
export function resetRateLimits(): void {
  buckets.clear();
}
