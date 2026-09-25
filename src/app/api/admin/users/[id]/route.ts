import { apiError } from '@/lib/api-response';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireRole } from '@/lib/auth/guards';
import { writeAudit } from '@/lib/audit';
import bcrypt from 'bcryptjs';
import { Role } from '@prisma/client';

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error, session } = await requireRole('SUPER_ADMIN');
    if (error) return error;

    const { id } = await params;
    const body = await req.json();

    const updateData: {
      name?: string;
      email?: string;
      phone?: string | null;
      role?: Role;
      branchIds?: string[];
      isActive?: boolean;
      passwordHash?: string;
      managerPinHash?: string;
      pinFailedAttempts?: number;
      pinLockedUntil?: Date | null;
    } = {};

    if (body.name) updateData.name = body.name.trim();
    if (body.email) updateData.email = body.email.trim().toLowerCase();
    if (typeof body.phone !== 'undefined') updateData.phone = body.phone ? body.phone.trim() : null;
    if (body.role) {
      if (!Object.values(Role).includes(body.role)) {
        return apiError('VALIDATION_ERROR', 'دور غير صالح', 400);
      }
      updateData.role = body.role as Role;
    }
    if (Array.isArray(body.branchIds)) updateData.branchIds = body.branchIds;
    if (typeof body.isActive === 'boolean') updateData.isActive = body.isActive;

    if (body.password && body.password.length >= 6) {
      updateData.passwordHash = await bcrypt.hash(body.password, 10);
    }

    // Manager discount PIN (SUPER_ADMIN only, 4-8 digits, stored as bcrypt hash).
    if (typeof body.managerPin !== 'undefined' && body.managerPin !== '') {
      if (!/^\d{4,8}$/.test(String(body.managerPin))) {
        return apiError('VALIDATION_ERROR', 'PIN must be 4-8 digits', 400);
      }
      updateData.managerPinHash = await bcrypt.hash(String(body.managerPin), 10);
      updateData.pinFailedAttempts = 0;
      updateData.pinLockedUntil = null;
    }

    // Nobody may change their own role or deactivate themselves (anti lock-out).
    const selfId = (session?.user as { id?: string } | undefined)?.id;
    if (selfId && selfId === id && (updateData.role || updateData.isActive === false)) {
      return apiError('FORBIDDEN', 'لا يمكنك تغيير دورك أو تعطيل حسابك بنفسك', 403);
    }

    // Check email uniqueness if email changed
    if (updateData.email) {
      const existing = await prisma.user.findFirst({
        where: { email: updateData.email, NOT: { id } },
      });
      if (existing) {
        return apiError('CONFLICT', 'هذا البريد الإلكتروني مستخدم بالفعل', 409);
      }
    }

    // Capture the pre-change values so the audit trail records the *change*,
    // not just the new state. Only security-relevant fields are captured.
    const before = await prisma.user.findUnique({
      where: { id },
      select: { role: true, isActive: true, branchIds: true, email: true },
    });
    if (!before) {
      return apiError('NOT_FOUND', 'المستخدم غير موجود', 404);
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: updateData,
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

    // One entry per kind of change keeps the trail searchable: a role change is
    // not buried inside a generic "user.updated" row. Secrets are never logged,
    // only that they were set.
    const actorId = (session?.user as { id?: string } | undefined)?.id;
    const base = { actorId, entity: 'User', entityId: id };
    if (before.role !== updatedUser.role) {
      void writeAudit({ ...base, action: 'user.role_changed', metadata: { from: before.role, to: updatedUser.role } });
    }
    if (before.isActive !== updatedUser.isActive) {
      void writeAudit({ ...base, action: 'user.access_changed', metadata: { isActive: { from: before.isActive, to: updatedUser.isActive } } });
    }
    if (JSON.stringify(before.branchIds) !== JSON.stringify(updatedUser.branchIds)) {
      void writeAudit({ ...base, action: 'user.branches_changed', metadata: { from: before.branchIds, to: updatedUser.branchIds } });
    }
    if (updateData.passwordHash) {
      void writeAudit({ ...base, action: 'user.password_changed', metadata: { email: updatedUser.email } });
    }
    if (updateData.managerPinHash) {
      void writeAudit({ ...base, action: 'user.manager_pin_changed', metadata: { email: updatedUser.email } });
    }
    if (before.email !== updatedUser.email) {
      void writeAudit({ ...base, action: 'user.email_changed', metadata: { from: before.email, to: updatedUser.email } });
    }

    return NextResponse.json({ success: true, user: updatedUser });
  } catch (err: unknown) {
    return apiError('INTERNAL_ERROR', String((err as Error).message || 'فشل تحديث بيانات المستخدم'), 500);
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error, session } = await requireRole('SUPER_ADMIN');
    if (error) return error;

    const { id } = await params;

    // Prevent user from deleting themselves
    const sessionEmail = session?.user?.email;
    const sessionUser = session?.user as { id?: string; email?: string } | undefined;
    if (sessionUser?.id === id) {
      return apiError('VALIDATION_ERROR', 'لا يمكنك حذف حسابك الشخصي الذي سجلت به الدخول', 400);
    }

    const targetUser = await prisma.user.findUnique({ where: { id } });
    if (!targetUser) {
      return apiError('NOT_FOUND', 'المستخدم غير موجود', 404);
    }

    if (sessionEmail && targetUser.email === sessionEmail) {
      return apiError('VALIDATION_ERROR', 'لا يمكنك حذف حسابك الشخصي الذي سجلت به الدخول', 400);
    }

    await prisma.user.delete({ where: { id } });

    void writeAudit({
      actorId: (session?.user as { id?: string } | undefined)?.id,
      action: 'user.deleted',
      entity: 'User',
      entityId: id,
      metadata: { email: targetUser.email, role: targetUser.role, isActive: targetUser.isActive },
    });

    return NextResponse.json({ success: true, message: 'تم حذف المستخدم بنجاح' });
  } catch (err: unknown) {
    return apiError('INTERNAL_ERROR', String((err as Error).message || 'فشل حذف المستخدم'), 500);
  }
}
