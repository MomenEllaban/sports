import type { PrismaClient } from '@prisma/client';
import { BRANCH_MAIN_ID, BRANCH_SAMOUHA_ID } from './branches.js';
import { FIRST, LAST, synthPhone, mulberry32 } from './utils.js';

export async function seedSuppliers(db: PrismaClient) {
  const sups = [
    { code: 'SUP-EGY-01', name: 'شركة النصر للاستيراد والأدوات الرياضية', contactPerson: 'المهندس مصطفى كامل', phone: '02 33458899', email: 'info@elnasr-sports.eg', address: 'منطقة شق الثعبان، القاهرة', taxNumber: 'FAKE-499-102-334' },
    { code: 'SUP-EGY-02', name: 'المتحدة للتجهيزات الرياضية', contactPerson: 'أ. كريم عادل', phone: '03 5761234', email: 'sales@united-sports.eg', address: 'سموحة، الإسكندرية', taxNumber: 'FAKE-201-554-908' },
    { code: 'SUP-EGY-03', name: 'سبورتس هاوس للملابس', contactPerson: 'أ. منى الشريف', phone: '02 26778899', email: 'info@sportshouse.eg', address: 'مدينة نصر، القاهرة', taxNumber: 'FAKE-310-007-221' },
    { code: 'SUP-EGY-04', name: 'الدلتا للمعدات', contactPerson: 'أ. حسن علي', phone: '050 2345678', email: 'delta@equip.eg', address: 'المنصورة، الدقهلية', taxNumber: 'FAKE-118-340-556' },
    { code: 'SUP-EGY-05', name: 'فيتنس برو للتجهيزات', contactPerson: 'م. سارة فهمي', phone: '03 4255667', email: 'pro@fitnesspro.eg', address: 'كفر عبده، الإسكندرية', taxNumber: 'FAKE-902-113-447' },
    { code: 'SUP-EGY-06', name: 'أكوا سبورتس للمستلزمات المائية', contactPerson: 'أ. عمرو حسني', phone: '02 4455667', email: 'aqua@aqua-sports.eg', address: 'المهندسين، الجيزة', taxNumber: 'FAKE-771-209-883' },
  ];
  for (const s of sups) {
    await db.supplier.upsert({ where: { code: s.code }, create: s, update: s });
  }
  return sups.length;
}

export async function seedCustomers(db: PrismaClient) {
  const rand = mulberry32(77);
  const areas = ['رشدي', 'سموحة', 'ميامي', 'العجمي', 'سيدي جابر', 'كليوباترا', 'جليم', 'ستانلي'];
  let n = 0;
  for (let i = 1; i <= 40; i++) {
    const phone = synthPhone(i);
    const name = `${FIRST[Math.floor(rand() * FIRST.length)]} ${LAST[Math.floor(rand() * LAST.length)]}`;
    const area = areas[Math.floor(rand() * areas.length)];
    await db.customer.upsert({
      where: { phone },
      create: {
        phone, name, loyaltyPoints: i % 4 === 0 ? Math.floor(rand() * 300) : 0,
        addresses: { create: { title: 'المنزل', street: `${i} شارع الجمهورية، ${area}`, city: 'الإسكندرية', governorate: 'الإسكندرية', isDefault: true } },
      },
      update: { name },
    });
    n++;
  }
  return n;
}

