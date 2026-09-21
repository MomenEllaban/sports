/**
 * pnpm check:i18n (F0 §1.3) — ar/en message keys must match exactly.
 * Compares flattened key sets of messages/ar.json and messages/en.json.
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const ar = JSON.parse(readFileSync(join(root, 'messages', 'ar.json'), 'utf8')) as unknown;
const en = JSON.parse(readFileSync(join(root, 'messages', 'en.json'), 'utf8')) as unknown;

function flat(o: unknown, p = ''): string[] {
  if (o === null || typeof o !== 'object') return [p];
  return Object.entries(o as Record<string, unknown>).flatMap(([k, v]) => flat(v, p ? `${p}.${k}` : k));
}
const a = new Set(flat(ar));
const e = new Set(flat(en));
const missingInEn = [...a].filter((k) => !e.has(k));
const missingInAr = [...e].filter((k) => !a.has(k));
if (missingInEn.length || missingInAr.length) {
  console.error('check:i18n FAILED:');
  for (const k of missingInEn) console.error(`  missing in en.json: ${k}`);
  for (const k of missingInAr) console.error(`  missing in ar.json: ${k}`);
  process.exit(1);
}
console.log(`check:i18n OK (${a.size} keys each).`);
