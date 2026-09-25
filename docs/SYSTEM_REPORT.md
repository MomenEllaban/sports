# التقرير الشامل لنظام أبطال الرياضة — ERP + Storefront + POS

**تاريخ التقرير:** 25 سبتمبر 2026
**الفرع:** `main`
**المصدر:** `MomenEllaban/sports`
**نطاق التقرير:** لوحة الإدارة، المسارات والتشغيل، الأمان، منطق المخزون والطلبات والمرتجعات، وكل ما طلبته المهمة.

> هذا التقرير يصف الحالة الحالية بعد إعادة هيكلة الـ Admin، وليس مجرد قائمة مهام. تم تنفيذ البنية والتنقل والصفحات ذات الـ Backend الموجود، وتم توثيق ما بقي Empty State بدل عرض بيانات وهمية.

---

## 1. ملخص تنفيذي

نظام **أبطال الرياضة الإسكندرية** منصة Omni-channel تجمع بين:

1. متجر أونلاين ثنائي اللغة (عربي RTL/إنجليزي LTR).
2. نقطة بيع POS لفروع الإبراهيمية وسموحة.
3. إدارة المخزون والتحويلات والجرد.
4. الطلبات والمدفوعات والشحن وCOD.
5. المشتريات والموردين والمرتجعات.
6. العملاء والولاء والكوبونات.
7. المالية والمصروفات والمرتبات.
8. الإعدادات والصلاحيات وسجل النشاط.

### ما تم تنفيذه في المهمة

- إنشاء `src/config/admin-navigation.ts` كمصدر واحد للروابط والصلاحيات وحالة كل صفحة.
- تحويل الـ Sidebar من قائمة flat إلى **Categories قابلة للطي** مع:
  - حفظ حالة الطي في `localStorage`.
  - وضع Collapsed أيقونات فقط مع Tooltip.
  - Responsive Drawer للموبايل.
  - زر POS ثابت ومقيد بالأدوار المسموحة.
  - إخفاء المجموعات التي لا تملك صفحة مسموحة للدور الحالي.
  - Breadcrumbs وCommand Palette عبر `Ctrl/Cmd+K`.
- إضافة Nested Routes وlayouts للتبويبات في الطلبات، المنتجات، المخزون، المشتريات، العملاء، الموظفين، الحسابات، المرتبات، المرتجعات، الكوبونات، الورديات، الإعدادات، والتقارير.
- إضافة صفحات تشغيلية للمصروفات، الشحن، ومصفوفة الأدوار.
- إضافة Empty States صريحة للوحدات التي لا تملك schema/Backend حتى الآن.
- إصلاح عدة مخاطر واضحة:
  - منع POS من اعتبار الدفع الإلكتروني `PAID` بدون إثبات؛ أصبح `PENDING`.
  - تجاهل رسوم التوصيل القادمة من العميل وحسابها من zone الخادم.
  - منع shipment orphan قبل commit الطلب.
  - منع الكميات السالبة/NaN في خدمة المخزون.
  - قفل webhooks fail-closed عند غياب secret.
  - إضافة branch scope للإشعارات.
  - حماية callback URL من open redirect.
  - escaping لمحتوى طباعة الإيصال وZ-Report.
  - تصحيح نسبة عمولة الموظف بين UI والـ API.
  - قفل seed خارج `APP_ENV=development` وعدم طباعة كلمات المرور/PINs.
  - إزالة الأسرار التشغيلية من `.env.example` وREADME والسكربتات.

### نسبة الاكتمال التقريبية

النِسب تقريبية من ناحية **جاهزية التشغيل الإنتاجي**، وليست نسبة عدد أسطر الكود:

| الموديول | التقدير | الملاحظة |
|---|---:|---|
| Storefront / Catalog | 85% | ممتاز، مع فجوات CMS وtracking/OTP |
| POS | 80% | المخزون والورديات robust؛ الدفع الإلكتروني يحتاج settlement |
| Admin shell | 90% | Categories, tabs, drawer, palette, breadcrumbs |
| Orders / fulfillment | 80% | state machine وRMA، لا يوجد idempotency عام كامل |
| Inventory | 78% | atomic updates، يبقى DB constraints وbatch stocktake |
| Purchasing | 75% | suppliers/PO/receive/payment، ناقص purchase invoice lifecycle |
| Returns / RMA | 82% | outbox وrestock؛ Exchange netting يحتاج إكمال |
| Finance / Expenses | 62% | CRUD وP&L تقريبي، ناقص ledger/treasury |
| HR / Payroll | 58% | payroll run، ناقص attendance/leave/advanced ledger |
| Reports | 68% | filters وCSV، ناقص pagination/aggregations وbranch scope |
| Shipping / COD | 55% | webhooks وoverview، ناقص carrier settlement ledger |
| Website CMS | 25% | planned routes فقط |
| Security / operations | 70% | improvements كبيرة، branch isolation وsecret rotation مطلوبان |

---

## 2. الـ Tech Stack والمعمارية

### التقنيات

- **Framework:** Next.js 15 App Router.
- **UI:** React 19 + TypeScript strict + Tailwind CSS 4 + Lucide.
- **Design system:** CSS tokens في `src/app/globals.css`، مع دعم Dark/Light وRTL.
- **ORM:** Prisma 6 + PostgreSQL (Neon).
- **Auth:** NextAuth v4 Credentials + JWT، و`requirePageRole` للصفحات و`requireRole` للـ APIs.
- **الأدوار:** `SUPER_ADMIN`, `BRANCH_MANAGER`, `FINANCE`, `CASHIER`, `STAFF`.
- **State:** Zustand للسلة وPOS offline queue.
- **i18n:** `next-intl` مع `/ar` و`/en`.
- **Files:** Cloudinary للصور والإيصالات.
- **Deployment:** Vercel + Neon.
- **Node:** `>=22.12.0` (متوافق مع Vitest 5).

### بنية المجلدات المهمة

```text
src/app/[locale]/admin/       صفحات الإدارة (root + nested routes)
src/app/api/admin/           Admin REST handlers
src/components/admin/        Shell, navigation, managers, dashboard widgets
src/config/                  مصدر navigation العام
src/lib/auth/                page/API guards وRBAC matrix
src/lib/returns/              RMA service, policy, calculations
src/lib/inventory/            stock service/mutations
prisma/schema.prisma         schema ومigrations
prisma/seed/                 seeders وdemo fixtures
scripts/                     audits, workers, maintenance scripts
tests/                       unit/integration/e2e
```

### نمط القراءة والكتابة

- القراءة في صفحات الإدارة: Server Components + Prisma مباشرة.
- الكتابة: `fetch` من managers إلى REST Route Handlers.
- لا توجد Server Actions في流转 Admin.
- العمليات الحساسة تستخدم `prisma.$transaction` وconditional updates.
- لا يوجد migration جديدة في هذه المهمة. Migration `21_perf_indexes` موجودة مسبقًا، وتم تعديل منطق التطبيق فقط.

### Production gates

- `APP_ENV=production` مطلوب عندما يكون `NODE_ENV=production`.
- `NEXTAUTH_SECRET`، `SETTINGS_ENCRYPTION_KEY`، secrets الـ webhooks، و`NEXT_PUBLIC_SITE_URL` يجب أن تأتي من Secret Manager/Vercel.
- لا يجب تشغيل demo seed أو cleanup scripts في production.
- يجب تدوير أي secret كان يومًا داخل Git history أو README أو `.env` مشترك.

---

## 3. خريطة الـ Sidebar النهائية

### الرئيسية

- `/admin` — لوحة المعلومات
- `/admin/notifications` — مركز التنبيهات

### المبيعات

- `/admin/orders` — الطلبات
  - `/admin/orders`
  - `/admin/orders/online`
  - `/admin/orders/pos`
  - `/admin/orders/whatsapp`
  - `/admin/orders/processing`
  - `/admin/orders/completed`
  - `/admin/orders/cancelled`
- `/admin/returns` — المرتجعات والاستبدال
  - `/admin/returns`
  - `/admin/returns/exchanges`
  - `/admin/returns/policies`
- `/admin/cod-settlement` — تسوية COD
- `/admin/shifts` — الورديات
  - `/admin/shifts`
  - `/admin/shifts/history`
  - `/admin/shifts/differences`
- `/admin/sales/invoices` — عروض الأسعار والفواتير (Empty State)
- `/admin/shipping` — الشحن وشركات التوصيل

### المنتجات والمخزون

- `/admin/products` — المنتجات
  - `/admin/products`
  - `/admin/products/categories`
  - `/admin/products/brands`
  - `/admin/products/variants`
  - `/admin/products/media`
- `/admin/inventory` — المخزون
  - `/admin/inventory`
  - `/admin/inventory/movements`
  - `/admin/inventory/transfers`
  - `/admin/inventory/count`
  - `/admin/inventory/labels`
  - `/admin/inventory/alerts`
- `/admin/inventory/count` — الجرد وتسوية المخزون
- `/admin/inventory/labels` — الباركود والطباعة

### المشتريات

- `/admin/purchasing` — المشتريات
  - `/admin/purchasing`
  - `/admin/purchasing/receiving`
  - `/admin/purchasing/invoices`
  - `/admin/purchasing/suppliers`
  - `/admin/purchasing/returns`
- `/admin/purchasing/suppliers` — الموردون
- `/admin/purchasing/invoices` — فواتير الشراء ومرتجعات الموردين (جزئي)

### العملاء والتسويق

- `/admin/customers` — العملاء
  - `/admin/customers`
  - `/admin/customers/groups`
  - `/admin/customers/loyalty`
  - `/admin/customers/ledger`
- `/admin/customers/loyalty` — الولاء
- `/admin/reviews` — التقييمات
- `/admin/coupons` — الكوبونات والعروض
  - `/admin/coupons`
  - `/admin/coupons/promos`
  - `/admin/coupons/usage`
