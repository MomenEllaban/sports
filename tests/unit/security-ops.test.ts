import { describe, it, expect } from 'vitest';
import { checkRateLimit, resetRateLimits } from '../../src/lib/rate-limit.js';
import { maskPhone } from '../../src/lib/pii.js';
import { captureError } from '../../src/lib/monitor.js';

describe('rate-limit (F1)', () => {
  it('allows up to the limit then 429s with retry hint', () => {
    resetRateLimits();
    expect(checkRateLimit('k', 2, 60_000)).toEqual({ ok: true, retryAfterSec: 0 });
    expect(checkRateLimit('k', 2, 60_000).ok).toBe(true);
    const third = checkRateLimit('k', 2, 60_000);
    expect(third.ok).toBe(false);
    expect(third.retryAfterSec).toBeGreaterThan(0);
  });

  it('isolates buckets per key', () => {
    resetRateLimits();
    checkRateLimit('a', 1, 60_000);
    expect(checkRateLimit('a', 1, 60_000).ok).toBe(false);
    expect(checkRateLimit('b', 1, 60_000).ok).toBe(true);
  });
});

describe('pii maskPhone (F1)', () => {
  it('masks middle digits, keeps prefix/suffix', () => {
    expect(maskPhone('01224226876')).toBe('012••••6876');
    expect(maskPhone(null)).toBe('');
    expect(maskPhone('123')).toBe('••••');
  });
});

describe('monitor captureError (F1)', () => {
  it('never throws without DSN', () => {
    delete process.env.SENTRY_DSN;
    expect(() => captureError('test', new Error('x'), { a: 1 })).not.toThrow();
  });
});
