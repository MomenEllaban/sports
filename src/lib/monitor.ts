/**
 * Error monitoring hook (F1): Sentry-compatible.
 * - `SENTRY_DSN` set → POSTs a minimal event to the DSN endpoint (best-effort).
 * - unset → console.error only. Never throws, never blocks the request.
 */
export function captureError(scope: string, err: unknown, extra?: Record<string, unknown>): void {
  const dsn = process.env.SENTRY_DSN;
  const message = err instanceof Error ? err.message : String(err);
  if (!dsn) {
    console.error(`[${scope}]`, message, extra ?? '');
    return;
  }
  try {
    const body = JSON.stringify({ scope, message, extra: extra ?? null, at: new Date().toISOString() });
    void fetch(dsn, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body }).catch(() => null);
  } catch {
    console.error(`[${scope}]`, message);
  }
}
