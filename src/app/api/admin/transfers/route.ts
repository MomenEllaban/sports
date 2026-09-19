import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireRole } from '@/lib/auth/guards.js';

// Create a stock transfer request (PENDING)
export async function POST(req: Request) {
  try {
    const { session, error } = await requireRole('SUPER_ADMIN', 'BRANCH_MANAGER');
    if (error) return error;

    const body = await req.json();
    const { fromBranchId, toBranchId, items, notes } = body;

    if (!fromBranchId || !toBranchId || fromBranchId === toBranchId) {
      return NextResponse.json({ success: false, error: 'Select two different branches' }, { status: 400 });
    }
    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ success: false, error: 'Add at least one item' }, { status: 400 });
    }
    for (const it of items) {
      if (!it.productId || !Number.isInteger(it.quantity) || it.quantity <= 0) {
        return NextResponse.json({ success: false, error: 'Invalid item quantity' }, { status: 400 });
      }
    }

    const transferNumber = `TRF-2026-${Math.floor(1000 + Math.random() * 9000)}`;
    const transfer = await prisma.stockTransfer.create({
      data: {
        transferNumber,
        fromBranchId,
        toBranchId,
        requestedById: (session!.user as { id: string }).id,
        notes: notes || null,
        status: 'PENDING',
        items: { create: items.map((it: { productId: string; quantity: number }) => ({ productId: it.productId, quantity: it.quantity })) },
      },
      include: { items: true },
    });

    return NextResponse.json({ success: true, transfer });
  } catch (e) {
    console.error('Admin transfer create error:', e);
    return NextResponse.json({ success: false, error: 'Failed to create transfer' }, { status: 500 });
  }
}
