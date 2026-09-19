import fs from 'node:fs';

// Loads .env.test (if present) then .env into process.env for vitest (Node 22+).
for (const f of ['.env.test', '.env']) {
  try {
    if (fs.existsSync(f)) process.loadEnvFile?.(f);
  } catch {
    /* ignore */
  }
}

// Route handlers import the app prisma client, which binds its datasource URL
// at construction time. Point EVERYTHING at the isolated test schema so
// integration tests can never touch demo/prod data (guarded below).
// NOTE: keep in sync with tests/helpers/test-db.ts refusal rules.
{
  const testUrl = process.env.TEST_DATABASE_URL || '';
  const appUrl = process.env.DATABASE_URL || '';
  const ok = testUrl && testUrl.toLowerCase().includes('test') && testUrl !== appUrl;
  if (!ok) {
    throw new Error(
      'REFUSED: tests require TEST_DATABASE_URL containing "test" and different from DATABASE_URL.'
    );
  }
  // Preserve the original app URL so the refusal guard can still compare against it.
  if (!process.env.APP_DATABASE_URL) process.env.APP_DATABASE_URL = appUrl;
  process.env.DATABASE_URL = testUrl;
  process.env.DIRECT_URL = testUrl;
}
