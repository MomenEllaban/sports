# Performance Audit — Sports Champions ERP

> تاريخ التدقيق: 2026-09-23 — الفرع `main@4b4a06c`. تدقيق قراءة فقط (لم يُعدّل أي كود).
> ملاحظة: الشجرة الحالية فيها شغل RMA غير مرفوع (`transactions.ts` + tests) — لا علاقة له بهذا التدقيق.

## 1. Architecture summary
- **Frontend:** Next.js 15 App Router + React 19 + TS. Server Components افتراضياً، Client Components للـ POS/المتجر التفاعلي.
- **Backend:** Route Handlers (`src/app/api/**`) + Prisma 6 + Neon Postgres. لا Server Actions.
- **Auth:** NextAuth v4 JWT + `middleware.ts` (role gating) + `next-intl` middleware.
- **State:** Zustand (سلة فقط) + `defaultValue`/GET-forms. لا SWR/React Query — لا كاش client ولا polling (جيد: لا refetch loops).
- **Layouts ثابتة:** `[locale]/layout` + `admin/layout` (AdminChrome) + `(storefront)/layout` — الهيدر/السايدبار لا يُعاد بناؤها بين الصفحات.
- **مؤشر تنقل:** `NavigationProgress.tsx` (top bar) موجود.

## 2. Refresh / navigation behavior (الحالي: جيد غالباً)
- التنقل Client-side عبر `<Link>` في معظمه. حالتا `window.location.href` فقط:
  - `checkout/page.tsx:186` → تحويل Paymob خارجي (شرعي).
  - `WishlistClient.tsx:43` + `ReturnsManager.tsx:124` → تنقل داخلي كان يجب أن يكون `Link`/router (إصلاح سهل).
- `router.refresh()` مستخدم ~30 مرة بعد كل mutation (كل المدراء) — يعيد جلب **الصفحة كاملة** من السيرفر. يعمل لكنه ثقيل: بعد حفظ صغير يُعاد تحميل كل الجداول.

## 3. Loading behavior (الحالي: جيد)
- `loading.tsx` لكل segment (storefront/admin/login) بشكل skeleton داخل الـ layout الثابت — الهيدر/الفوتر يبقيان.
- `Skeleton` primitive موجود في foundation. لا spinners بملء الصفحة.
- الفجوة: الداشبورد Server Component واحد — أبطأ استعلام يحجب الكل (لا تحميل مستقل للودجت).

## 4. Data-fetching architecture
- Server Components تجلب بـ `Promise.all` متوازٍ (جيد).
- Client fetches عند submit/بحث فقط (POS customer lookup, tracking, portal) — لا loops.
- لا debounce في أي مكان — لكن البحث الأساسي GET-form (submit صريح) فلا حاجة. بحث POS منتجات يدعم `q` (T-RMA) — يُستدعى عند الضغط، جيد.
- Settings: كاش in-memory واحد 30s (`settings.ts:42`) — لكل instance؛ على serverless يُعاد البناء مع cold start (مقبول).

## 5. Table architecture (أعلى أولوية)
- `DataTable` الموحد: **pagination client-side** (`rows.slice`) — تجميلية. كل الجداول الكبيرة تحمل كامل الداتا أولاً:
  - `/admin/orders`: **كل** الطلبات + كل المبيعات + items (بلا `take`).
  - `/admin/products`, `/admin/inventory`, `/admin/accounting`, `/admin/payroll`: سحب كامل.
  - `/catalog`: كل المنتجات + `category: true` + `branch: true` كاملة (بلا `take`/select).
  - `reports/summary`: `take: 2000` orderItems + `take: 2000` saleItems + كل المخزون + تجميع في الذاكرة.
- الفلاتر في المدراء القديمة client-side (`OrdersManager:100` يفلتر المصفوفة الكاملة) — ReturnsManager الأحدث server-side عبر API (النموذج الصحيح).

## 6. Filter/search architecture
- Storefront catalog: GET-form + server where (`contains insensitive`) — صحيح، بلا debounce (غير لازم).
- Admin managers: خليط — قديم client-side، جديد (returns) server-side API. التوحيد مطلوب.

## 7. Database architecture
- Postgres (Neon) عبر Prisma. `DATABASE_URL` pooler مقابل `DIRECT_URL` المباشر (الكود يستخدم المباشر للأداء — موثق في NEXT_TASK).
- Migrations حتى `20_drop_legacy_refund`. لا raw SQL حرج.

## 8. Existing indexes (ناقصة فعلياً)
الموجود فقط: `Shift(cashierId,status)`, `Shift(branchId,status)`, `SupplierPayment(supplierId)`, `CouponUse(couponId)`, `Review(productId,approved)`, RMA indexes, `Order.returnNumber` (unique), `Customer.phone` (unique).
**المفقود رغم الاستعلام اليومي:**
- `Order(createdAt)`, `Order(orderStatus)`, `Order(paymentStatus)`, `Order(branchId)`, `Order(customerId)`, `Order(trackingNumber)`, `Order(guestPhone)`, `Order(deliveryZone?)` لا.
- `Product(isActive)`, `Product(categoryId)`, `Product(brandId?)`, `Product(sku)` للبحث.
- `Sale(branchId,createdAt)`, `Sale(cashierId)`, `Sale(createdAt)`.
- `BranchInventory(branchId)`, `BranchInventory(productId)`, `(lowStock query: branchId+stockQuantity)`.
- `InventoryLog(branchId,productId)`, `InventoryLog(referenceId)`, `InventoryLog(createdAt)`.
- `OrderItem(productId)`, `SaleItem(productId)`, `Notification(branchId?,isRead?,createdAt)`, `AuditLog(createdAt,entity)`, `ReturnRequest(status,createdAt)`, `TaxInvoice(status)`, `Expense(branchId,date)`.

