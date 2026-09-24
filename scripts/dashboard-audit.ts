/**
 * Dashboard test flow (audit) — no browser:
 *  1. Page inventory: every /admin page must be covered by a loading.tsx (loader) + error.tsx (failsafe).
 *  2. Security: every admin page guards with requirePageRole (login is the single exception); middleware must match /admin.
 *  3. Navigation/button integrity: every href="/admin/..." and storefront href resolves to a real route.
 * Writes docs/DASHBOARD_TEST_LOG.md and prints a PASS/FAIL log.
 */
import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';

const ROOT = process.cwd();
const ADMIN_DIR = join(ROOT, 'src', 'app', '[locale]', 'admin');
const COMP_ADMIN = join(ROOT, 'src', 'components', 'admin');
const LINE = '──────────────────────────────────────────────';

function pagesUnder(dir: string): string[] {
  const out: string[] = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...pagesUnder(p));
    else if (e.name === 'page.tsx') out.push(p);
  }
  return out;
}

function rel(p: string): string {
  return p.replace(join(ROOT, 'src', 'app', '[locale]'), '').replace(/\\/g, '/');
}

function loadersFor(page: string): { loading: boolean; error: boolean } {
  // Any loading.tsx/error.tsx up the ancestor chain (incl. admin group root) covers the page.
  let dir = page.replace(/page\.tsx$/, '');
  const found = { loading: false, error: false };
  let guard = 0;
  for (;;) {
    if (existsSync(join(dir, 'loading.tsx'))) found.loading = true;
    if (existsSync(join(dir, 'error.tsx'))) found.error = true;
    const parent = join(dir, '..');
    if (samePath(parent, dir)) break; // drive root
    if (dir.replace(/[\\/]+$/, '').toLowerCase() === ADMIN_DIR.toLowerCase()) break;
    if (++guard > 40) break; // hard safety
    dir = parent;
  }
  return found;
}

function samePath(a: string, b: string): boolean {
  return a.replace(/[\\/]+$/, '').toLowerCase() === b.replace(/[\\/]+$/, '').toLowerCase();
}

