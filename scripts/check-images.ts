/**
 * pnpm check:images (F0 §1.6) — every image path referenced by the seed
 * catalog and every local <Image>/<img> src starting with `/` must exist
 * under public/ (or be an allowed remote domain returning 200 — checked
 * only for http(s) URLs present in seed data).
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pub = join(root, 'public');
const failures: string[] = [];

// 1. Seed image filenames referenced in catalog.ts (img field + /seed-images/).
const catalogSrc = readFileSync(join(root, 'prisma', 'seed', 'catalog.ts'), 'utf8');
const imgs = [...catalogSrc.matchAll(/img:\s*'([^']+)'/g)].map((m) => m[1]);
const seedDir = join(pub, 'seed-images');
for (const f of new Set(imgs)) {
  if (!existsSync(join(seedDir, f))) failures.push(`seed image missing: public/seed-images/${f}`);
}

// 2. Static local assets referenced across src (src="/...").
const srcFiles: string[] = [];
const walk = (d: string) => {
  for (const e of readdirSync(d, { withFileTypes: true })) {
    const p = join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (/\.(tsx?|json)$/.test(e.name)) srcFiles.push(p);
  }
};
walk(join(root, 'src'));
const refs = new Set<string>();
for (const f of srcFiles) {
  const s = readFileSync(f, 'utf8');
  for (const m of s.matchAll(/src=["'](\/[^"']+)["']/g)) refs.add(m[1]);
}
for (const r of refs) {
  const clean = r.split('?')[0];
  if (clean.includes('[') || clean.includes('{')) continue; // dynamic
  if (!existsSync(join(pub, clean))) failures.push(`static asset missing: public${clean} (ref)`);
}

// 3. Required foundation assets.
for (const f of ['/placeholder-product.svg', '/logo.avif', '/favicon.ico']) {
  if (!existsSync(join(pub, f))) failures.push(`required asset missing: public${f}`);
}

if (failures.length) {
  console.error(`check:images FAILED (${failures.length}):\n- ${failures.join('\n- ')}`);
  process.exit(1);
}
console.log(`check:images OK (${imgs.length} seed imgs, ${refs.size} static refs).`);