## 9. Potential missing indexes (مرشحة بعد الفحص)
مركبة مقترحة (بعد قياس، لا عميانياً):
- `Order(status, createdAt)`, `Order(paymentStatus, createdAt)`, `Order(branchId, createdAt)`.
- `Sale(branchId, createdAt)`, `BranchInventory(branchId, stockQuantity)`.
- `InventoryLog(branchId, productId, createdAt)` — satisfies stocktake/audit screens.

## 10. Potential slow queries (بالدليل)
1. `admin/orders` — سحب كامل + علاقات (تكبر مع كل طلب).
2. `catalog` — كل المنتجات + include كامل (category+branch لكل صنف).
3. `reports/summary` — 2000+2000 سطر + كل المخزون + تجميع JS.
4. `shifts/service expectedCashFor` — `findMany` كل مبيعات الوردية + كل المرتجعات عند كل معاينة إغلاق.
5. `payroll-runs` — `groupBy` سليم + `refund.findMany` إضافي (مقبول).
6. Dashboard `weekOrders/weekSales` — `findMany` بنافذة 7 أيام بدون select ضيق (يوجد select، مقبول حجمه الحالي).

## 11. Duplicate API requests
لم يُرصد تكرار منهجي. `AdminHeader` يجلب notifications + settings/status مرة عند التحميل (جيد). الحذر: `router.refresh()` بعد كل عملية يعيد ~10 استعلامات الصفحة دفعة واحدة.

## 12. Dashboard performance problems
- Server Component واحد بـ 16 استعلاماً متوازياً — أبطأ واحد يحجب العرض كله.
- لا تحميل تدريجي للودجت (KPIs/charts/queues). المرشح: React `Suspense` حدود لكل قسم.

## 13. Storefront performance problems
- الكتالوج يحمل كل الأصناف دفعة واحدة (صور Cloudinary محلاة بـ next/image — جيد).
- لا pagination في الكتالوج. البحث يعيد render كامل للصفحة (مقبول: GET-form).

## 14. Existing caching
- Settings 30s Map فقط. لا `unstable_cache`، لا fetch cache (صفحات admin `force-dynamic`)، لا CDN hints للصور الثابتة.

## 15. Existing skeleton/loading components
- `loading.tsx` ×3 (skeletons حقيقية تشبه المحتوى). `Skeleton` primitive. `EmptyState` موحد. `error.tsx` ×2 (admin/storefront) مع retry ضمني. لا table-internal skeleton (DataTable يعرض EmptyState فقط أثناء غياب الداتا — التحميل يغطيه route skeleton).

## 16. Recommended changes (مرتبة)
1. **G1:** تحويل `window.location` الداخلي لـ router + تقليل `router.refresh()` (تحديث موضعي/تفاؤلي حيث آمن).
2. **G2:** حدود `Suspense` للداشبورد + skeletons للأقسام.
3. **G3:** server-side pagination حقيقية للجداول الكبيرة (orders/products/inventory) + توحيد الفلاتر server-side + debounce لبحث POS المنتجات.
4. **G4:** تقليص payloads (select ضيق في catalog/orders) + إزالة `category: true`/`branch: true` الكاملة.
5. **G5:** indexes الناقصة (§8–9) + قياس قبل/بعد عبر `EXPLAIN`.
6. **G6:** داشبورد تدريجي (مدمجة مع G2 عملياً — تُنفذ معاً).
7. **G7:** حالات أزرار/فورمات (موجودة غالباً — تدقيق + توحيد `pending` states).
8. **G8:** QA نهائي + تحقق إنتاج.

## 17. Risk assessment
- **عالي:** تغيير pagination لسلوك server-side يمس كل المدراء — يُنفذ تدريجياً لكل جدول مع اختباراته.
- **متوسط:** indexes — `CREATE INDEX CONCURRENTLY` على الإنتاج لتفادي lock؛ composite order حساس.
- **منخفض:** skeletons/Suspense/UI — لا تمس بيزنس.
- **ممنوع:** المساس بالـ auth/RBAC/pricing/stock math. أي تغيير DB migration آمنة إضافية فقط.

## 18. Exact task groups
G1 Global Navigation & Refresh → G2 Loading & Skeletons (+G6 Dashboard) → G3 Tables/Filters/Search → G4 API payloads/fetching → G5 Database indexes/queries → G7 Forms & actions → G8 Final QA.

## 19. Files likely to change
- `src/components/layout/NavigationProgress.tsx`, `WishlistClient.tsx`, `ReturnsManager.tsx`, `checkout/page.tsx` (G1).
- `admin/page.tsx` + skeletons, `admin/loading.tsx` (G2/G6).
- `OrdersManager/ProductsManager/*Manager` + `api/admin/*` list routes + `catalog/page.tsx` (G3).
- `api/pos/products`, `api/admin/orders`, `catalog`, `api/products/by-ids` selects (G4).
- `prisma/migrations/21_perf_indexes/*` + `shifts/service.ts` + `reports/summary` (G5).
- Forms with missing pending states — تدقيق (G7).

## 20. Database migrations that may be required
- `21_perf_indexes`: الـ indexes الناقصة (§8) — إضافية فقط، `CONCURRENTLY` على الإنتاج. لا تغيير أعمدة/علاقات.
