# Performance Progress

> التفصيل: `docs/performance-audit.md`. القاعدة: الجروب يُغلق بعد (checks + commit + push).
> ملاحظة: أي AI يكمل يقرأ الـ audit أولاً. الشجرة فيها شغل RMA غير مرفوع — لا يمسه هذا المسار.

## Group 01 — Global Navigation & Refresh
- [ ] تحويل `window.location` الداخلي (wishlist/returns) لـ router
- [ ] تقليل `router.refresh()` الشامل (تحديث موضعي حيث آمن)
- [ ] مراجعة NavigationProgress + route transitions

Commit: -
Status: Pending (NEXT)

---

## Group 02 — Loading & Skeletons (+06 Dashboard)
- [ ] حدود `Suspense` لأقسام الداشبورد (KPIs/charts/queues مستقلة)
- [ ] Table-internal skeleton في DataTable
- [ ] مراجعة error/empty states

Commit: -
Status: Pending

---

## Group 03 — Tables, Filters & Search
- [ ] Server-side pagination للجداول الكبيرة (orders/products/inventory…)
- [ ] توحيد الفلاتر server-side (نموذج ReturnsManager)
- [ ] Debounce لبحث منتجات POS
- [ ] Reset الصفحة عند تغير الفلتر

Commit: -
Status: Pending

---

## Group 04 — API & Data Fetching
- [ ] تضييق selects (catalog/orders/products APIs)
- [ ] مراجعة أحجام payloads
- [ ] إزالة includes الكاملة غير اللازمة

Commit: -
Status: Pending

---

## Group 05 — Database
- [ ] قياس الاستعلامات البطيئة (`EXPLAIN`)
- [ ] `21_perf_indexes` (إضافية فقط، CONCURRENTLY)
- [ ] إصلاح `expectedCashFor` (aggregate بدل findMany)
- [ ] مراجعة N+1

Commit: -
Status: Pending

---

## Group 07 — Forms & Actions
- [ ] تدقيق pending/disabled states لكل الفورمات
- [ ] منع double-submit

Commit: -
Status: Pending

---

## Group 08 — Final QA
- [ ] Desktop + Mobile + regression + build + تحقق إنتاج (أو توثيق التعذر)

Commit: -
Status: Pending
