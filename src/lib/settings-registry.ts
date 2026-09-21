/**
 * Settings registry (F0) — SINGLE SOURCE OF TRUTH for every configurable
 * business value. No business value (rates, limits, durations, phones,
 * receipt texts, integration keys) may live hardcoded in code; each one
 * must be registered here with client-facing guidance.
 *
 * Status model:
 * - MISSING: required value with no usable value stored.
 * - DEFAULT_UNCONFIRMED: a safe default was seeded by us; admin must confirm.
 * - CONFIRMED: admin explicitly saved/confirmed the value via Settings UI.
 *
 * Confirmation is tracked in the Setting row itself: values are stored as
 * JSON `{ v: <actual>, _confirmed: true }` once confirmed. Legacy plain
 * values (seeded before F0) read as unconfirmed defaults.
 */

export type SettingOwner = 'CLIENT' | 'ACCOUNTANT' | 'PROVIDER' | 'DEV';
export type SettingValueType = 'text' | 'number' | 'boolean' | 'select' | 'list' | 'secret';
export type SettingStatus = 'MISSING' | 'DEFAULT_UNCONFIRMED' | 'CONFIRMED';

export interface SettingDef {
  key: string;
  group: string;
  groupAr: string;
  labelAr: string;
  labelEn: string;
  helpAr: string;
  helpEn: string;
  type: SettingValueType;
  required: boolean;
  sensitive: boolean;
  featureGate: string;
  owner: SettingOwner;
  example?: string;
  options?: string[];
  defaultValue: unknown;
}

export const SETUP_GROUPS = [
  { id: 'store', ar: 'بيانات المتجر والفروع', en: 'Store & branches' },
  { id: 'tax', ar: 'الضريبة والإيصالات', en: 'Tax & receipts' },
  { id: 'payments', ar: 'بوابات الدفع', en: 'Payment gateways' },
  { id: 'shipping', ar: 'الشحن والتوصيل', en: 'Shipping' },
  { id: 'loyalty', ar: 'الولاء والخصومات', en: 'Loyalty & discounts' },
  { id: 'stock', ar: 'المخزون', en: 'Stock' },
  { id: 'eta', ar: 'الفاتورة الإلكترونية ETA', en: 'ETA e-invoicing' },
  { id: 'whatsapp', ar: 'واتساب للأعمال', en: 'WhatsApp Business' },
  { id: 'portal', ar: 'بوابة العميل', en: 'Customer portal' },
  { id: 'security', ar: 'الأمان والحدود', en: 'Security & limits' },
  { id: 'ops', ar: 'التشغيل (طلبات/ورديات)', en: 'Operations' },
] as const;

