import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdminSession } from '@/lib/admin-guard';

export async function POST(req: Request) {
  try {
    const { error } = await requireAdminSession();
    if (error) return error;

    const body = await req.json();
    const { phone, name, email, notes } = body;

    if (!phone || String(phone).trim().length < 7) {
      return NextResponse.json(
        { success: false, error: 'رقم الموبايل مطلوب (7 أرقام على الأقل)' },
        { status: 400 }
      );
    }

    const customer = await prisma.customer.create({
      data: {
        phone: String(phone).trim(),
        name: name ? String(name).trim() : null,
        email: email ? String(email).trim() : null,
        notes: notes ? String(notes).trim() : null,
        loyaltyPoints: 0,
      },
    });

    return NextResponse.json({ success: true, customer });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    if (msg.includes('Unique constraint')) {
      return NextResponse.json(
        { success: false, error: 'رقم الموبايل مسجل بالفعل' },
        { status: 409 }
      );
    }
    console.error('Admin customer create error:', e);
    return NextResponse.json(
      { success: false, error: 'فشل في إضافة العميل' },
      { status: 500 }
    );
  }
}