- `/admin/campaigns` — الحملات والرسائل (Empty State)

### المالية

- `/admin/accounting` — الحسابات
  - `/admin/accounting`
  - `/admin/accounting/pnl`
  - `/admin/accounting/expenses`
  - `/admin/accounting/treasury`
  - `/admin/accounting/eta`
- `/admin/expenses` — المصروفات والإيرادات
- `/admin/accounting/treasury` — الخزينة والبنوك (Empty State)
- `/admin/accounting/eta` — ضرائب ETA
- `/admin/accounting/receivables` — ذمم العملاء والموردين (Empty State)

### الموارد البشرية

- `/admin/employees` — الموظفون
  - `/admin/employees`
  - `/admin/employees/departments`
  - `/admin/employees/attendance`
  - `/admin/employees/documents`
- `/admin/attendance` — الحضور والانصراف (Empty State)
- `/admin/payroll` — المرتبات
  - `/admin/payroll`
  - `/admin/payroll/commissions`
  - `/admin/payroll/advances`
  - `/admin/payroll/history`
- `/admin/leave` — السلف والجزاءات والإجازات (Empty State)

### التقارير

- `/admin/reports` — التقارير
  - `/admin/reports`
  - `/admin/reports/sales`
  - `/admin/reports/inventory`
  - `/admin/reports/branches`
  - `/admin/reports/finance`

### الموقع الإلكتروني

- `/admin/website/content` — البنرات والصفحات (Empty State)
  - `/admin/website/content`
  - `/admin/website/store`
  - `/admin/website/carts`
- `/admin/website/store` — إعدادات المتجر (Overview آمن)
- `/admin/website/carts` — السلات المتروكة (Empty State)

### الإعدادات

- `/admin/users` — المستخدمون
- `/admin/users/roles` — الأدوار والصلاحيات
- `/admin/branches` — الفروع
- `/admin/settings` — الإعدادات
  - `/admin/settings`
  - `/admin/settings/branches`
  - `/admin/settings/tax`
  - `/admin/settings/payments`
  - `/admin/settings/printing`
  - `/admin/settings/notifications`
- `/admin/audit` — سجل النشاط
- `/admin/backup` — النسخ الاحتياطي (Empty State)

> ملاحظة: بعض tabs الحالية route aliases تحافظ على نفس Prisma query والـ UI، مع تفاوت في preset/filter. هذا موثق في حالة كل صفحة أدناه، وليس قناعًا على اكتمال وهمي.

---

## 4. تقرير تفصيلي لكل صفحة

### 4.1 لوحة المعلومات — `/admin`

- **المسار:** `/admin`
- **الغرض:** ملخص الأداء، queues المطلوبة، الإيراد، low-stock، آخر الطلبات.
- **المحتوى/التبويبات:** Sections مستقلة: Action queues، KPI cards، revenue chart، recent activity. كل Section داخل `Suspense` وSkeleton.
- **الداتا والـ API:** Prisma مباشرة على `Order`, `Sale`, `Shift`, `ReturnRequest`, `BranchInventory`, `Branch`, `Product`; لا API كتابة.
- **الصلاحيات:** `SUPER_ADMIN`, `BRANCH_MANAGER`, `FINANCE`.
- **الحالة:** ✅ مكتملة كـ dashboard أساسي، مع branch isolation وتحليلات متقدمة غير مكتملة.
- **ملاحظات ومشاكل لوجيك:** النص Originally كان يقول “محدث مباشرة” بدون realtime، تم تغييره إلى “آخر تحديث عند الفتح”. Dashboard غير مربوط بـ websocket/polling، وqueries الفرعية تحتاج pagination للبيانات الكبيرة.
- **توصيات:** استبدال القراءة المتعددة بـ materialized aggregates/queues، وإضافة scope للفرع.

### 4.2 مركز التنبيهات — `/admin/notifications`

- **المسار:** `/admin/notifications`
- **الغرض:** عرض تنبيهات الطلبات والمخزون والورديات.
- **المحتوى/التبويبات:** قائمة بطاقات؛ mark read، read all، delete.
- **الداتا والـ API:** `Notification`; `GET/PATCH/DELETE /api/admin/notifications` و`POST /read-all`.
- **الصلاحيات:** جميع الأدوار، مع branch scope على البيانات غير SUPER_ADMIN.
- **الحالة:** 🟡 جزئية.
- **ملاحظات ومشاكل لوجيك:** تم إصلاح IDOR/تسريب branch notifications؛ القراءة والعد والتعديل تستخدم نفس predicate. Dashboard badge يُحدّث عند تغيير pathname، لكن لا يوجد realtime subscription.
- **توصيات:** pagination، event stream، retention policy، branch/role targeting كامل.

### 4.3 الطلبات — `/admin/orders`

- **المسار:** `/admin/orders`
- **الغرض:** عرض طلبات Online/POS/WhatsAMP وتغيير الحالة وإدارة الشحن.
- **المحتوى/التبويبات:** All، Online، POS، WhatsApp، Processing، Completed، Cancelled. Routes aliases تطبق source/status filter في `OrdersManager`.
- **الداتا والـ API:** `Order`, `Sale`, `OrderItem`, `SaleItem`, `Customer`, `Branch`, `ReturnRequest`; `POST /api/admin/orders`, `PATCH /api/admin/orders/:id`, `POST /ship`, returns refund retry.
- **الصلاحيات:** `SUPER_ADMIN`, `BRANCH_MANAGER`.
- **الحالة:** 🟡 جزئية إلى متقدمة.
- **ملاحظات ومشاكل لوجيك:** state machine يمنع `RETURNED` direct، وتمت إزالة `RETURNED` من selector. POS electronic pending لم يعد يظهر كـ Paid. مازال رقم order retry/idempotency عام، server pagination، branch scope، payment proof UI ناقصة.
- **توصيات:** `clientRequestId` unique، reservation، server pagination، settlement action بدل تعديل payment status العام.

### 4.4 المرتجعات — `/admin/returns`

- **المسار:** `/admin/returns`
- **الغرض:** RMA موحد للـ return/exchange مع receive وrefund outbox.
- **المحتوى/التبويبات:** root queue + routes `exchanges`, `policies`؛ داخل الصفحة status chips للحالات.
- **الداتا والـ API:** `ReturnRequest`, `ReturnItem`, `Refund`, `Order`, `Sale`; `GET/POST /api/admin/returns`, action `/[id]`, refund retry/manual.
- **الصلاحيات:** قراءة `SUPER_ADMIN`, `BRANCH_MANAGER`, `FINANCE`; action API للـ BM/SA، مع manual refund للـ Finance.
- **الحالة:** 🟡 متقدمة.
- **ملاحظات ومشاكل لوجيك:** تم إصلاح duplicate line over-return داخل نفس الطلب، ولذلك حساب full-return لا ي.double-count الطلب الحالي. Exchange monetary netting ما زال يحتاج قرار schema/workflow. Return side effects تحتاج refund status/ledger أوسع.
- **توصيات:** `ExchangeSettlement` ذرّي، partial-refund state، watchdog للـ `PROCESSING` outbox.

### 4.5 تسوية COD — `/admin/cod-settlement`

- **المسار:** `/admin/cod-settlement`
- **الغرض:** مطابقة COD orders مع remittance من شركة الشحن.
- **المحتوى/التبويبات:** جدول remitted/collected/difference؛ لا tabs مستقلة.
- **الداتا والـ API:** `Order.codReconciled`, `codRemitted`, tracking/shipping fields; `GET/POST /api/admin/cod-settlement`.
- **الصلاحيات:** `SUPER_ADMIN`, `FINANCE`.
- **الحالة:** 🟡 أساسية.
- **ملاحظات ومشاكل لوجيك:** لا يوجد carrier statement ledger أو pagination، والتعديل لا يرتبط بوثيقة remittance.
- **توصيات:** `CodSettlementCase` مع screenshots/import/export وbranch scope.

### 4.6 الورديات — `/admin/shifts`

- **المسار:** `/admin/shifts`
- **الغرض:** فتح/إغلاق الوردية، expected cash، fringe/shortage، Z-Report.
- **المحتوى/التبويبات:** root + `history` + `differences` aliases؛ داخل الصفحة status/branch/search.
- **الداتا والـ API:** `Shift`, `Sale`, `Branch`, `User`; `POST /api/pos/shifts`, `POST /api/pos/shifts/:id`.
- **الصلاحيات:** عرض `SUPER_ADMIN`, `BRANCH_MANAGER`, `FINANCE`; الإغلاق يتركب على POS API.
- **الحالة:** 🟡 متقدمة.
- **ملاحظات ومشاكل لوجيك:** Force close لـ Finance غير متاح عبر API، والـ Sidebar كان سابقًا يعرض رابط POS لكل الأدوار وتم إصلاحه. unique partial DB constraint مطلوب لمنع فتح concurrent.
- **توصيات:** Add partial unique index `(cashierId) WHERE status='OPEN'`, close lock، cashier payout reconciliation.

### 4.7 عروض الأسعار والفواتير — `/admin/sales/invoices`

- **المسار:** `/admin/sales/invoices`
- **الغرض:** lifecycle لعروض الأسعار والفواتير البيعية.
- **المحتوى/التبويبات:** Empty State؛ لا UI وهمي.
- **الدata والـ API:** لا Quote/Invoice model مستقل.
- **الصلاحيات:** `SUPER_ADMIN`, `BRANCH_MANAGER`, `FINANCE`.
- **الحالة:** 🔴 ناقصة / Empty State.
- **ملاحظات ومشاكل لوجيك:** لا يمكن بدء cycle آمن قبل decisionsTotals والضريبة والـ payment terms.
- **توصيات:** `Quote`, `Invoice`, `InvoicePayment` models + state machine + PDF/ETA policy.

