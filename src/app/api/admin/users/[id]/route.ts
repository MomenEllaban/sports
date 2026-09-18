import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdminSession } from '@/lib/admin-guard';
import bcrypt from 'bcryptjs';
import { Role } from '@prisma/client';

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error, session } = await requireAdminSession();
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
    } = {};

    if (body.name) updateData.name = body.name.trim();
    if (body.email) updateData.email = body.email.trim().toLowerCase();
    if (typeof body.phone !== 'undefined') updateData.phone = body.phone ? body.phone.trim() : null;
    if (body.role) updateData.role = body.role as Role;
    if (Array.isArray(body.branchIds)) updateData.branchIds = body.branchIds;
    if (typeof body.isActive === 'boolean') updateData.isActive = body.isActive;

    if (body.password && body.password.length >= 6) {
      updateData.passwordHash = await bcrypt.hash(body.password, 10);
    }

    // Check email uniqueness if email changed
    if (updateData.email) {
      const existing = await prisma.user.findFirst({
        where: { email: updateData.email, NOT: { id } },
      });
      if (existing) {
        return NextResponse.json(
          { success: false, error: 'هذا البريد الإلكتروني مستخدم بالفعل' },
          { status: 409 }
        );
      }
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

    return NextResponse.json({ success: true, user: updatedUser });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: (err as Error).message || 'فشل تحديث بيانات المستخدم' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error, session } = await requireAdminSession();
    if (error) return error;

    const { id } = await params;

    // Prevent user from deleting themselves
    const sessionEmail = session?.user?.email;
    const sessionUser = session?.user as { id?: string; email?: string } | undefined;
    if (sessionUser?.id === id) {
      return NextResponse.json(
        { success: false, error: 'لا يمكنك حذف حسابك الشخصي الذي سجلت به الدخول' },
        { status: 400 }
      );
    }

    const targetUser = await prisma.user.findUnique({ where: { id } });
    if (!targetUser) {
      return NextResponse.json({ success: false, error: 'المستخدم غير موجود' }, { status: 404 });
    }

    if (sessionEmail && targetUser.email === sessionEmail) {
      return NextResponse.json(
        { success: false, error: 'لا يمكنك حذف حسابك الشخصي الذي سجلت به الدخول' },
        { status: 400 }
      );
    }

    await prisma.user.delete({ where: { id } });

    return NextResponse.json({ success: true, message: 'تم حذف المستخدم بنجاح' });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: (err as Error).message || 'فشل حذف المستخدم' },
      { status: 500 }
    );
  }
}
