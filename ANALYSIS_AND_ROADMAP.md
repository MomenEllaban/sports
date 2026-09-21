# التحليل الشامل وخطة التطوير — Sports Champions ERP
**التاريخ:** 2026-09-21 — **الفرع:** `main` عند `a0141c9` — **الريبو:** `MomenEllaban/sports`

> مبني على قراءة فعلية للكود (schema + routes + lib + seed + tests)، وليس على التقارير القديمة.

---

## 1) فهم البيزنس

### 1.1 النشاط والفروع
- محل أدوات ومعدات رياضية في الإسكندرية، فرعان نشطان: **الإبراهيمية** (رئيسي، `92 Omar Lotfy St`) + **سموحة**.
- الإعدادات المركزية في `prisma/seed/settings.ts:3` و`src/lib/settings.ts:9` (اسم المتجر، واتساب `01224226876`، أرضي `03 5926908`، ضريبة `14%`، مناطق الشحن 25–95 ج، بوابات الدفع، الولاء).

### 1.2 الكتالوج الحقيقي (`prisma/seed/catalog.ts:48`)
- ~187 SKU عبر 6 أقسام (`catalog-base.ts:3`) و8 براندات (Nike/Adidas/Speedo/Molten/Cougar/TRX/KT Tape/Generic).
- التشكيل: ملابس بمقاسات/ألوان + أحذية جري/باليه + سباحة + جيم (دمبل/كيتل/يوجا) + كارديو ثقيل (مشاية 18500، عجلة 6800، إليبتيكال 12500) + طبي (KT Tape/دعامات) + جماعي (كرات/مضارب).
- **نقطة جوهرية:** المقاس/اللون `String` على `Product` (`schema.prisma:318`) — كل تركيبة = SKU مستقل، لا يوجد موديل Variants أب/ابن ولا Size Chart.

### 1.3 قنوات البيع والفلوس
| القناة | الدخول | المخرجات |
|---|---|---|
| متجر B2C | `src/app/[locale]/(storefront)/` (رئيسية/كتالوج/`catalog/[id]`/سلة/checkout/تتبع/حساب/فروع) | طلب `ORD-2026-XXXX` + شحن Bosta/Pickup + دفع COD/Paymob/Fawry/InstaPay/Vodafone |
| POS كاشير | `src/app/[locale]/pos/page.tsx` + `src/app/api/pos/*` | فاتورة `POS-2026-XXXX` + خصم بموافقة PIN + ولاء + إيصال ETA + offline queue |
| واتساب يدوي | زر واتساب + طلب يدوي من الإدارة | طلب `WHATSAPP` بنفس دورة الأونلاين |

- التسعير المركزي في `src/lib/pricing.ts:70` (`total = (subtotal-discount) + 14% + delivery`)، والعملة `Decimal(12,2)` مع حد `num()` في `pricing.ts:29`.
- الولاء: نقطة/10 ج (`loyaltyEarned` في `pricing.ts:81`) — **اكتساب فقط، لا استبدال**.

---

## 2) خريطة النظام الحالية (ماذا يفعل فعلاً)

### 2.1 متجر العملاء
- كتالوج + بحث + صفحة منتج منفردة (`catalog/[id]/page.tsx` + `ProductDetailsClient`) بمعرض وتوفر فرعي.
- سلة Zustand + checkout (`checkout/page.tsx:10`) يدعم توصيل/استلام + 5 طرق دفع + رفع إيصال تحويل (`/api/upload/receipt`).
- تتبع برقم الطلب/الهاتف/بوليصة (`/api/orders/track`)، وبورتال عميل (`account/AccountClient.tsx:39`) دخول هاتف+طلب سابق، يعرض النقاط والطلبات والعناوين.

### 2.2 POS
- هوية كاشير من الجلسة + فرع إجباري (`src/lib/pos/context.ts:26`)، حماية middleware (`middleware.ts:41`) للأدوار `CASHIER/BRANCH_MANAGER/SUPER_ADMIN`.
- أسعار من DB دائماً + خصم بموافقة مدير (`src/lib/pos/discount.ts`) + idempotency عبر `clientSaleId` (`pos/sale/route.ts:42`) + معاملة ذرية واحدة (مخزون + فاتورة + ETA).
- ولاء يُضاف بعد الـ commit (`pos/sale/route.ts:235`).

