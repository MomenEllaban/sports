/**
 * In-memory fixed-window rate limiter (F1).
 * Per-process, per-instance: sufficient for single-instance hobby deploy;
 * front with Vercel/edge throttling in production (see docs/OPERATIONS.md).
 * Keys should scope by client IP + route. Returns 429 payload when exceeded.
 */
interface Bucket { count: number; resetAt: number }
const buckets = new Map<string, Bucket>();

export function clientIp(req: Request): string {
  const h = (n: string) => req.headers.get(n);
  const fwd = h('x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim();
  return h('x-real-ip') || 'unknown';
}

export function checkRateLimit(key: string, limit: number, windowMs: number): { ok: boolean; retryAfterSec: number } {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || now >= b.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfterSec: 0 };
  }
  b.count += 1;
  if (b.count > limit) {
    return { ok: false, retryAfterSec: Math.ceil((b.resetAt - now) / 1000) };
  }
  return { ok: true, retryAfterSec: 0 };
}

export function rateLimitedResponse(retryAfterSec: number, message = 'طلبات كثيرة — حاول بعد قليل') {
  return Response.json({ success: false, error: message }, {
    status: 429,
    headers: { 'Retry-After': String(retryAfterSec) },
  });
}

/** Test hook: reset all buckets. */
export function resetRateLimits(): void {
  buckets.clear();
}
