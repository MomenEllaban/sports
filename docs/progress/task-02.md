# Task 02 — Seeder v1 (DONE)

## RED ثم GREEN
- Unit (`seed-utils`): PRNG determinism + EAN-13 validity — PASS من أول مرة (2 tests).
- Integration idempotency: فشل أولاً (Setting غير موجود في سكيمة الاختبار → أعدت `db push`)، ثم فشل (توقعي 17 بدل 18 مفتاح — صححته)، ثم GREEN.
- `seed:reset` فشل أولاً (مسار `env-guard` خاطئ من `prisma/seed/`) — أُصلح.

## عقبات موثقة
1. `migrate dev` يريد مسح الـ DB (كانت `db:push`) — عملت baseline يدوي (`0_baseline` + `resolve --applied`) بدون فقدان.
2. `migrate deploy` يفشل على Neon: P3018 عبر pooler، وP1002 advisory-lock عبر المضيف المباشر (الذي نفسه أحياناً P1001 غير reachable). التمهيد للاختبار = `db push` على سكيمة الاختبار (انحراف موثق في `docs/testing.md`).
3. تحقيقات دخول مضللة: `.next` فاسد (تعارك dev/prod) سبب 500/404 متقطعة؛ سكربتات urllib لا ترسل الكوكيز لـ `localhost` بشكل موثوق. الحكم النهائي: Playwright على `next start` نظيف — الدخول يعمل (سببه الجذري بيئي لا برمجي). e2e ضد `next dev` متذبذب هنا — الاعتماد على نسخة الإنتاج للتحقق.

## نتائج
- `seed:reset`: 41 models / 141 SKUs (قريب من ~40/~150)، كل الأعداد أعلاه.
- `tests/e2e/login.spec.ts` (دخول حقيقي بالمتصفح) أخضر — يبقى كاختبار انحدار.
- vitest الكامل (10/10) + smoke (57) + build + typecheck + lint كلها خضراء.

## قرارات
- أسعار VAT-exclusive (الحالي) مثبتة في `settings.vat.mode`.
- PINs مطبوعة كنص حتى T06.
- الصلاحيات القانونية (legal pages) ليست هنا — T22.
