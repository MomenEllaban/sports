import { captureError } from '@/lib/monitor';
import { apiError } from '@/lib/api-response';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireRole } from '@/lib/auth/guards';
import { canAccessBranch } from '@/lib/auth/branch-scope';
import { num, money } from '@/lib/pricing';

function fail(message: string, status = 400) {
  return apiError(status === 401 ? 'UNAUTHORIZED' : status === 403 ? 'FORBIDDEN' : status === 404 ? 'NOT_FOUND' : status === 409 ? 'CONFLICT' : 'VALIDATION_ERROR', message, status);
}

function normalizeLines(raw: unknown): Array<{ productId: string; quantityOrdered: number; unitCost: number }> | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const seen = new Set<string>();
  const lines: Array<{ productId: string; quantityOrdered: number; unitCost: number }> = [];
  for (const value of raw) {
    const item = value as { productId?: unknown; quantityOrdered?: unknown; unitCost?: unknown };
    if (typeof item.productId !== 'string' || !item.productId || seen.has(item.productId)) return null;
    if (typeof item.quantityOrdered !== 'number' || !Number.isSafeInteger(item.quantityOrdered) || item.quantityOrdered <= 0) return null;
    if (typeof item.unitCost !== 'number' || !Number.isFinite(item.unitCost) || item.unitCost < 0) return null;
    seen.add(item.productId);
    lines.push({ productId: item.productId, quantityOrdered: item.quantityOrdered, unitCost: money(item.unitCost) });
  }
  return lines;
}

export async function POST(req: Request) {
  try {
    const { error, session } = await requireRole('SUPER_ADMIN', 'BRANCH_MANAGER');
    if (error) return error;
    const body = await req.json() as { intent?: unknown; supplierId?: unknown; branchId?: unknown; notes?: unknown; items?: unknown };
    const actorId = session?.user?.id;
    if (!actorId) return fail('جلسة المستخدم غير صالحة', 401);
    if (body.intent !== 'draft' && body.intent !== 'confirm') return fail('intent يجب أن يكون draft أو confirm');
    if (typeof body.supplierId !== 'string' || !body.supplierId || typeof body.branchId !== 'string' || !body.branchId) return fail('المورد والفرع مطلوبان');
    if (!canAccessBranch(session, body.branchId)) return fail('لا تملك صلاحية هذا الفرع', 403);
    const lines = normalizeLines(body.items);
    if (!lines) return fail('أصناف أمر التوريد غير صالحة أو مكررة');

    const [supplier, branch, products] = await Promise.all([
      prisma.supplier.findUnique({ where: { id: body.supplierId }, select: { id: true } }),
      prisma.branch.findFirst({ where: { id: body.branchId, isActive: true }, select: { id: true } }),
      prisma.product.findMany({ where: { id: { in: lines.map((line) => line.productId) }, isActive: true }, select: { id: true } }),
    ]);
    if (!supplier) return fail('المورد غير موجود');
    if (!branch) return fail('الفرع غير صالح');
    if (products.length !== new Set(lines.map((line) => line.productId)).size) return fail('أحد الأصناف غير موجود أو موقوف');

    const totalAmount = money(lines.reduce((sum, line) => sum + line.quantityOrdered * line.unitCost, 0));
    const poNumber = `PO-${new Date().getUTCFullYear()}-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 900 + 100)}`;
    const status = body.intent === 'draft' ? 'DRAFT' : 'SUBMITTED';
    const created = await prisma.$transaction(async (tx) => {
      const po = await tx.purchaseOrder.create({
        data: {
          poNumber,
          supplierId: supplier.id,
          branchId: branch.id,
          status,
          totalAmount,
          notes: typeof body.notes === 'string' ? body.notes.trim().slice(0, 1000) || null : null,
          createdById: actorId,
          items: { create: lines },
        },
        include: { items: true, supplier: true, branch: true },
      });
      await tx.auditLog.create({
        data: {
          actorId: session?.user?.id || null,
          action: status === 'DRAFT' ? 'purchase_order.draft_created' : 'purchase_order.confirmed',
          entity: 'PurchaseOrder',
          entityId: po.id,
          branchId: branch.id,
          metadata: JSON.stringify({ poNumber, totalAmount, lineCount: lines.length }),
        },
      });
      return po;
    });
    const createdRecord = created as unknown as { id: string; totalAmount: unknown; items: Array<{ unitCost: unknown }> };
    return NextResponse.json({ success: true, purchaseOrder: { ...created, totalAmount: num(createdRecord.totalAmount), items: createdRecord.items.map((item) => ({ ...item, unitCost: num(item.unitCost) })) } });
  } catch (error) {
    captureError('api/admin/purchase-orders', error);
    return apiError('INTERNAL_ERROR', 'تعذر حفظ أمر التوريد', 500);
  }
}
