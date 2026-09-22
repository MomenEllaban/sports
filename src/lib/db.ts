import { PrismaClient } from '@prisma/client';

const globalForPrisma = global as unknown as { prisma: PrismaClient };

// Neon's PgBouncer pooler adds ~700ms per query (pooler -> compute round trip),
// which makes login and every dashboard screen feel sluggish. Route Prisma to
// the direct endpoint when configured — ~5x faster per query. `directUrl` keeps
// using DIRECT_URL for migrations, so the pooler stays available for that path.
const clientUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    datasources: clientUrl ? { db: { url: clientUrl } } : undefined,
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
