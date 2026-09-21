import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { testPrisma, resetTestDb } from '../helpers/factories.js';
import { seedBranches } from '../../prisma/seed/branches.js';
import { seedCategories } from '../../prisma/seed/catalog-base.js';
import { seedSettings } from '../../prisma/seed/settings.js';

describe('seed:minimal idempotency (integration, test schema)', () => {
  beforeAll(async () => {
    await resetTestDb();
  }, 120000);

  afterAll(async () => {
    await testPrisma().$disconnect();
  });

  it('running seed modules twice yields identical counts', async () => {
    const db = testPrisma();
    await seedBranches(db);
    await seedCategories(db);
    await seedSettings(db);
    const c1 = { b: await db.branch.count(), c: await db.category.count(), s: await db.setting.count() };
    await seedBranches(db);
    await seedCategories(db);
    await seedSettings(db);
    const c2 = { b: await db.branch.count(), c: await db.category.count(), s: await db.setting.count() };
    expect(c2).toEqual(c1);
    expect(c1).toEqual({ b: 2, c: 6, s: 52 });
  }, 180000);
});
