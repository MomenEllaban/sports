# جولة تصحيحات UX والميزات — Admin / POS / Storefront

**الفرع:** `main`
**التاريخ:** 25 سبتمبر 2026
**قاعدة التحديث:** كل بند يبدأ `❌`، ويصبح `🟡` عند التنفيذ الجزئي أو عند وجود blocker، و`✅` عند الاكتمال والاختبار.

## A) عام

- [x] ✅ **A1 — العربية default locale:** routing/middleware والـ redirect من `/` إلى `/ar`، مع اختبار Admin/POS/Storefront.
- [ ] 🟡 **A2 — الألوان والتباين:** أُضيفت semantic status tokens وطبقت على badges/لوحات Admin مع mappings للضوء؛ بقت مراجعة التباين البصري والـ legacy literals مرحلة تدريجية (لم يُثبت بعد فحص آلي WCAG لكل الصفحات).

## B) الطلبات

- [x] ✅ **B1 — تأكيد تغيير حالة الطلب:** Confirm Dialog يعرض رقم الطلب، الحالة الحالية→الجديدة، وأثر الإرجاع/التشغيل، مع endpoint متوقع الحالة وrollback للـ UI وتسجيل Audit.
- [x] ✅ **B2 — تعديل الطلب:** endpoint فعلي لـ PENDING/CONFIRMED مع optimistic version، server-side totals، stock delta داخل transaction، قيود الدفع/الفاتورة/المرتجع، وAudit Log؛ اختبارات rollback/stale مضافة.
- [x] ✅ **B3 — الفاتورة القديمة:** snapshot issuance للطلبات/المبيعات، عرض/إعادة طباعة مع توضيح أنها نسخة معادة، requestId/idempotency، وAudit/InvoiceReprint؛ السجلات القديمة تُعرض كـ legacy reconstructed بوسم واضح.

## C) المشتريات والموردون

- [x] ✅ **C1 — صفحة الموردين المستقلة:** `/admin/purchasing/suppliers` أصبحت Server Component مستقلة مع CRUD، اختيار مورد، ملخص الالتزامات والمدفوعات، POs والمدفوعات الخاصة، وحماية الحذف من السجلات المالية.
- [x] ✅ **C2 — نموذج Purchase Order:** بحث بالاسم/SKU/الباركود، اختيار أصناف غير مكررة، quantities/cost، إجمالي لحظي، validation responsive، وحفظ draft/confirm مع API server authoritative ومنع استلام المسودة.

## D) التقارير

- [x] ✅ **D1 — فصل التقارير:** routes مستقلة للمبيعات والمخزون والفروع والمالية وكشكول النواقص، وفهرس مُجمّع لم يعد alias واحدًا.
- [x] ✅ **D2 — فلاتر server-side:** from/to/search/branch وpagination في query/URL، أعمدة SKU/باركود/تصنيف/ماركة/أسعار/كميات الفروع، وتصدير CSV بنفس الفلاتر.
- [x] ✅ **D3 — تقرير كشكول النواقص:** reorderPoint/quantity لكل فرع، checkbox محفوظة في ReorderRequest مع user/date/note/supplier، فلاتر المتابعة، وإنشاء PO من المحدد.

## E) المخزون / الجرد

- [x] ✅ **E1 — Batch Stocktake:** StocktakeSession + StocktakeLine، جدول كل أصناف الفرع مع بحث/تصنيف، draft/approve transaction مع drift guard وInventoryLog، وتقرير/CSV فروقات.

## F) POS

- [x] ✅ **F1 — POS category/brand filters:** API facets حقيقية، chips touch-friendly للتصنيف/الماركة مع «الكل»، والبحث/الباركود والاختيار السريع محفوظة.

## G) Storefront / المنتجات

- [x] ✅ **G1 — Product pagination:** pagination/عدد النتائج والفلاتر/الترتيب في URL للـStorefront، وتصفير page مع تغيير الفلتر؛ Admin Products يمرر pagination من الخادم.
- [x] ✅ **G2 — Wishlist:** قلب sibling غير متداخل، WishlistItem DB للمسجل، localStorage للزائر مع merge عند الدخول، نقل للسلة/حذف/عداد_header، وعزل privacy للـDB.

## حالة التنفيذ الأولية

- اكتملت الجولة التنفيذية للبنود A1 وB1–B3 وC1–C2 وD1–D3 وE1 وF1 وG1–G2؛ A2 يبقى 🟡 حتى فحص التباين البصري الآلي.
- migrations 22–26 موثقة في `SYSTEM_REPORT.md` وتم تطبيقها على Neon ومزامنة قاعدة الاختبار المعزولة.
- لا يتم_stage أو حذف الملفات المحلية غير المتتبعة الحالية (`scripts/debug-*.ts`, `scripts/.stock-snap.json`).

## H) إصلاحات UI/UX ومعالجة الأخطاء — 25 سبتمبر 2026

**نطاق الجولة:** Admin / POS / Storefront على `main`.

### H-A) Scrollbar مزدوج ومصدر الـ overflow

