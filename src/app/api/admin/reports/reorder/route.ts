import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireRole } from '@/lib/auth/guards';
import { canAccessBranch, scopedBranchIds } from '@/lib/auth/branch-scope';
import { getReorderRows } from '@/lib/reports/reorder';

function fail(message: string, status = 400) { return NextResponse.json({ success: false, error: message }, { status }); }

export async function GET(req: Request) {
  try {
    const { error, session } = await requireRole('SUPER_ADMIN', 'BRANCH_MANAGER', 'FINANCE');
    if (error) return error;
    const params = new URL(req.url).searchParams;
    const requested = params.get('requested');
    const allowed = scopedBranchIds(session);
    const requestedBranch = params.get('branch') || undefined;
    const branchId = allowed === null ? requestedBranch : requestedBranch && allowed.includes(requestedBranch) ? requestedBranch : allowed[0] || '__no_branch__';
    const result = await getReorderRows({ q: params.get('q') || undefined, branchId, page: Math.max(1, Number(params.get('page') || 1)), pageSize: Math.min(100, Math.max(5, Number(params.get('pageSize') || 25))), requested: requested === 'requested' || requested === 'unrequested' ? requested : undefined });
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('Reorder report error:', error);
    return NextResponse.json({ success: false, error: 'تعذر تحميل كشكول النواقص' }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const { error, session } = await requireRole('SUPER_ADMIN', 'BRANCH_MANAGER');
    if (error) return error;
    const body = await req.json() as { branchInventoryId?: unknown; reorderPoint?: unknown; reorderQuantity?: unknown };
    if (typeof body.branchInventoryId !== 'string' || !Number.isSafeInteger(body.reorderPoint) || Number(body.reorderPoint) < 0 || !Number.isSafeInteger(body.reorderQuantity) || Number(body.reorderQuantity) <= 0) return fail('قيم حد إعادة الطلب غير صالحة');
    const row = await prisma.branchInventory.findUnique({ where: { id: body.branchInventoryId } });
    if (!row) return fail('سجل المخزون غير موجود', 404);
    if (!canAccessBranch(session, row.branchId)) return fail('هذا السجل خارج نطاق فروعك', 403);
    const updated = await prisma.branchInventory.update({ where: { id: row.id }, data: { reorderPoint: Number(body.reorderPoint), reorderQuantity: Number(body.reorderQuantity) } });
    return NextResponse.json({ success: true, reorderPoint: updated.reorderPoint, reorderQuantity: updated.reorderQuantity });
  } catch (error) {
    console.error('Reorder policy update error:', error);
    return NextResponse.json({ success: false, error: 'تعذر حفظ حد إعادة الطلب' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { error, session } = await requireRole('SUPER_ADMIN', 'BRANCH_MANAGER');
    if (error) return error;
    const body = await req.json() as { items?: unknown; note?: unknown; neededAt?: unknown };
    if (!Array.isArray(body.items) || body.items.length === 0) return fail('اختر صنفًا واحدًا على الأقل');
    const actorId = session?.user?.id;
    if (!actorId) return fail('جلسة غير صالحة', 401);
    const inputs = body.items as Array<{ branchInventoryId?: unknown; supplierId?: unknown; quantity?: unknown }>;
    const created = await prisma.$transaction(async (tx) => {
      const records = [];
      for (const input of inputs) {
        if (typeof input.branchInventoryId !== 'string' || !Number.isSafeInteger(input.quantity) || Number(input.quantity) <= 0) throw new Error('INVALID');
        const inventory = await tx.branchInventory.findUnique({ where: { id: input.branchInventoryId }, include: { product: { select: { isActive: true, costPrice: true } } } });
        if (!inventory || !inventory.product.isActive || !canAccessBranch(session, inventory.branchId)) throw new Error('FORBIDDEN');
        const record = await tx.reorderRequest.create({ data: { branchInventoryId: inventory.id, productId: inventory.productId, supplierId: typeof input.supplierId === 'string' && input.supplierId ? input.supplierId : null, requestedById: actorId, neededAt: typeof body.neededAt === 'string' && body.neededAt ? new Date(body.neededAt) : null, note: typeof body.note === 'string' ? body.note.trim().slice(0, 500) || null : null, quantity: Number(input.quantity), unitCost: inventory.product.costPrice } });
        records.push(record);
      }
      await tx.auditLog.create({ data: { actorId, action: 'reorder.requested', entity: 'ReorderRequest', entityId: records[0]?.id, metadata: JSON.stringify({ count: records.length, note: body.note || null }) } });
      return records;
    });
    return NextResponse.json({ success: true, requests: created.map((record) => ({ id: record.id, requestedAt: record.requestedAt })) });
  } catch (error) {
    if (error instanceof Error && error.message === 'FORBIDDEN') return fail('أحد الأصناف خارج نطاق فروعك', 403);
    if (error instanceof Error && error.message === 'INVALID') return fail('عناصر الطلب غير صالحة');
    console.error('Reorder request error:', error);
    return NextResponse.json({ success: false, error: 'تعذر تسجيل طلبات النواقص' }, { status: 500 });
  }
}