### 2.3 إدارة الطلبات والمخزون
- إنشاء الطلب: فحص مخزون صارم + رفض عند العجز (`orders/create/route.ts:90`) + `$transaction` واحدة (خصم + طلب + فاتورة ضريبية) + retry لتكرار الأرقام.
- دورة الحالات في `src/lib/orders/status.ts:11` (`PENDING→CONFIRMED→PROCESSING→SHIPPED→DELIVERED` + `CANCELLED/RETURNED` نهائية) مع **restock ذري exactly-once** عند الإلغاء/المرتجع.
- خدمة المخزون الوحيدة `src/lib/inventory/service.ts:30` (خصم شرطي `updateMany` ضد race + سجل `InventoryLog` لكل حركة).
- تحويلات فروع + مشتريات باستلام جزئي + تنبيه نواقص (حد 5).

### 2.4 مالية وHR وتقارير
- محاسبة (`admin/accounting/page.tsx:11`): إجمالي + VAT + مصروفات + صافي تقريبي + COD محصل/معلق + سجل ETA.
- تقارير (`admin/reports/page.tsx:9`): best sellers + تقييم مخزون بيع/تكلفة/هامش + إيراد قنوات — **بدون فلاتر زمنية/فرع**.
- مرتبات بعمولة من المبيعات الفعلية + مكافآت/خصومات قابلة للتحرير، ودورة `DRAFT→APPROVED→PAID`.
- إعدادات key/value (`Setting` + `settings.ts`) تتحكم في كل قيم البيزنس + بوابات ETA/WhatsApp.
- إشعارات in-app + WhatsApp settings-gated (`notifications.ts:53`).

### 2.5 ما هو صلب وتم التحقق منه
RBAC matrix (`rbac-matrix.ts:20` + meta-test)، حماية POS، أسعار server-authoritative، مخزون ذري، restock exactly-once، webhooks بتوقيع (`webhooks/verify.ts:17`)، تغطية integration للمسارات الحرجة (`pos-atomic`, `order-status`, `transfer-atomic`, `rbac-enforcement`, `seed-idempotent`).

---

## 3) الفجوات المؤكدة بالدليل (بعد إنجاز P0–P3 القديمة)

### G1 — بوابات الدفع mock رغم وجود Webhooks حقيقية — حرجة
- **الدليل:** `src/lib/payments/index.ts:43` يرجع `sample_token`، و`:52` رقم Fawry عشوائي، و`:78` لينك Kashier تجريبي.
- **المقابل:** webhooks تستقبل وتتحقق وتطابق المبلغ (`webhooks/paymob/route.ts:39`) — أي البنية جاهزة لكن **الإنشاء وهمي**.
- **الأثر:** طلبات Paymob/Fawry تظل `PENDING` ولا يوجد redirect حقيقي؛ `KASHIER` في الـ enum بلا تفعيل.

### G2 — الشحن mock — حرجة
- **الدليل:** `src/lib/logistics/index.ts:43` يرجع `BST-xxx`/`MYL-xxx` وهمية بلا أي `fetch` لـ Bosta/Mylerz.
- **الأثر:** لا AWB حقيقي ولا label؛ `MRSOOL/LOCAL_COURIER` في الـ enum ميتة.

### G3 — لا استبدال للنقاط — عالية
- **الدليل:** الكسب في `pos/sale/route.ts:238` والعرض في `AccountClient.tsx:200`، ولا يوجد أي `redeem` في الكود (grep صفر).
- **الأثر:** الولاء عرض فقط؛ لا خصم نقاط في checkout/POS.

### G4 — لا كوبونات/عروض — عالية
- **الدليل:** لا موديل `Coupon` في `schema.prisma` وصفر matches لكلمة coupon/promo.
- **الأثر:** لا حملات ولا خصم بكود ولا تقرير استخدام.

