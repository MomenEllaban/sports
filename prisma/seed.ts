/**
 * Legacy entry kept for `npm run db:seed`. Delegates to the modular seeder (T02).
 * Usage: `npx tsx prisma/seed.ts [minimal|demo|reset]`
 */
import('./seed/run.js').catch((e) => {
  console.error(e);
  process.exit(1);
});
