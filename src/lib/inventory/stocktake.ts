import { prisma } from '@/lib/db';
import { num } from '@/lib/pricing';
import { decrementStock, incrementStock } from './service';
import { canAccessBranch } from '@/lib/auth/branch-scope';
import type { AppSession } from '@/lib/auth/guards';

export class StocktakeError extends Error { constructor(public status: number, message: string) { super(message); } }

function assertActor(session: AppSession | null): string { const id = session?.user?.id; if (!id) throw new StocktakeError(401, 'جلسة غير صالحة'); return id; }

export async function createStocktake(input: { session: AppSession | null; branchId: string; productIds: string[]; notes?: string }) {
  const actorId = assertActor(input.session);
  if (!input.branchId || !Array.isArray(input.productIds) || input.productIds.length === 0) throw new StocktakeError(400, 'اختر الفرع والأصناف');
  const productIds = [...new Set(input.productIds)];
  if (productIds.length !== input.productIds.length) throw new StocktakeError(400, 'لا يمكن تكرار الصنف');
  if (!canAccessBranch(input.session, input.branchId)) throw new StocktakeError(403, 'الفرع خارج نطاقك');
  return prisma.$transaction(async (tx) => {
    const branch = await tx.branch.findFirst({ where: { id: input.branchId, isActive: true }, select: { id: true } });
    if (!branch) throw new StocktakeError(400, 'الفرع غير صالح');
    const products = await tx.product.findMany({ where: { id: { in: productIds }, isActive: true }, select: { id: true, sku: true, nameAr: true, nameEn: true, costPrice: true } });
    if (products.length !== productIds.length) throw new StocktakeError(400, 'أحد الأصناف غير موجود أو موقوف');
    for (const product of products) {
      await tx.branchInventory.upsert({ where: { branchId_productId: { branchId: input.branchId, productId: product.id } }, create: { branchId: input.branchId, productId: product.id, stockQuantity: 0, lowStockThreshold: 5, reorderPoint: 5, reorderQuantity: 10 }, update: {} });
    }
    const inventories = await tx.branchInventory.findMany({ where: { branchId: input.branchId, productId: { in: productIds } }, select: { productId: true, stockQuantity: true } });
    const inventoryByProduct = new Map(inventories.map((row) => [row.productId, row.stockQuantity]));
    const stocktakeNumber = `STK-${new Date().getUTCFullYear()}-${Date.now().toString(36).toUpperCase()}`;
    const session = await tx.stocktakeSession.create({ data: { stocktakeNumber, branchId: input.branchId, createdById: actorId, notes: input.notes?.trim().slice(0, 1000) || null, lines: { create: products.map((product) => ({ productId: product.id, skuSnapshot: product.sku, nameArSnapshot: product.nameAr, nameEnSnapshot: product.nameEn, unitCost: product.costPrice, expectedQuantity: inventoryByProduct.get(product.id) || 0 })) } }, include: { lines: true, branch: true } });
    await tx.auditLog.create({ data: { actorId, action: 'stocktake.created', entity: 'StocktakeSession', entityId: session.id, branchId: input.branchId, metadata: JSON.stringify({ stocktakeNumber, lineCount: products.length }) } });
    return session;
  }, { maxWait: 10000, timeout: 30000 });
}

export async function saveStocktakeLines(input: { session: AppSession | null; sessionId: string; lines: Array<{ id: string; countedQuantity?: number | null; reasonCode?: string | null; notes?: string | null }> }) {
  const actorId = assertActor(input.session);
  const stocktake = await prisma.stocktakeSession.findUnique({ where: { id: input.sessionId }, select: { id: true, branchId: true, status: true } });
  if (!stocktake) throw new StocktakeError(404, 'جلسة الجرد غير موجودة');
  if (!canAccessBranch(input.session, stocktake.branchId)) throw new StocktakeError(403, 'الجلسة خارج نطاق فروعك');
  if (stocktake.status !== 'DRAFT') throw new StocktakeError(409, 'لا يمكن تعديل جلسة معتمدة');
  return prisma.$transaction(async (tx) => {
    for (const line of input.lines) {
      const current = await tx.stocktakeLine.findFirst({ where: { id: line.id, sessionId: stocktake.id } });
      if (!current) throw new StocktakeError(404, 'سطر الجرد غير موجود');
      if (line.countedQuantity !== undefined && line.countedQuantity !== null && (!Number.isSafeInteger(line.countedQuantity) || line.countedQuantity < 0)) throw new StocktakeError(400, 'كمية الجرد غير صالحة');
      const counted = line.countedQuantity === undefined ? current.countedQuantity : line.countedQuantity;
      const variance = counted === null ? null : counted - current.expectedQuantity;
      if (variance !== null && variance !== 0 && !line.reasonCode) throw new StocktakeError(400, 'سبب الفرق مطلوب عند وجود اختلاف');
      if (line.reasonCode === 'OTHER' && !line.notes?.trim()) throw new StocktakeError(400, 'ملاحظة مطلوبة لسبب OTHER');
      await tx.stocktakeLine.update({ where: { id: current.id }, data: { countedQuantity: counted, varianceQuantity: variance, reasonCode: (line.reasonCode || null) as never, notes: line.notes?.trim().slice(0, 500) || null, status: counted === null ? 'PENDING' : 'COUNTED', countedById: counted === null ? null : actorId, countedAt: counted === null ? null : new Date() } });
    }
    return tx.stocktakeSession.findUniqueOrThrow({ where: { id: stocktake.id }, include: { lines: { include: { product: true }, orderBy: { productId: 'asc' } }, branch: true } });
  }, { maxWait: 10000, timeout: 30000 });
}

