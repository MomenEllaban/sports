# Task 04 — Server-side RBAC everywhere (DONE)

## RED ثم GREEN
- RED: meta-test يسرد ~40 مساراً غير مدرج (`RBAC_MATRIX` فارغة).
- GREEN: المصفوفة ممتلئة + `rbac-enforcement` (6/6) + الميتا أخضر + الكل 22/22.

## ما تم
- `src/lib/auth/guards.ts`: `requireRole()` (401/403) + `POS_ROLES` + `ROLE_RANK`/`canGrantRole` + `requireSession` للتوافق.
- `src/lib/auth/rbac-matrix.ts`: المصدر الوحيد (33 مساراً) + `lookupMatrix`.
- `src/lib/auth/require-page.ts`: حارس صفحات السيرفر (redirect).
- 31 ملف API هُجّرت من `requireAdminSession` إلى `requireRole` بالمجموعات الدنيا.
- 13 صفحة أدمن محمية بـ `requirePageRole` + middleware يقيّد `/pos` (CASHIER/BM/SUPER_ADMIN).
- users: منع تغيير الدور/التعطيل الذاتي + تحقق الدور + عدم حذف الذات (كان موجوداً).
- `docs/rbac-matrix.md`.

## ملاحظات
- `requireAdminSession` بقيت wrapper مهملة (تُحذف في T35).
- T03 سبق وغطى POS؛ T04 وحّد الباقي. سلوك route-handler tests خُتبر مباشرة (callAs عبر mock `getServerSession`).

## النتائج
- vitest 22/22 (8 ملفات)، lint بلا errors، tsc نظيف، demo DB سليمة (141 SKU).
