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
    { id: 'INSTAPAY', enabled: false, handle: '' },
    { id: 'VODAFONE_CASH', enabled: false, number: '' },
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
  // 4.1 ETA eInvoicing — settings-gated (off until the customer fills credentials).
  'eta.mode': 'off',
  'eta.clientId': '',
  'eta.clientSecret': '',
  'eta.taxRegNumber': '123-456-789',
  // ETA-spike — branch/activity/signing (used in T14, safe defaults).
  'eta.branchCode': '0',
  'eta.activityCode': '',
  'eta.signingUrl': '',
  // 4.2 WhatsApp Business Cloud API — settings-gated.
  'whatsapp.mode': 'off',
  'whatsapp.phoneId': '',
  'whatsapp.token': '',
  'whatsapp.templateOrder': 'order_confirmation',
  // 4.3 Customer portal toggle.
  'portal.enabled': true,
  // F0 — new registry keys (safe defaults, DEFAULT_UNCONFIRMED until admin confirms).
  'paymob.apiKey': '',
  'paymob.integrationId': '',
  'paymob.iframeId': '',
  'paymob.hmacSecret': '',
  'fawry.merchantCode': '',
  'fawry.secureKey': '',
  'couriers.bostaApiKey': '',
  'couriers.mylerzApiKey': '',
  'loyalty.redeemRate': 1,
  'loyalty.maxRedeemPct': 20,
  'discount.maxTotalPct': 30,
  'orders.unpaidExpiryHours': 48,
  'shifts.openingFloat': 500,
  'shifts.maxShortage': 50,
  // T16 — discount stacking rules.
  'discount.stacking': { allowCouponLoyalty: true, allowCouponPin: false },
  // T12 — dead stock window.
  'reports.deadStockDays': 60,
  // T-RMA returns policy (safe defaults, DEFAULT_UNCONFIRMED).
  'returns.enabled': true,
  'returns.windowDays': 14,
  'returns.exchangeWindowDays': 14,
  'returns.nonReturnableCategories': ['swimming-gear', 'medical-protection'],
  'returns.requireReceipt': true,
  'returns.reasons': ['SIZE_ISSUE', 'DEFECTIVE', 'WRONG_ITEM', 'NOT_AS_DESCRIBED', 'CHANGED_MIND', 'OTHER'],
  'returns.requirePhotoForReasons': ['DEFECTIVE'],
  'returns.refundDeliveryFee': 'FULL_RETURN_OR_OUR_FAULT',
  'returns.restockingFeePct': 0,
  'returns.whoPaysReturnShipping': 'STORE_IF_OUR_FAULT',
  'returns.cashRefundManagerThreshold': 500,
  'returns.autoApproveMaxValue': 1000,
  'returns.maxReturnsPerCustomerPerMonth': 5,
  'returns.allowedRefundMethods': ['CASH', 'ORIGINAL_GATEWAY', 'INSTAPAY', 'VODAFONE', 'BANK_TRANSFER'],
  'returns.slaHours': 72,
  'returns.policyText': [{ ar: 'الاستبدال والاسترجاع خلال 14 يوماً بالفاتورة', en: 'Returns within 14 days with receipt' }],
  'returns.receiveBranchDefault': 'SALE_BRANCH',
  'returns.reverseCourierEnabled': false,
  'loyalty.allowNegativeOnReturn': true,
  'coupons.restoreOnFullReturn': false,
  'returns.notifyWhatsapp': true,
  // T07 — size charts per category slug.
  'sizecharts': [
    { category: 'apparel-footwear', titleAr: 'جدول مقاسات الملابس', titleEn: 'Apparel size chart', columns: ['المقاس', 'الصدر (سم)', 'الطول (سم)'], rows: [['S', '88-93', '66'], ['M', '94-99', '69'], ['L', '100-105', '71'], ['XL', '106-111', '74'], ['XXL', '112-117', '76']] },
  ],
  // F1 — rate limits, upload cap, OTP mode (safe defaults).
  'ratelimit.trackPerMin': 30,
  'ratelimit.portalLoginPerMin': 10,
  'ratelimit.uploadPerMin': 20,
  'upload.receiptMaxMb': 5,
  'portal.otpMode': 'off',
};

export async function seedSettings(db: PrismaClient) {
  for (const [key, value] of Object.entries(DEFAULTS)) {
    await db.setting.upsert({ where: { key }, create: { key, value: JSON.stringify(value) }, update: {} });
  }
  return Object.keys(DEFAULTS).length;
}