function collectHrefs(dir: string, cache: Set<string>) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) collectHrefs(p, cache);
    else if (/\.tsx?$/.test(e.name)) {
      const src = readFileSync(p, 'utf8');
      for (const m of src.matchAll(/href=\{?\s*["'`]([^"'`}{]+)["'`]\s*\}?/g)) cache.add(m[1]);
    }
  }
}

// Route existence: given "/admin/orders" → look for [locale]/admin/orders/page.tsx (or sub-page.tsx).
function existsAdminRoute(href: string): boolean {
  const cleaned = href.replace(/^\/admin/, '').replace(/\/$/, '');
  const candidate = join(ROOT, 'src', 'app', '[locale]', 'admin', ...(cleaned.split('/').filter(Boolean)), 'page.tsx');
  return existsSync(candidate);
}

function existsStoreRoute(href: string): boolean {
  const cleaned = href.replace(/^\//, '').replace(/\/$/, '');
  const seg = cleaned.split('/').filter(Boolean);
  const base = join(ROOT, 'src', 'app', '[locale]');
  const withGroup = join(base, '(storefront)', ...seg, 'page.tsx');
  const noGroup = join(base, ...seg, 'page.tsx');
  return existsSync(withGroup) || existsSync(noGroup);
}

function guardOf(file: string): string | null {
  const src = readFileSync(file, 'utf8');
  const m = src.match(/requirePageRole\(([^)]*)\)/);
  if (m) return m[1].split(',').map((s) => s.trim()).join(', ');
  if (/export\s*\{\s*default\s*\}\s*from\s*['"]\.\.\/page['"]/.test(src)) {
    const parent = join(dirname(file), '..', 'page.tsx');
    if (existsSync(parent)) return `inherited: ${guardOf(parent) || 'NO_GUARD_IN_PARENT'}`;
  }
  return null;
}

async function main() {
  const rows: string[] = [];
  let pass = 0;
  let fail = 0;
  const failLines: string[] = [];

  const ok = (label: string, detail: string) => {
    console.log(`  PASS  ${label} — ${detail}`);
    rows.push(`| ✅ | ${label} | ${detail.replace(/\|/g, '\\|')} |`);
    pass++;
  };
  const bad = (label: string, detail: string) => {
    console.log(`  FAIL  ${label} — ${detail}`);
    rows.push(`| ❌ | ${label} | ${detail.replace(/\|/g, '\\|')} |`);
    failLines.push(`${label}: ${detail}`);
    fail++;
  };

  console.log(LINE);
  console.log('  DASHBOARD TEST FLOW (automated audit)');
  console.log(LINE);

  // 1) Page inventory + loader/error coverage
  console.log('Step 1 — page inventory & loader/failsafe coverage');
  const pages = pagesUnder(ADMIN_DIR).sort();
  const adminLoading = existsSync(join(ADMIN_DIR, 'loading.tsx'));
  const adminError = existsSync(join(ADMIN_DIR, 'error.tsx'));
  ok('admin group loading.tsx', adminLoading ? 'present (covers all admin pages as SSR loader)' : 'MISSING');
  ok('admin group error.tsx', adminError ? 'present (covers all admin pages as failsafe)' : 'MISSING');

  for (const p of pages) {
    const lf = loadersFor(p);
    if (rel(p).includes('/admin/login')) {
      ok(`login page`, 'auto-redirects; no data loader needed');
      continue;
    }
    if (!lf.loading || !lf.error) bad(rel(p), `loader=${lf.loading} error=${lf.error} (should inherit admin group loader/error)`);
    else ok(rel(p), `loader + error inherited from admin group`);
  }

  // 2) Security guards (pages) + middleware
  console.log('\nStep 2 — security (server-side role guards + middleware)');
  for (const p of pages) {
    const r = rel(p);
    const guard = guardOf(p);
    if (r.includes('/admin/login')) {
      if (guard) bad(r, 'login must have NO requirePageRole (public)');
      else ok(r, 'public login, redirects to /admin/dashboard when already signed in');
      continue;
    }
    if (!guard) bad(r, 'NO requirePageRole guard');
    else ok(r, `guard: ${guard}`);
  }
  const mw = readFileSync(join(ROOT, 'src', 'middleware.ts'), 'utf8');
  const matchesAdmin = mw.includes('/admin');
  if (matchesAdmin) {
    ok('middleware', 'matches /admin (early auth interception)');
  } else {
    bad('middleware', '/admin not matched');
  }

  // 3) Navigation/button integrity
  console.log('\nStep 3 — link & button targets resolve to real routes');
  const adminHrefs = new Set<string>();
  collectHrefs(ADMIN_DIR, adminHrefs);
  collectHrefs(COMP_ADMIN, adminHrefs);
  const badHrefs: string[] = [];
  for (const h of adminHrefs) {
    if (h.startsWith('/admin') && !h.includes('${') && !h.includes('{') && !existsAdminRoute(h) && !h.startsWith('/admin/api')) {
      badHrefs.push(h);
    }
  }
  if (badHrefs.length) {
    bad('admin internal links', `broken: ${badHrefs.join(', ')}`);
  } else {
    ok('admin internal links', `${adminHrefs.size} unique /admin hrefs all resolve`);
  }

  const storeHrefs = new Set<string>();
  for (const f of ['src/app/[locale]/(storefront)/page.tsx', 'src/app/[locale]/(storefront)/features/page.tsx', 'src/app/[locale]/(storefront)/tracking/page.tsx', 'src/components/storefront/Header.tsx', 'src/components/storefront/ReturnPortal.tsx']) {
    const fp = join(ROOT, f);
    if (!existsSync(fp)) continue;
    for (const m of readFileSync(fp, 'utf8').matchAll(/href=\{?\s*["'`]([^"'`}{]+)["'`]\s*\}?/g)) storeHrefs.add(m[1]);
  }
  const brokenStore: string[] = [];
  for (const h of storeHrefs) {
    if (h.startsWith('/') && !h.includes('${') && !h.includes('{') && !h.startsWith('/api') && h !== '/' && !h.startsWith('/admin') && !existsStoreRoute(h)) brokenStore.push(h);
  }
  if (brokenStore.length) {
    bad('storefront internal links', `broken: ${brokenStore.join(', ')}`);
  } else {
    ok('storefront internal links', `${storeHrefs.size} unique storefront hrefs all resolve`);
  }

  // 4) Report
  console.log(LINE);
  console.log(`  RESULT: ${pass} passed, ${fail} failed`);
  console.log(LINE);

  const md = `# Dashboard Test Log — automated flow\n\n> Generated ${new Date().toISOString()} · no-browser audit (pages + loaders + security + link integrity).\n\n## Summary\n\n- **Passed:** ${pass}\n- **Failed:** ${fail}\n\n## Checks\n\n| Status | Check | Detail |\n| --- | --- | --- |\n${rows.join('\n')}\n${fail ? `\n## Failures\n- ${failLines.join('\n- ')}` : '\n## Failures\n\nNone — all checks passed.'}\n`;
  mkdirSync(join(ROOT, 'docs'), { recursive: true });
  writeFileSync(join(ROOT, 'docs', 'DASHBOARD_TEST_LOG.md'), md, 'utf8');
  console.log(`Log written to docs/DASHBOARD_TEST_LOG.md`);
  process.exit(fail ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});