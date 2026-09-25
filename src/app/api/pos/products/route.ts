import { apiError, apiInternalError } from '@/lib/api-response';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireRole, POS_ROLES } from '@/lib/auth/guards';
import { resolvePosContext, PosContextError } from '@/lib/pos/context';
import { num } from '@/lib/pricing';
import type { Role } from '@prisma/client';

const BRANCH_FIELDS = { id: true, name: true, nameEn: true } as const;

/**
 * Branches the current POS user may sell from:
 * - SUPER_ADMIN: every active branch.
 * - BRANCH_MANAGER: only the active branches assigned to them.
 * - CASHIER: none (their home branch is resolved server-side by resolvePosContext).
 */
async function selectableBranches(role: Role | undefined, userId: string | undefined) {
  if (role === 'SUPER_ADMIN') {
    return prisma.branch.findMany({
      where: { isActive: true },
      select: BRANCH_FIELDS,
      orderBy: { name: 'asc' },
    });
  }
  if (role === 'BRANCH_MANAGER' && userId) {
    const me = await prisma.user.findUnique({ where: { id: userId }, select: { branchIds: true } });
    return prisma.branch.findMany({
      where: { isActive: true, id: { in: me?.branchIds ?? [] } },
      select: BRANCH_FIELDS,
      orderBy: { name: 'asc' },
    });
  }
  return [];
}

export async function GET(req: Request) {
  try {
    const { error, session } = await requireRole(...POS_ROLES);
    if (error) return error;

    const role = session!.user?.role as Role | undefined;
    const userId = session!.user?.id;
    const branchParam = new URL(req.url).searchParams.get('branchId');
    const q = (new URL(req.url).searchParams.get('q') || '').trim().slice(0, 60);

    let ctx;
    try {
      ctx = await resolvePosContext(session!, branchParam);
    } catch (e) {
      const err = e as PosContextError;
      // Managers/admins must choose a branch explicitly. Instead of dead-ending
      // the first load with "select a branch", return the branches they can pick
      // from so the POS can render a selector and let them continue.
      if (err.status === 422 && !branchParam && (role === 'BRANCH_MANAGER' || role === 'SUPER_ADMIN')) {
        const branches = await selectableBranches(role, userId);
        return NextResponse.json({
          success: true,
          needsBranch: true,
          products: [],
          branch: null,
          branches,
          filters: { categories: [], brands: [] },
        });
      }
      return apiError('REQUEST_FAILED', String(err.message), err.status || 400);
    }

    const [products, categories, brands] = await Promise.all([
      prisma.product.findMany({
        where: {
          isActive: true,
          ...(q ? { OR: [
            { nameAr: { contains: q, mode: 'insensitive' } },
            { nameEn: { contains: q, mode: 'insensitive' } },
            { sku: { contains: q, mode: 'insensitive' } },
            { barcode: { contains: q, mode: 'insensitive' } },
          ] } : {}),
        },
        ...(q ? { take: 50 } : {}),
        select: {
          id: true, sku: true, barcode: true, nameAr: true, nameEn: true, price: true,
          categoryId: true, brandId: true,
          category: { select: { id: true, nameAr: true, nameEn: true } },
          brand: { select: { id: true, nameAr: true, nameEn: true } },
          inventories: { where: { branchId: ctx.branch.id }, select: { stockQuantity: true } },
        },
        orderBy: { nameAr: 'asc' },
      }),
      prisma.category.findMany({ where: { products: { some: { isActive: true } } }, select: { id: true, nameAr: true, nameEn: true }, orderBy: { nameAr: 'asc' } }),
      prisma.brand.findMany({ where: { products: { some: { isActive: true } } }, select: { id: true, nameAr: true, nameEn: true }, orderBy: { nameAr: 'asc' } }),
    ]);

    // Branch options for managers/admins who may switch branches explicitly.
    const branches = await selectableBranches(ctx.role, userId);

    return NextResponse.json({
      success: true,
      // T10: Decimal -> number at the API boundary.
      products: products.map((p) => ({ ...p, price: num(p.price) })),
      branch: ctx.branch,
      branches,
      filters: { categories, brands },
    });
  } catch (error) {
    return apiInternalError(req, error, 'تعذر تحميل منتجات POS');
  }
}
