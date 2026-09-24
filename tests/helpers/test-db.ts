import { assertDevelopment } from '../../src/lib/env-guard.js';

function databaseIdentity(url: string): { host: string; database: string } | null {
  try {
    const parsed = new URL(url);
    const database = decodeURIComponent(parsed.pathname.replace(/^\/+/, ''));
    if (!parsed.hostname || !database) return null;
    return { host: parsed.host.toLowerCase(), database: database.toLowerCase() };
  } catch {
    return null;
  }
}

/**
 * Refuses to run unless TEST_DATABASE_URL points at a physically distinct
 * database whose database name contains "test". A different ?schema query on
 * the same PostgreSQL database is not isolation and must never be accepted for
 * destructive integration tests.
 */
export function assertSafeTestDatabaseUrl(testUrl: string | undefined, appUrl: string | undefined): string {
  assertDevelopment('test database bootstrap');
  if (!testUrl) throw new Error('REFUSED: TEST_DATABASE_URL is not set.');

  const testIdentity = databaseIdentity(testUrl);
  const appIdentity = appUrl ? databaseIdentity(appUrl) : null;
  const testDatabase = testIdentity?.database ?? '';
  const samePhysicalDatabase = !!testIdentity && !!appIdentity && testIdentity.host === appIdentity.host && testIdentity.database === appIdentity.database;

  if (!testIdentity || !testDatabase.includes('test') || samePhysicalDatabase) {
    throw new Error(
      'REFUSED: TEST_DATABASE_URL must name a distinct physical database containing "test". ' +
        'A different schema/query on the app database is not safe because tests truncate tables.'
    );
  }
  return testUrl;
}

export function getTestDatabaseUrl(): string {
  return assertSafeTestDatabaseUrl(process.env.TEST_DATABASE_URL, process.env.APP_DATABASE_URL || process.env.DATABASE_URL);
}
