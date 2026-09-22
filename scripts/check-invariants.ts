import { prisma as db } from '../src/lib/db';
import { runChecks } from '../src/lib/invariants';

async function main() {
  const findings = await runChecks(db);
  if (findings.length === 0) {
    console.log('INVARIANTS CLEAN');
  } else {
    console.log(`INVARIANT FINDINGS (${findings.length}):`);
    for (const f of findings) console.log(' - ' + f);
    process.exitCode = 1;
  }
  await db.$disconnect();
}

main().catch(async (e) => {
  console.error('checker crashed:', e);
  await db.$disconnect();
  process.exit(2);
});