export async function seedEmployees(db: PrismaClient) {
  const defs = [
    { email: 'manager.ibrahimeyah@sports-champions.local', name: 'مدير فرع الإبراهيمية', phone: '01000000011', roleTitle: 'Branch Manager', salary: 12000, type: 'MONTHLY' as const, comm: 0.02, branch: BRANCH_MAIN_ID },
    { email: 'manager.smouha@sports-champions.local', name: 'مدير فرع سموحة', phone: '01000000012', roleTitle: 'Branch Manager', salary: 12000, type: 'MONTHLY' as const, comm: 0.02, branch: BRANCH_SAMOUHA_ID },
    { email: 'cashier.ibrahimeyah@sports-champions.local', name: 'كاشير الإبراهيمية', phone: '01000000013', roleTitle: 'POS Cashier', salary: 6500, type: 'MONTHLY' as const, comm: 0.01, branch: BRANCH_MAIN_ID },
    { email: 'cashier.smouha@sports-champions.local', name: 'كاشير سموحة', phone: '01000000014', roleTitle: 'POS Cashier', salary: 6500, type: 'MONTHLY' as const, comm: 0.01, branch: BRANCH_SAMOUHA_ID },
    { email: 'staff.ibrahimeyah@sports-champions.local', name: 'موظف مبيعات إبراهيمية', phone: '01000000015', roleTitle: 'Sales Staff', salary: 45, type: 'HOURLY' as const, comm: 0.0, branch: BRANCH_MAIN_ID },
    { email: 'finance@sports-champions.local', name: 'مدير الحسابات', phone: '01000000016', roleTitle: 'Finance Manager', salary: 14000, type: 'MONTHLY' as const, comm: 0.0, branch: BRANCH_MAIN_ID },
    { email: 'admin@sports-champions.local', name: 'المدير العام', phone: '01000000017', roleTitle: 'General Manager', salary: 20000, type: 'MONTHLY' as const, comm: 0.0, branch: BRANCH_MAIN_ID },
    { email: 'staff.ibrahimeyah@sports-champions.local', name: 'موظف مخزن', phone: '01000000018', roleTitle: 'Warehouse Staff', salary: 5500, type: 'MONTHLY' as const, comm: 0.005, branch: BRANCH_SAMOUHA_ID },
  ];
  // NOTE: staff.ibrahimeyah user exists once; warehouse staff links to same user (demo data).
  let n = 0;
  for (const d of defs) {
    const user = await db.user.findUnique({ where: { email: d.email } });
    await db.employee.upsert({
      where: { id: `emp-${d.email.split('@')[0]}` },
      create: { id: `emp-${d.email.split('@')[0]}`, userId: user?.id || null, name: d.name, phone: d.phone, roleTitle: d.roleTitle, salary: d.salary, salaryType: d.type, commissionRate: d.comm, branchId: d.branch, isActive: true },
      update: { name: d.name, salary: d.salary, commissionRate: d.comm, isActive: true },
    });
    n++;
  }
  return n;
}

export async function seedExpenses(db: PrismaClient) {
  const rand = mulberry32(913);
  const cats = ['RENT', 'UTILITIES', 'SALARIES', 'MARKETING', 'MAINTENANCE', 'SUPPLIES', 'TAXES', 'OTHER'] as const;
  const descs: Record<string, string[]> = {
    RENT: ['إيجار الفرع الشهري'], UTILITIES: ['فاتورة الكهرباء', 'فاتورة المياه والإنترنت'],
    SALARIES: ['سلفة موظف'], MARKETING: ['إعلانات سوشيال ميديا', 'طباعة بانرات'],
    MAINTENANCE: ['صيانة المشايات', 'صيانة التكييف'], SUPPLIES: ['أكياس ومنظفات', 'ورق فواتير'],
    TAXES: ['دفعة ضريبية'], OTHER: ['مصروفات نثرية'],
  };
  const users = await db.user.findMany({ take: 3 });
  const by = users[0]?.id || 'seed-admin';
  let n = 0;
  for (let m = 0; m < 3; m++) {
    const d = new Date();
    d.setMonth(d.getMonth() - m);
    for (const c of cats) {
      for (const desc of descs[c]) {
        if (rand() < 0.35) continue;
        n++;
        await db.expense.upsert({
          where: { expenseNumber: `EXP-D-${d.getFullYear()}${m}-${c}-${n}` },
          create: {
            expenseNumber: `EXP-D-${d.getFullYear()}${m}-${c}-${n}`,
            branchId: rand() < 0.6 ? BRANCH_MAIN_ID : BRANCH_SAMOUHA_ID,
            category: c, description: `${desc} - شهر ${m + 1}`,
            amount: Math.round((500 + rand() * 20000) * 100) / 100,
            date: d, createdById: by,
          },
          update: {},
        });
      }
    }
  }
  return n;
}
