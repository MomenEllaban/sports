import type { PrismaClient } from '@prisma/client';

const DEFAULTS: Record<string, unknown> = {
  'store.nameAr': 'ابطال الرياضة الإبراهيمية',
  'store.nameEn': 'Sports Champions Alexandria',
  'store.landline': '03 5926908',
  'store.whatsapp': '01224226876',
  'store.addressAr': '92 شارع عمر لطفى، الإبراهيمية بحري، سيدي جابر، الإسكندرية',
  'store.addressEn': '92 Omar Lotfy St, Ibrahimeyah, Sidi Gaber, Alexandria',
  'store.taxNumber': '123-456-789',
  'vat.rate': 0.14,
  'vat.mode': 'exclusive',
  'shipping.zones': [
    { id: 'ALX-CENTRAL', nameAr: 'الإبراهيمية / سيدي جابر', nameEn: 'Ibrahimeyah / Sidi Gaber', fee: 25 },
    { id: 'ALX-EAST', nameAr: 'شرق الإسكندرية', nameEn: 'East Alexandria', fee: 35 },
    { id: 'ALX-SMOUHA', nameAr: 'سموحة', nameEn: 'Smouha', fee: 30 },
    { id: 'ALX-WEST', nameAr: 'العجمي', nameEn: 'Agami', fee: 55 },
    { id: 'CAIRO-GIZA', nameAr: 'القاهرة الكبرى', nameEn: 'Greater Cairo', fee: 65 },
    { id: 'DELTA', nameAr: 'الدلتا', nameEn: 'Delta', fee: 75 },
    { id: 'CANAL-UPPER', nameAr: 'القناة والصعيد', nameEn: 'Canal & Upper Egypt', fee: 95 },
  ],
  'payments.methods': [
    { id: 'COD', enabled: true },
    { id: 'PAYMOB', enabled: false },
    { id: 'FAWRY', enabled: false },
    { id: 'INSTAPAY', enabled: true, handle: 'sports.champions@instapay' },
    { id: 'VODAFONE_CASH', enabled: true, number: '01001234567' },
    { id: 'CASH', enabled: true },
    { id: 'CARD', enabled: true },
  ],
  'loyalty.earnPerEgp': 10,
  'loyalty.pointsPerUnit': 1,
  'discount.approvalThreshold': 100,
  'stock.lowThreshold': 5,
  'receipt.headerAr': 'ابطال الرياضة الإبراهيمية — شكراً لتسوقكم معنا',
  'receipt.footerAr': 'الاستبدال والاسترجاع خلال 14 يوماً بالفاتورة',
  'integrations': { paymob: false, fawry: false, bosta: false, mylerz: false, eta: false, whatsapp: false },
};

export async function seedSettings(db: PrismaClient) {
  for (const [key, value] of Object.entries(DEFAULTS)) {
    await db.setting.upsert({ where: { key }, create: { key, value: JSON.stringify(value) }, update: {} });
  }
  return Object.keys(DEFAULTS).length;
}
