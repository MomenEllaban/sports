import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireRole } from '@/lib/auth/guards';
import bcrypt from 'bcryptjs';
import { Role } from '@prisma/client';

export async function GET() {
  try {
    const { error } = await requireRole('SUPER_ADMIN');
    if (error) return error;

    const users = await prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        branchIds: true,
        isActive: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ success: true, users });
  } catch {
    return NextResponse.json({ success: false, error: 'فشل استرجاع المستخدمين' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { error } = await requireRole('SUPER_ADMIN');
    if (error) return error;

    const body = await req.json();
    const { name, email, password, phone, role, branchIds, isActive, managerPin } = body;

    if (typeof name !== 'string' || typeof email !== 'string' || typeof password !== 'string' || !name.trim() || !email.trim() || !password) {
      return NextResponse.json(
        { success: false, error: 'الاسم والبريد الإلكتروني وكلمة المرور مطلوبة' },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { success: false, error: 'يجب أن لا تقل كلمة المرور عن 8 أحرف' },
        { status: 400 }
      );
    }
    if (role && !Object.values(Role).includes(role)) {
      return NextResponse.json({ success: false, error: 'دور غير صالح' }, { status: 400 });
    }
    if (managerPin !== undefined && managerPin !== '' && !/^\d{4,8}$/.test(String(managerPin))) {
      return NextResponse.json({ success: false, error: 'PIN must be 4-8 digits' }, { status: 400 });
    }
    if (branchIds !== undefined && (!Array.isArray(branchIds) || branchIds.some((id: unknown) => typeof id !== 'string'))) {
      return NextResponse.json({ success: false, error: 'branchIds must be an array of strings' }, { status: 400 });
    }

    const existing = await prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
    });

    if (existing) {
      return NextResponse.json(
        { success: false, error: 'هذا البريد الإلكتروني مسجل بالفعل لمستخدم آخر' },
        { status: 409 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const managerPinHash = managerPin ? await bcrypt.hash(String(managerPin), 10) : undefined;

    const user = await prisma.user.create({
      data: {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        passwordHash,
        phone: phone ? phone.trim() : null,
        role: (role as Role) || Role.STAFF,
        branchIds: Array.isArray(branchIds) ? branchIds : [],
        isActive: typeof isActive === 'boolean' ? isActive : true,
        ...(managerPinHash ? { managerPinHash } : {}),
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        branchIds: true,
        isActive: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ success: true, user }, { status: 201 });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: (err as Error).message || 'فشل إنشاء المستخدم' },
      { status: 500 }
    );
  }
}
