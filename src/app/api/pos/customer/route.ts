import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const phone = searchParams.get('phone');

    if (!phone || phone.length < 5) {
      return NextResponse.json({ success: false, error: 'رقم موبايل غير كافٍ' }, { status: 400 });
    }

    const customer = await prisma.customer.findFirst({
      where: { phone: { contains: phone } },
      select: { id: true, name: true, phone: true, loyaltyPoints: true },
    });

    if (!customer) {
      return NextResponse.json({ success: false, error: 'العميل غير موجود' });
    }

    return NextResponse.json({ success: true, customer });
  } catch {
    return NextResponse.json({ success: false, error: 'فشل في البحث' }, { status: 500 });
  }
}
