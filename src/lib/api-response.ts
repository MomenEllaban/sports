import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { captureError } from '@/lib/monitor';

export type ApiErrorCode =
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'VALIDATION_ERROR'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'RATE_LIMITED'
  | 'INTERNAL_ERROR'
  | string;

export interface ApiErrorBody {
  success: false;
  error: {
    code: ApiErrorCode;
    message: string;
    requestId: string;
  };
}

export function getRequestId(request?: Request): string {
  const supplied = request?.headers.get('x-request-id')?.trim();
  return supplied && /^[a-zA-Z0-9._:-]{1,100}$/.test(supplied) ? supplied : randomUUID();
}

export function apiError(
  code: ApiErrorCode,
  message: string,
  status: number,
  requestId: string = randomUUID(),
  extra: Record<string, unknown> = {},
): NextResponse<ApiErrorBody & Record<string, unknown>> {
  return NextResponse.json(
    { success: false, error: { code, message, requestId }, message, ...extra },
    { status, headers: { 'x-request-id': requestId } },
  );
}

export function apiInternalError(
  request: Request | undefined,
  error: unknown,
  message = 'حدث خطأ داخلي. حاول مرة أخرى.',
): NextResponse<ApiErrorBody> {
  const requestId = getRequestId(request);
  captureError('api/unexpected', error, { requestId });
  return apiError('INTERNAL_ERROR', message, 500, requestId);
}

export function apiSuccess<T extends Record<string, unknown>>(
  data: T,
  status = 200,
  requestId: string = randomUUID(),
): NextResponse<T & { success: true; requestId: string }> {
  return NextResponse.json(
    { ...data, success: true, requestId },
    { status, headers: { 'x-request-id': requestId } },
  );
}
