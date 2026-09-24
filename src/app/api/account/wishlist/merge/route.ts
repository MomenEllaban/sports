import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { readPortalSession } from '@/lib/account/session';

export async function POST(req: Request) {
  const session = await readPortalSession();
  if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  const body = await req.json() as { productIds?: unknown };
  const ids = Array.isArray(body.productIds) ? [...new Set(body.productIds.filter((id): id is string => typeof id === 'string' && id.length > 0))].slice(0, 500) : [];
  const products = ids.length ? await prisma.product.findMany({ where: { id: { in: ids }, isActive: true }, select: { id: true } }) : [];
  const validIds = products.map((product) => product.id);
  if (validIds.length) await prisma.wishlistItem.createMany({ data: validIds.map((productId) => ({ customerId: session.customerId, productId })), skipDuplicates: true });
  const rows = await prisma.wishlistItem.findMany({ where: { customerId: session.customerId }, select: { productId: true }, orderBy: { createdAt: 'desc' }, take: 500 });
  return NextResponse.json({ success: true, productIds: rows.map((row) => row.productId) });
}