export async function approveStocktake(input: { session: AppSession | null; sessionId: string }) {
  const actorId = assertActor(input.session);
  return prisma.$transaction(async (tx) => {
    const session = await tx.stocktakeSession.findUnique({ where: { id: input.sessionId }, include: { branch: true, lines: { include: { product: true }, orderBy: { productId: 'asc' } } } });
    if (!session) throw new StocktakeError(404, 'جلسة الجرد غير موجودة');
    if (!canAccessBranch(input.session, session.branchId)) throw new StocktakeError(403, 'الجلسة خارج نطاق فروعك');
    if (session.status !== 'DRAFT') throw new StocktakeError(409, 'تم اعتماد هذه الجلسة مسبقًا');
    if (session.lines.length === 0 || session.lines.some((line) => line.countedQuantity === null)) throw new StocktakeError(422, 'يجب عد كل الأصناف قبل الاعتماد');
    const claimed = await tx.stocktakeSession.updateMany({ where: { id: session.id, status: 'DRAFT' }, data: { status: 'APPROVED', approvedById: actorId, approvedAt: new Date() } });
    if (claimed.count !== 1) throw new StocktakeError(409, 'تم اعتماد الجلسة من جهاز آخر');
    let totalVariance = 0; let adjustmentLogs = 0;
    for (const line of session.lines) {
      const current = await tx.branchInventory.findUnique({ where: { branchId_productId: { branchId: session.branchId, productId: line.productId } }, select: { stockQuantity: true } });
      const previous = current?.stockQuantity ?? 0;
      if (previous !== line.expectedQuantity) throw new StocktakeError(409, `تغير مخزون ${line.skuSnapshot} أثناء الجرد`);
      const counted = line.countedQuantity!; const change = counted - previous; const variance = counted - line.expectedQuantity; totalVariance += variance;
      if (change > 0) { await incrementStock(tx, { branchId: session.branchId, productId: line.productId, quantity: change, type: 'CYCLE_COUNT', referenceId: session.stocktakeNumber, notes: `جرد: ${line.reasonCode || 'CYCLE_COUNT'}`, createdById: actorId }); adjustmentLogs += 1; }
      if (change < 0) { await decrementStock(tx, { branchId: session.branchId, productId: line.productId, quantity: Math.abs(change), type: 'CYCLE_COUNT', referenceId: session.stocktakeNumber, notes: `جرد: ${line.reasonCode || 'CYCLE_COUNT'}`, createdById: actorId }); adjustmentLogs += 1; }
      await tx.stocktakeLine.update({ where: { id: line.id }, data: { previousQuantity: previous, newQuantity: counted, varianceQuantity: variance, status: 'APPLIED', appliedAt: new Date() } });
    }
    await tx.auditLog.create({ data: { actorId, action: 'stocktake.approved', entity: 'StocktakeSession', entityId: session.id, branchId: session.branchId, metadata: JSON.stringify({ stocktakeNumber: session.stocktakeNumber, lineCount: session.lines.length, totalVariance, adjustmentLogs }) } });
    return { id: session.id, stocktakeNumber: session.stocktakeNumber, totalVariance, adjustmentLogs };
  }, { maxWait: 15000, timeout: 60000 });
}

export async function getStocktakeReport(id: string, session: AppSession | null) {
  const row = await prisma.stocktakeSession.findUnique({ where: { id }, include: { branch: true, lines: { include: { product: true }, orderBy: { productId: 'asc' } } } });
  if (!row) throw new StocktakeError(404, 'جلسة الجرد غير موجودة');
  if (!canAccessBranch(session, row.branchId)) throw new StocktakeError(403, 'الجلسة خارج نطاق فروعك');
  const lines = row.lines.map((line) => ({ ...line, unitCost: num(line.unitCost), varianceValue: (line.varianceQuantity || 0) * num(line.unitCost) }));
  return { session: { ...row, createdAt: row.createdAt.toISOString(), startedAt: row.startedAt.toISOString(), approvedAt: row.approvedAt?.toISOString() || null }, lines, summary: { lineCount: lines.length, countedLineCount: lines.filter((line) => line.countedQuantity !== null).length, varianceLineCount: lines.filter((line) => (line.varianceQuantity || 0) !== 0).length, expectedQuantity: lines.reduce((sum, line) => sum + line.expectedQuantity, 0), countedQuantity: lines.reduce((sum, line) => sum + (line.countedQuantity || 0), 0), varianceQuantity: lines.reduce((sum, line) => sum + (line.varianceQuantity || 0), 0), varianceValue: lines.reduce((sum, line) => sum + line.varianceValue, 0) } };
}
