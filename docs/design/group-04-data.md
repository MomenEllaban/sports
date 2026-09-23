# Group 04 — Data Components — Done

Commit: `509b165` — Status: Done (verified 2026-09-23).

## ما تم
- [x] `DataTable` مشترك (table spec + built-in pagination + `text-start` المنطقي)
- [x] `StatusBadge` موحد على كل الـ enums
- [x] `Pagination` مشترك مربوط في (Shifts/Returns/Reviews/SupplierPayments/Coupons) — التقارير top-N summaries ومعفية
- [x] توحيد empty + loading states
- [x] توحيد كل `<table>` الخام (14 سطح) على canonical style واحد

## ملاحظات
- أي جدول جديد = `DataTable` + `Pagination` المشترك. ممنوع `<table>` خام جديد.