export const SETTINGS_REGISTRY: SettingDef[] = [
  // ── Store ──────────────────────────────────────────────
  { key: 'store.nameAr', group: 'store', groupAr: 'بيانات المتجر والفروع', labelAr: 'اسم المتجر (عربي)', labelEn: 'Store name (AR)', helpAr: 'يظهر في الإيصالات والمتجر. أكّد الاسم التجاري.', helpEn: 'Shown on receipts and storefront.', type: 'text', required: true, sensitive: false, featureGate: 'storefront', owner: 'CLIENT', defaultValue: 'ابطال الرياضة الإبراهيمية' },
  { key: 'store.nameEn', group: 'store', groupAr: 'بيانات المتجر والفروع', labelAr: 'اسم المتجر (إنجليزي)', labelEn: 'Store name (EN)', helpAr: 'الاسم بالإنجليزية للفواتير والنسخة الإنجليزية.', helpEn: 'English name for invoices and EN locale.', type: 'text', required: true, sensitive: false, featureGate: 'storefront', owner: 'CLIENT', defaultValue: 'Sports Champions Alexandria' },
  { key: 'store.landline', group: 'store', groupAr: 'بيانات المتجر والفروع', labelAr: 'التليفون الأرضي', labelEn: 'Landline', helpAr: 'رقم الفرع الرئيسي ويظهر أعلى المتجر وفي الإيصال.', helpEn: 'Flagship branch phone.', type: 'text', required: true, sensitive: false, featureGate: 'storefront', owner: 'CLIENT', example: '03 5926908', defaultValue: '03 5926908' },
  { key: 'store.whatsapp', group: 'store', groupAr: 'بيانات المتجر والفروع', labelAr: 'رقم واتساب الطلبات', labelEn: 'Orders WhatsApp', helpAr: 'الرقم الذي يستقبل طلبات الواتساب المباشرة من كروت المنتجات.', helpEn: 'Number receiving direct WhatsApp orders.', type: 'text', required: true, sensitive: false, featureGate: 'storefront', owner: 'CLIENT', example: '01224226876', defaultValue: '01224226876' },
  { key: 'store.addressAr', group: 'store', groupAr: 'بيانات المتجر والفروع', labelAr: 'عنوان الفرع (عربي)', labelEn: 'Branch address (AR)', helpAr: 'عنوان الاستلام المجاني والإيصالات.', helpEn: 'Pickup address and receipts.', type: 'text', required: true, sensitive: false, featureGate: 'storefront', owner: 'CLIENT', defaultValue: '92 شارع عمر لطفى، الإبراهيمية بحري، سيدي جابر، الإسكندرية' },
  { key: 'store.addressEn', group: 'store', groupAr: 'بيانات المتجر والفروع', labelAr: 'عنوان الفرع (إنجليزي)', labelEn: 'Branch address (EN)', helpAr: 'نفس العنوان بالإنجليزية.', helpEn: 'Same address in English.', type: 'text', required: false, sensitive: false, featureGate: 'storefront', owner: 'CLIENT', defaultValue: '92 Omar Lotfy St, Ibrahimeyah, Sidi Gaber, Alexandria' },
  { key: 'store.taxNumber', group: 'store', groupAr: 'بيانات المتجر والفروع', labelAr: 'الرقم الضريبي (احتياطي)', labelEn: 'Tax number (fallback)', helpAr: 'يُستخدم في QR الإيصال عند غياب إعداد ETA. هاته من البطاقة الضريبية.', helpEn: 'Used in receipt QR when ETA is off. From the tax card.', type: 'text', required: true, sensitive: false, featureGate: 'receipts', owner: 'ACCOUNTANT', example: '123-456-789', defaultValue: '123-456-789' },
  // ── Tax & receipts ─────────────────────────────────────
  { key: 'vat.rate', group: 'tax', groupAr: 'الضريبة والإيصالات', labelAr: 'نسبة ضريبة القيمة المضافة', labelEn: 'VAT rate', helpAr: 'النسبة المطبقة على كل الفواتير (0.14 = 14%). أكّدها مع المحاسب.', helpEn: 'Applied to every invoice. Confirm with accountant.', type: 'number', required: true, sensitive: false, featureGate: 'pricing', owner: 'ACCOUNTANT', example: '0.14', defaultValue: 0.14 },
  { key: 'receipt.headerAr', group: 'tax', groupAr: 'الضريبة والإيصالات', labelAr: 'ترويسة الإيصال', labelEn: 'Receipt header', helpAr: 'سطر يطبع أعلى الإيصال الحراري.', helpEn: 'Printed at the top of thermal receipts.', type: 'text', required: false, sensitive: false, featureGate: 'receipts', owner: 'CLIENT', defaultValue: 'ابطال الرياضة الإبراهيمية — شكراً لتسوقكم معنا' },
  { key: 'receipt.footerAr', group: 'tax', groupAr: 'الضريبة والإيصالات', labelAr: 'تذييل الإيصال (سياسة الاسترجاع)', labelEn: 'Receipt footer (returns policy)', helpAr: 'يحدد للعميل مدة وشروط الاستبدال والاسترجاع. راجع T10 لسياسة الأيام.', helpEn: 'Tells the customer the return window.', type: 'text', required: true, sensitive: false, featureGate: 'receipts', owner: 'CLIENT', defaultValue: 'الاستبدال والاسترجاع خلال 14 يوماً بالفاتورة' },
  // ── Payments ───────────────────────────────────────────
  { key: 'payments.methods', group: 'payments', groupAr: 'بوابات الدفع', labelAr: 'طرق الدفع المفعّلة', labelEn: 'Enabled payment methods', helpAr: 'تحكم أي طرق تظهر في checkout. Paymob/Fawry لا تظهر إلا بعد ملء مفاتيحها.', helpEn: 'Controls checkout options. Gateways hidden until keys are set.', type: 'list', required: true, sensitive: false, featureGate: 'checkout', owner: 'CLIENT', defaultValue: [{ id: 'COD', enabled: true }] },
  { key: 'paymob.apiKey', group: 'payments', groupAr: 'بوابات الدفع', labelAr: 'Paymob API Key', labelEn: 'Paymob API key', helpAr: 'من لوحة Paymob ← Developers ← API Keys. بدونه الدفع بالبطاقة مخفي.', helpEn: 'From Paymob dashboard → Developers → API Keys.', type: 'secret', required: false, sensitive: true, featureGate: 'paymob', owner: 'PROVIDER', defaultValue: '' },
  { key: 'paymob.integrationId', group: 'payments', groupAr: 'بوابات الدفع', labelAr: 'Paymob Integration ID', labelEn: 'Paymob integration ID', helpAr: 'رقم الـ Integration (بطاقات/محافظ) من لوحة Paymob.', helpEn: 'Integration ID from Paymob dashboard.', type: 'text', required: false, sensitive: false, featureGate: 'paymob', owner: 'PROVIDER', defaultValue: '' },
  { key: 'paymob.iframeId', group: 'payments', groupAr: 'بوابات الدفع', labelAr: 'Paymob Iframe ID', labelEn: 'Paymob iframe ID', helpAr: 'رقم الـ Iframe الذي يُعرض فيه الدفع.', helpEn: 'Iframe ID for the payment page.', type: 'text', required: false, sensitive: false, featureGate: 'paymob', owner: 'PROVIDER', defaultValue: '' },
  { key: 'paymob.hmacSecret', group: 'payments', groupAr: 'بوابات الدفع', labelAr: 'Paymob HMAC Secret', labelEn: 'Paymob HMAC secret', helpAr: 'يُستخدم للتحقق من webhooks. من إعدادات الـ Integration.', helpEn: 'Verifies webhooks. From integration settings.', type: 'secret', required: false, sensitive: true, featureGate: 'paymob', owner: 'PROVIDER', defaultValue: '' },
  { key: 'fawry.merchantCode', group: 'payments', groupAr: 'بوابات الدفع', labelAr: 'Fawry Merchant Code', labelEn: 'Fawry merchant code', helpAr: 'كود التاجر من حساب Fawry Business.', helpEn: 'Merchant code from Fawry Business.', type: 'text', required: false, sensitive: false, featureGate: 'fawry', owner: 'PROVIDER', defaultValue: '' },
  { key: 'fawry.secureKey', group: 'payments', groupAr: 'بوابات الدفع', labelAr: 'Fawry Secure Key', labelEn: 'Fawry secure key', helpAr: 'مفتاح التوقيع من حساب Fawry Business (سرّي).', helpEn: 'Signature key from Fawry Business (secret).', type: 'secret', required: false, sensitive: true, featureGate: 'fawry', owner: 'PROVIDER', defaultValue: '' },
  // ── Shipping ───────────────────────────────────────────
  { key: 'shipping.zones', group: 'shipping', groupAr: 'الشحن والتوصيل', labelAr: 'مناطق وأسعار الشحن', labelEn: 'Shipping zones & fees', helpAr: 'راجع أسعار المناطق مع شركات الشحن ثم أكّدها هنا.', helpEn: 'Confirm zone fees with couriers.', type: 'list', required: true, sensitive: false, featureGate: 'shipping', owner: 'CLIENT', defaultValue: [] },
  { key: 'couriers.bostaApiKey', group: 'shipping', groupAr: 'الشحن والتوصيل', labelAr: 'Bosta API Key', labelEn: 'Bosta API key', helpAr: 'من لوحة Bosta ← API. بدونه تُنشأ الشحنات يدوياً.', helpEn: 'From Bosta dashboard → API.', type: 'secret', required: false, sensitive: true, featureGate: 'bosta', owner: 'PROVIDER', defaultValue: '' },
  { key: 'couriers.mylerzApiKey', group: 'shipping', groupAr: 'الشحن والتوصيل', labelAr: 'Mylerz API Key', labelEn: 'Mylerz API key', helpAr: 'من حساب Mylerz للأعمال.', helpEn: 'From Mylerz business account.', type: 'secret', required: false, sensitive: true, featureGate: 'mylerz', owner: 'PROVIDER', defaultValue: '' },
  // ── Loyalty & discounts ────────────────────────────────
  { key: 'loyalty.earnPerEgp', group: 'loyalty', groupAr: 'الولاء والخصومات', labelAr: 'الشراء اللازم لنقطة (ج.م)', labelEn: 'EGP per loyalty point', helpAr: 'كل كام جنيه يمنح نقطة (الافتراضي 10).', helpEn: 'Spend per earned point (default 10).', type: 'number', required: true, sensitive: false, featureGate: 'loyalty', owner: 'CLIENT', defaultValue: 10 },
  { key: 'loyalty.redeemRate', group: 'loyalty', groupAr: 'الولاء والخصومات', labelAr: 'قيمة النقطة عند الاستبدال (ج.م)', labelEn: 'Point value on redeem (EGP)', helpAr: 'قيمة الخصم لكل نقطة عند الدفع (T16).', helpEn: 'Discount per point at checkout (T16).', type: 'number', required: false, sensitive: false, featureGate: 'loyalty-redeem', owner: 'CLIENT', defaultValue: 1 },
  { key: 'loyalty.maxRedeemPct', group: 'loyalty', groupAr: 'الولاء والخصومات', labelAr: 'أقصى نسبة خصم بالنقاط %', labelEn: 'Max points discount %', helpAr: 'سقف خصم الولاء من الإجمالي (مثلاً 20%).', helpEn: 'Cap for loyalty discount of total.', type: 'number', required: false, sensitive: false, featureGate: 'loyalty-redeem', owner: 'CLIENT', defaultValue: 20 },
  { key: 'discount.approvalThreshold', group: 'loyalty', groupAr: 'الولاء والخصومات', labelAr: 'حد موافقة المدير على الخصم (ج.م)', labelEn: 'Manager discount approval threshold', helpAr: 'أي خصم فوقه يطلب PIN المدير في POS.', helpEn: 'Discounts above it need manager PIN.', type: 'number', required: true, sensitive: false, featureGate: 'pos-discount', owner: 'CLIENT', defaultValue: 100 },
  { key: 'discount.maxTotalPct', group: 'loyalty', groupAr: 'الولاء والخصومات', labelAr: 'أقصى خصم كلي % (كل القنوات)', labelEn: 'Max combined discount %', helpAr: 'سقف مجموع (كوبون+ولاء+PIN) من الإجمالي (T16).', helpEn: 'Cap for combined discounts (T16).', type: 'number', required: false, sensitive: false, featureGate: 'discount-pipeline', owner: 'CLIENT', defaultValue: 30 },
  // ── Stock ──────────────────────────────────────────────
  { key: 'stock.lowThreshold', group: 'stock', groupAr: 'المخزون', labelAr: 'حد النواقص الافتراضي', labelEn: 'Default low-stock threshold', helpAr: 'يُستخدم عند إنشاء صنف جديد؛ يمكن تخصيصه لكل صنف/فرع.', helpEn: 'Used for new products; per-item override possible.', type: 'number', required: true, sensitive: false, featureGate: 'inventory', owner: 'CLIENT', defaultValue: 5 },
  // ── ETA ────────────────────────────────────────────────
  { key: 'eta.mode', group: 'eta', groupAr: 'الفاتورة الإلكترونية ETA', labelAr: 'وضع ETA', labelEn: 'ETA mode', helpAr: 'off حتى تجهز بيانات... ثم preprod للتجربة ثم production.', helpEn: 'off until ready, then preprod, then production.', type: 'select', required: true, sensitive: false, featureGate: 'eta', owner: 'ACCOUNTANT', options: ['off', 'preprod', 'production'], defaultValue: 'off' },
  { key: 'eta.clientId', group: 'eta', groupAr: 'الفاتورة الإلكترونية ETA', labelAr: 'ETA Client ID', labelEn: 'ETA client ID', helpAr: 'من بوابة مصلحة الضرائب (eInvoicing).', helpEn: 'From the ETA eInvoicing portal.', type: 'secret', required: false, sensitive: true, featureGate: 'eta', owner: 'ACCOUNTANT', defaultValue: '' },
  { key: 'eta.clientSecret', group: 'eta', groupAr: 'الفاتورة الإلكترونية ETA', labelAr: 'ETA Client Secret', labelEn: 'ETA client secret', helpAr: 'سرّي — يُخزن مشفراً.', helpEn: 'Secret — stored encrypted.', type: 'secret', required: false, sensitive: true, featureGate: 'eta', owner: 'ACCOUNTANT', defaultValue: '' },
  { key: 'eta.taxRegNumber', group: 'eta', groupAr: 'الفاتورة الإلكترونية ETA', labelAr: 'رقم التسجيل الضريبي (9 أرقام)', labelEn: 'Tax registration number', helpAr: 'من البطاقة الضريبية. إلزامي لأي إرسال.', helpEn: 'From the tax card. Required for any submission.', type: 'text', required: false, sensitive: false, featureGate: 'eta', owner: 'ACCOUNTANT', example: '123-456-789', defaultValue: '123-456-789' },
  // ── WhatsApp ───────────────────────────────────────────
  { key: 'whatsapp.mode', group: 'whatsapp', groupAr: 'واتساب للأعمال', labelAr: 'وضع واتساب', labelEn: 'WhatsApp mode', helpAr: 'off للوضع التجريبي (سجل فقط)، cloud للإرسال الحقيقي عبر Meta.', helpEn: 'off logs only; cloud sends via Meta.', type: 'select', required: true, sensitive: false, featureGate: 'whatsapp', owner: 'CLIENT', options: ['off', 'cloud'], defaultValue: 'off' },
  { key: 'whatsapp.phoneId', group: 'whatsapp', groupAr: 'واتساب للأعمال', labelAr: 'WhatsApp Phone Number ID', labelEn: 'WhatsApp phone number ID', helpAr: 'من Meta Business ← WhatsApp ← API Setup.', helpEn: 'From Meta Business → WhatsApp → API Setup.', type: 'text', required: false, sensitive: false, featureGate: 'whatsapp', owner: 'PROVIDER', defaultValue: '' },
  { key: 'whatsapp.token', group: 'whatsapp', groupAr: 'واتساب للأعمال', labelAr: 'WhatsApp API Token', labelEn: 'WhatsApp API token', helpAr: 'توكن دائم من Meta (سرّي — يُخزن مشفراً).', helpEn: 'Permanent token from Meta (secret — encrypted).', type: 'secret', required: false, sensitive: true, featureGate: 'whatsapp', owner: 'PROVIDER', defaultValue: '' },
  { key: 'whatsapp.templateOrder', group: 'whatsapp', groupAr: 'واتساب للأعمال', labelAr: 'قالب تأكيد الطلب', labelEn: 'Order confirmation template', helpAr: 'اسم القالب المعتمد في Meta (مثل order_confirmation).', helpEn: 'Approved template name in Meta.', type: 'text', required: false, sensitive: false, featureGate: 'whatsapp', owner: 'CLIENT', defaultValue: 'order_confirmation' },
  // ── Portal ─────────────────────────────────────────────
  { key: 'portal.enabled', group: 'portal', groupAr: 'بوابة العميل', labelAr: 'تفعيل بوابة العميل', labelEn: 'Enable customer portal', helpAr: 'إتاحة دخول العملاء لمتابعة طلباتهم ونقاطهم.', helpEn: 'Lets customers track orders and points.', type: 'boolean', required: false, sensitive: false, featureGate: 'portal', owner: 'CLIENT', defaultValue: true },
  { key: 'portal.otpMode', group: 'portal', groupAr: 'بوابة العميل', labelAr: 'وضع التحقق OTP', labelEn: 'OTP verification mode', helpAr: 'off: دخول برقم الطلب (حالياً). sms: يتطلب OTP — يُفعّل بعد تركيب مزود SMS (T-مستقبل).', helpEn: 'off: order-number login. sms: requires SMS provider (future).', type: 'select', required: false, sensitive: false, featureGate: 'portal', owner: 'CLIENT', options: ['off', 'sms'], defaultValue: 'off' },
  // ── Security & limits ──────────────────────────────────
  { key: 'ratelimit.trackPerMin', group: 'security', groupAr: 'الأمان والحدود', labelAr: 'حد تتبع الطلبات / دقيقة / IP', labelEn: 'Order tracking limit per min per IP', helpAr: 'يمنع تخمين أرقام الطلبات آلياً. الافتراضي 30.', helpEn: 'Blocks order-number enumeration. Default 30.', type: 'number', required: false, sensitive: false, featureGate: 'rate-limit', owner: 'DEV', defaultValue: 30 },
  { key: 'ratelimit.portalLoginPerMin', group: 'security', groupAr: 'الأمان والحدود', labelAr: 'حد محاولات دخول البورتال / دقيقة', labelEn: 'Portal login attempts per min', helpAr: 'يمنع التخمين على البورتال. الافتراضي 10.', helpEn: 'Throttles portal login. Default 10.', type: 'number', required: false, sensitive: false, featureGate: 'rate-limit', owner: 'DEV', defaultValue: 10 },
  { key: 'ratelimit.uploadPerMin', group: 'security', groupAr: 'الأمان والحدود', labelAr: 'حد رفع الإيصالات / دقيقة / IP', labelEn: 'Receipt upload limit per min per IP', helpAr: 'يمنع إغراق التخزين. الافتراضي 20.', helpEn: 'Prevents storage abuse. Default 20.', type: 'number', required: false, sensitive: false, featureGate: 'rate-limit', owner: 'DEV', defaultValue: 20 },
  { key: 'upload.receiptMaxMb', group: 'security', groupAr: 'الأمان والحدود', labelAr: 'أقصى حجم لصورة الإيصال (MB)', labelEn: 'Max receipt image size (MB)', helpAr: 'صور PNG/JPEG/WebP/GIF فقط مع فحص البصمة. الافتراضي 5.', helpEn: 'PNG/JPEG/WebP/GIF with magic-byte check. Default 5.', type: 'number', required: false, sensitive: false, featureGate: 'receipt-upload', owner: 'CLIENT', defaultValue: 5 },
  // ── Ops ────────────────────────────────────────────────
  { key: 'orders.unpaidExpiryHours', group: 'ops', groupAr: 'التشغيل (طلبات/ورديات)', labelAr: 'مهلة إلغاء الطلب غير المدفوع (ساعات)', labelEn: 'Unpaid order expiry (hours)', helpAr: 'بعدها يُلغى تلقائياً مع إرجاع المخزون (F1).', helpEn: 'Then auto-cancelled with restock (F1).', type: 'number', required: false, sensitive: false, featureGate: 'order-expiry', owner: 'CLIENT', defaultValue: 48 },
  { key: 'shifts.openingFloat', group: 'ops', groupAr: 'التشغيل (طلبات/ورديات)', labelAr: 'رصيد بداية الدرج الافتراضي (ج.م)', labelEn: 'Default opening float (EGP)', helpAr: 'يُقترح عند فتح الوردية ويمكن تعديله (T05).', helpEn: 'Suggested on shift open, editable (T05).', type: 'number', required: false, sensitive: false, featureGate: 'shifts', owner: 'CLIENT', defaultValue: 500 },
  { key: 'shifts.maxShortage', group: 'ops', groupAr: 'التشغيل (طلبات/ورديات)', labelAr: 'حد العجز المسموح بالدرج (ج.م)', labelEn: 'Allowed cash shortage (EGP)', helpAr: 'فوقه يُطلب تفسير إجباري عند الإغلاق.', helpEn: 'Above it a note is mandatory on close.', type: 'number', required: false, sensitive: false, featureGate: 'shifts', owner: 'CLIENT', defaultValue: 50 },
];

