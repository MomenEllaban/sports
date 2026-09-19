# Task 05 — POS session identity and branch (DONE)

## RED ثم GREEN
- RED: بيع كاشير سموحة يخصم من الفرع الأول، ومحاولة فرع آخر تنجح (200)، ولا `branch` في رد المنتجات.
- GREEN: `pos-branch` (3/3) + `pos-guard` (5/5) + `rbac-enforcement` (6/6).

## ما تم
- Migration `2_user_branch`: `User.branchId?` (+ ملف حقيقي + `resolve --applied`؛ test schema عبر `db push`).
- الجلسة تحمل `branchId` (jwt/session callbacks في `auth.ts` + نوع `AppSession`).
- `src/lib/pos/context.ts`: المصدر الوحيد — CASHIER يبيع في فرعه فقط (403 لغيره، 422 بلا تعيين)، وBM/SUPER_ADMIN بفرع صريح نشط (BM مقيد بفروعه).
- `pos/sale`: `cashierId` من الجلسة (يعمل لـ SUPER_ADMIN)، والفرع المحلول، و`saleId` في الرد.
- `pos/products`: مخزون الفرع المحلول + `{branch, branches}` (للاختيار).
- صفحة POS: اسم الفرع النشط + منتقي فروع للمديرين + إرسال `branchId` (بيع ومزامنة).
- Seed: `branchId` لكل مستخدم.

## ملاحظات
- `sale.cashierId` نص حر بلا FK — يعمل لأي دور (موثق كدين: T28 قد يربطه).
- T06 سيضيف PIN الخزينة للخصم فوق العتبة.
