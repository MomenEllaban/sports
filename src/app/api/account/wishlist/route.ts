import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { readPortalSession } from '@/lib/account/session';

async function customerId() {
  const session = await readPortalSession();
  return session?.customerId || null;
}

export async function GET() {
  const id = await customerId();
  if (!id) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  const rows = await prisma.wishlistItem.findMany({ where: { customerId: id }, select: { productId: true, createdAt: true }, orderBy: { createdAt: 'desc' }, take: 500 });
  return NextResponse.json({ success: true, productIds: rows.map((row) => row.productId), items: rows.map((row) => ({ productId: row.productId, createdAt: row.createdAt.toISOString() })) });
}

export async function POST(req: Request) {
  const id = await customerId();
  if (!id) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  const body = await req.json() as { productId?: unknown };
  if (typeof body.productId !== 'string' || !body.productId) return NextResponse.json({ success: false, error: 'productId مطلوب' }, { status: 400 });
  const product = await prisma.product.findFirst({ where: { id: body.productId, isActive: true }, select: { id: true } });
  if (!product) return NextResponse.json({ success: false, error: 'المنتج غير متاح' }, { status: 404 });
  await prisma.wishlistItem.upsert({ where: { customerId_productId: { customerId: id, productId: product.id } }, create: { customerId: id, productId: product.id }, update: {} });
  return NextResponse.json({ success: true, productId: product.id });
}

export async function DELETE(req: Request) {
  const id = await customerId();
  if (!id) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  const body = await req.json().catch(() => ({})) as { productId?: unknown };
  if (typeof body.productId !== 'string' || !body.productId) return NextResponse.json({ success: false, error: 'productId مطلوب' }, { status: 400 });
  await prisma.wishlistItem.deleteMany({ where: { customerId: id, productId: body.productId } });
  return NextResponse.json({ success: true });
}
