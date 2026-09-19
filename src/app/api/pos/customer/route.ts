import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireRole, POS_ROLES } from '@/lib/auth/guards.js';

export async function GET(req: Request) {
  try {
    const { error } = await requireRole(...POS_ROLES);
    if (error) return error;

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

export async function POST(req: Request) {
  try {
    const { error } = await requireRole(...POS_ROLES);
    if (error) return error;

    const body = await req.json();
    const { name, phone, email, address } = body;

    if (!name || !phone) {
      return NextResponse.json({ success: false, error: 'الاسم ورقم الهاتف مطلوبان' }, { status: 400 });
    }

    // Check if customer with same phone already exists
    const existing = await prisma.customer.findFirst({
      where: { phone },
    });

    if (existing) {
      return NextResponse.json({ success: true, customer: existing });
    }

    const customer = await prisma.customer.create({
      data: {
        name,
        phone,
        email: email || null,
        notes: address || null,
        loyaltyPoints: 0,
      },
      select: { id: true, name: true, phone: true, loyaltyPoints: true },
    });

    return NextResponse.json({ success: true, customer }, { status: 201 });
  } catch {
    return NextResponse.json({ success: false, error: 'فشل إنشاء العميل' }, { status: 500 });
  }
}