### 4.8 الشحن — `/admin/shipping`

- **المسار:** `/admin/shipping`
- **الغرض:** readiness لـ Bosta/Mylerz ومناطق Alexandria.
- **المحتوى/التبويبات:** provider cards، manual/mock warning، zones، links للطلبات والإعدادات.
- **الداتا والـ API:** `Order`, `Setting`, `getCourierConfig`, `ALEXANDRIA_DELIVERY_ZONES`; webhooks Bosta/Mylerz موجودة.
- **الصلاحيات:** `SUPER_ADMIN`, `BRANCH_MANAGER`, `FINANCE`.
- **الحالة:** 🟡 Overview حقيقي، وليس carrier management كامل.
- **ملاحظات ومشاكل لوجيك:** regions المعروضة من constant وليست settings dynamic؛ لا يوجد settlement/label archive.
- **توصيات:** CarrierAccount/ Shipment/label models، sandbox credentials، mapping webhook idempotency.

### 4.9 المنتجات — `/admin/products`

- **المسار:** `/admin/products`
- **الغرض:** CRUD للكتالوج والصور والتصنيفات والماركات.
- **المحتوى/التبويبات:** products/categories/brands/variants/media. Routes categories/brands state active tab؛ variants/media تخدم المنتج الحالي.
- **الداتا والـ API:** `Product`, `Category`, `Brand`, `BranchInventory`; products/categories/brands handlers + upload.
- **الصلاحيات:** `SUPER_ADMIN`, `BRANCH_MANAGER`.
- **الحالة:** 🟡 متقدمة.
- **ملاحظات ومشاكل لوجيك:** initial stock وتهيئة كل الفروع يحتاجان مراجعة؛ CSV import غير موجود، وstock columns ما زالت reliant على أسماء الفروع.
- **توصيات:** variant model مستقل، bulk CSV، branch inventory editor.

### 4.10 المخزون — `/admin/inventory`

- **المسار:** `/admin/inventory`
- **الغرض:** أرصدة الفروع، transfers، سجل الحركات، التنبيه للـ low stock.
- **المحتوى/التبويبات:** balances/movements/transfers/count/labels/alerts؛ aliases تعرض parent view، وcount/labels لهما صفحات مستقلة.
- **الدata والـ API:** `BranchInventory`, `InventoryLog`, `StockTransfer`, `Product`, `Branch`; transfer/adjust handlers.
- **الصلاحيات:** `SUPER_ADMIN`, `BRANCH_MANAGER` بعد تصحيح config.
- **الحالة:** 🟡 متقدمة.
- **ملاحظات ومشاكل لوجيك:** decrement/increment atomic و positivity guard مضاف، لكن لا توجد DB CHECK constraints، وbatch stocktake ناقص.
- **توصيات:** stock reservation، DB constraints، reason registry، movement pagination.

### 4.11 الجرد والتسوية — `/admin/inventory/count`

- **المسار:** `/admin/inventory/count`
- **الغرض:** wizard تسوية صنف/فرع مع reason وinventory log.
- **المحتوى/التبويبات:** 3-step wizard (branch/product، count/reason، confirmation).
- **الدata والـ API:** `BranchInventory`, `InventoryLog`; `GET /inventory/adjust-info`, `POST /inventory/adjust`.
- **الصلاحيات:** `SUPER_ADMIN`, `BRANCH_MANAGER`.
- **الحالة:** 🟡 فعّالة的单-item.
- **ملاحظات ومشكلة:** لا batch count/Variants، والسبب 자유 النص بدل typed reasons، ولا stocktake session model.
- **توصيات:** `StocktakeSession` + lines + approvals + variance report.

### 4.12 الباركود والطباعة — `/admin/inventory/labels`

- **المسار:** `/admin/inventory/labels`
- **الغرض:** اختيار products وطباعة barcode sheet محلي.
- **المحتوى/التبويبات:** search/selection/count/print.
- **الدata والـ API:** `Product`; no write API.
- **الصلاحيات:** `SUPER_ADMIN`, `BRANCH_MANAGER`.
- **الحالة:** 🟡 أساسية.
- **ملاحظات:** لا label template/branch inventory context مخصص، والطباعة لا تستخدم shared print service.
- **توصيات:** label templates وZPL/thermal integration.

### 4.13 المشتريات — `/admin/purchasing`

- **المسار:** `/admin/purchasing`
- **الغرض:** suppliers + purchase orders + receiving + supplier payments.
- **المحتوى/التبويبات:** orders/receiving/invoices/suppliers/returns؛ aliases حقيقية للـ parent، وreturns لها Empty State مستقل.
- **الدata والـ API:** `Supplier`, `PurchaseOrder`, `PurchaseOrderItem`, `SupplierPayment`, `Product`, `Branch`; CRUD/receive/return/payment handlers.
- **الصلاحيات:** `SUPER_ADMIN`, `BRANCH_MANAGER` بعد مطابقة config.
- **الحالة:** 🟡 متقدمة.
- **ملاحظات:** Finance كان ظاهرًا في nav مع page guard أضيق وتم إصلاحه. Supplier payment notes غير مكتملة، ولا purchase invoice credit ledger مستقل.
- **توصيات:** approval workflow، supplier statement، return/credit note ذرّي.

### 4.14 الموردون — `/admin/purchasing/suppliers`

- **المسار:** `/admin/purchasing/suppliers`
- **الغرض:** دليل suppliers وCRUD.
- **المحتوى/التبويبات:** يعرض purchasing shared view حاليًا.
- **الدata والـ API:** `Supplier`; `GET/POST /api/admin/suppliers`, `PATCH/DELETE /:id`.
- **الصلاحيات:** `SUPER_ADMIN`, `BRANCH_MANAGER`.
- **الحالة:** 🟡 موجودة، والـ nested route محتاج split UI مستقل.
- **ملاحظات:** لا vendor risk/rating/tax verification workflow.
- **توصيات:** supplier profile + onboarding + payment terms.

### 4.15 فواتير الشراء ومرتجعات الموردين — `/admin/purchasing/invoices`

- **المسار:** `/admin/purchasing/invoices`
- **الغرض:** lifecycle لفاتورة الشراء ومرتجع المورد.
- **المحتوى/التبويTabs:** aliases لعرض المشتريات الحالية؛ `returns` Empty State.
- **الدata والـ API:** `PurchaseOrder`, `SupplierPayment`; return endpoint أولي.
- **الصلاحيات:** `SUPER_ADMIN`, `BRANCH_MANAGER`.
- **الحالة:** 🟡 جزئية.
- **ملاحظات:** لا `PurchaseInvoice` مستقل أو tax invoice/credit note supplier.
- **توصيات:** schema + three-way match (PO/receipt/invoice).

### 4.16 العملاء — `/admin/customers`

- **المسار:** `/admin/customers`
- **الغرض:** customer directory, loyalty, orders count, address.
- **المحتوى/التبويبات:** list/groups/loyalty/ledger؛ aliases common CRM view.
- **الدata والـ API:** `Customer`, `Address`, `Order`, `Sale`; CRUD customers.
- **الصلاحيات:** `SUPER_ADMIN`, `BRANCH_MANAGER`.
- **الحالة:** 🟡 متقدمة.
- **ملاحظات:** loyalty points ما زالت flat، عدد الطلبات في العمود لا يشمل POS في بعض views. BM mutation of loyalty يحتاج ledger بدل direct edit.
- **توصيات:** loyalty tiers، loyalty ledger، customer 360.

### 4.17 الولاء — `/admin/customers/loyalty`

- **المسار:** `/admin/customers/loyalty`
- **الغرض:** نقاط الولاء والاستبدال.
- **المحتوى/التبويTabs:** customer shared view; route semantics فقط.
- **الدata والـ API:** `Customer.loyaltyPoints`, `Coupon`, order/sale discount fields.
- **الصلاحيات:** `SUPER_ADMIN`, `BRANCH_MANAGER`.
- **الحالة:** 🟡 جزئية.
- **ملاحظات:** لا loyalty transaction ledger أو tiers/ت expirations.
- **توصيات:** `LoyaltyLedger` immutable + tiers.

### 4.18 التقييمات — `/admin/reviews`

- **المسار:** `/admin/reviews`
- **الغرض:** approve/hide/delete customer reviews.
- **المحتوى/التبويTabs:** pending/all filter؛ لا nested tabs.
- **الدata والـ API:** `Review`, `Product`; `GET/PATCH/DELETE /api/admin/reviews`.
- **الصلاحيات:** `SUPER_ADMIN`, `BRANCH_MANAGER`.
- **الحالة:** 🟡 أساسية.
- **ملاحظات:**يجب في العميل تأكيد HTTP response قبل success toast في بعض المسارات، وpagination صغيرة.
- **توصيات:** moderation queue, abuse rules, response workflow.

### 4.19 الكوبونات — `/admin/coupons`

- **المسار:** `/admin/coupons`
- **الغرض:** coupon CRUD, limits, usage counters.
- **المحتوى/التبويTabs:** coupons/promos/usage؛ aliases common coupon view.
- **الدata والـ API:** `Coupon`, `CouponUse`; coupon handlers + quote/consume service.
- **الصلاحيات:** `SUPER_ADMIN`, `BRANCH_MANAGER`.
- **الحالة:** 🟡 متقدمة.
- **ملاحظات:** `endsAt` غير مكتمل في UI، promotion rules المتقدمة غير موجودة.
- **توصيات:** Buy X/Get Y, exclusions, scheduled campaigns.

### 4.20 الحملات والرسائل — `/admin/campaigns`

