import { PrismaClient } from '@prisma/client';
import { runChecks } from '../src/lib/invariants.js';

const db = new PrismaClient();

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
