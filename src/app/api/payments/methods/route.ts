import { availablePaymentMethods } from '@/lib/payments';
import { apiSuccess, getRequestId } from '@/lib/api-response';

/** Public: which payment methods checkout may offer right now (T01). */
export async function GET(request: Request) {
  try {
    return apiSuccess({ methods: await availablePaymentMethods() }, 200, getRequestId(request));
  } catch {
    return apiSuccess({ methods: ['COD'] }, 200, getRequestId(request));
  }
}