- **المسار:** `/admin/campaigns`
- **الغرض:** campaigns/templates/segments.
- **المحتوى/التبويTabs:** Empty State؛ لا mock content.
- **الدata والـ API:** لا Campaign/Dispatch models.
- **الصلاحيات:** `SUPER_ADMIN`, `BRANCH_MANAGER`.
- **الحالة:** 🔴 ناقصة.
- **ملاحظات:** WhatsApp connector موجود، لكن campaign orchestration غير موجود.
- **توصيات:** Campaign, Segment, MessageDispatch, template approval ledger.

### 4.21 الحسابات والأرباح — `/admin/accounting`

- **المسار:** `/admin/accounting`
- **الغرض:** P&L تقريبي، expenses، COD، ETA invoices.
- **المحتوى/التبويTabs:** overview/pnl/expenses/treasury/eta؛ aliases تعرض accounting view، وtreasury/receivables planned.
- **الدata والـ API:** `Order`, `Sale`, `Expense`, `TaxInvoice`, `Branch`; expense CRUD + ETA retry.
- **الصلاحيات:** `SUPER_ADMIN`, `FINANCE`.
- **الحالة:** 🟡 جزئية.
- **ملاحظات:** تم استبعاد pending/unpaid من revenue في accounting. ما زالت التكلفة تعتمد على `current costPrice`، ولا يوجد period/branch ledger كامل.
- **توصيات:** double-entry/ledger، costing snapshot، period close، treasury.

### 4.22 المصروفات والإيرادات — `/admin/expenses`

- **المسار:** `/admin/expenses`
- **الغرض:** CRUD expenses per branch/category.
- **المحتوى/التبويTabs:** expenses CRUD/table; no fake income module.
- **الدata والـ API:** `Expense`, `Branch`; `POST/PATCH/DELETE /api/admin/expenses`.
- **الصلاحيات:** `SUPER_ADMIN`, `FINANCE`.
- **الحالة:** ✅ CRUD فعلي؛ 🟡 الموديول ناقص—no income/treasury.
- **ملاحظات:** expense number generation عشوائي، لا idempotency/attachment policy كاملة.
- **توصيات:** `Income`/cash movement model, approval and attachment validation.

### 4.23 الخزينة والبنوك — `/admin/accounting/treasury`

- **المسار:** `/admin/accounting/treasury`
- **الغرض:** bank/cash balances and movements.
- **المحتوى/التبويTabs:** Empty State.
- **الدata والـ API:** لا bank/treasury tables.
- **الصلاحيات:** `SUPER_ADMIN`, `FINANCE`.
- **الحالة:** 🔴 ناقصة.
- **توصيات:** BankAccount, TreasuryMovement, reconciliation statement.

### 4.24 ضرائب ETA — `/admin/accounting/eta`

- **المسار:** `/admin/accounting/eta`
- **الغرض:** عرض/retry ETA invoice log.
- **المحتوى/التبويTabs:** ETA log aliases إلى accounting overview؛ retry button عند INVALID.
- **الدata والـ API:** `TaxInvoice`, `Setting`, `buildEtaReceipt`; `POST /api/admin/tax-invoices/:id/retry`.
- **الصلاحيات:** `SUPER_ADMIN`, `FINANCE`.
- **الحالة:** 🟡 staging/local؛ live ETA غير مفعّل.
- **ملاحظات:** offline fallback لا يعني إرسال فعلي؛ production mode/GS1/Tوقيع يحتاج اختبار sandbox.
- **توصيات:** ETA preprod credentials, signed payload, credit-note worker، no offline success wording.

### 4.25 ذمم العملاء والموردين — `/admin/accounting/receivables`

- **المسار:** `/admin/accounting/receivables`
- **الغرض:** AR/AP aging.
- **المحتوى/التبويTabs:** Empty State.
- **الدata والـ API:** لا aging ledger.
- **الصلاحيات:** `SUPER_ADMIN`, `FINANCE`.
- **الحالة:** 🔴 ناقصة.
- **توصيات:** due dates, aging buckets, settlement allocation, reminders.

### 4.26 الموظفون — `/admin/employees`

- **المسار:** `/admin/employees`
- **الغرض:** employee CRUD, role title, salary, commission.
- **المحتوى/التبويTabs:** list/departments/attendance/documents؛ list فعلي، attendance planned.
- **الدata والـ API:** `Employee`, `Branch`, optional `User`; employee CRUD.
- **الصلاحيات:** `SUPER_ADMIN`, `BRANCH_MANAGER`.
- **الحالة:** 🟡 CRUD فعلي، attendance/documents planned.
- **ملاحظات:** تم تصحيح commission UI إلى percentage↔fraction. staff role كان visible لـ Finance في nav مع page mismatch وتمت مطابقته. branch isolation ما زال مطلوبًا.
- **توصيات:** employee-user invariant, departments, documents, effective-dated salary.

### 4.27 الحضور والانصراف — `/admin/attendance`

- **المسار:** `/admin/attendance`
- **الغرض:** clock-in/out و biometric/manual source.
- **المحتوى/التبويTabs:** Empty State؛ duplicate داخل employees intentionally.
- **الدata والـ API:** لا AttendanceSession.
- **الصلاحيات:** `SUPER_ADMIN`, `BRANCH_MANAGER`, `FINANCE`.
- **الحالة:** 🔴 ناقصة.
- **توصيات:** AttendanceSession, device integration, exceptions/approvals.

### 4.28 المرتبات — `/admin/payroll`

- **المسار:** `/admin/payroll`
- **الغرض:** run/approve/pay وcommission/bonus/deduction.
- **المحتوى/التبويTabs:** payslips/commissions/advances/history؛ aliases common payroll view.
- **الدata والـ API:** `Employee`, `PayrollRun`, `PayrollItem`, `Sale`, `Refund`; payroll handlers.
- **الصلاحيات:** `SUPER_ADMIN`, `FINANCE`.
- **الحالة:** 🟡 متقدمة.
- **ملاحظات:** actual sales-based commission موجود، لكن no unique period constraint، salaryType لا يغير hourly calculation، ولا payslip/advance ledger مستقل.
- **توصيات:** unique period, effective salary, payslip PDF, immutable adjustment ledger.

### 4.29 السلف والجزاءات والإجازات — `/admin/leave`

- **المسار:** `/admin/leave`
- **الغرض:** advances, penalties, leave requests.
- **المحتوى/التبويTabs:** Empty State؛ لا mixing مع payroll.
- **الدata والـ API:** لا models.
- **الصلاحيات:** `SUPER_ADMIN`, `FINANCE`.
- **الحالة:** 🔴 ناقصة.
- **توصيات:** AdvanceLedger, LeaveRequest, approval policy, payroll link.

### 4.30 التقارير — `/admin/reports`

- **المسار:** `/admin/reports` plus independent `/sales`, `/inventory`, `/branches`, `/finance`, and `/reorder` routes.
- **المحتوى/التبويTabs:** overview cards and route-specific server-rendered tables; no longer aliases to one client.
- **الدata والـ API:** `src/lib/reports/data.ts`, reorder service, and CSV export endpoint.
- **الصلاحيات:** `SUPER_ADMIN`, `BRANCH_MANAGER`, `FINANCE` with branch scope.
- **الحالة:** ✅ جولة التصحيحات؛ see Section 10 for bounded aggregation caveat.
- **توصيات:** SQL groupBy/materialized views for high-volume installations and historical cost snapshots.

### 4.31 إدارة محتوى الموقع — `/admin/website/content`

- **المسار:** `/admin/website/content`
- **الغرض:** banners/pages/CMS.
- **المحتوى/التبويTabs:** Empty State.
- **الدata والـ API:** لا CMS models.
- **الصلاحيات:** `SUPER_ADMIN`, `BRANCH_MANAGER`.
- **الحالة:** 🔴 ناقصة.
- **توصيات:** Banner/Page/Block, media library, publish workflow.

### 4.32 إعدادات المتجر — `/admin/website/store`

- **المسار:** `/admin/website/store`
- **الغرض:** overview آمن لإعدادات الدفع والشحن.
- **المحتوى/التبويTabs:** store summary + link إلى Settings.
- **الدata والـ API:** `Setting`; `getCourierConfig` indirectly; لا secrets returned.
- **الصلاحيات:** `SUPER_ADMIN`.
- **الحالة:** 🟡 Overview حقيقي، جزئي.
- **ملاحظات:** existence check يفحص القيمة usable، ولا يعرض Fawry/كل gateway details بعد.
- **توصيات:** settings deep links, confirmation status, secret rotation UI.

### 4.33 السلات المتروكة — `/admin/website/carts`

- **المسار:** `/admin/website/carts`
- **الغرض:** recovery funnel/reminders.
- **المحتوى/التبويTabs:** Empty State.
- **الدata والـ API:** لا CartSession/Event store.
- **الصلاحيات:** `SUPER_ADMIN`, `BRANCH_MANAGER`.
- **الحالة:** 🔴 ناقصة.
- **توصيات:** server cart events, consent, recovery message queue.

### 4.34 المستخدمون — `/admin/users`

- **المسار:** `/admin/users`
- **الغرض:** user CRUD, role assignment, branchIds, active state.
- **المحتوى/التبويTabs:** users list; roles nested page.
- **الدata والـ API:** `User`, `Branch`; user CRUD.
- **الصلاحيات:** `SUPER_ADMIN`.
- **الحالة:** 🟡 CRUD فعلي.
- **ملاحظات:** تم إصلاح إنشاء managerPin hashing، password minimum 8، role/branch validation. anti self-lockout موجود في PATCH/DELETE.
- **توصيات:** password reset flow, session revocation, audit all role changes.

### 4.35 الأدوار والصلاحيات — `/admin/users/roles`

- **المسار:** `/admin/users/roles`
- **الغرض:** عرض source of truth لصلاحيات API.
- **المحتوى/التبويTabs:** role cards + route/method matrix read-only.
- **الدata والـ API:** `src/lib/auth/rbac-matrix.ts`; لا API.
- **الصلاحيات:** `SUPER_ADMIN`.
- **الحالة:** 🟡 جزئية.
- **ملاحظات:** تعرض API RBAC، ولا تعرض page guards/branch isolation/field-level permissions.
- **توصيات:** permissions persisted أو typed policy موحد، branch scope matrix، permission tests.

