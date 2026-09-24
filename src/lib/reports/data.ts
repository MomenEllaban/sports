import { prisma } from '@/lib/db';
import { num } from '@/lib/pricing';

export type ReportType = 'sales' | 'inventory' | 'branches' | 'finance';
export interface ReportQuery {
  from: Date;
  to: Date;
  branchId?: string;
  q?: string;
  page: number;
  pageSize: number;
}
export interface ReportRow {
  id: string;
  nameAr: string;
  nameEn: string;
  sku: string;
  barcode: string | null;
  category: string;
  brand: string;
  buyPrice: number;
  sellPrice: number;
  quantity: number;
  revenue: number;
  cost: number;
  profit: number;
  branchName: string;
  branchQuantities: Record<string, number>;
  status?: string;
}

export function parseReportQuery(params: URLSearchParams | Record<string, string | string[] | undefined>): ReportQuery {
  const get = (key: string) => {
    const value = params instanceof URLSearchParams ? params.get(key) : params[key];
    return Array.isArray(value) ? value[0] : value;
  };
  const rawFrom = get('from');
  const rawTo = get('to');
  const from = rawFrom && !Number.isNaN(Date.parse(rawFrom)) ? new Date(rawFrom) : new Date(Date.now() - 30 * 86_400_000);
  const to = rawTo && !Number.isNaN(Date.parse(rawTo)) ? new Date(`${rawTo.slice(0, 10)}T23:59:59.999Z`) : new Date();
  const page = Math.max(1, Math.min(1000, Number(get('page') || 1) || 1));
  const pageSize = Math.max(5, Math.min(100, Number(get('pageSize') || 25) || 25));
  return { from, to, branchId: get('branch') || undefined, q: (get('q') || '').trim().slice(0, 100) || undefined, page, pageSize };
}

function productSearch(q?: string) {
  if (!q) return undefined;
  return { OR: [
    { nameAr: { contains: q, mode: 'insensitive' as const } },
    { nameEn: { contains: q, mode: 'insensitive' as const } },
    { sku: { contains: q, mode: 'insensitive' as const } },
    { barcode: { contains: q, mode: 'insensitive' as const } },
    { category: { is: { nameAr: { contains: q, mode: 'insensitive' as const } } } },
    { brand: { is: { nameAr: { contains: q, mode: 'insensitive' as const } } } },
  ] };
}

export async function getReport(type: ReportType, query: ReportQuery): Promise<{ rows: ReportRow[]; total: number; page: number; pageSize: number; totalPages: number }> {
  if (type === 'inventory') return inventoryReport(query);
  if (type === 'branches') return branchReport(query);
  if (type === 'finance') return salesReport(query, true);
  return salesReport(query, false);
}

async function salesReport(query: ReportQuery, finance: boolean) {
  const search = productSearch(query.q);
  const [orderItems, saleItems] = await Promise.all([
    prisma.orderItem.findMany({
      where: { order: { createdAt: { gte: query.from, lte: query.to }, paymentStatus: 'PAID', ...(query.branchId ? { branchId: query.branchId } : {}) }, ...(search ? { product: search } : {}) },
      include: { product: { select: { id: true, nameAr: true, nameEn: true, sku: true, barcode: true, price: true, costPrice: true, category: { select: { nameAr: true } }, brand: { select: { nameAr: true } } } }, order: { select: { branchId: true, branch: { select: { name: true } } } } },
      take: 5000,
    }),
    prisma.saleItem.findMany({
      where: { sale: { createdAt: { gte: query.from, lte: query.to }, paymentStatus: 'PAID', ...(query.branchId ? { branchId: query.branchId } : {}) }, ...(search ? { product: search } : {}) },
      include: { product: { select: { id: true, nameAr: true, nameEn: true, sku: true, barcode: true, price: true, costPrice: true, category: { select: { nameAr: true } }, brand: { select: { nameAr: true } } } }, sale: { select: { branchId: true, branch: { select: { name: true } } } } },
      take: 5000,
    }),
  ]);
  const map = new Map<string, ReportRow>();
  const add = (item: typeof orderItems[number] | typeof saleItems[number], branchId: string, branchName: string) => {
    const product = item.product;
    const current = map.get(product.id) || { id: product.id, nameAr: product.nameAr, nameEn: product.nameEn, sku: product.sku, barcode: product.barcode, category: product.category?.nameAr || '—', brand: product.brand?.nameAr || '—', buyPrice: num(product.costPrice), sellPrice: num(product.price), quantity: 0, revenue: 0, cost: 0, profit: 0, branchName, branchQuantities: {} };
    current.quantity += item.quantity;
    current.revenue += num(item.totalPrice);
    current.cost += current.buyPrice * item.quantity;
    current.branchQuantities[branchName] = (current.branchQuantities[branchName] || 0) + item.quantity;
    current.profit = Math.round((current.revenue - current.cost) * 100) / 100;
    map.set(product.id, current);
  };
  for (const item of orderItems) add(item, item.order.branchId, item.order.branch.name);
  for (const item of saleItems) add(item, item.sale.branchId, item.sale.branch.name);
  const all = [...map.values()].sort((a, b) => (finance ? b.revenue - a.revenue : b.profit - a.profit));
  const start = (query.page - 1) * query.pageSize;
  return { rows: all.slice(start, start + query.pageSize), total: all.length, page: query.page, pageSize: query.pageSize, totalPages: Math.max(1, Math.ceil(all.length / query.pageSize)) };
}

