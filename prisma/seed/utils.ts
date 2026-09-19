/** Deterministic PRNG + barcode/name helpers (T02). Same seed => same data. */
export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Valid EAN-13 starting with `2` (in-store prefix), deterministic from n. */
export function ean13(n: number): string {
  const base = '2' + String(10000000000 + (n % 89999999999)).slice(0, 11);
  const digits = base.split('').map(Number);
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += digits[i] * (i % 2 === 0 ? 1 : 3);
  const check = (10 - (sum % 10)) % 10;
  return base + check;
}

export const FIRST = ['أحمد', 'محمد', 'مصطفى', 'كريم', 'عمرو', 'منى', 'هبة', 'سارة', 'مريم', 'فاطمة', 'علي', 'حسن', 'إبراهيم', 'يوسف', 'نور', 'سلمى'];
export const LAST = ['حسني', 'عادل', 'الشريف', 'مصطفى', 'سلامة', 'فهمي', 'عبد العزيز', 'كامل', 'السيد', 'بركات'];

/** CLEARLY SYNTHETIC customer phones: 01000000001 ... */
export const synthPhone = (i: number) => `0100000${String(i).padStart(4, '0')}`;

export const round2 = (x: number) => Math.round(x * 100) / 100;