### 4.36 الفروع — `/admin/branches`

- **المسار:** `/admin/branches`
- **الغرض:** branch CRUD.
- **المحتوى/التبويTabs:** branch cards/form.
- **الدata والـ API:** `Branch`; branch CRUD.
- **الصلاحيات:** `SUPER_ADMIN`.
- **الحالة:** 🟡 أساسية.
- **ملاحظات:** branch isActive validation وdefault hours تحتاج مراجعة، ولا يوجد onboarding wizard.
- **توصيات:** branch opening checklist and inventory initialization transaction.

### 4.37 إعدادات النظام — `/admin/settings`

- **المسار:** `/admin/settings`
- **الغرض:** registry-based business settings and encrypted secrets.
- **المحتوى/التبويTabs:** general/branches/tax/payments/printing/notifications aliases common settings manager.
- **الدata والـ API:** `Setting`; `GET/PUT /api/admin/settings`; `settings-secure`.
- **الصلاحيات:** `SUPER_ADMIN`.
- **الحالة:** 🟡 متقدمة.
- **ملاحظات:** تم حذف UI لمفتاح غير مسجل `loyalty.pointsPerUnit`، وإضافة validation للـ manual destinations. Settings coverage لا يزال جزئيًا compared with registry.
- **توصيات:** auto-generate all registry controls, confirmation UX, secret rotation, audit history.

### 4.38 سجل النشاط — `/admin/audit`

- **المسار:** `/admin/audit`
- **الغرض:** قراءة العمليات الحساسة.
- **المحتوى/التبويTabs:** search/table read-only.
- **الدata والـ API:** `AuditLog`; `GET /api/admin/audit`; direct query take 200.
- **الصلاحيات:** `SUPER_ADMIN`.
- **الحالة:** 🟡 أساسية.
- **ملاحظات:** لا pagination/export/branch filters UI، وبعض العمليات القديمة لا تكتب audit.
- **توصيات:** append-only retention، actor display names، server pagination.

### 4.39 النسخ الاحتياطي — `/admin/backup`

- **المسار:** `/admin/backup`
- **الغرض:** backup/restore operations.
- **المحتوى/التبويTabs:** Empty State؛ لا تشغيل destructive من browser.
- **الدata والـ API:** لا backup job UI؛ should be external.
- **الصلاحيات:** `SUPER_ADMIN`.
- **الحالة:** 🔴 ناقصة.
- **توصيات:** encrypted external job، retention، restore drills، monitoring.

---

## 5. الصفحات الجديدة التي اتضافت

###heiجزة فعلية

1. **ShellSidebar config-driven** — categories، collapse، drawer، tooltips، role filtering، POS shortcut، command palette، breadcrumbs.
2. **Nested route layouts** — orders/products/inventory/purchasing/customers/employees/accounting/payroll/returns/coupons/shifts/settings/reports/website.
3. **`/admin/expenses`** — صفحة CRUD فعلية باستخدام `Expense` و`Branch`.
4. **`/admin/shipping`** — Overview فعلي لـ Bosta/Mylerz readiness وzones، بدون أسرار.
5. **`/admin/users/roles`** — read-only role/API matrix.
6. **Route pages للتبويبات** — all generated routes have real `page.tsx` and inherit their parent’s server guard.
7. **Tests** — navigation route existence، branch notification scope، env guard، DB physical identity guard.

### Empty States مقصودة

- `/admin/sales/invoices`
- `/admin/campaigns`
- `/admin/attendance`
- `/admin/leave`
- `/admin/backup`
- `/admin/website/content`
- `/admin/website/carts`
- `/admin/accounting/treasury`
- `/admin/accounting/receivables`
- `/admin/purchasing/returns`

### أولوية high priority

- **Suppliers / purchase invoices:** CRUD/PO/receive/payment موجودة، لكن invoice/credit lifecycle غير مكتمل.
- **Stocktake:** wizard فعلي的单-item، batch stocktake غير موجود.
- **Expenses:** CRUD فعلي، income/treasury غير موجود.
- **Roles/Permissions:** static API matrix، field/branch permissions غير موجودة.
- **Audit Log:** read-only query، لا write/export UI كامل.
- **Shipping:** provider overview، لا carrier account/settlement UI.

---

## 6. تقرير مراجعة اللوجيك (Logic Audit)

| الموديول | المشكلة | الخطورة | اتصلحت؟ | الحل/الحالة |
|---|---|---:|---:|---|
| Navigation | Sidebar كان flat، وrole links غير متطابقة | High | ✅ | config واحد + role filter + tabs/drawer/palette |
| POS | Electronic payment كان يصبح `PAID` من browser input | High | ✅ جزئي | أصبح `PENDING`؛ يلزم webhook/terminal proof |
| Orders | Client delivery fee قابل للتلاعب | High | ✅ | server zone table + server fee |
| Orders | Shipment ينشأ قبل transaction | High | ✅ | ينشأ بعد commit مع manual fallback |
| Orders | Retry قد ينشئ order/stock duplicates | High | ❌ | `clientRequestId` + reservation/idempotency مطلوب |
| Orders | Online expiry script يبحث PENDING فقط | Med | ✅ | يدعم PENDING وCONFIRMED |
| Stock | decrement يقبل quantity سالبة | High | ✅ | positive integer guard + conditional update |
| Stock | DB لا يمنع negative stock | High | ❌ | CHECK constraint/serializable reservation مطلوب |
| Stock | batch stocktake غير موجود | Med | ❌ | StocktakeSession مقترح |
| Stock | branch scope غير مركزي في معظم Admin APIs | High | ❌ | helper مركزي + policy matrix هو الأولوية |
| RMA | duplicate lines قد يتجاوزان quantity | High | ✅ | accumulator + transaction recheck |
| RMA | fullReturn يحتسب الطلب الحالي مرتين | High | ✅ | استبعاد current return id |
| RMA | Exchange type كان 항상 RETURN | High | ✅ جزئي | type EXCHANGE在西؛ netting لم يكتمل |
| RMA | PROCESSING refund قد يعلق بعد crash | High | ❌ | watchdog/UNKNOWN/provider idempotency |
| RMA | coupon/loyalty side effects تحتاج ledger أوسع | High | ❌ | immutable refund allocation |
| Webhooks | secret غياب كان يقبل الرسالة في development | High | ✅ | fail-closed دائمًا |
| Webhooks | لا method/amount/reference validation | High | ✅ جزئي | Paymob/Fawry checks؛ يلزم event dedupe |
| Auth | Demo credentials ظاهرة في production | Critical | ✅ | production gate + bundle test |
| Auth | fallback NEXTAUTH secret عند APP_ENV ناقص | Critical | ✅ | NODE_ENV production fail-closed |
| Auth | Callback open redirect | High | ✅ | same-site path validation |
| Settings | manual transfer instructions hardcoded | High | ✅ | settings-backed destinations + hidden by default |
| Settings | `loyalty.pointsPerUnit` غير موجود في registry | Med | ✅ | إزالة UI |
| Employees | commission UI percentage mismatch | High | ✅ | UI percent ↔ DB fraction |
| Employees | PIN create كان يتجاهل | Med | ✅ | bcrypt validation/hashing |
| Reports | pending sales计入 revenue | High | ✅ | paid-only filters |
| Reports | discount يتضاعف مع sale items | High | ✅ | count discount مرة لكل sale |
| Reports | `to` date excludes end day | Med | ✅ | end-of-day parse |
| Reports | in-memory limits وbranch scope | Med | ❌ | SQL aggregation/cursor pagination |
| ETA | offline status قد يبدو submitted | High | ❌ | status OFFLINE_QUEUED + worker |
| ETA | SKU fallback بدل GS1 | High | ❌ | production hard validation |
| POS | offline queue لا يحفظ كل discount/reference | Med | ❌ | queue schema versioning |
| Shifts | concurrent OPEN shifts | High | ❌ | partial unique index + row lock |
| Suppliers | return race على quantityReceived | High | ❌ | conditional decrement |
| Seed | demo seed يعيد كلمات مرور production | Critical | ✅ | development-only gate + opt-in reset |
| Secrets | credentials في README/example/script | Critical | ✅ | placeholders + remove fallback |
| Test DB | schema query كانconsidered isolation | Critical | ✅ | physical database identity |
| SEO | placeholder canonical domain | Med | ✅ | production `NEXT_PUBLIC_SITE_URL` gate |
| UX | nested interactive wishlist inside product Link | Med | ✅ | siblings under image link |
| UX | print HTML بدون escaping | High | ✅ | escape dynamic print values |
| UX | English empty state كان يعرض Arabic | Low | ✅ | locale-aware empty state/tabs |
| UX | mobile admin drawer | High | ✅ | responsive drawer + focusable controls |

---

## 7. الفجوات في النظام (Gaps)

###产品和Operations

- Loyalty tiers، loyalty ledger، expiry/referral، وadvanced redemption.
- Serial/lot/expiry numbers للequipment وbattery/tyre/product lines.
- Warranty، returns reason analytics، وRMA customer portal timeline الكامل.
- Reorder points، ABC analysis، demand forecasting، وbatch stocktake.
- Multi-warehouse permissions وbranch-scoped BI على مستوى query.
- Gift wrapping، channels/price books، وB2B customer accounts.
- Store credit، deposits، وsplit tenders POS.

### Finance/Compliance

- Double-entry ledger، bank reconciliation، cash/bank movement، وaccruals.
- Historical cost/FIFO/weighted average cost.
- Purchase invoice three-way match وsupplier credit notes.
- AR/AP aging، due dates، reminders، وcollections.
- ETA production credentials، CAdES signing، GS1 validation، credit-note worker.
- Immutable audit retention وfinancial exports.

