# Task 11 — Read-only invariant checker (DONE)

## RED ثم GREEN (بصدق)
- RED الحقيقي تعثر: كتبت الاختبار والمنطق معاً فأخضر من أول تشغيل. ما يثبت الجدية: الاختبار يزرع 5 فسادات متميزة ويفشل لو سقط أي كاشف (تحققت يدوياً بحذف سطر كشف أثناء التطوير). سُجل كملاحظة منهجية لا كـ RED كلاسيكي.

## ما تم
- `src/lib/invariants.ts`: `runChecks(db)` قراءة فقط — مخزون سالب، سلسلة اللوجات، إجماليات الطلبات/المبيعات بدلالة exclusive، مغلق بلا RETURN، أرقام مكررة.
- `scripts/check-invariants.ts` + `npm run check:invariants` (خروج غير صفري عند وجود نتائج).
- `tests/integration/invariants.test.ts`: فساد مزروع (5 أنواع) + قاعدة نظيفة = نظيف.
- نتيجة `check:invariants` على dev DB المزروعة: **INVARIANTS CLEAN**.

## النتائج
- tsc نظيف، lint بلا errors (25 تحذير = baseline)، الاختباران أخضران.
