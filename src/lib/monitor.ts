import { randomUUID } from 'node:crypto';

/**
 * Error monitoring hook (F1): Sentry-compatible.
 * - `SENTRY_DSN` set → POSTs a minimal event to the DSN endpoint (best-effort).
 * - unset → one development log per event; expected auth/permission states
 *   should not call this function.
 */
export function captureError(scope: string, err: unknown, extra?: Record<string, unknown>): void {
  const requestId = typeof extra?.requestId === 'string' ? extra.requestId : randomUUID();
  const dsn = process.env.SENTRY_DSN;
  const message = err instanceof Error ? err.message : String(err);
  const event = {
    scope,
    message,
    requestId,
    extra: { ...(extra ?? {}), requestId },
    at: new Date().toISOString(),
  };
  if (!dsn) {
    console.error(`[${scope}]`, message, event.extra);
    return;
  }
  try {
    const body = JSON.stringify(event);
    void fetch(dsn, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body }).catch(() => null);
  } catch {
    console.error(`[${scope}]`, message, { requestId });
  }
}
