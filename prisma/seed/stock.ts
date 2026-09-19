import type { PrismaClient } from '@prisma/client';
import { BRANCH_MAIN_ID, BRANCH_SAMOUHA_ID } from './branches.js';
import { buildModels } from './catalog.js';

/** Creates BranchInventory rows (qty 0 default) for ALL active branches — T15 rule. */
export async function seedStock(db: PrismaClient) {
  const models = buildModels();
  const products = await db.product.findMany({ select: { id: true, sku: true } });
  const bySku = new Map(products.map((p) => [p.sku, p.id]));
  let rows = 0;
  for (const m of models) {
    for (const s of m.skus) {
      const pid = bySku.get(s.sku);
      if (!pid) continue;
      for (const [branchId, qty] of [[BRANCH_MAIN_ID, s.stockMain], [BRANCH_SAMOUHA_ID, s.stockSmouha]] as const) {
        await db.branchInventory.upsert({
          where: { branchId_productId: { branchId, productId: pid } },
          create: { branchId, productId: pid, stockQuantity: qty, lowStockThreshold: 5 },
          update: { stockQuantity: qty },
        });
        rows++;
      }
    }
  }
  return rows;
}
