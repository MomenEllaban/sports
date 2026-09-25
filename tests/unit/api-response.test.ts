import { describe, expect, it } from 'vitest';
import { apiError, apiSuccess } from '@/lib/api-response';

describe('API response envelope', () => {
  it('returns a structured error with a request id and compatibility message', async () => {
    const response = apiError('VALIDATION_ERROR', 'قيمة غير صالحة', 400, 'req-test');
    const body = await response.json();
    expect(response.status).toBe(400);
    expect(body).toMatchObject({
      success: false,
      message: 'قيمة غير صالحة',
      error: { code: 'VALIDATION_ERROR', message: 'قيمة غير صالحة', requestId: 'req-test' },
    });
    expect(response.headers.get('x-request-id')).toBe('req-test');
  });

  it('keeps successful payloads successful and traceable', async () => {
    const response = apiSuccess({ value: 7 }, 201, 'req-ok');
    const body = await response.json();
    expect(response.status).toBe(201);
    expect(body).toEqual({ value: 7, success: true, requestId: 'req-ok' });
  });
});
