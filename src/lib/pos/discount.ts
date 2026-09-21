import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/db';
import { getDiscountThreshold } from '@/lib/settings';

const MAX_PIN_ATTEMPTS = 5;
const LOCK_MINUTES = 15;

export class DiscountAuthError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export interface DiscountDecision {
  approvedById: string | null;
}

/**
 * Server-authoritative discount authorization (T06).
 * - amount <= threshold: no approval needed.
 * - BM/SUPER_ADMIN session: self-approved (approver = actor).
 * - otherwise: valid manager PIN required (bcrypt, any BRANCH_MANAGER/SUPER_ADMIN
 *   with a pinHash). Failures counted on the ACTOR; 5 fails -> 15min lock.
 */
export async function authorizeDiscount(
  actorId: string,
  actorRole: string,
  amount: number,
  pin?: string | null
): Promise<DiscountDecision> {
  if (!(amount > 0)) return { approvedById: null };
  const threshold = await getDiscountThreshold();
  if (amount <= threshold) return { approvedById: null };

  const actor = await prisma.user.findUnique({ where: { id: actorId } });
  if (!actor) throw new DiscountAuthError(401, 'Unauthorized');
  if (actor.pinLockedUntil && actor.pinLockedUntil > new Date()) {
    throw new DiscountAuthError(423, 'تم إيقاف الخصومات مؤقتاً بعد محاولات خاطئة. حاول بعد ١٥ دقيقة.');
  }

  if (actorRole === 'BRANCH_MANAGER' || actorRole === 'SUPER_ADMIN') {
    return { approvedById: actor.id };
  }

  if (!pin) {
    throw new DiscountAuthError(422, `الخصم فوق ${threshold} ج.م يتطلب اعتماد المدير (PIN)`);
  }

  const managers = await prisma.user.findMany({
    where: { role: { in: ['BRANCH_MANAGER', 'SUPER_ADMIN'] }, isActive: true, managerPinHash: { not: null } },
    select: { id: true, managerPinHash: true },
  });
  for (const m of managers) {
    if (m.managerPinHash && (await bcrypt.compare(pin, m.managerPinHash))) {
      await prisma.user.update({ where: { id: actor.id }, data: { pinFailedAttempts: 0, pinLockedUntil: null } });
      return { approvedById: m.id };
    }
  }

  const fails = actor.pinFailedAttempts + 1;
  const locked = fails >= MAX_PIN_ATTEMPTS;
  await prisma.user.update({
    where: { id: actor.id },
    data: {
      pinFailedAttempts: fails,
      ...(locked ? { pinLockedUntil: new Date(Date.now() + LOCK_MINUTES * 60 * 1000) } : {}),
    },
  });
  if (locked) {
    throw new DiscountAuthError(423, 'تم إيقاف الخصومات مؤقتاً بعد محاولات خاطئة. حاول بعد ١٥ دقيقة.');
  }
  throw new DiscountAuthError(422, 'كلمة سر المدير غير صحيحة');
}

/** Hash + store a manager PIN (SUPER_ADMIN only, called from users API). */
export async function setManagerPin(userId: string, pin: string): Promise<void> {
  if (!/^\d{4,8}$/.test(pin)) {
    throw new DiscountAuthError(400, 'PIN must be 4-8 digits');
  }
  await prisma.user.update({
    where: { id: userId },
    data: { managerPinHash: await bcrypt.hash(pin, 10), pinFailedAttempts: 0, pinLockedUntil: null },
  });
}
