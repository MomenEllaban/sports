import { describe, it, expect } from 'vitest';
import { groupSlugForSku, sizesOf, colorsOf, pickVariant } from '../../src/lib/catalog/groups.js';

describe('variant families (T07)', () => {
  it('family key strips trailing variant segments', () => {
    expect(groupSlugForSku('TSH-DRY-S-00')).toBe('tsh-dry');
    expect(groupSlugForSku('RUN-NK-42')).toBe('run-nk');
    expect(groupSlugForSku('TRX-PRO-KIT')).toBe('trx-pro-kit');
    expect(groupSlugForSku('BOX-LTH-12oz')).toBe('box-lth');
    expect(groupSlugForSku('SOK-CT-39-42')).toBe('sok-ct');
    expect(groupSlugForSku('SKU')).toBe('sku');
  });

  it('sizes/colors dedupe in order', () => {
    const v = [
      { id: 'a', size: 'M', color: 'أسود', price: 1, stock: 2 },
      { id: 'b', size: 'L', color: 'أسود', price: 1, stock: 0 },
      { id: 'c', size: 'M', color: 'أبيض', price: 1, stock: 1 },
    ];
    expect(sizesOf(v)).toEqual(['M', 'L']);
    expect(colorsOf(v)).toEqual(['أسود', 'أبيض']);
  });

  it('pick prefers exact, falls back to size then color', () => {
    const v = [
      { id: 'a', size: 'M', color: 'أسود', price: 1, stock: 2 },
      { id: 'b', size: 'L', color: 'أسود', price: 1, stock: 1 },
    ];
    expect(pickVariant(v, 'L', 'أسود')?.id).toBe('b');
    expect(pickVariant(v, 'XL', 'أسود')?.id).toBe('a'); // color fallback
    expect(pickVariant([], 'M', null)).toBe(null);
  });
});
