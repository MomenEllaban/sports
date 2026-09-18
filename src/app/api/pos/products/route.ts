import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET() {
  try {
    const flagshipBranch = await prisma.branch.findFirst({
      where: { isActive: true },
    });

    if (!flagshipBranch) {
      return NextResponse.json({ success: false, products: [] });
    }

    const products = await prisma.product.findMany({
      where: { isActive: true },
      include: {
        inventories: {
          where: { branchId: flagshipBranch.id },
        },
      },
      orderBy: { nameAr: 'asc' },
    });

    return NextResponse.json({ success: true, products });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ success: false, products: [] }, { status: 500 });
  }
}
