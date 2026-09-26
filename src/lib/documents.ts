import type { Prisma } from '@prisma/client';

/**
 * Accepts either a transaction client or the base Prisma client, so a caller
 * can allocate inside its own transaction (preferred — the increment then rolls
 * back with the rest of the work) or stand-alone.
 */
type SequenceClient = Pick<Prisma.TransactionClient, 'sequence'>;

/**
 * Prefixes that need a collision-free, human-readable document number.
 * `ORD` orders, `POS` till sales, `RTN` return tickets, `TRF` stock transfers,
 * `EXP` expenses, `QT` quotations, `INV` customer invoices, `RCP` customer
 * payment receipts.
 */
export const DOC_PREFIXES = ['ORD', 'POS', 'RTN', 'TRF', 'EXP', 'QT', 'INV', 'RCP'] as const;
export type DocPrefix = (typeof DOC_PREFIXES)[number];

export const DOC_WIDTH = 6;

export function isDocPrefix(value: unknown): value is DocPrefix {
  return typeof value === 'string' && (DOC_PREFIXES as readonly string[]).includes(value);
}

/**
 * Allocates the next number for a prefix from a database counter and returns it
 * as `PREFIX-YYYY-000123`.
 *
 * Why this exists: the numbers used to be `Math.random()` inside a fixed window
 * (`ORD-2026-${1000 + rand * 9000}`), which allowed only 9,000 storefront order
 * numbers per year, and the two order-creation routes used *different* windows
 * for the same `@unique` column. A collision surfaced as a 500 after the payment
 * gateway had already been contacted.
 *
 * The counter is an atomic `INSERT ... ON CONFLICT DO UPDATE`, so concurrent
 * requests — including separate serverless instances — cannot read the same
 * value. Numbers are consumed inside the caller's transaction, so a rollback
 * leaves a gap in the sequence. That is intentional and matches how invoices
 * are numbered: a gap is harmless, a duplicate is not.
 */
export async function nextDocumentNumber(
  tx: SequenceClient,
  prefix: DocPrefix,
  options: { year?: number; width?: number } = {},
): Promise<string> {
  const year = options.year ?? new Date().getUTCFullYear();
  const width = options.width ?? DOC_WIDTH;
  const key = `${prefix}-${year}`;
  const row = await tx.sequence.upsert({
    where: { key },
    create: { key, value: 1 },
    update: { value: { increment: 1 } },
  });
  return `${prefix}-${year}-${String(row.value).padStart(width, '0')}`;
}

/** `ORD-2026-000123` shape, used to sanity-check user-supplied document numbers. */
export const DOC_NUMBER_PATTERN = /^[A-Z]{2,3}-\d{4}-[A-Za-z0-9-]{1,16}$/;
const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9_-]{8,80}$/;

/**
 * Validates a client-supplied idempotency key. Anything malformed is dropped
 * rather than rejected, so an old or hostile client keeps working — it simply
 * loses replay protection.
 */
export function normalizeIdempotencyKey(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!IDEMPOTENCY_KEY_PATTERN.test(trimmed)) return null;
  return trimmed;
}