async function inventoryReport(query: ReportQuery) {
  const search = productSearch(query.q);
  const rows = await prisma.branchInventory.findMany({
    where: { ...(query.branchId ? { branchId: query.branchId } : {}), ...(search ? { product: search } : {}) },
    include: { product: { select: { id: true, nameAr: true, nameEn: true, sku: true, barcode: true, price: true, costPrice: true, category: { select: { nameAr: true } }, brand: { select: { nameAr: true } } } }, branch: { select: { name: true } } },
    orderBy: { updatedAt: 'desc' },
    take: 5000,
  });
  const mapped = rows.map((row) => ({ id: row.id, nameAr: row.product.nameAr, nameEn: row.product.nameEn, sku: row.product.sku, barcode: row.product.barcode, category: row.product.category?.nameAr || '—', brand: row.product.brand?.nameAr || '—', buyPrice: num(row.product.costPrice), sellPrice: num(row.product.price), quantity: row.stockQuantity, revenue: 0, cost: num(row.product.costPrice) * row.stockQuantity, profit: 0, branchName: row.branch.name, branchQuantities: { [row.branch.name]: row.stockQuantity }, status: row.stockQuantity <= 0 ? 'OUT' : 'IN_STOCK' }));
  const start = (query.page - 1) * query.pageSize;
  return { rows: mapped.slice(start, start + query.pageSize), total: mapped.length, page: query.page, pageSize: query.pageSize, totalPages: Math.max(1, Math.ceil(mapped.length / query.pageSize)) };
}

async function branchReport(query: ReportQuery) {
  const [orders, sales] = await Promise.all([
    prisma.order.findMany({ where: { createdAt: { gte: query.from, lte: query.to }, paymentStatus: 'PAID', ...(query.branchId ? { branchId: query.branchId } : {}) }, select: { id: true, branchId: true, branch: { select: { name: true } }, totalAmount: true, createdAt: true }, take: 5000 }),
    prisma.sale.findMany({ where: { createdAt: { gte: query.from, lte: query.to }, paymentStatus: 'PAID', ...(query.branchId ? { branchId: query.branchId } : {}) }, select: { id: true, branchId: true, branch: { select: { name: true } }, totalAmount: true, createdAt: true }, take: 5000 }),
  ]);
  const map = new Map<string, ReportRow>();
  const add = (row: typeof orders[number] | typeof sales[number]) => {
    const current = map.get(row.branchId) || { id: row.branchId, nameAr: row.branch.name, nameEn: row.branch.name, sku: '—', barcode: null, category: '—', brand: '—', buyPrice: 0, sellPrice: 0, quantity: 0, revenue: 0, cost: 0, profit: 0, branchName: row.branch.name, branchQuantities: {} };
    current.quantity += 1; current.revenue += num(row.totalAmount); current.profit = current.revenue; map.set(row.branchId, current);
  };
  orders.forEach(add); sales.forEach(add);
  const all = [...map.values()].sort((a, b) => b.revenue - a.revenue);
  const start = (query.page - 1) * query.pageSize;
  return { rows: all.slice(start, start + query.pageSize), total: all.length, page: query.page, pageSize: query.pageSize, totalPages: Math.max(1, Math.ceil(all.length / query.pageSize)) };
}