- [x] ✅ **H-A1 — مصدر الـ scroll في Admin:** `AdminChrome` صار مالكًا للـ viewport (`h-dvh` + `body[data-app-shell=admin]`)، و`main` هو منطقة التمرير الرأسي الوحيدة. الـ Sidebar ثابت، والمنطقة الداخلية القابلة للتمرير تظهر فقط عند تجاوز ارتفاع المحتوى، ونسخة footer ثابتة.
- [x] ✅ **H-A2 — Scrollbar موحّد:** class عامة `.app-scrollbar` + `.app-scrollbar-horizontal` بألوان design tokens و`scrollbar-width: thin`، وطبّقت على جداول Admin/POS وشرائط الفلاتر والصور.
- [x] ✅ **H-A3 — POS/Storefront:** POS يستخدم `h-dvh` ومناطق مستقلة مصممة للوحة/التذكرة، وStorefront يمرر فقط صفوف الفلاتر/الجداول أفقيًا. تم إصلاح overflow أفقي في breakpoint التابلت.
- [x] ✅ **اختبار responsive:** فحص Playwright محلي على `390×844`, `768×1024`, `1024×768`, `1366×768` لصفحات `/ar`, `/ar/catalog`, `/ar/cart`, `/ar/tracking`, `/ar/branches`: صفر horizontal overflow وصفر console/5xx بعد الإصلاح. (المتصفح البصري الخارجي ما زال غير متصل.)

### H-B) ارتفاع الـ Modal

- [x] ✅ **H-B1 — Wrapper مشترك:** `DialogFrame` في `src/components/ui/foundation.tsx` أصبح المصدر الواحد لـ`Modal` و`ConfirmDialog` وdialogs الـPOS المخصصة، مع overlay ثابت على viewport، focus trap، Escape، body lock وaria-modal.
- [x] ✅ **H-B2 — Dynamic height:** لا يوجد height ثابت؛ panel يستخدم `max-height: min(90dvh, calc(100dvh - 2rem))`، والمحتوى هو الذي يحدد الارتفاع، و`app-modal-body` هو منطقة التمرير الوحيدة بعد تجاوز الشاشة. Footer يثبت خارج جسم التمرير.
- [x] ✅ **H-B3 — Migration:** تم توحيد dialogs المستخدمين والفروع والورديات وPOS payment/receipt/return، مع الحفاظ على RTL.
- [x] ✅ **H-B4 — Portal root:** `DialogFrame` وCommand Palette ينشران عبر `document.body`، لذلك لا يحبسهما `backdrop-filter` الخاص بـ`.glass-panel` داخل الجدول ولا يظلان على ارتفاعه.

### H-C) Version label

- [x] ✅ **H-C1:** `Sports Champions ERP · v1.0` في footer ثابت أسفل Sidebar (`shrink-0`)، لا يتكرر ولا يأخذ مساحة تنقل، ومع `dir=ltr` و`aria-label`، ولا يوجد رابط Changelog وهمي.

### H-D) الأخطاء والـ Console

- [x] ✅ **H-D1 — Wishlist 401 spam:** `StorefrontSessionProvider` يمرر حالة portal من Server Component، ولا يستدعي `/api/account/wishlist` للزائر؛ `useWishlist()` مركزي للعداد/الأزرار/الصفحة، مع request واحد وdedupe، localStorage للزائر، merge عند login، وfallback عند 401/403.
- [x] ✅ **H-D2 — Wrapper موحد:** `src/lib/client-api.ts` هو wrapper كل طلبات المتصفح في Admin/Storefront/POS (لم تبقَ `fetch()` مباشرة في مكونات العميل)، مع timeout/abort، 401 redirect أو رسالة، 403 رسالة صريحة، 5xx/network toast مع إعادة محاولة، throttle، وعدم `console.error` للحالات المتوقعة.
- [x] ✅ **H-D3 — ErrorBoundary:** `GlobalErrorBoundary` في الـlocale layout + `ErrorEventHandler` + `pos/error.tsx`، مع fallback ودّي وإعادة محاولة/تحديث.
- [x] ✅ **H-D4 — API envelope:** `src/lib/api-response.ts` يوحّد `{ success:false, error:{ code, message, requestId } }` مع `x-request-id`، وحُوّل خطأ API في كل route handlers من `NextResponse.json({success:false,error})` إلى `apiError`، وأخطاء 5xx تمر عبر `captureError` مع request id. أضيف `message` top-level لتوافق العملاء القدامى.
- [x] ✅ **H-D5 — Console Audit:** لا يوجد سكربت/dependency باسم `useblackbox` أو `index.iife.js` في المستودع؛ خطأ CORS المرصود خارجي من browser extension/أداة Blackbox وليس من كود النظام. تم توثيقه بدل تعطيله.
- [x] ✅ **H-D6 — POS light mode:** إصلاح تباين الأزرار و tab strip في نافذة `إتمام عملية البيع والدفع`؛ كانت `bg-slate-900/80` داكنة مع نص remapped داكن، وأضيفت قواعد light-mode scoped للـ modal.

### اختبارات الجولة

| الأمر | النتيجة |
|---|---|
| `npm run typecheck` | ✅ PASS |
| `npm run lint` | ✅ PASS، 0 warnings |
| `npm run build` (مع `NEXT_PUBLIC_SITE_URL`) | ✅ PASS، 252 routes |
| `npm run test:unit` | ✅ 18 ملف / 72 اختبار |
| `npm run test:int` | ✅ 26 ملف / 87 اختبار |
| `npm run test:dashboard` | ✅ 173/173 |
| `npm run check:i18n` / `check:invariants` | ✅ PASS / CLEAN |
| Playwright responsive probe | ✅ 4 viewports × 5 public routes، بلا overflow/console errors |
| Desktop visual/WCAG review | 🟡 يحتاج جلسة browser متصلة؛ لم يتم إجراء فحص axe بصري كامل بعد |

**ملاحظة:** لم يتم stage أو حذف `scripts/debug-*.ts` أو `scripts/.stock-snap.json`.
