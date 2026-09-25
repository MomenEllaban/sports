'use client';

export const FETCH_ERROR_EVENT = 'app:fetch-error';
export const AUTH_REQUIRED_EVENT = 'app:auth-required';
export const FORBIDDEN_EVENT = 'app:forbidden';

export interface ClientApiErrorOptions {
  status: number;
  code: string;
  requestId?: string;
  retryable?: boolean;
  expected?: boolean;
}

export class ClientApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly requestId?: string;
  readonly retryable: boolean;
  readonly expected: boolean;

  constructor(message: string, options: ClientApiErrorOptions) {
    super(message);
    this.name = 'ClientApiError';
    this.status = options.status;
    this.code = options.code;
    this.requestId = options.requestId;
    this.retryable = options.retryable ?? (options.status >= 500 || options.status === 0);
    this.expected = options.expected ?? (options.status === 401 || options.status === 403);
  }
}

type ErrorPayload = {
  error?: { code?: unknown; message?: unknown; requestId?: unknown } | string;
  code?: unknown;
  message?: unknown;
  requestId?: unknown;
};

type RequestOptions = RequestInit & {
  timeoutMs?: number;
  /** Do not ask the global handler to redirect for an expected guest 401. */
  suppressAuthRedirect?: boolean;
  /** Suppress global events for an expected response handled by the caller. */
  suppressErrorEvents?: boolean;
  /** A stable key used to de-duplicate retries/toasts for the same operation. */
  errorKey?: string;
};

const lastReported = new Map<string, number>();
const lastDispatched = new Map<string, number>();

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function errorInfo(payload: unknown, fallback: string) {
  const data = isRecord(payload) ? payload as ErrorPayload : undefined;
  const nested = data?.error;
  if (nested && typeof nested === 'object') {
    return {
      code: typeof nested.code === 'string' ? nested.code : 'REQUEST_FAILED',
      message: typeof nested.message === 'string' ? nested.message : fallback,
      requestId: typeof nested.requestId === 'string' ? nested.requestId : undefined,
    };
  }
  return {
    code: typeof data?.code === 'string' ? data.code : typeof nested === 'string' ? 'REQUEST_FAILED' : 'REQUEST_FAILED',
    message: typeof nested === 'string' ? nested : typeof data?.message === 'string' ? data.message : fallback,
    requestId: typeof data?.requestId === 'string' ? data.requestId : undefined,
  };
}

export function getClientErrorMessage(error: unknown, fallback = 'حدث خطأ، حاول مرة أخرى'): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

export function reportClientError(error: unknown, scope = 'client'): void {
  if (typeof window === 'undefined') return;
  const now = Date.now();
  const key = `${scope}:${error instanceof Error ? error.message : String(error)}`;
  if (now - (lastReported.get(key) ?? 0) < 30_000) return;
  lastReported.set(key, now);
  // Expected auth/permission states are deliberately not error-level logs.
  if (error instanceof ClientApiError && error.expected) return;
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (dsn) {
    try {
      const body = JSON.stringify({ scope, message: error instanceof Error ? error.message : String(error), at: new Date().toISOString() });
      void fetch(dsn, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body }).catch(() => null);
      return;
    } catch {
      // Fall through to the throttled local log if monitoring is unavailable.
    }
  }
  console.error(`[${scope}]`, error);
}

function dispatchOnce(key: string, eventName: string, detail: unknown): void {
  if (typeof window === 'undefined') return;
  const now = Date.now();
  if (now - (lastDispatched.get(key) ?? 0) < 2_000) return;
  lastDispatched.set(key, now);
  window.dispatchEvent(new CustomEvent(eventName, { detail }));
}

function parseResponseBody(text: string): unknown {
  if (!text) return {};
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return {};
  }
}

/**
 * Browser-side JSON request wrapper shared by Admin, Storefront and POS.
 * It understands both the new `{ error: { code, message } }` envelope and
 * older `{ error: string }` responses while callers migrate.
 */
export async function apiRequest<T = unknown>(input: RequestInfo | URL, options: RequestOptions = {}): Promise<T> {
  const {
    timeoutMs = 20_000,
    suppressAuthRedirect = false,
    suppressErrorEvents = false,
    errorKey = `${typeof input === 'string' ? input : input.toString()}:${options.method ?? 'GET'}`,
    signal,
    ...init
  } = options;
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
  const onAbort = () => controller.abort();
  signal?.addEventListener('abort', onAbort, { once: true });

  const headers = new Headers(init.headers);
  if (!headers.has('Accept')) headers.set('Accept', 'application/json');
  if (init.body && !(init.body instanceof FormData) && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');

  try {
    const response = await fetch(input, {
      ...init,
      signal: controller.signal,
      credentials: init.credentials ?? 'same-origin',
      headers,
    });
    const text = await response.text();
    const payload = parseResponseBody(text);
    if (!response.ok) {
      const info = errorInfo(payload, `Request failed (${response.status})`);
      const expected = response.status === 401 || response.status === 403;
      const error = new ClientApiError(info.message, {
        status: response.status,
        code: info.code,
        requestId: info.requestId,
        expected,
        retryable: response.status >= 500,
      });
      if (!suppressErrorEvents) {
        if (response.status === 401 && !suppressAuthRedirect) {
          dispatchOnce(`${errorKey}:401`, AUTH_REQUIRED_EVENT, { error, path: window.location.pathname });
        } else if (response.status === 403) {
          dispatchOnce(`${errorKey}:403`, FORBIDDEN_EVENT, { error, path: window.location.pathname });
        } else if (!expected) {
          dispatchOnce(`${errorKey}:${response.status}`, FETCH_ERROR_EVENT, {
            error,
            retry: () => apiRequest<T>(input, options),
          });
        }
      }
      if (!expected) reportClientError(error, errorKey);
      throw error;
    }
    if (isRecord(payload) && payload.success === false) {
      const info = errorInfo(payload, 'Request failed');
      throw new ClientApiError(info.message, {
        status: response.status,
        code: info.code,
        requestId: info.requestId,
        expected: false,
      });
    }
    return payload as T;
  } catch (error) {
    if (error instanceof ClientApiError) throw error;
    const networkError = new ClientApiError(
      error instanceof DOMException && error.name === 'AbortError'
        ? 'انتهت مهلة الاتصال. حاول مرة أخرى.'
        : 'تعذر الاتصال بالسيرفر. حاول مرة أخرى.',
      { status: 0, code: 'NETWORK_ERROR', retryable: true },
    );
    if (!suppressErrorEvents) {
      dispatchOnce(`${errorKey}:network`, FETCH_ERROR_EVENT, {
        error: networkError,
        retry: () => apiRequest<T>(input, options),
      });
    }
    reportClientError(networkError, errorKey);
    throw networkError;
  } finally {
    window.clearTimeout(timeout);
    signal?.removeEventListener('abort', onAbort);
  }
}
