import type { FullConfig } from '@playwright/test';

/**
 * `next dev` compiles a route the first time it is requested, and the spec that
 * happens to request it first pays the cost. With two workers on a cold server
 * that showed up as login waits and `page.goto` timeouts in whichever test ran
 * first, not as a real failure. Warming the routes the suite visits moves that
 * cost in front of the run, so the specs start against compiled routes.
 *
 * Requests are sequential on purpose: concurrent cold compiles contend for the
 * same build cache and are slower than doing them one at a time.
 */
const WARM_PATHS = [
  // Admin session: the login page, then the dashboard the login lands on. The
  // specs that timed out on a cold server were always the first ones to log in.
  '/admin/login',
  '/admin',
  '/ar/admin/login',
  '/ar/admin',
];

export default async function globalSetup(_config: FullConfig) {
  const base = process.env.E2E_BASE_URL || 'http://localhost:3102';
  for (const path of WARM_PATHS) {
    try {
      await fetch(new URL(path, base), { redirect: 'follow' });
    } catch {
      // Warm-up is best effort: a route that refuses to answer here fails
      // loudly in the spec that actually needs it.
    }
  }
}
