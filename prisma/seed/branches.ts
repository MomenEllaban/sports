import type { PrismaClient } from '@prisma/client';

export const BRANCH_MAIN_ID = 'branch-ibrahimeyah';
export const BRANCH_SAMOUHA_ID = 'branch-smouha';

export async function seedBranches(db: PrismaClient) {
  for (const b of [
    {
      id: BRANCH_MAIN_ID,
      name: 'فرع الإبراهيمية (الرئيسي)',
      nameEn: 'Al Ibrahimeyah Flagship Branch',
      address: '92 شارع عمر لطفى، الإبراهيمية بحري، سيدي جابر، باب شرقي، الإسكندرية',
      addressEn: '92 Omar Lotfy St, Al Ibrahimeyah Bahri, Sidi Gaber, Bab Sharqi, Alexandria',
      phone: '03 5926908',
      workingHours: 'Sat–Wed 10am–10pm, Thu–Fri 10am–11pm',
    },
    {
      id: BRANCH_SAMOUHA_ID,
      name: 'فرع سموحة',
      nameEn: 'Smouha Branch',
      address: 'شارع فوزي معاذ، أمام نادى سموحة، الإسكندرية',
      addressEn: 'Fawzy Moaz St, opposite Smouha Club, Alexandria',
      phone: '03 4200112',
      workingHours: 'Everyday 10am–11pm',
    },
  ]) {
    await db.branch.upsert({
      where: { id: b.id },
      create: { ...b, city: 'Alexandria', isActive: true },
      update: { ...b, isActive: true },
    });
  }
  return 2;
}
