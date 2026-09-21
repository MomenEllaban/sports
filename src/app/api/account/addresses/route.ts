import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { readPortalSession } from '@/lib/account/session';

/** Customer portal: add / remove own delivery addresses (4.3). */
export async function POST(req: Request) {
  try {
    const session = await readPortalSession();
    if (!session) {
      return NextResponse.json({ success: false, error: 'not logged in' }, { status: 401 });
    }
    const body = await req.json();
    const street = String(body.street || '').trim();
    if (!street) {
      return NextResponse.json({ success: false, error: 'الشارع مطلوب' }, { status: 400 });
    }
    const address = await prisma.address.create({
      data: {
        customerId: session.customerId,
        title: String(body.title || 'Home').slice(0, 30),
        street: street.slice(0, 200),
        building: body.building ? String(body.building).slice(0, 50) : null,
        city: body.city ? String(body.city).slice(0, 50) : 'Alexandria',
        governorate: body.governorate ? String(body.governorate).slice(0, 50) : 'Alexandria',
        isDefault: false,
      },
    });
    return NextResponse.json({ success: true, address }, { status: 201 });
  } catch (e) {
    console.error('Portal address create error:', e);
    return NextResponse.json({ success: false, error: 'failed' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await readPortalSession();
    if (!session) {
      return NextResponse.json({ success: false, error: 'not logged in' }, { status: 401 });
    }
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ success: false, error: 'id is required' }, { status: 400 });
    }
    const existing = await prisma.address.findFirst({ where: { id, customerId: session.customerId } });
    if (!existing) {
      return NextResponse.json({ success: false, error: 'address not found' }, { status: 404 });
    }
    await prisma.address.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('Portal address delete error:', e);
    return NextResponse.json({ success: false, error: 'failed' }, { status: 500 });
  }
}
