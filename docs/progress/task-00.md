# Task 00 — Recon and verification (DONE)

## الحالة
- لا تغييرات وظيفية. قراءة كاملة للمستودع + أدلة `file:line`.

## ما تم
- `docs/audit-verification.md`: كل مزاعم G1/G4/G5/G7/G8 **CONFIRMED** مع الأدلة. فروقات مسجلة:
  - بيع POS يرفض الـ oversell (مختلف عن G4 للأونلاين فقط).
  - 3 أرقام واتساب/محافظ مختلفة في الكود (T12).
- `docs/route-inventory.md`: كل الصفحات (22) والـ APIs (~40) + الصلاحيات + روابط ميتة (`/admin/branches` مفقودة كصفحة، لا تفاصيل منتج، لا webhooks).
- حقائق: money كلها `Float`، الضريبة exclusive (تُضاف 14% فوق السعر) — DECISION NEEDED للتثبيت في T09. لا variants حقيقية (size/color نصوص). لا timezone صريح. لا إطار اختبار. لا migrations. baseline: tsc=0، lint=غير موجود (next lint deprecated)، build=0.

## ما لم يُتحقق منه
- سلوك الإنتاج الحي (Vercel) — تحقق محلي فقط.
- رابط `users` في السايدبار — يحتاج فحص بصري (T38).

## للمهام التالية
- T01 يحتاج `TEST_DATABASE_URL` + حارس رفض، T02 يحتاج `APP_ENV` + `env-guard`.
