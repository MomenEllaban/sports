/**
 * Small normalizers shared by the admin write routes.
 *
 * The admin forms all submit optional free-text fields as `''` when the user
 * clears them, so "cleared" and "absent" arrive at the API the same way. These
 * helpers make the stored value explicit (`null` for empty) and bounded, which
 * is what the columns and the storefront expect.
 */

/** Empty / non-string input becomes `null`; anything else is trimmed. */
export function optionalText(value: unknown, maxLength = 2000): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, maxLength);
}

/** Requires a non-empty string after trimming. */
export function requiredText(value: unknown, maxLength = 2000): string | null {
  return optionalText(value, maxLength);
}

/**
 * Parses a finite number from form input. Returns `null` for anything that is
 * not a number, so a caller can reject it explicitly instead of storing NaN.
 */
export function finiteNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

/** Lengths accepted for a GTIN: EAN-8, UPC-A, EAN-13 and GS1-14. */
export const GTIN_LENGTHS = [8, 12, 13, 14] as const;

/**
 * Normalises a GTIN (the `gs1Code` field used for ETA production) to digits only.
 * Returns `null` when the field is empty, and the raw digits when the length is
 * not a valid GTIN so the caller can decide whether to reject it.
 *
 * Both the create and the update route go through this so a product can never be
 * created with a GTIN that the update route would refuse to save.
 */
export function normalizeGtin(value: unknown): { value: string | null; invalid: boolean } {
  if (value === null || value === undefined) return { value: null, invalid: false };
  const digits = String(value).replace(/\D/g, '');
  if (!digits) return { value: null, invalid: false };
  const valid = (GTIN_LENGTHS as readonly number[]).includes(digits.length);
  return { value: digits, invalid: !valid };
}
