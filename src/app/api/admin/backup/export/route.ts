import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireRole } from '@/lib/auth/guards';
import { captureError } from '@/lib/monitor';
import { apiError } from '@/lib/api-response';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const { error, session } = await requireRole('SUPER_ADMIN');
    if (error) return error;

    const url = new URL(req.url);
    const table = url.searchParams.get('table') || 'all';

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

    if (table === 'customers') {
      const customers = await prisma.customer.findMany({
        orderBy: { createdAt: 'desc' },
      });
      return new NextResponse(JSON.stringify(customers, null, 2), {
        headers: {
          'Content-Type': 'application/json',
          'Content-Disposition': `attachment; filename="customers-backup-${timestamp}.json"`,
        },
      });
    }

    if (table === 'products') {
      const products = await prisma.product.findMany({
        include: { category: true, brand: true, inventories: true },
        orderBy: { createdAt: 'desc' },
      });
      return new NextResponse(JSON.stringify(products, null, 2), {
        headers: {
          'Content-Type': 'application/json',
          'Content-Disposition': `attachment; filename="products-catalog-${timestamp}.json"`,
        },
      });
    }

    if (table === 'orders') {
      const orders = await prisma.order.findMany({
        include: { items: true },
        orderBy: { createdAt: 'desc' },
      });
      return new NextResponse(JSON.stringify(orders, null, 2), {
        headers: {
          'Content-Type': 'application/json',
          'Content-Disposition': `attachment; filename="orders-backup-${timestamp}.json"`,
        },
      });
    }

    // Full snapshot
    const [customers, products, orders, branches, suppliers, categories, brands] = await Promise.all([
      prisma.customer.findMany(),
      prisma.product.findMany(),
      prisma.order.findMany({ take: 500, orderBy: { createdAt: 'desc' } }),
      prisma.branch.findMany(),
      prisma.supplier.findMany(),
      prisma.category.findMany(),
      prisma.brand.findMany(),
    ]);

    const backupSnapshot = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      exportedBy: (session?.user as { email?: string })?.email || 'admin',
      database: {
        customersCount: customers.length,
        productsCount: products.length,
        ordersCount: orders.length,
        branchesCount: branches.length,
        suppliersCount: suppliers.length,
      },
      data: {
        customers,
        products,
        orders,
        branches,
        suppliers,
        categories,
        brands,
      },
    };

    return new NextResponse(JSON.stringify(backupSnapshot, null, 2), {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="full-database-backup-${timestamp}.json"`,
      },
    });
  } catch (e) {
    captureError('api/admin/backup/export', e);
    return apiError('INTERNAL_ERROR', 'فشل في تصدير النسخة الاحتياطية', 500);
  }
}