### Integrations

- Production Bosta/Mylerz credentials، label archive، carrier settlement cases.
- Paymob/Fawry terminal proof وpayment event dedupe.
- WhatsApp approved templates and campaign dispatch.
- Distributed rate limiting (Redis/edge) بدل in-memory Map.
- Stock reservation expiry/idempotency.
- Backup/restore automation وdisaster recovery drills.

### UX/Accessibility

- Translation coverage لكل النصوص الثابتة في storefront/POS/EN.
- Focus trap وEscape لكل POS/custom modals.
- Semantic radio/tab controls في checkout.
- Automated contrast audit وreduced-motion/no-JS tests.
- English hardcoded strings في Footer/Checkout/POS.

---

## 8. خطة العمل القادمة (Roadmap)

### Now — P0 قبل production

1. **Secret rotation:** تدوير Neon/NextAuth/Cloudinary/Vercel/ETA/Paymob/Fawry/couriers، تنقية history، وتفعيل secret scanning.
2. **Branch authorization:** helper مركزي يطبق `branchIds` على pages وAPI وreports، ثم IDOR tests لكل role.
3. **Payment truthfulness:** POS terminal/webhook proof، منع manual generic PAID، event dedupe.
4. **Order idempotency/reservation:** `clientRequestId`, reservation expiry, outbox shipment/payment.
5. **DB safety:** `CHECK` للكمية، unique payroll period/partial open shift، migration plan.
6. **Test DB/CI:** PostgreSQL service فعلي، db push/seed، E2E against isolated DB.

### Next — P1

1. إكمال RMA exchange netting وrefund watchdog.
2. Batch stocktake + variants/serial/lot model.
3. Treasury/bank/AR/AP ledger.
4. Supplier invoice/credit workflow.
5. Server-side pagination/filtering للجداول الكبيرة.
6. CMS/Banner/Page models.
7. Campaign/segment/template dispatch.
8. Attendance/leave/advance workflows.
9. POS offline queue versioning وsplit tender ledger.

### Later — P2/P3

1. Loyalty tiers/referrals/advanced promotions.
2. ABC/reorder/forecasting.
3. Native mobile/PWA/offline-first POS.
4. BI warehouse/read replicas.
5. Integrations ERP/marketplaces/accounting packages.
6. Automated backup/restore وadvanced observability.
7. Arabic/English accessibility certification وperformance budgets.

---

## 9. ملحق

### 9.1 Migrations

- **لا migration جديدة تم إنشاؤها في هذه المهمة.**
- Migration القائمة المستخدمة: `prisma/migrations/21_perf_indexes/migration.sql`.
- يجب تشغيل migrations على staging/Neon وفق خطة، وعدم تنفيذ `db push` على production.
- التوصية: backup + migration verification قبل migration 20/21 أو أي migration تحوي schema.

### 9.2 Environment variables

المتغيرات الجديدة/المطلوبة توثيقًا:

```env
APP_ENV=production
NEXT_PUBLIC_SITE_URL=https://<real-domain>
DIRECT_URL=<neon-direct-connection>
SETTINGS_ENCRYPTION_KEY=<32-byte-base64-key>
PAYMOB_HMAC_SECRET=<secret>
BOSTA_WEBHOOK_SECRET=<secret>
MYLERZ_WEBHOOK_SECRET=<secret>
FAWRY_SECURE_KEY=<secret>
WHATSAPP_API_TOKEN=<secret>
WHATSAPP_PHONE_NUMBER_ID=<id>
SEED_DEFAULT_PASSWORD=<development-only>
SEED_RESET_CREDENTIALS=false
SEED_MANAGER_PIN_PRIMARY=
SEED_MANAGER_PIN_SECONDARY=
ALLOW_DESTRUCTIVE_CLEANUP=false
```

### 9.3 الملفات الرئيسية المضافة/المعدلة

#### Navigation/UI

- `src/config/admin-navigation.ts`
- `src/components/admin/AdminSidebar.tsx`
- `src/components/admin/AdminChrome.tsx`
- `src/components/admin/AdminHeader.tsx`
- `src/components/admin/AdminBreadcrumbs.tsx`
- `src/components/admin/AdminCommandPalette.tsx`
- `src/components/admin/AdminSectionTabs.tsx`
- `src/components/admin/AdminEmptyState.tsx`
- `src/components/admin/AdminPlannedPage.tsx`
- `src/components/admin/AdminIcon.tsx`
- `src/lib/site-url.ts`
- `src/app/[locale]/admin/**/layout.tsx`
- `src/app/[locale]/admin/**/page.tsx` للتبويبات والصفحات الجديدة.

#### Backend/security/logic

- `src/app/api/orders/create/route.ts`
- `src/app/api/pos/sale/route.ts`
- `src/app/api/pos/returns/route.ts`
- `src/app/api/webhooks/paymob/route.ts`
- `src/app/api/webhooks/fawry/route.ts`
- `src/lib/webhooks/verify.ts`
- `src/lib/env-guard.ts`
- `src/lib/inventory/service.ts`
- `src/lib/returns/service.ts`
- `src/lib/payments/index.ts`
- `src/lib/notifications.ts`
- `src/lib/admin/notification-scope.ts`
- `src/app/api/admin/notifications/**`
- `src/app/api/admin/users/route.ts`
- `src/app/api/admin/employees/**`
- `src/app/api/admin/reports/summary/route.ts`
- `src/app/api/admin/settings/route.ts`
- `src/app/api/admin/orders/route.ts`
- `src/components/pos/PosReceiptModal.tsx`
- `src/components/admin/ShiftsManager.tsx`
- `prisma/seed/run.ts`, `prisma/seed/users.ts`, `prisma/seed/settings.ts`
- `.env.example`, `README.md`, `package.json`.

#### Tests/tooling

- `tests/unit/admin-navigation.test.ts`
- `tests/unit/notification-scope.test.ts`
- `tests/unit/env-guard.test.ts`
- `tests/helpers/test-db.ts`
- `tests/integration/db-guard.test.ts`
- `tests/integration/returns-service.test.ts`
- `tests/integration/pos-atomic.test.ts` (verified after server fee change)
- `tests/integration/portal-address.test.ts` (verified after server zone default)
- `scripts/dashboard-audit.ts`
- `scripts/expire-unpaid-orders.ts`
- `scripts/cleanup-ops-data.ts`
- `scripts/migrate-to-cloudinary.ts`

### 9.4 نتائج التحقق

| الأمر | النتيجة |
|---|---|
| `npm run typecheck` | ✅ PASS |
| `npm run lint` | ✅ PASS، 0 warnings بعد تنظيف الـ lint |
| `npm run build` | ✅ PASS، production build، 252 routes |
| `npm run test:unit` | ✅ 17 ملف اختبار / 70 اختبارًا ناجحًا |
| `npm run test:int` | ✅ 26 ملف اختبار / 87 اختبارًا ناجحًا |
| `npm run test:dashboard` | ✅ 173/173 |
| Browser E2E visual | ⚠️ لم يتم تشغيله في البيئة الحالية؛ desktop browser غير متصل |
| `npm run check:i18n` | ✅ 207 keys each |
| `npm run check:invariants` | ✅ INVARIANTS CLEAN |

### 9.5 Git

- Branch العمل الحالي: `main` (الـ commits السابقة كانت على `refactor/admin-sidebar-restructure`).
- Phase 1: `c6bbe3d` — categorized admin shell.
- Phase 2: `5ea3a94` — nested routes/module pages.
- Phase 3: `b4de357` — security/payment/logic hardening.
- UX round commits: `e853258` (locale/colors), `7ef4f98` (orders/invoices), `f4a84cb` (purchasing), `e3e3c13` (schema), `2e0116f` (reports/reorder), `258a958` (batch stocktake), `1d950f7` (POS filters), `338ae6b` (storefront/wishlist).
- Report/metadata commit: `4a47b1a`.
- UI/error round commits: `71d1d0c` (code), `e0a4174` (docs), `a299698` (complete API envelope migration).
- لم يتم push إلى `main` مباشرة؛ يتم push للbranch(feature) بعد الفحص النهائي.
- الملفات المحلية غير المتتبعة `scripts/debug-*.ts` و`scripts/.stock-snap.json` لم يتم stage أو حذف.

### 9.6 خلاصة الجاهزية

