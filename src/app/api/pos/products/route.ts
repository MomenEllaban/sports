import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireRole, POS_ROLES } from '@/lib/auth/guards';
import { resolvePosContext, PosContextError } from '@/lib/pos/context';

export async function GET(req: Request) {
  try {
    const { error, session } = await requireRole(...POS_ROLES);
    if (error) return error;

    const branchParam = new URL(req.url).searchParams.get('branchId');
    let ctx;
    try {
      ctx = await resolvePosContext(session!, branchParam);
    } catch (e) {
      const err = e as PosContextError;
      return NextResponse.json({ success: false, error: err.message }, { status: err.status || 400 });
    }

    const products = await prisma.product.findMany({
      where: { isActive: true },
      include: {
        inventories: {
          where: { branchId: ctx.branch.id },
        },
      },
      orderBy: { nameAr: 'asc' },
    });

    // Branch options for managers/admins who may switch branches explicitly.
    const role = ctx.role;
    const branches =
      role === 'BRANCH_MANAGER' || role === 'SUPER_ADMIN'
        ? await prisma.branch.findMany({ where: { isActive: true }, select: { id: true, name: true, nameEn: true } })
        : [];

    return NextResponse.json({ success: true, products, branch: ctx.branch, branches });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ success: false, products: [] }, { status: 500 });
  }
}
