import type { PrismaClient } from '@prisma/client';
import { mulberry32, ean13, round2 } from './utils.js';
import { groupSlugForSku } from '../../src/lib/catalog/groups.js';

interface SkuSpec {
  sku: string;
  nameAr: string;
  nameEn: string;
  price: number;
  size?: string;
  color?: string;
  stockMain: number;
  stockSmouha: number;
  featured?: boolean;
  active?: boolean;
  image?: boolean; // false => product without image
}

interface ModelSpec {
  cat: string;
  brand: string | null;
  descAr: string;
  descEn: string;
  img: string; // seed-images filename
  skus: SkuSpec[];
}

const SIZES_APPAREL = ['S', 'M', 'L', 'XL', 'XXL'];
const COLORS_BASIC = ['أسود/Black', 'كحلي/Navy', 'رمادي/Gray'];
const SHOE_SIZES = ['39', '40', '41', '42', '43', '44', '45'];

function apparelSkus(prefix: string, baseAr: string, baseEn: string, price: number, sizes: string[], colors: string[], stock: [number, number]): SkuSpec[] {
  const out: SkuSpec[] = [];
  sizes.forEach((s, si) =>
    colors.forEach((c, ci) => {
      const [arC, enC] = c.split('/');
      out.push({
        sku: `${prefix}-${s}-${si}${ci}`,
        nameAr: `${baseAr} - مقاس ${s} (${arC})`,
        nameEn: `${baseEn} - Size ${s} (${enC})`,
        price, size: s, color: arC,
        stockMain: stock[0], stockSmouha: stock[1],
      });
    })
  );
  return out;
}

