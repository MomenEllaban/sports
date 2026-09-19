import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { testPrisma, resetTestDb } from '../helpers/factories.js';

describe('test database connectivity (integration smoke)', () => {
  beforeAll(async () => {
    await resetTestDb();
  }, 120000);

  afterAll(async () => {
    await testPrisma().$disconnect();
  });

  it('connects to the isolated test schema and starts empty', async () => {
    const db = testPrisma();
    await expect(db.$queryRaw`SELECT 1`).resolves.toBeTruthy();
    await expect(db.branch.count()).resolves.toBe(0);
    await expect(db.product.count()).resolves.toBe(0);
  });
});
