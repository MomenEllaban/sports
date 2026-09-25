import { captureError } from '@/lib/monitor';
import { apiError } from '@/lib/api-response';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireRole } from '@/lib/auth/guards';

export async function GET() {
  try {
    const { error } = await requireRole('SUPER_ADMIN', 'BRANCH_MANAGER');
    if (error) return error;

    const suppliers = await prisma.supplier.findMany({ orderBy: { name: 'asc' } });
    return NextResponse.json({ success: true, suppliers });
  } catch {
    return apiError('INTERNAL_ERROR', 'Failed', 500);
  }
}

export async function POST(req: Request) {
  try {
    const { error } = await requireRole('SUPER_ADMIN', 'BRANCH_MANAGER');
    if (error) return error;

    const body = await req.json();
    const { name, contactPerson, phone, email, address, taxNumber } = body;

    if (typeof name !== 'string' || !name.trim()) {
      return apiError('VALIDATION_ERROR', 'اسم المورد مطلوب', 400);
    }
    if (email !== undefined && email !== null && email !== '' && !/^\S+@\S+\.\S+$/.test(String(email).trim())) {
      return apiError('VALIDATION_ERROR', 'البريد الإلكتروني غير صالح', 400);
    }

    const code = `SUP-${Date.now()}`;

    const supplier = await prisma.supplier.create({
      data: {
        code,
        name: String(name).trim(),
        contactPerson: contactPerson ? String(contactPerson).trim() : null,
        phone: phone ? String(phone).trim() : null,
        email: email ? String(email).trim() : null,
        address: address ? String(address).trim() : null,
        taxNumber: taxNumber ? String(taxNumber).trim() : null,
      },
    });

    return NextResponse.json({ success: true, supplier });
  } catch (e) {
    captureError('api/admin/suppliers', e);
    return apiError('INTERNAL_ERROR', 'فشل في إضافة المورد', 500);
  }
}
