import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireRole } from '@/lib/auth/guards.js';

// Create a purchase order (SUBMITTED)
export async function POST(req: Request) {
  try {
    const { session, error } = await requireRole('SUPER_ADMIN', 'BRANCH_MANAGER');
    if (error) return error;

    const body = await req.json();
    const { supplierId, branchId, notes, items } = body;

    if (!supplierId || !branchId) {
      return NextResponse.json({ success: false, error: 'Supplier and branch are required' }, { status: 400 });
    }
    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ success: false, error: 'Add at least one item' }, { status: 400 });
    }
    for (const it of items) {
      if (!it.productId || !(it.quantityOrdered > 0) || !(it.unitCost >= 0)) {
        return NextResponse.json({ success: false, error: 'Invalid PO item' }, { status: 400 });
      }
    }

    const totalAmount = items.reduce((s: number, it: { quantityOrdered: number; unitCost: number }) => s + it.quantityOrdered * it.unitCost, 0);
    const poNumber = `PO-2026-${Math.floor(1000 + Math.random() * 9000)}`;

    const po = await prisma.purchaseOrder.create({
      data: {
        poNumber,
        supplierId,
        branchId,
        status: 'SUBMITTED',
        totalAmount,
        notes: notes || null,
        createdById: (session!.user as { id: string }).id,
        items: {
          create: items.map((it: { productId: string; quantityOrdered: number; unitCost: number }) => ({
            productId: it.productId,
            quantityOrdered: Math.floor(it.quantityOrdered),
            unitCost: Number(it.unitCost),
          })),
        },
      },
      include: { items: true },
    });

    return NextResponse.json({ success: true, purchaseOrder: po });
  } catch (e) {
    console.error('Admin PO create error:', e);
    return NextResponse.json({ success: false, error: 'Failed to create purchase order' }, { status: 500 });
  }
}
