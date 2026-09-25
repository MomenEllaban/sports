import { apiError } from '@/lib/api-response';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireRole } from '@/lib/auth/guards';
import { writeAudit } from '@/lib/audit';
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
    return apiError('INTERNAL_ERROR', 'فشل استرجاع المستخدمين', 500);
  }
}

export async function POST(req: Request) {
  try {
    const { error, session } = await requireRole('SUPER_ADMIN');
    if (error) return error;

    const body = await req.json();
    const { name, email, password, phone, role, branchIds, isActive, managerPin } = body;
    const actorId = (session?.user as { id?: string } | undefined)?.id;

    if (typeof name !== 'string' || typeof email !== 'string' || typeof password !== 'string' || !name.trim() || !email.trim() || !password) {
      return apiError('VALIDATION_ERROR', 'الاسم والبريد الإلكتروني وكلمة المرور مطلوبة', 400);
    }

    if (password.length < 8) {
      return apiError('VALIDATION_ERROR', 'يجب أن لا تقل كلمة المرور عن 8 أحرف', 400);
    }
    if (role && !Object.values(Role).includes(role)) {
      return apiError('VALIDATION_ERROR', 'دور غير صالح', 400);
    }
    if (managerPin !== undefined && managerPin !== '' && !/^\d{4,8}$/.test(String(managerPin))) {
      return apiError('VALIDATION_ERROR', 'PIN must be 4-8 digits', 400);
    }
    if (branchIds !== undefined && (!Array.isArray(branchIds) || branchIds.some((id: unknown) => typeof id !== 'string'))) {
      return apiError('VALIDATION_ERROR', 'branchIds must be an array of strings', 400);
    }

    const existing = await prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
    });

    if (existing) {
      return apiError('CONFLICT', 'هذا البريد الإلكتروني مسجل بالفعل لمستخدم آخر', 409);
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

    // Never log the password or the PIN — only that they were set.
    void writeAudit({
      actorId,
      action: 'user.created',
      entity: 'User',
      entityId: user.id,
      metadata: {
        email: user.email,
        role: user.role,
        branchIds: user.branchIds,
        isActive: user.isActive,
        passwordSet: true,
        managerPinSet: Boolean(managerPinHash),
      },
    });

    return NextResponse.json({ success: true, user }, { status: 201 });
  } catch (err: unknown) {
    return apiError('INTERNAL_ERROR', String((err as Error).message || 'فشل إنشاء المستخدم'), 500);
  }
}
