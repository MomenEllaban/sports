import { describe, expect, it } from 'vitest';
import {
  DOC_NUMBER_PATTERN,
  DOC_PREFIXES,
  isDocPrefix,
  nextDocumentNumber,
  normalizeIdempotencyKey,
} from '../../src/lib/documents.js';

/**
 * Minimal in-memory stand-in for the `Sequence` table. `upsert` mirrors the
 * atomic `INSERT ... ON CONFLICT DO UPDATE` the real Prisma call performs, so
 * the tests cover the numbering contract without a database.
 */
function fakeClient(initial: Record<string, number> = {}) {
  const rows = new Map(Object.entries(initial));
  return {
    rows,
    sequence: {
      async upsert({ where, create, update }: {
        where: { key: string };
        create: { key: string; value: number };
        update: { value: { increment: number } };
      }) {
        const existing = rows.get(where.key);
        const value = existing === undefined ? create.value : existing + update.value.increment;
        rows.set(where.key, value);
        return { key: where.key, value };
      },
    },
  };
}

describe('document numbering', () => {
  it('starts at 1 and zero-pads to a fixed width', async () => {
    const db = fakeClient();
    expect(await nextDocumentNumber(db as never, 'ORD')).toBe('ORD-2026-000001');
    expect(await nextDocumentNumber(db as never, 'ORD')).toBe('ORD-2026-000002');
  });

  it('keeps a separate counter per prefix', async () => {
    const db = fakeClient();
    await nextDocumentNumber(db as never, 'ORD');
    await nextDocumentNumber(db as never, 'ORD');
    // A POS sale must not consume order numbers, and vice versa.
    expect(await nextDocumentNumber(db as never, 'POS')).toBe('POS-2026-000001');
    expect(await nextDocumentNumber(db as never, 'RTN')).toBe('RTN-2026-000001');
    expect(await nextDocumentNumber(db as never, 'ORD')).toBe('ORD-2026-000003');
  });

  it('uses a distinct counter per year', async () => {
    const db = fakeClient();
    await nextDocumentNumber(db as never, 'ORD', { year: 2026 });
    expect(await nextDocumentNumber(db as never, 'ORD', { year: 2027 })).toBe('ORD-2027-000001');
  });

  it('never repeats a number, which is what the @unique columns rely on', async () => {
    const db = fakeClient();
    const seen = new Set<string>();
    for (let i = 0; i < 500; i++) {
      const value = await nextDocumentNumber(db as never, 'ORD');
      expect(seen.has(value)).toBe(false);
      seen.add(value);
    }
    expect(seen.size).toBe(500);
  });

  it('produces numbers matching the shape the UI and CSV parsers expect', async () => {
    const db = fakeClient();
    const value = await nextDocumentNumber(db as never, 'POS');
    expect(value).toMatch(DOC_NUMBER_PATTERN);
  });

  it('exposes only the prefixes that have a counter', () => {
    expect([...DOC_PREFIXES]).toEqual(['ORD', 'POS', 'RTN', 'TRF', 'EXP']);
    expect(isDocPrefix('ORD')).toBe(true);
    expect(isDocPrefix('TRF')).toBe(true);
    expect(isDocPrefix('EXP')).toBe(true);
    // `PO` still uses a timestamp+random form and is deliberately not counted.
    expect(isDocPrefix('PO')).toBe(false);
    expect(isDocPrefix(42)).toBe(false);
  });
});

describe('idempotency key normalisation', () => {
  it('accepts UUIDs and alnum tokens', () => {
    expect(normalizeIdempotencyKey('3f7c1a52-9b0e-4d1a-8f2c-0b6e5a4d3c21')).toBe(
      '3f7c1a52-9b0e-4d1a-8f2c-0b6e5a4d3c21',
    );
    expect(normalizeIdempotencyKey('  chk-abc123-xyz  ')).toBe('chk-abc123-xyz');
  });

  it('rejects values that could not be safely indexed or are too short', () => {
    expect(normalizeIdempotencyKey('short')).toBeNull();
    expect(normalizeIdempotencyKey('')).toBeNull();
    expect(normalizeIdempotencyKey('has spaces in it')).toBeNull();
    expect(normalizeIdempotencyKey("'; DROP TABLE \"Order\"; --")).toBeNull();
    expect(normalizeIdempotencyKey(undefined)).toBeNull();
    expect(normalizeIdempotencyKey(12345)).toBeNull();
    expect(normalizeIdempotencyKey('x'.repeat(81))).toBeNull();
  });
});
