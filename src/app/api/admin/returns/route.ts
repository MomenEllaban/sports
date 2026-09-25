import { apiError } from '@/lib/api-response';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireRole } from '@/lib/auth/guards';
import { requestReturn, ReturnError } from '@/lib/returns/service';
import { captureError } from '@/lib/monitor';

/** Admin RMA list with filters (T-RMA). */
export async function GET(req: Request) {
  try {
    const { error } = await requireRole('SUPER_ADMIN', 'BRANCH_MANAGER', 'FINANCE');
    if (error) return error;
    const q = new URL(req.url).searchParams;
    const where: Record<string, unknown> = {};
    if (q.get('status')) where.status = String(q.get('status'));
    if (q.get('channel')) where.channel = String(q.get('channel'));
    if (q.get('branch')) where.branchId = String(q.get('branch'));
    if (q.get('reason')) where.items = { some: { reasonCode: String(q.get('reason')) } };
    if (q.get('from') || q.get('to')) {
      where.createdAt = {
        ...(q.get('from') ? { gte: new Date(String(q.get('from'))) } : {}),
        ...(q.get('to') ? { lte: new Date(String(q.get('to'))) } : {}),
      };
    }
    if (q.get('q')) {
      const s = String(q.get('q'));
      where.OR = [
        { returnNumber: { contains: s, mode: 'insensitive' } },
        { customerPhone: { contains: s } },
        { order: { orderNumber: { contains: s, mode: 'insensitive' } } },
      ];
    }
    const rows = await prisma.returnRequest.findMany({
      where: where as never,
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        items: { include: { product: { select: { nameAr: true, nameEn: true, sku: true } } } },
        branch: { select: { name: true, nameEn: true } },
        order: { select: { orderNumber: true, totalAmount: true } },
        sale: { select: { saleNumber: true, totalAmount: true } },
        refunds: { select: { id: true, amount: true, method: true, status: true } },
      },
    });
    return NextResponse.json({ success: true, returns: rows });
  } catch (e) {
    captureError('admin/returns GET', e);
    return apiError('INTERNAL_ERROR', 'تعذر الجلب', 500);
  }
}

/** Admin creates an RMA case (REQUESTED). */
export async function POST(req: Request) {
  try {
    const { error, session } = await requireRole('SUPER_ADMIN', 'BRANCH_MANAGER');
    if (error) return error;
    const body = await req.json();
    try {
      const { request, replay, frequencyWarning } = await requestReturn({
        orderId: body.orderId,
        saleId: body.saleId,
        channel: 'ADMIN',
        branchId: body.branchId,
        items: body.items,
        customerPhone: body.customerPhone,
        notes: body.notes,
        clientRequestId: body.clientRequestId,
        actorId: (session?.user as { id?: string })?.id,
        actorRole: session?.user?.role as string,
      });
      return NextResponse.json({ success: true, return: request, replay: !!replay, frequencyWarning });
    } catch (e) {
      const err = e as ReturnError & { status?: number };
      return apiError('REQUEST_FAILED', String(err.message), err.status || 400);
    }
  } catch (e) {
    captureError('admin/returns POST', e);
    return apiError('INTERNAL_ERROR', 'تعذر الإنشاء', 500);
  }
}