export function buildModels(): ModelSpec[] {
  const M: ModelSpec[] = [
    { cat: 'apparel-footwear', brand: 'nike', descAr: 'تيشيرت تدريب خفيف سريع الجفاف', descEn: 'Lightweight quick-dry training t-shirt', img: 'tshirt.svg',
      skus: apparelSkus('TSH-DRY', 'تيشيرت تدريب دراي', 'Dry Training T-Shirt', 450, ['S', 'M', 'L', 'XL', 'XXL'], COLORS_BASIC, [30, 20]) },
    { cat: 'apparel-footwear', brand: 'adidas', descAr: 'شورت تدريب مريح بجيوب', descEn: 'Comfort training shorts with pockets', img: 'shorts.svg',
      skus: apparelSkus('SHR-TRN', 'شورت تدريب', 'Training Shorts', 380, ['S', 'M', 'L', 'XL'], COLORS_BASIC.slice(0, 2), [25, 15]) },
    { cat: 'apparel-footwear', brand: 'nike', descAr: 'حذاء جري بنعل ماص للصدمات', descEn: 'Running shoes with shock-absorbing sole', img: 'shoes.svg',
      skus: SHOE_SIZES.map((s, i) => ({ sku: `RUN-NK-${s}`, nameAr: `حذاء جري - مقاس ${s}`, nameEn: `Running Shoes - Size ${s}`, price: 2200, size: s, stockMain: 8, stockSmouha: 5, featured: i === 3 })) },
    { cat: 'apparel-footwear', brand: 'generic', descAr: 'حذاء باليه قماش مريح', descEn: 'Comfortable canvas ballet shoes', img: 'ballet.svg',
      skus: ['36', '37', '38', '39', '40', '41'].map((s) => ({ sku: `BLT-CNV-${s}`, nameAr: `حذاء باليه - مقاس ${s}`, nameEn: `Ballet Shoes - Size ${s}`, price: 420, size: s, stockMain: 12, stockSmouha: 8 })) },
    { cat: 'swimming-gear', brand: 'speedo', descAr: 'نظارة سباحة ضد التغبيش', descEn: 'Anti-fog swimming goggles', img: 'goggles.svg',
      skus: ['أسود/Black', 'أزرق/Blue', 'شفاف/Clear'].map((c, i) => { const [a, e] = c.split('/'); return { sku: `GOG-SPD-0${i}`, nameAr: `نظارة سباحة (${a})`, nameEn: `Swimming Goggles (${e})`, price: 550, color: a, stockMain: 20, stockSmouha: 12, featured: i === 0 }; }) },
    { cat: 'swimming-gear', brand: 'speedo', descAr: 'كاب سيليكون مقاوم للكلور', descEn: 'Chlorine-resistant silicone cap', img: 'cap.svg',
      skus: ['أسود/Black', 'أزرق/Blue', 'وردي/Pink', 'أبيض/White'].map((c, i) => { const [a, e] = c.split('/'); return { sku: `CAP-SIL-0${i}`, nameAr: `كاب سباحة سيليكون (${a})`, nameEn: `Silicone Swim Cap (${e})`, price: 350, color: a, stockMain: 45, stockSmouha: 30, featured: i === 1 }; }) },
    { cat: 'swimming-gear', brand: 'generic', descAr: 'مايوه تدريب بوليستر', descEn: 'Polyester training swimsuit', img: 'swimsuit.svg',
      skus: ['S', 'M', 'L', 'XL'].map((s) => ({ sku: `SWM-SUT-${s}`, nameAr: `مايوه تدريب - مقاس ${s}`, nameEn: `Training Swimsuit - Size ${s}`, price: 690, size: s, stockMain: 15, stockSmouha: 9 })) },
    { cat: 'gym-accessories', brand: 'generic', descAr: 'طقم دمبل مطاطي', descEn: 'Rubber coated dumbbell pair', img: 'dumbbell.svg',
      skus: [2.5, 5, 7.5, 10, 12.5, 15].map((w, i) => ({ sku: `DMB-RB-${String(w).replace('.', 'p')}`, nameAr: `دمبل ${w} كجم (جوز)`, nameEn: `${w}kg Dumbbell Pair`, price: 400 + w * 90, stockMain: 10, stockSmouha: 6, featured: i === 3 })) },
    { cat: 'gym-accessories', brand: 'generic', descAr: 'كيتل بيل حديد', descEn: 'Cast iron kettlebell', img: 'kettlebell.svg',
      skus: [4, 6, 8, 12, 16].map((w) => ({ sku: `KTL-IR-${w}`, nameAr: `كيتل بيل ${w} كجم`, nameEn: `${w}kg Kettlebell`, price: 350 + w * 70, stockMain: 9, stockSmouha: 5 })) },
    { cat: 'gym-accessories', brand: 'generic', descAr: 'سجادة يوجا مضادة للانزلاق', descEn: 'Anti-slip yoga mat', img: 'yogamat.svg',
      skus: ['بنفسجي/Purple', 'أزرق/Blue', 'وردي/Pink', 'أسود/Black'].map((c, i) => { const [a, e] = c.split('/'); return { sku: `YGA-MAT-0${i}`, nameAr: `سجادة يوجا (${a})`, nameEn: `Yoga Mat (${e})`, price: 480, color: a, stockMain: 25, stockSmouha: 15 }; }) },
    { cat: 'gym-accessories', brand: 'trx', descAr: 'أحزمة تمارين معلقة', descEn: 'Suspension training straps', img: 'trx.svg',
      skus: [{ sku: 'TRX-PRO-KIT', nameAr: 'طقم أحزمة TRX Pro', nameEn: 'TRX Pro Suspension Kit', price: 1450, stockMain: 22, stockSmouha: 12, featured: true }] },
    { cat: 'gym-accessories', brand: 'generic', descAr: 'قفازات جيم مبطنة', descEn: 'Padded gym gloves', img: 'gloves.svg',
      skus: ['S', 'M', 'L', 'XL'].map((s) => ({ sku: `GLV-PAD-${s}`, nameAr: `قفازات جيم - مقاس ${s}`, nameEn: `Gym Gloves - Size ${s}`, price: 290, size: s, stockMain: 30, stockSmouha: 18 })) },
    { cat: 'cardio-fitness', brand: 'cougar', descAr: 'مشاية كهربائية 3.5 حصان', descEn: '3.5HP motorized treadmill', img: 'treadmill.svg',
      skus: [{ sku: 'COU-TR-900', nameAr: 'مشاية كوجار T-900', nameEn: 'Cougar Treadmill T-900', price: 18500, stockMain: 2, stockSmouha: 1, featured: true }] },
    { cat: 'cardio-fitness', brand: 'cougar', descAr: 'عجلة مغناطيسية ثابتة', descEn: 'Magnetic stationary bike', img: 'bike.svg',
      skus: [{ sku: 'COU-BK-500', nameAr: 'عجلة كوجار B-500', nameEn: 'Cougar Bike B-500', price: 6800, stockMain: 3, stockSmouha: 2, featured: true }] },
    { cat: 'cardio-fitness', brand: 'generic', descAr: 'بنش حديد قابل للتعديل', descEn: 'Adjustable weight bench', img: 'bench.svg',
      skus: [{ sku: 'BNCH-ADJ-01', nameAr: 'بنش حديد قابل للتعديل', nameEn: 'Adjustable Bench', price: 3400, stockMain: 4, stockSmouha: 0 }] },
    { cat: 'medical-protection', brand: 'kt-tape', descAr: 'شريط كينيسيو 5 متر', descEn: '5m kinesiology tape', img: 'kttape.svg',
      skus: ['أسود/Black', 'أزرق/Blue', 'وردي/Pink'].map((c, i) => { const [a, e] = c.split('/'); return { sku: `KTT-5M-0${i}`, nameAr: `شريط KT (${a})`, nameEn: `KT Tape (${e})`, price: 490, color: a, stockMain: 40, stockSmouha: 25, featured: i === 0 }; }) },
    { cat: 'medical-protection', brand: 'generic', descAr: 'دعامة ركبة ضاغطة', descEn: 'Compression knee support', img: 'knee.svg',
      skus: ['S', 'M', 'L', 'XL'].map((s) => ({ sku: `KNE-CMP-${s}`, nameAr: `دعامة ركبة - مقاس ${s}`, nameEn: `Knee Support - Size ${s}`, price: 260, size: s, stockMain: 28, stockSmouha: 16 })) },
    { cat: 'medical-protection', brand: 'generic', descAr: 'دعامة كاحل مرنة', descEn: 'Elastic ankle support', img: 'ankle.svg',
      skus: ['M', 'L', 'XL'].map((s) => ({ sku: `ANK-EL-${s}`, nameAr: `دعامة كاحل - مقاس ${s}`, nameEn: `Ankle Support - Size ${s}`, price: 190, size: s, stockMain: 4, stockSmouha: 3 })) },
    { cat: 'medical-protection', brand: 'generic', descAr: 'حزام ظهر حراري', descEn: 'Thermal back support belt', img: 'back.svg',
      skus: ['M', 'L', 'XL'].map((s) => ({ sku: `BCK-TH-${s}`, nameAr: `حزام ظهر - مقاس ${s}`, nameEn: `Back Belt - Size ${s}`, price: 380, size: s, stockMain: 0, stockSmouha: 6 })) },
    { cat: 'team-sports', brand: 'molten', descAr: 'كرة قدم مقاس رسمي', descEn: 'Official size football', img: 'football.svg',
      skus: [{ sku: 'BAL-FB-5', nameAr: 'كرة قدم مقاس 5', nameEn: 'Football Size 5', price: 750, stockMain: 20, stockSmouha: 12, featured: true }] },
    { cat: 'team-sports', brand: 'molten', descAr: 'كرة سلة جلد صناعي', descEn: 'Composite leather basketball', img: 'basketball.svg',
      skus: [{ sku: 'BAL-BB-7', nameAr: 'كرة سلة مقاس 7', nameEn: 'Basketball Size 7', price: 890, stockMain: 3, stockSmouha: 2 }] },
    { cat: 'team-sports', brand: 'generic', descAr: 'حبل قفز احترافي', descEn: 'Pro speed jump rope', img: 'rope.svg',
      skus: [{ sku: 'RPE-SPD-01', nameAr: 'حبل قفز سرعة', nameEn: 'Speed Jump Rope', price: 150, stockMain: 0, stockSmouha: 0, active: true }] },
    { cat: 'gym-accessories', brand: 'generic', descAr: 'زجاجة مياه رياضية 1 لتر', descEn: '1L sports bottle', img: 'bottle.svg',
      skus: [{ sku: 'BTL-1L-01', nameAr: 'زجاجة مياه 1 لتر', nameEn: 'Sports Bottle 1L', price: 120, stockMain: 60, stockSmouha: 40 }] },
    { cat: 'apparel-footwear', brand: 'adidas', descAr: 'شنطة جيم كبيرة', descEn: 'Large gym duffel bag', img: 'bag.svg',
      skus: [{ sku: 'BAG-GYM-01', nameAr: 'شنطة جيم كبيرة', nameEn: 'Gym Duffel Bag', price: 950, stockMain: 2, stockSmouha: 0, active: false }] },
    { cat: 'gym-accessories', brand: 'generic', descAr: 'حزام رفع أثقال جلد', descEn: 'Leather weightlifting belt', img: 'belt.svg',
      skus: ['M', 'L', 'XL', 'XXL'].map((s) => ({ sku: `BLT-WL-${s}`, nameAr: `حزام رفع أثقال - مقاس ${s}`, nameEn: `Weightlifting Belt - Size ${s}`, price: 620, size: s, stockMain: 14, stockSmouha: 8 })) },
    { cat: 'gym-accessories', brand: 'generic', descAr: 'لفافات معصم قطنية', descEn: 'Cotton wrist wraps', img: 'wraps.svg',
      skus: [{ sku: 'WRP-CTN-01', nameAr: 'لفافات معصم', nameEn: 'Wrist Wraps', price: 180, stockMain: 35, stockSmouha: 20 }] },
    { cat: 'gym-accessories', brand: 'generic', descAr: 'رول فوم للتعافي', descEn: 'Recovery foam roller', img: 'roller.svg',
      skus: [{ sku: 'RLR-FM-01', nameAr: 'رول فوم 45 سم', nameEn: 'Foam Roller 45cm', price: 390, stockMain: 18, stockSmouha: 10 }] },
    { cat: 'gym-accessories', brand: 'generic', descAr: 'بار أولمبي 20 كجم', descEn: '20kg Olympic barbell bar', img: 'bar.svg',
      skus: [{ sku: 'BAR-OLY-20', nameAr: 'بار أولمبي 20 كجم', nameEn: 'Olympic Bar 20kg', price: 4200, stockMain: 3, stockSmouha: 1 }] },
    { cat: 'gym-accessories', brand: 'generic', descAr: 'طارات حديد مطاطية', descEn: 'Rubber coated weight plates', img: 'plates.svg',
      skus: [5, 10, 15, 20].map((w) => ({ sku: `PLT-RB-${w}`, nameAr: `طارة ${w} كجم`, nameEn: `${w}kg Plate`, price: 300 + w * 55, stockMain: 12, stockSmouha: 8 })) },
    { cat: 'cardio-fitness', brand: 'cougar', descAr: 'جهاز إليبتيكال منزلي', descEn: 'Home elliptical trainer', img: 'elliptical.svg',
      skus: [{ sku: 'COU-EL-300', nameAr: 'إليبتيكال كوجار E-300', nameEn: 'Cougar Elliptical E-300', price: 12500, stockMain: 1, stockSmouha: 1 }] },
    { cat: 'gym-accessories', brand: 'generic', descAr: 'قفازات ملاكمة جلد', descEn: 'Leather boxing gloves', img: 'boxing.svg',
      skus: ['10oz', '12oz', '14oz'].map((s) => ({ sku: `BOX-LTH-${s}`, nameAr: `قفازات ملاكمة ${s}`, nameEn: `Boxing Gloves ${s}`, price: 780, size: s, stockMain: 10, stockSmouha: 6 })) },
    { cat: 'apparel-footwear', brand: 'generic', descAr: 'واقي ساق كرة قدم', descEn: 'Football shin guards', img: 'shin.svg',
      skus: ['S', 'M', 'L'].map((s) => ({ sku: `SHN-FB-${s}`, nameAr: `واقي ساق - مقاس ${s}`, nameEn: `Shin Guards - Size ${s}`, price: 160, size: s, stockMain: 22, stockSmouha: 14 })) },
    { cat: 'team-sports', brand: 'generic', descAr: 'مضرب تنس احترافي', descEn: 'Pro tennis racket', img: 'tennis.svg',
      skus: [{ sku: 'RKT-TN-01', nameAr: 'مضرب تنس احترافي', nameEn: 'Pro Tennis Racket', price: 1450, stockMain: 7, stockSmouha: 4 }] },
    { cat: 'team-sports', brand: 'generic', descAr: 'كرة طائرة رسمية', descEn: 'Official volleyball', img: 'volleyball.svg',
      skus: [{ sku: 'BAL-VB-01', nameAr: 'كرة طائرة رسمية', nameEn: 'Official Volleyball', price: 690, stockMain: 11, stockSmouha: 7 }] },
    { cat: 'team-sports', brand: 'generic', descAr: 'طقم تنس طاولة', descEn: 'Table tennis set', img: 'pingpong.svg',
      skus: [{ sku: 'TT-SET-01', nameAr: 'طقم تنس طاولة (مضربان + 3 كرات)', nameEn: 'Table Tennis Set', price: 520, stockMain: 16, stockSmouha: 9 }] },
    { cat: 'gym-accessories', brand: 'generic', descAr: 'بلوك يوجا فوم', descEn: 'EVA foam yoga block', img: 'yogablock.svg',
      skus: [{ sku: 'YGA-BLK-01', nameAr: 'بلوك يوجا', nameEn: 'Yoga Block', price: 180, stockMain: 50, stockSmouha: 30 }] },
    { cat: 'apparel-footwear', brand: 'generic', descAr: 'شراب رياضي قطن (3 أزواج)', descEn: 'Cotton sport socks 3-pack', img: 'socks.svg',
      skus: ['39-42', '43-46', '35-38'].map((s) => ({ sku: `SOK-CT-${s}`, nameAr: `شراب رياضي - مقاس ${s}`, nameEn: `Sport Socks - Size ${s}`, price: 140, size: s, stockMain: 40, stockSmouha: 25 })) },
    { cat: 'apparel-footwear', brand: 'adidas', descAr: 'هودي قطن بجيب أمامي', descEn: 'Cotton hoodie with front pocket', img: 'hoodie.svg',
      skus: apparelSkus('HOD-CTN', 'هودي قطن', 'Cotton Hoodie', 780, ['S', 'M', 'L', 'XL', 'XXL'], ['أسود/Black', 'رمادي/Gray', 'كحلي/Navy'], [18, 12]) },
    { cat: 'apparel-footwear', brand: 'nike', descAr: 'بنطلون تدريب خفيف', descEn: 'Light training pants', img: 'pants.svg',
      skus: apparelSkus('PNT-TRN', 'بنطلون تدريب', 'Training Pants', 620, ['S', 'M', 'L', 'XL'], ['أسود/Black', 'رمادي/Gray'], [20, 12]) },
    { cat: 'apparel-footwear', brand: 'generic', descAr: 'كاب رياضي قطن', descEn: 'Cotton sports cap', img: 'sportcap.svg',
      skus: ['أسود/Black', 'أبيض/White', 'أحمر/Red', 'كحلي/Navy'].map((c, i) => { const [a, e] = c.split('/'); return { sku: `CAP-SP-0${i}`, nameAr: `كاب رياضي (${a})`, nameEn: `Sports Cap (${e})`, price: 210, color: a, stockMain: 33, stockSmouha: 21 }; }) },
    { cat: 'gym-accessories', brand: 'generic', descAr: 'ساعة ستوب ووتش', descEn: 'Digital stopwatch', img: 'stopwatch.svg',
      skus: [{ sku: 'STW-DG-01', nameAr: 'ستوب ووتش رقمية', nameEn: 'Digital Stopwatch', price: 220, stockMain: 13, stockSmouha: 8 }] },
  ];
  return M;
}

