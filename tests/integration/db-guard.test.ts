import { describe, it, expect } from 'vitest';
import { assertSafeTestDatabaseUrl } from '../helpers/test-db.js';

describe('test database refusal guard (RED first)', () => {
  it('refuses the production DATABASE_URL', () => {
    expect(() =>
      assertSafeTestDatabaseUrl('postgresql://u:p@host/neondb?sslmode=require', 'postgresql://u:p@host/neondb?sslmode=require')
    ).toThrow(/refuse/i);
  });

  it('refuses a URL without test in the database name', () => {
    expect(() =>
      assertSafeTestDatabaseUrl('postgresql://u:p@host/neondb?schema=public', 'postgresql://u:p@host/other?sslmode=require')
    ).toThrow(/refuse/i);
  });

  it('refuses the same physical database with a different schema query', () => {
    expect(() =>
      assertSafeTestDatabaseUrl('postgresql://u:p@host/neondb?schema=sports_test', 'postgresql://u:p@host/neondb?sslmode=require')
    ).toThrow(/refuse/i);
  });

  it('accepts a distinct physical test database', () => {
    expect(() =>
      assertSafeTestDatabaseUrl('postgresql://u:p@host/sports_test?sslmode=require', 'postgresql://u:p@host/neondb?sslmode=require')
    ).not.toThrow();
  });
});
