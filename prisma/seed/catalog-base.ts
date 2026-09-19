import type { PrismaClient } from '@prisma/client';

const CATS = [
  { slug: 'cardio-fitness', nameAr: 'معدات اللياقة البدنية والكارديو', nameEn: 'Cardio & Fitness Equipment' },
  { slug: 'swimming-gear', nameAr: 'مستلزمات السباحة والرياضات المائية', nameEn: 'Swimming & Water Sports Gear' },
  { slug: 'gym-accessories', nameAr: 'أدوات الجيم والإكسسوارات', nameEn: 'Gym Accessories & Training Gear' },
  { slug: 'apparel-footwear', nameAr: 'الملابس والأحذية الرياضية', nameEn: 'Sportswear & Specialty Shoes' },
  { slug: 'medical-protection', nameAr: 'الواقيات والأحزمة العلاجية', nameEn: 'Sports Medical & Protection' },
  { slug: 'team-sports', nameAr: 'الرياضات الجماعية والكرات', nameEn: 'Team Sports & Balls' },
];

const BRANDS = [
  { slug: 'cougar', nameAr: 'كوجار', nameEn: 'Cougar Fitness' },
  { slug: 'speedo', nameAr: 'سبيدو', nameEn: 'Speedo' },
  { slug: 'trx', nameAr: 'تي آر إكس', nameEn: 'TRX Training' },
  { slug: 'kt-tape', nameAr: 'كا تي تيب', nameEn: 'KT Tape' },
  { slug: 'nike', nameAr: 'نايك', nameEn: 'Nike' },
  { slug: 'adidas', nameAr: 'أديداس', nameEn: 'Adidas' },
  { slug: 'molten', nameAr: 'مولتن', nameEn: 'Molten' },
  { slug: 'generic', nameAr: 'ماركة عامة', nameEn: 'Generic' },
];

export async function seedCategories(db: PrismaClient) {
  for (const c of CATS) {
    await db.category.upsert({ where: { slug: c.slug }, create: c, update: c });
  }
  return CATS.length;
}

export async function seedBrands(db: PrismaClient) {
  for (const b of BRANDS) {
    await db.brand.upsert({ where: { slug: b.slug }, create: b, update: b });
  }
  return BRANDS.length;
}
