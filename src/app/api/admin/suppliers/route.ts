import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireRole } from '@/lib/auth/guards';

export async function GET() {
  try {
    const suppliers = await prisma.supplier.findMany({ orderBy: { name: 'asc' } });
    return NextResponse.json({ success: true, suppliers });
  } catch {
    return NextResponse.json({ success: false, error: 'Failed' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { error } = await requireRole('SUPER_ADMIN', 'BRANCH_MANAGER');
    if (error) return error;

    const body = await req.json();
    const { name, contactPerson, phone, email, address, taxNumber } = body;

    if (!name) {
      return NextResponse.json({ success: false, error: 'اسم المورد مطلوب' }, { status: 400 });
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
    console.error('Supplier create error:', e);
    return NextResponse.json({ success: false, error: 'فشل في إضافة المورد' }, { status: 500 });
  }
}