### G5 — لا ورديات/درج نقدية — عالية
- **الدليل:** لا موديل `Shift`؛ تعليق يتيم في `branches/[id]/route.ts:16` يذكر `open shifts (T14)`.
- **الأثر:** لا فتح/إغلاق وردية ولا عجز/زيادة درج ولا ربط مبيعات بشفت.

### G6 — Variants مسطحة — عالية
- **الدليل:** `schema.prisma:318` (`size/color String`) + توليد SKUs في `catalog.ts:31`.
- **الأثر:** تجربة مقاسات مربكة، لا Size Chart، لا تجميع أب/ابن.

### G7 — ETA ليس production-ready — متوسطة/عالية
- **الدليل:** `eta.ts:192` يولّد `itemCode: '1000001'` ثابت، والتوقيع اختياري عبر `ETA_SIGNING_URL`، وcredit note بأصناف فارغة (`eta.ts:244`).
- **الأثر:** يعمل preprod/mock لكن مرفوض ضريبياً في الإنتاج (GS1 + توقيع إلزامي + retry).

### G8 — المرتجع بلا Refund — متوسطة
- **الدليل:** `transitionOrder` يرجع المخزون (`status.ts:83`) ولا يغير `paymentStatus` ولا يستدعي بوابة.
- **الأثر:** إرجاع بضاعة بلا رد فلوس ولا credit note من UI.

### G9 — عناوين البورتال منفصلة عن checkout — متوسطة
- **الدليل:** `Order.deliveryAddress` نص حر (`schema.prisma:343`)، وcheckout يستخدم `textarea` (`checkout/page.tsx:228`) ولا يقرأ `Address`.
- **الأثر:** العميل يعيد كتابة العنوان كل مرة.

### G10 — تقارير وداشبورد بدائية — متوسطة
- **الدليل:** `admin/page.tsx:16` يجلب 5 طلبات + نواقص فقط؛ `reports/page.tsx:11` يجلب كل الأصناف بلا فلتر زمني/فرع/كاشير.
- **الأثر:** لا KPIs يومية، لا ربحية منتج/فرع/كاشير، لا dead stock، لا أداء شحن، وأداء يتدهور مع كبر البيانات (full scan).

### G11 — Reviews/Wishlist غائبة — منخفضة/متوسطة
- **الدليل:** لا موديل `Review` ولا wishlist.
- **الأثر:** ثقة B2C وتحويل أقل.

### G12 — عمليات مخزنية ناقصة UI — منخفضة
- باركود EAN-13 يُولّد (`catalog.ts:153`) بلا طباعة؛ الجرد/التسوية عبر `incrementStock(ADJUSTMENT)` موجود خدمياً بلا شاشة مخصصة بسبب مبرر؛ لا مرتجع موردين ولا مدفوعات موردين.

---

## 4) خطة التاسكات (الأفضل هندسياً)

### P0 — فلوس حقيقية (التأثير الأعلى)

**T01 — Paymob حقيقي end-to-end**
- الملفات: `src/lib/payments/index.ts` (+`src/lib/settings.ts` مفاتيح `paymob.*`)، `orders/create/route.ts:219`، صفحات نجاح/فشل.
- التنفيذ: Auth→Order→PaymentKey→Iframe بأسرار من Settings (لا `.env` مكشوفة)، حفظ `paymentRef` قبل redirect، الاعتماد الكامل على webhook الموجود.
- القبول: دفع sandbox 1 ج يقلب `PAID` + idempotent replay + amount-mismatch مرفوض.

**T02 — Fawry حقيقي**
- نفس الملفات + عرض `fawryReferenceNumber` + expiry 24h + webhook موجود.
- القبول: كود فعلي من sandbox + انتهاء صلاحية يُعالج.

**T03 — Bosta/Mylerz حقيقي**
- الملفات: `src/lib/logistics/index.ts` + إعدادات `couriers.*` + شاشة الطلب (AWB/label).
- التنفيذ: `fetch` فعلي بـ API key من Settings، تخزين `trackingNumber+labelUrl`، أخطاء لا تُفشل الطلب (degrade).
- القبول: AWB حقيقي من sandbox + تتبع يعمل.

