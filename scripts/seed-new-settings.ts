import { PrismaClient } from '@prisma/client';
import { seedSettings } from '../prisma/seed/settings.js';

async function main() {
  const db = new PrismaClient();
  try {
    const n = await seedSettings(db);
    console.log('seeded keys:', n);
  } finally {
    await db.$disconnect();
  }
}

main().catch((e) => {
  console.error('settings seed failed:', e);
  process.exit(1);
});