export const REGISTRY_KEYS = new Set(SETTINGS_REGISTRY.map((d) => d.key));
export const SENSITIVE_KEYS = new Set(SETTINGS_REGISTRY.map((d) => (d.sensitive ? d.key : null)).filter(Boolean) as string[]);

/** Parse a stored Setting value into { value, confirmed }. */
export function parseStored(raw: string | null, fallback: unknown): { value: unknown; confirmed: boolean } {
  if (raw === null) return { value: fallback, confirmed: false };
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed) && 'v' in (parsed as Record<string, unknown>)) {
      const o = parsed as { v: unknown; _confirmed?: unknown };
      return { value: o.v, confirmed: o._confirmed === true };
    }
    return { value: parsed, confirmed: false };
  } catch {
    return { value: raw, confirmed: false };
  }
}

export function statusOf(def: SettingDef, stored: { value: unknown; confirmed: boolean }, hasValue: boolean): SettingStatus {
  if (stored.confirmed) return 'CONFIRMED';
  if (def.required && !hasValue) return 'MISSING';
  if (def.required && hasValue) return 'DEFAULT_UNCONFIRMED';
  if (!def.required && !hasValue && (def.defaultValue === '' || def.defaultValue === undefined)) return 'MISSING';
  return 'DEFAULT_UNCONFIRMED';
}

export function hasUsableValue(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'number') return Number.isFinite(value);
  return true;
}
