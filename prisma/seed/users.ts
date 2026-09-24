import type { PrismaClient, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { BRANCH_MAIN_ID, BRANCH_SAMOUHA_ID } from './branches.js';

export interface SeedUser {
  email: string;
  name: string;
  role: Role;
  branchIds: string[];
  branchId: string | null;
}

/** One user per role; BRANCH_MANAGER/CASHIER per branch. Password from SEED_DEFAULT_PASSWORD. */
export async function seedUsers(db: PrismaClient, password: string) {
  const hash = await bcrypt.hash(password, 10);
  const resetCredentials = process.env.SEED_RESET_CREDENTIALS === 'true';
  const users: SeedUser[] = [
    { email: 'admin@sports-champions.local', name: 'المدير العام', role: 'SUPER_ADMIN', branchIds: [BRANCH_MAIN_ID, BRANCH_SAMOUHA_ID], branchId: BRANCH_MAIN_ID },
    { email: 'finance@sports-champions.local', name: 'مدير الحسابات', role: 'FINANCE', branchIds: [BRANCH_MAIN_ID, BRANCH_SAMOUHA_ID], branchId: null },
    { email: 'manager.ibrahimeyah@sports-champions.local', name: 'مدير فرع الإبراهيمية', role: 'BRANCH_MANAGER', branchIds: [BRANCH_MAIN_ID], branchId: BRANCH_MAIN_ID },
    { email: 'manager.smouha@sports-champions.local', name: 'مدير فرع سموحة', role: 'BRANCH_MANAGER', branchIds: [BRANCH_SAMOUHA_ID], branchId: BRANCH_SAMOUHA_ID },
    { email: 'cashier.ibrahimeyah@sports-champions.local', name: 'كاشير الإبراهيمية', role: 'CASHIER', branchIds: [BRANCH_MAIN_ID], branchId: BRANCH_MAIN_ID },
    { email: 'cashier.smouha@sports-champions.local', name: 'كاشير سموحة', role: 'CASHIER', branchIds: [BRANCH_SAMOUHA_ID], branchId: BRANCH_SAMOUHA_ID },
    { email: 'staff.ibrahimeyah@sports-champions.local', name: 'موظف الإبراهيمية', role: 'STAFF', branchIds: [BRANCH_MAIN_ID], branchId: BRANCH_MAIN_ID },
  ];
  for (const u of users) {
    await db.user.upsert({
      where: { email: u.email },
      create: { ...u, passwordHash: hash, phone: '01000000000', isActive: true },
      update: {
        name: u.name,
        role: u.role,
        branchIds: u.branchIds,
        branchId: u.branchId,
        ...(resetCredentials ? { passwordHash: hash, isActive: true } : {}),
      },
    });
  }
  // Optional manager discount PINs are supplied through the environment and
  // are never hardcoded or printed by the seed runner.
  const pins: Array<[string, string | undefined]> = [
    ['manager.ibrahimeyah@sports-champions.local', process.env.SEED_MANAGER_PIN_PRIMARY],
    ['manager.smouha@sports-champions.local', process.env.SEED_MANAGER_PIN_SECONDARY],
  ];
  for (const [email, pin] of pins) {
    if (!pin || !/^\d{4,8}$/.test(pin)) continue;
    await db.user.update({
      where: { email },
      data: { managerPinHash: await bcrypt.hash(pin, 10), pinFailedAttempts: 0, pinLockedUntil: null },
    });
  }
  return users;
}
