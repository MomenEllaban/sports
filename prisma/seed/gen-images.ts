import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildModels } from './catalog.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, '../../public/seed-images');

const PALETTES: Array<[string, string]> = [
  ['#1e3a8a', '#f8fafc'], ['#065f46', '#f8fafc'], ['#7c2d12', '#fef3c7'],
  ['#4c1d95', '#f8fafc'], ['#0c4a6e', '#f8fafc'], ['#78350f', '#fef3c7'],
];

/** Generates simple local SVG placeholders (no downloads, no copyrighted images). */
function run() {
  fs.mkdirSync(OUT, { recursive: true });
  const models = buildModels();
  const seen = new Set<string>();
  let i = 0;
  for (const m of models) {
    if (seen.has(m.img)) continue;
    seen.add(m.img);
    const [bg, fg] = PALETTES[i++ % PALETTES.length];
    const firstSku = m.skus[0]?.sku || 'SKU';
    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800" viewBox="0 0 800 800">` +
      `<rect width="800" height="800" fill="${bg}"/>` +
      `<circle cx="400" cy="330" r="150" fill="none" stroke="${fg}" stroke-width="18" opacity="0.85"/>` +
      `<rect x="250" y="520" width="300" height="26" rx="13" fill="${fg}" opacity="0.85"/>` +
      `<text x="400" y="610" text-anchor="middle" font-family="sans-serif" font-size="44" font-weight="bold" fill="${fg}">${firstSku}</text>` +
      `</svg>`;
    fs.writeFileSync(path.join(OUT, m.img), svg);
  }
  console.log(`seed-images: ${seen.size} placeholders written to public/seed-images/`);
}
run();
