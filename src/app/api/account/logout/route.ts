import { NextResponse } from 'next/server';
import { clearPortalCookieHeader } from '@/lib/account/session';

export async function POST() {
  const res = NextResponse.json({ success: true });
  res.headers.append('Set-Cookie', clearPortalCookieHeader());
  return res;
}
