import { NextResponse } from 'next/server';
import { availablePaymentMethods } from '@/lib/payments';

/** Public: which payment methods checkout may offer right now (T01). */
export async function GET() {
  try {
    return NextResponse.json({ success: true, methods: await availablePaymentMethods() });
  } catch {
    return NextResponse.json({ success: true, methods: ['COD'] });
  }
}
