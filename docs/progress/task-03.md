# Task 03 — Protect POS (DONE)

## RED ثم GREEN
- RED: anon `GET /api/pos/*` → 200 (مفتوحة)، و`POST sale` تقبل أي خصم بدون دور.
- GREEN: `tests/integration/pos-guard.test.ts` (5 فحوص): anon → 401 على الثلاثة، STAFF/FINANCE → 403، CASHIER يبيع 200. + e2e: `/pos` المجهول → login.

## ما تم
- `src/lib/auth/guards.ts`: `requireRole(...roles)` (401/403) + `POS_ROLES` + `requireSession` للتوافق.
- `src/lib/admin-guard.ts` أصبح wrapper (كل الاستيرادات القديمة سليمة).
- الحارس مطبق على `/api/pos/products|sale|customer` (GET/POST).
- middleware: صفحات `/pos` — مجهول → دخول مع callback، ودور خاطئ → `/`.

## حادثة خطيرة موثقة بصدق
- البنية الأولى استخدمت `?schema=sports_test` على نفس الـ DB، لكن Prisma Client **يتجاهل** بارامتر `schema` runtime (ظل `search_path=public`) — فاختبارات التكامل **مسحت قاعدة التطوير** (branches/products/users/customers = 0).
- الإصلاح: قاعدة منفصلة حقيقية `sports_test_db` (CREATE DATABASE) + `db push` + إعادة `seed:reset` + تحقق smoke (141 SKU سليمة).
- القاعدة: العزل يُتحقق منه (`current_schema` + الأعداد) ولا يُفترض أبداً. وُثق في `docs/testing.md`.

## إيجابيات جانبية
- `fileParallelism: false` + تسلسل الملفات بعد اكتشاف تلوث متوازٍ.
- اختبارات order-independent (درس `db-connect`).

## النتائج
- vitest 15/15 (6 ملفات)، e2e desktop 5/5، smoke 57/57.
- غير متحقق: STAFF/FINANCE على صفحة `/pos` بالمتصفح (الـ unit يغطي الـ API؛ الـ middleware نفس نمط الأدمن المُختبر e2e).
