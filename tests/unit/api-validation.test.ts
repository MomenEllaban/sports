import { describe, it, expect } from 'vitest';
import {
  GTIN_LENGTHS,
  finiteNumber,
  normalizeGtin,
  optionalText,
  requiredText,
} from '../../src/lib/api-validation.js';

describe('optionalText', () => {
  it('maps empty and non-string input to null', () => {
    expect(optionalText('')).toBeNull();
    expect(optionalText('   ')).toBeNull();
    expect(optionalText(undefined)).toBeNull();
    expect(optionalText(null)).toBeNull();
    expect(optionalText(42)).toBeNull();
  });

  it('trims and bounds the stored value', () => {
    expect(optionalText('  Nike  ')).toBe('Nike');
    expect(optionalText('abcdef', 3)).toBe('abc');
  });
});

describe('requiredText', () => {
  it('rejects blank input so the caller can fail fast', () => {
    expect(requiredText('   ')).toBeNull();
    expect(requiredText(' Puma ')).toBe('Puma');
  });
});

describe('finiteNumber', () => {
  it('never returns NaN for unparseable form input', () => {
    expect(finiteNumber('')).toBeNull();
    expect(finiteNumber('abc')).toBeNull();
    expect(finiteNumber(Number.POSITIVE_INFINITY)).toBeNull();
    expect(finiteNumber('12.5')).toBe(12.5);
    expect(finiteNumber(0)).toBe(0);
  });
});

describe('normalizeGtin', () => {
  it('accepts every valid GTIN length', () => {
    for (const len of GTIN_LENGTHS) {
      const digits = '1'.repeat(len);
      expect(normalizeGtin(digits)).toEqual({ value: digits, invalid: false });
    }
  });

  it('strips non-digits before validating', () => {
    expect(normalizeGtin(' 622-1031-4042-6 ')).toEqual({ value: '622103140426', invalid: false });
    expect(normalizeGtin('abc')).toEqual({ value: null, invalid: false });
  });

  it('reports an invalid length instead of silently dropping it', () => {
    expect(normalizeGtin('12345')).toEqual({ value: '12345', invalid: true });
    expect(normalizeGtin('123456789012345')).toEqual({ value: '123456789012345', invalid: true });
  });

  it('treats an empty or absent field as "no GTIN", never as invalid', () => {
    expect(normalizeGtin('')).toEqual({ value: null, invalid: false });
    expect(normalizeGtin(null)).toEqual({ value: null, invalid: false });
    expect(normalizeGtin(undefined)).toEqual({ value: null, invalid: false });
  });
});
