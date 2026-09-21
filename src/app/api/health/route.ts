import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

/** Liveness probe (F1): public, no secrets, DB ping included. */
export async function GET() {
  let db: 'up' | 'down' = 'down';
  try {
    await prisma.$queryRaw`SELECT 1`;
    db = 'up';
  } catch {
    db = 'down';
  }
  const status = db === 'up' ? 200 : 503;
  return NextResponse.json(
    { success: db === 'up', service: 'sports-champions', db, at: new Date().toISOString() },
    { status }
  );
}