/** Deterministic cost = 55-75% of price via PRNG. */
export function costFor(price: number, rand: () => number) {
  return round2(price * (0.55 + rand() * 0.2));
}

export async function seedCatalog(db: PrismaClient) {
  const rand = mulberry32(20260919);
  const models = buildModels();
  const cats = await db.category.findMany();
  const brands = await db.brand.findMany();
  const catId = (slug: string) => cats.find((c) => c.slug === slug)!.id;
  const brandId = (slug: string | null) => (slug ? brands.find((b) => b.slug === slug)?.id || null : null);

  let skuCount = 0, n = 0;
  for (const m of models) {
    for (const s of m.skus) {
      n++;
      await db.product.upsert({
        where: { sku: s.sku },
        create: {
          sku: s.sku,
          barcode: ean13(n),
          nameAr: s.nameAr,
          nameEn: s.nameEn,
          descriptionAr: m.descAr,
          descriptionEn: m.descEn,
          price: s.price,
          costPrice: costFor(s.price, rand),
          categoryId: catId(m.cat),
          brandId: brandId(m.brand),
          size: s.size || null,
          color: s.color || null,
          isFeatured: s.featured || false,
          isActive: s.active !== false,
          images: s.image === false ? [] : [`/seed-images/${m.img}`],
          groupSlug: groupSlugForSku(s.sku),
        },
        update: {
          nameAr: s.nameAr, nameEn: s.nameEn, price: s.price,
          size: s.size || null, color: s.color || null,
          isFeatured: s.featured || false, isActive: s.active !== false,
          categoryId: catId(m.cat), brandId: brandId(m.brand),
          groupSlug: groupSlugForSku(s.sku),
        },
      });
      skuCount++;
    }
  }
  return { models: models.length, skus: skuCount };
}
