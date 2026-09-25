import { captureError } from '@/lib/monitor';
import { apiError } from '@/lib/api-response';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireRole } from '@/lib/auth/guards';

export async function POST(req: Request) {
  try {
    const { error } = await requireRole('SUPER_ADMIN', 'BRANCH_MANAGER');
    if (error) return error;

    const body = await req.json();
    const { phone, name, email, notes } = body;

    if (!phone || String(phone).trim().length < 7) {
      return apiError('VALIDATION_ERROR', 'رقم الموبايل مطلوب (7 أرقام على الأقل)', 400);
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
      return apiError('CONFLICT', 'رقم الموبايل مسجل بالفعل', 409);
    }
    captureError('api/admin/customers', e);
    return apiError('INTERNAL_ERROR', 'فشل في إضافة العميل', 500);
  }
}
