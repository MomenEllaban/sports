import { describe, it, expect } from 'vitest';
import {
  digitsOf,
  isPrintableCode,
  printCode,
  rawCode,
  symbologyOf,
} from '../../src/lib/labels/symbology.js';

const p = (gs1Code: string | null, barcode: string | null = null) => ({ gs1Code, barcode });

describe('rawCode', () => {
  it('prefers the GS1 code over the legacy barcode', () => {
    expect(rawCode(p('622103140426', '123'))).toBe('622103140426');
  });

  it('falls back to the barcode when there is no GTIN', () => {
    expect(rawCode(p(null, '622103140426'))).toBe('622103140426');
  });

  it('trims but never rewrites the stored value', () => {
    expect(rawCode(p('  ABC-123 '))).toBe('ABC-123');
    expect(rawCode(p(null, null))).toBe('');
  });
});

describe('symbologyOf', () => {
  it('uses EAN-8 for an 8-digit code', () => {
    expect(symbologyOf(p('96385074'))).toBe('EAN8');
  });

  it('uses EAN-13 for 12 and 13 digit codes', () => {
    expect(symbologyOf(p('622103140426'))).toBe('EAN13');
    expect(symbologyOf(p('0622103140426'))).toBe('EAN13');
  });

  it('does not force a GTIN-14 into EAN-13, which would change the number', () => {
    // GTIN-14 carries a packaging indicator digit; zero-padding it to 13 would
    // print a code that scans as a different product.
    expect(symbologyOf(p('06221031404261'))).toBe('CODE128');
  });

  it('encodes a legacy alphanumeric barcode as CODE128 verbatim', () => {
    expect(symbologyOf(p('ABC-1234'))).toBe('CODE128');
  });

  it('returns null when there is no code at all', () => {
    expect(symbologyOf(p(null))).toBeNull();
    expect(symbologyOf(p(''))).toBeNull();
    expect(symbologyOf(p('   '))).toBeNull();
  });
});

describe('printCode', () => {
  it('zero-pads a 12-digit UPC-A so the EAN-13 check digit lands correctly', () => {
    expect(printCode(p('061234567890'))).toBe('0061234567890');
  });

  it('passes a 13-digit code through unchanged', () => {
    expect(printCode(p('6221031404266'))).toBe('6221031404266');
  });

  it('never strips characters out of an alphanumeric code', () => {
    // Stripping to "1234" here would print a scannable label for the wrong data.
    expect(printCode(p('ABC-1234'))).toBe('ABC-1234');
  });
});

describe('digitsOf', () => {
  it('only reports digits for a fully numeric code', () => {
    expect(digitsOf(p('6221031404266'))).toBe('6221031404266');
    expect(digitsOf(p('ABC-1234'))).toBe('');
  });
});

describe('isPrintableCode', () => {
  it('accepts every symbology the printer can render', () => {
    expect(isPrintableCode(p('96385074'))).toBe(true);
    expect(isPrintableCode(p('6221031404266'))).toBe(true);
    expect(isPrintableCode(p('06221031404261'))).toBe(true);
    expect(isPrintableCode(p('ABC-1234'))).toBe(true);
  });

  it('rejects a product with no identifier', () => {
    expect(isPrintableCode(p(null))).toBe(false);
  });

  it('rejects an over-long CODE128 value that would overflow the label', () => {
    expect(isPrintableCode(p('A'.repeat(49)))).toBe(false);
    expect(isPrintableCode(p('A'.repeat(48)))).toBe(true);
  });
});
