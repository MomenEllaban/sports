/**
 * Barcode symbology selection for the label printer.
 *
 * A product carries two possible identifiers: `gs1Code` (a GTIN, and the one
 * ETA production expects) and the legacy `barcode` field. `gs1Code` wins.
 *
 * The stored value is never rewritten before encoding. Stripping characters to
 * force a "digits only" check silently changes the payload, so a scanner reads
 * back a different number than the one in the database. Instead the code's
 * actual shape decides the symbology, and CODE128 carries anything that is not
 * a retail EAN.
 */

export type Symbology = 'EAN8' | 'EAN13' | 'CODE128';

/** The maximum length that still fits a CODE128 label on the sheet. */
const MAX_CODE128_LENGTH = 48;

/** The identifier exactly as stored, trimmed. */
export function rawCode(product: { gs1Code?: string | null; barcode?: string | null }): string {
  return (product.gs1Code || product.barcode || '').trim();
}

/** The stored code when it is entirely digits, otherwise ''. */
export function digitsOf(product: { gs1Code?: string | null; barcode?: string | null }): string {
  const raw = rawCode(product);
  return raw !== '' && /^\d+$/.test(raw) ? raw : '';
}

/**
 * EAN-8 and EAN-13/UPC-A are retail standards that scan at the checkout, so
 * they are encoded as EAN. GTIN-14 carries a packaging indicator digit and is
 * not a valid EAN-13, so it falls back to CODE128 rather than being
 * zero-padded into a different number. A legacy alphanumeric barcode cannot be
 * encoded as EAN at all, and CODE128 is the only symbology that represents
 * arbitrary text, so it is used verbatim.
 */
export function symbologyOf(product: {
  gs1Code?: string | null;
  barcode?: string | null;
}): Symbology | null {
  const digits = digitsOf(product);
  if (digits.length === 8) return 'EAN8';
  if (digits.length === 12 || digits.length === 13) return 'EAN13';
  if (rawCode(product)) return 'CODE128';
  return null;
}

/** The exact value handed to the encoder for a product. */
export function printCode(product: {
  gs1Code?: string | null;
  barcode?: string | null;
}): string {
  const symbology = symbologyOf(product);
  if (symbology === 'EAN13') {
    // UPC-A is a 12-digit EAN-13 with a leading zero; the check digit moves.
    const digits = digitsOf(product);
    return digits.length === 12 ? `0${digits}` : digits;
  }
  return rawCode(product);
}

/** Whether the product can produce a scannable label at all. */
export function isPrintableCode(product: {
  gs1Code?: string | null;
  barcode?: string | null;
}): boolean {
  const symbology = symbologyOf(product);
  if (!symbology) return false;
  return symbology === 'CODE128' ? rawCode(product).length <= MAX_CODE128_LENGTH : true;
}
