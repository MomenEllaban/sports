import { apiError } from '@/lib/api-response';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { num } from '@/lib/pricing';
import { requireRole } from '@/lib/auth/guards';
import { writeAudit } from '@/lib/audit';
import { captureError } from '@/lib/monitor';

/** Supplier payments ledger (T13): list + record a payment. */
export async function GET() {
  try {
    const { error } = await requireRole('SUPER_ADMIN', 'BRANCH_MANAGER', 'FINANCE');
    if (error) return error;
    const rows = await prisma.supplierPayment.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: { supplier: { select: { name: true } } },
    });
    return NextResponse.json({ success: true, payments: rows.map((r) => ({ ...r, amount: num(r.amount) })) });
  } catch (e) {
    captureError('admin/supplier-payments GET', e);
    return apiError('INTERNAL_ERROR', 'تعذر الجلب', 500);
  }
}

export async function POST(req: Request) {
  try {
    const { error, session } = await requireRole('SUPER_ADMIN', 'BRANCH_MANAGER', 'FINANCE');
    if (error) return error;
    const body = (await req.json()) as { supplierId?: string; amount?: number; method?: string; reference?: string; notes?: string };
    if (!body.supplierId) return apiError('VALIDATION_ERROR', 'المورد مطلوب', 400);
    const amount = Math.round(Number(body.amount) * 100) / 100;
    if (!Number.isFinite(amount) || amount <= 0) {
      return apiError('VALIDATION_ERROR', 'المبلغ غير صالح', 400);
    }
    const supplier = await prisma.supplier.findUnique({ where: { id: body.supplierId } });
    if (!supplier) return apiError('NOT_FOUND', 'المورد غير موجود', 404);
    const created = await prisma.supplierPayment.create({
      data: {
        supplierId: supplier.id,
        amount,
        method: typeof body.method === 'string' && body.method ? body.method.slice(0, 20).toUpperCase() : 'CASH',
        reference: typeof body.reference === 'string' ? body.reference.slice(0, 100) : null,
        notes: typeof body.notes === 'string' ? body.notes.slice(0, 500) : null,
        createdById: (session?.user as { id?: string })?.id,
      },
    });
    writeAudit({ actorId: (session?.user as { id?: string })?.id, action: 'supplier.pay', entity: 'Supplier', entityId: supplier.id, metadata: { amount } }).catch(() => null);
    return NextResponse.json({ success: true, payment: { ...created, amount: num(created.amount) } });
  } catch (e) {
    captureError('admin/supplier-payments POST', e);
    return apiError('INTERNAL_ERROR', 'تعذر الحفظ', 500);
  }
}