النظام الآن أفضل تنظيمًا من ناحية التنقل والوصول، والصفحات الجديدة لا تعرض بيانات وهمية،(build/lint/typecheck clean، والـ routes是真的 موجودة. قبل إعلان production-ready يجب إغلاق P0 المتعلقًا بـ branch isolation، payment proof/webhooks، online idempotency/reservation، وتدوير الأسرار. هذه البنود موثقة وليست مخفية.

---

## 10. جولة التصحيحات UX والميزات — 25 سبتمبر 2026

هذه الجولة منفصلة عن إعادة هيكلة الـ shell السابقة، ونفّذت على نفس الـ branch. الحالة في `docs/TASKS.md` هي المصدر التشغيلي السريع.

### 10.1 حالة البنود الأربعة عشر

| البند | الحالة | التنفيذ الفعلي |
|---|---|---|
| A1 العربية default locale | ✅ | `localePrefix: always`، redirect صريح `/` إلى `/ar`، وroot page redirect؛ حافظت روابط next-intl على `/ar` و`/en`. |
| A2 الألوان والتباين | 🟡 | semantic tokens لحالات السلامة، mappings للضوء، وتطبيق على badges/Sidebar/Command Palette. لم يُنفذ فحص axe/WCAG بصري كامل، والـ legacy literals ما زالت تحتاج مرحلة تدريجية. |
| B1 تغيير حالة الطلب | ✅ | Confirm Dialog يعرض الطلب من→إلى والأثر، endpoint state machine مع `expectedFromStatus`، ومنع تغيير payment status من نفس المسار. |
| B2 تعديل الطلب | ✅ | PENDING/CONFIRMED فقط، server totals، optimistic `editVersion`، stock delta transaction، قيود invoice/return/payment، وAudit داخل transaction. |
| B3 الفاتورة القديمة | ✅ | snapshot issuance، viewer/print، reprint marker و`requestId` idempotency، `InvoiceReprint` وAudit. السجلات القديمة reconstructed وتُوسم Legacy. |
| C1 صفحة الموردين | ✅ | route مستقلة، CRUD، كشف ملخص لكل مورد، POs والمدفوعات، ومنع حذف مورد مرتبط بسجلات مالية. |
| C2 Purchase Order | ✅ | بحث name/SKU/barcode، dedupe UI/API، quantities/cost، total فوري، responsive، draft/confirm، ومنع استلام DRAFT. |
| D1 فصل التقارير | ✅ | overview إضافة إلى routes مستقلة للمبيعات والمخزون والفروع والمالية والنواقص. |
| D2 فلاتر التقارير | ✅ | server-side aggregation/filter/pagination، URL query state، أعمدة المنتج الكاملة، وCSV export endpoint. |
| D3 كشكول النواقص | ✅ | reorder point/quantity لكل branch، `ReorderRequest` يحفظ checkbox/user/date/note/supplier، filters، وإنشاء PO من المحدد. |
| E1 Batch Stocktake | ✅ | `StocktakeSession` + `StocktakeLine`، جدول كامل، draft/approve ذري، drift guard، InventoryLog لكل فرق، variance report/CSV. |
| F1 POS filters | ✅ | facets API للتصنيف/الماركة، chips touch-friendly و«الكل»، وباركود/SKU يظل fastest path. |
| G1 Product pagination | ✅ | Storefront server pagination/URL filters/sort/count، وAdmin Products server page pagination. |
| G2 Wishlist | ✅ | `WishlistItem` DB للعميل، localStorage للزائر، merge عند login، حذف/نقل للسلة/عداد، وقلب sibling غير nesting. |

### 10.2 Migrations والقرارات

- `22_order_edit_version`: `Order.editVersion` لحماية التعديلات المتزامنة.
- `23_invoice_reprints`: invoice snapshot/reprint count/audit record.
- `24_reorder_requests`: per-branch reorder policy and durable `ReorderRequest`.
- `25_batch_stocktake`: stocktake session/line enums and tables.
- `26_wishlist_items`: composite-key `WishlistItem` for idempotent customer lists.

تم تطبيق migrations 22–26 على Neon عبر `prisma migrate deploy`، ومزامنة test DB عبر `prisma db push` في بيئة الاختبار المعزولة. لم تُضف أي أسرار إلى Git.

### 10.3 الملفات الرئيسية في الجولة

- Routing/locale: `src/i18n/routing.ts`, `src/middleware.ts`, `src/app/page.tsx`, `src/app/globals.css`.
- Orders/B3: `src/components/admin/OrdersManager.tsx`, `src/components/admin/InvoiceActions.tsx`, `src/app/api/admin/orders/**`, `src/app/api/admin/tax-invoices/[id]/route.ts`, `src/lib/invoices/snapshot.ts`.
- Purchasing: `src/app/[locale]/admin/purchasing/suppliers/page.tsx`, `src/components/admin/PurchasingManager.tsx`, `src/app/api/admin/purchase-orders/**`.
- Reports/reorder: `src/lib/reports/**`, `src/components/admin/ReportTableClient.tsx`, `src/components/admin/ReorderClient.tsx`, `src/app/api/admin/reports/**`.
- Stocktake: `src/lib/inventory/stocktake.ts`, `src/app/api/admin/stocktakes/**`, `src/components/admin/StocktakeClient.tsx`.
- POS/storefront/wishlist: `src/app/api/pos/products/route.ts`, `src/app/[locale]/pos/page.tsx`, catalog server page، `src/components/storefront/WishlistButton.tsx`, `src/app/api/account/wishlist/**`.

### 10.4 التحقق والقيود المتبقية

- typecheck/lint/build/check:i18n ناجحة بعد مجموعة الميزات النهائية.
- Focused integration tests cover order edit, purchase-order draft workflow, reorder requests, batch stocktake, POS branch protection, and existing report behavior.
- A2 remains 🟡 because no automated visual WCAG/axe run is available in this environment; do not describe it as fully audited.
- Supplier account is a commitments/payments summary until supplier-payment-to-PO allocation and return credit notes exist.
- Report aggregation currently has bounded source reads before in-memory aggregation; high-volume installations should move these reports to SQL groupBy/materialized views.
- Existing production risks from the previous report remain explicit: broad historical branch isolation, online order idempotency/reservation, exchange netting, refund watchdog, live ETA/signing, and DB-level stock constraints.
- Desktop browser visual/WCAG ما زال يحتاج جلسة browser متصلة؛ تم تشغيل فحص Playwright محلي على 4 مقاسات و5 صفحات public بدون overflow أو console errors، بينما لم يتم ادعاء فحص axe/WCAG كامل.

---

## 11. إصلاحات UI/UX ومعالجة الأخطاء

هذه الجولة نُفذت على `main` بعد جولة الميزات السابقة، وتغطي المشاكل A–D في `docs/TASKS.md`.

### 11.1 قبل/بعد — A) Scrollbar مزدوج

**المشكلة قبل:**
- `AdminChrome` كان يستخدم `h-dvh` و`overflow-hidden`، لكن الـ Sidebar كان عنصرًا قابلًا للتمرير وحده، بينما كان Main عنصرًا آخر قابلًا للتمرير؛ على RTL والجداول العريضة كان يظهر scrollbar للـ document وآخر للمحتوى.
- `h-screen` في POS مع `w-screen` كان يترك تجاوزًا أفقيًا بسبب اختلاف viewport.
- في Storefront كانت Desktop navigation/actions تظهر معًا عند `1024px` وتسبب overflow أفقي 79px في tablet landscape.

**الحل بعد:**
- `AdminChrome` يملك viewport ويضع `data-scroll-region="admin-main"` على `main` مع `.app-scrollbar`; يضيف `body[data-app-shell='admin']` لمنع document scroll المكرر.
- `AdminSidebar` أصبح غلافه `overflow-hidden`، وداخله Navigation وPOS وuser card داخل region داخلي واحد قابل للتمرير عند الحاجة فقط، والـ footer ثابت `shrink-0`.
- كل الجداول العريضة وشرائط الفلاتر في Admin/POS تستخدم `.app-scrollbar` و`.app-scrollbar-horizontal`، مع لون token و`scrollbar-width: thin`، والجدول الأفقي يبقى scrollbar أفقيًا مميزًا.
- POS يستخدم `h-dvh` و`min-h-0`، وStorefront ينقل nav الكامل إلى `xl` بينما يعرض compact menu/actions في `1024px`.

**الملفات:** `src/app/globals.css`, `src/components/admin/AdminChrome.tsx`, `src/components/admin/AdminSidebar.tsx`, `src/app/[locale]/pos/page.tsx`, `src/components/storefront/Header.tsx`, `src/components/ui/foundation.tsx`, وبقية wrappers الجداول.

### 11.2 قبل/بعد — B) Modal

**المشكلة قبل:** كانت `Modal` في `foundation.tsx` تمرر panel كامل في `overflow-y-auto`، بينما كانت dialogs أخرى في POS/Admin تكرر markup بحدود وارتفاعات ثابتة؛ النتيجة كانت فراغ/تغطية عند جدول قصير وعدم ثبات footer عند جدول طويل.

**الحل بعد:**
- `DialogFrame` هو wrapper واحد: overlay `fixed inset-0` مع flex centering، panel بلا height ثابت، و`max-height: min(90dvh, calc(100dvh - 2rem))`.
- `app-modal-body` هو منطقة التمرير الوحيدة، وheader/footer ثابتان، مع `aria-modal` وfocus trap وEscape وbody lock واستعادة focus، مع `getClientRects()` كفلتر صحيح للـ focusables داخل fixed elements.
- تم ترحيل Users/Branch/Shifts/Quick Customer/Close Shift/Payment/Receipt/Return dialogs إلى `DialogFrame` دون تغيير RTL أو التصميم البصري.
- لا يوجد JS height measurement أو layout shift؛ الحل CSS فقط مع `flex`/`max-height`.
- `DialogFrame` يستخدم React Portal إلى `document.body`، ولا تستخدمه `backdrop-filter` أو `overflow` في الـ ancestors، لذلك يظل overlay مرتبطًا بالـ viewport حتى داخل `.glass-panel` الخاص بالجدول.

### 11.3 قبل/بعد — C) Version label

كان footer موجود بالفعل أسفل Sidebar، وتم تثبيت Contract: `shrink-0`, `dir="ltr"`, `aria-label`, `whitespace-nowrap`، وعدم تكرار النسخة في Header/الصفحات. لا يوجد Changelog route وهمي، لذلك لم يُضاف رابط غير حقيقي.

### 11.4 قبل/بعد — D) الأخطاء

#### 11.4.1 Wishlist 401 spam

**قبل:** كل `ProductCard` كان ينفذ `GET /api/account/wishlist` عند mount وعند كل storage event، و`useWishlistCount` كان ينفذ طلبًا إضافيًا؛ الزائر غير المسجل كان يسبب 401 متكررًا وضوضاء في console.

**بعد:**
- Server storefront layout يقرأ signed portal cookie مرة واحدة ويمرر `initialAuthenticated` إلى `StorefrontSessionProvider`.
- `useWishlist()` هو المصدر الوحيد للعداد/الأزرار/صفحة Wishlist؛ الطلب يُجلَب مرة واحدة، مع in-flight dedupe، وlocalStorage للزائر، وmerge endpoint واحدة عند login، وfallback إلى guest عند 401/403.
- Toggle optimistic مع rollback، toast واضح عند فشل 5xx، ولا unhandled promise rejection.

**الملفات:** `src/components/storefront/StorefrontSessionProvider.tsx`, `WishlistButton.tsx`, `wishlist/WishlistClient.tsx`, `account/AccountClient.tsx`, `(storefront)/layout.tsx`, `api/account/wishlist/**`.

#### 11.4.2 Client fetch/error boundary

- `src/lib/client-api.ts` أصبح wrapper وحيد لكل `fetch` في مكونات العميل (Admin/Storefront/POS؛ لا توجد `fetch()` مباشرة بخلاف server integrations).
- يقرأ `{error:{code,message,requestId}}` والـ legacy strings، يطبق timeout/abort، ولا يسجل 401/403 كـ `console.error`.
- 401 يطلق auth event (redirect في Admin أو رسالة في Storefront)، 403 يعرض رسالة صلاحية، و5xx/network يعرض toast مع زر `إعادة المحاولة`، مع throttle لمنع spam.
- `GlobalErrorBoundary` في `[locale]/layout.tsx`، و`ErrorEventHandler` مركزي، و`[locale]/pos/error.tsx` يغطيان أخطاء render في Admin/Storefront/POS.
- `Toast` أضيف له action اختياري و`role=alert` للأخطاء.

#### 11.4.3 Backend API envelope/logging

**قبل:** كانت معظم API error responses تعتمد `{success:false,error:'text'}`، وأخطاء 5xx تكتب مباشرة إلى `console.error` بدون request id.

**بعد:**
- `src/lib/api-response.ts` يوفّر `apiError`, `apiSuccess`, `apiInternalError`, `getRequestId`؛ شكل الخطأ هو:

```json
{
  "success": false,
  "error": { "code": "VALIDATION_ERROR", "message": "...", "requestId": "..." },
  "message": "..."
}
```

- `x-request-id` و`requestId` يضافان للردود، و`message` top-level يبقى compatibility للـ legacy consumers.
- تم تحويل error responses في جميع `route.ts` handlers من `NextResponse.json({success:false,...})` إلى `apiError`، بما فيها Admin/POS/webhooks، مع `apiError` extras عند وجود `needsPin` أو `needsShift` أو payload أخطاء الطلب.
- تم استبدال `console.error` داخل API handlers بـ`captureError`؛ `monitor.ts` يضيف requestId/event shape، ولا تُسجل حالات 401 المتوقعة كـ error.
- `NEXT_PUBLIC_SENTRY_DSN` اختياري في `.env.example` للـ browser monitoring، ولا يوجد سر في frontend.
- في POS light mode، أضيفت rules scoped للـ `.pos-payment-modal` لأن opacity surfaces مثل `bg-slate-900/80` كانت ما زالت داكنة بينما التحويل العام للـ light mode يغيّر لون النص، مما كان يخفي labels؛ الآن payment options وtab strip وchange summary لهما backgrounds متوافقة مع النص.

### 11.5 Console Audit

|البند|Observation|Origin|Action|
|---|---|---|---|
| CORS `https://www.useblackbox.io/tlm` + `Failed to fetch` | browser extension/أداة Blackbox خارجية (`index.iife.js`)، لا يوجد في dependencies أو source | external | توثيق فقط؛ لم يتم تعطيل كود النظام |
| 401 متكرر على `/api/account/wishlist` | كود التطبيق | app | تم إصلاحه بالكامل بـsession gate + hook مركزي |
| 403/5xx/انقطاع شبكة | API/شبكة متوقعة أو حقيقية | app | envelope موحد + toast/retry + monitoring منظّم |
| React `Decimal` server warning في public home | Server Component كان يمرر object كامل | app | تم explicit projection لأرقام plain قبل `ProductCard` |
| Admin/POS auth shell | layout/local | app | shell واحد وscroll regions موحدة |

### 11.6 التحقق

- `npm run typecheck` ✅
- `npm run lint` ✅ (0 warnings)
- `npm run build` ✅ (252 routes؛ تم ضبط `NEXT_PUBLIC_SITE_URL` أثناء التحقق المحلي)
- `npm run test:unit` ✅
- `npm run test:int` ✅ (26 ملف / 87 اختبار)
- `npm run test:dashboard` ✅ (173/173)
- `npm run check:i18n` ✅ (207 keys each)
- `npm run check:invariants` ✅ CLEAN
- Playwright local probe ✅ (390/768/1024/1366 × 5 public routes، صفر horizontal overflow وصفر console/5xx response).
- Playwright locale probe ✅ (`tests/e2e/locale.spec.ts`، 10/10 على `/en`).
- Admin English scan ✅ (`npm run check:i18n-admin` groups a/b/c، صفر UI leak على 38 مسار).

---

## 12. الترجمة على `/en` — التشخيص والعلاج

### 12.1 السبب الجذري

مسار `/en` كان يعمل تقنيًا (middleware + `next-intl` + `html lang="en" dir="ltr"` سليمة)، لكن طبقة العرض كانت تستخدم **نصوصًا عربية مكتوبة inline داخل JSX** بدل `useLocale()` / `getLocale()`. النتيجة: الترويسة والجداول والـdialogs تعرض عربي حتى على `/en`.

### 12.2 ما تم تغييره

| الطبقة | التغيير |
|---|---|
| Storefront | كل صفحات المتجر ومكوناته تستخدم `isAr`/`L()`؛ أسماء المنتجات والفروع والفئات تأخذ `nameEn/addressEn` |
| POS | شاشة الكاشير + `PosPaymentModal` + `PosReceiptModal` (بما فيه الإيصال المطبوع `dir/lang` والتواريخ) + `ReturnWizard`، مع `dir` ديناميكي و`ج.م/EGP` |
| Admin | 25+ صفحة و20+ مكوّنًا؛ `StatusBadge/PayLabel/SourceLabel` تعتمد `messages/*.json` وسليمة، والباقي أُصلح |
| Shared errors | `ErrorEventHandler` + `lib/client-api.ts` + `DialogFrame/ConfirmDialog` |
| Returns API | `nameEn`, `reasonsEn`, `blockedReasonEn`, `branchEn` |
| Language switcher | `router.replace(pathname,{locale})` كان no-op → استُبدل بـ`Link locale={next}` |

**نمط الترجمة المعتمد:** `const isAr = locale === 'ar'` ثم `const L = (ar, en) => (isAr ? ar : en)` داخل client components، و`getLocale()` من `next-intl/server` داخل server pages. ملفّا `messages/ar.json` و`messages/en.json` يبقيان كما هما (parity 207 key) ولا يزالان مصدرًا لمفاتيح `common/*`, `auth/*`, `nav/*`, `admin.status_*`, `admin.pay_*`, `admin.src_*`.

### 12.3 أدوات التحقق

- `tests/e2e/locale.spec.ts` — 10 اختبارات: كل مسار `/en` يجب أن يكون `lang="en"`، خاليًا من الحروف العربية في النص المرئي، وأن يحتوي نصًا إنجليزيًا متوقعًا. الاستثناء الوحيد الموثّق هو مبدّل اللغة (`data-locale-switcher`) لأنه يعرض اسم اللغة الهدف بشكلها الصحيح (endonym).
- `scripts/verify-admin-en.mjs` + `npm run check:i18n-admin` (groups `a|b|c`) — يفتح جلسة JWT محلية (قراءة فقط، لا يكتب في الـDB) ويفحص 38 مسار `/en`، ويفصل بين:
  - `LEAK` — نص UI لم يُترجم (فشل).
  - `data` — قيمة قاعدة بيانات بلا نسخة إنجليزية (لا يُفشل، مع طباعة العمود المسؤول).
  - `clean` — لا عربية.

### 12.4 عربي متبقٍ على `/en` — وهو بيانات لا UI

الأعمدة التالية لا تملك `*En` في `prisma/schema.prisma`، لذلك تعرض العربية على `/en`:

| العمود | يظهر في |
|---|---|
| `Customer.name`, `Order.guestName` | dashboard, orders, customers, cod-settlement |
| `User.name` | users, shifts |
| `Employee.name`, `Employee.roleTitle` | employees, payroll, shifts |
| `Supplier.name/contactName/address` | purchasing, purchasing/suppliers, reports/reorder |
| `Address.street/city` | customers |
| `Product.color`, `Product.size` | products, reports/reorder |
| `Expense.notes/title` | expenses, accounting |
| `Review.text` | reviews |

**المطلوب لإغلاقها:** migration تضيف `nameEn`/`addressEn` لتلك الجداول + backfill + bilingual rendering. موثّق في `DB_SOURCED_ROUTES` داخل `scripts/verify-admin-en.mjs` حتى لا يتحول إلى تسريب صامت.

### 12.5 عطل حقيقي اكتُشف أثناء الفحص

مبدّل اللغة في `Header` و`LocaleSwitcher` كان يستخدم `router.replace(pathname, { locale: next })`، وهو **لا ينتقل فعليًا** (الـclick يعمل والـReact handler مثبّت، لكن العنوان لا يتغير). الاستبدال بـ`<Link href={pathname} locale={next}>`:
- ينتج `href` حقيقيًا يعمل حتى قبل hydration،
- يحافظ على تنقّل Next soft،
- مُغطّى باختبار e2e (`the language switcher moves between locales and back`).

**المتبقي قبل production:** جلسة browser متصلة للـ screenshots/WCAG/axe sign-off، ومراجعة production caveats الموجودة في القسم 10.4 (branch isolation، online idempotency/reservation، refund watchdog، ETA، DB stock constraints)، ومigration أعمدة `*En` المذكورة في 12.4.
