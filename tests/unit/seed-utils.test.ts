import { describe, it, expect } from 'vitest';
import { mulberry32, ean13 } from '../../prisma/seed/utils.js';

describe('seed utils (unit)', () => {
  it('PRNG is deterministic', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });

  it('EAN-13 starts with 2, 13 digits, valid check digit', () => {
    for (const n of [0, 1, 12345, 99999999]) {
      const code = ean13(n);
      expect(code).toMatch(/^2\d{12}$/);
      const d = code.split('').map(Number);
      let sum = 0;
      for (let i = 0; i < 12; i++) sum += d[i] * (i % 2 === 0 ? 1 : 3);
      expect((10 - (sum % 10)) % 10).toBe(d[12]);
    }
  });
});
