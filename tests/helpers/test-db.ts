import { assertDevelopment } from '../../src/lib/env-guard.js';

/**
 * Refuses to run unless TEST_DATABASE_URL points at a database/schema whose
 * name contains "test" AND differs from the app DATABASE_URL.
 * Tests truncate tables — this guard prevents wiping demo/prod data.
 */
export function assertSafeTestDatabaseUrl(testUrl: string | undefined, appUrl: string | undefined): string {
  assertDevelopment('test database bootstrap');
  if (!testUrl) {
    throw new Error('REFUSED: TEST_DATABASE_URL is not set.');
  }
  const lower = testUrl.toLowerCase();
  const looksTest = lower.includes('test');
  const differs = testUrl !== appUrl;
  if (!looksTest || !differs) {
    throw new Error(
      'REFUSED: TEST_DATABASE_URL must contain "test" and differ from DATABASE_URL. ' +
        'Tests truncate tables and must never run against the app database.'
    );
  }
  return testUrl;
}

export function getTestDatabaseUrl(): string {
  return assertSafeTestDatabaseUrl(process.env.TEST_DATABASE_URL, process.env.DATABASE_URL);
}