**T04 — استبدال الولاء**
- الملفات: `Setting (loyalty.redeemRate, loyalty.maxRedeemPct)` + `pricing.ts (loyaltyDiscount)` + checkout/POS/portal + `orders/create` و`pos/sale` داخل نفس `$transaction` (خصم نقاط + إنشاء + سجل).
- القبول: طلب يخصم نقاط ويمنع الرصيد السالب تحت التزامن.

**T05 — ورديات ودرج**
- الملفات: موديل `Shift (branchId, cashierId, openedAt/closedAt, expectedCash, actualCash, diff, status)` + `resolvePosContext` يرفض البيع بلا وردية + شاشة فتح/إغلاق + تقرير.
- القبول: لا `POST /api/pos/sale` بدون shift مفتوحة (test).

### P1 — بيع أكثر

**T06 — كوبونات وعروض**
- موديل `Coupon (code unique, type %, cap, minTotal, dates, usageLimit, isActive)` + تحقق في checkout/POS داخل pricing + جدول استخدام + RBAC `BM`.
- القبول: كود يخصم ويُحتسب مرة واحدة ولا يتجاوز الحد.

**T07 — تجميع Variants + Size Chart**
- بدون كسر SKUs: `ProductGroup (slug)` أو تجميع عرضي + Size Chart من Settings + صفحة المنتج تختار مقاس/لون وتضيف SKU الصح.
- القبول: منتج واحد يعرض كل تركيباته ومخزون كل فرع.

**T08 — Reviews + Wishlist**
- موديل `Review (productId, customerId/phone, rating 1-5, text, approved)` + اعتماد من الإدارة + wishlist محلية للزوار.
- القبول: تقييم يظهر بعد الاعتماد فقط.

**T09 — ربط عناوين البورتال بالـ checkout**
- checkout يقرأ `/api/account/me` ويقدم dropdown + إضافة عنوان تحفظ في `Address`.
- القبول: طلب من عنوان محفوظ يخزن `addressId` + نص.

### P2 — عمليات أنظف

**T10 — Refund/RMA من الطلب**
- زر استرداد: يعكس `paymentStatus→REFUNDED` + يستدعي `submitEtaCreditNote` بأصناف حقيقية + إشعار + AuditLog. للمدفوعات الإلكترونية: استدعاء void/refund البوابة (best-effort).
- القبول: `RETURNED + REFUNDED + restock + credit note` في معاملة واحدة.

**T11 — داشبورد KPI حقيقي**
- إيراد/ربح اليوم، معلق الدفع، إيصالات تحويل بانتظار المراجعة، شارت 7 أيام — server components مع تجميع DB (لا full scan) + روابط عميقة موجودة.
- القبول: تحميل < 1s على بيانات demo.

**T12 — تقارير ربحية ومخزون**
- ربحية منتج/فرع/كاشير (سعر−تكلفة)، dead stock (لا بيع 60 يوم)، أداء شحن (زمن/مرتجع)، تصدير CSV، فلاتر زمنية.
- القبول: أرقام تطابق `check:invariants`.

**T13 — باركود وجرد**
- طباعة EAN-13 للأصناف + شاشة جرد (تسوية بسبب مبرر عبر `incrementStock(ADJUSTMENT)` + AuditLog) + مرتجع موردين.

### P3 — امتثال وتوسع

**T14 — ETA إنتاجي**
- GS1 لكل صنف (`Product.gs1Code`)، توقيع إلزامي (لا submission بدون sign في production)، retry queue لحالات `INVALID`، credit note بأصناف حقيقية.
- القبول: إيصال `VALID` من preprod ببيانات حقيقية.

**T15 — تنظيف الميت + SEO/i18n**
- حذف أو تفعيل `MRSOOL/LOCAL_COURIER/KASHIER` من enum+UI، إكمال `messages/ar|en.json`، sitemap/metadata عربي، E2E للـ checkout والـ POS.

---

## 5) ترتيب التنفيذ المقترح
`T01 → T03 → T04 → T05 → T06 → T10 → T11 → T12 → T07 → T08 → T09 → T13 → T14 → T15`
(الفلوس أولاً، ثم ما يزيد البيع، ثم ما ينظف العمليات، ثم الامتثال.)
