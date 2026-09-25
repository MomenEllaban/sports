import { clearPortalCookieHeader } from '@/lib/account/session';
import { apiSuccess, getRequestId } from '@/lib/api-response';

export async function POST(request: Request) {
  const res = apiSuccess({}, 200, getRequestId(request));
  res.headers.append('Set-Cookie', clearPortalCookieHeader());
  return res;
}
