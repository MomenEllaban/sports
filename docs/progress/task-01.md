# Task 01 — Test foundation (DONE)

## ما كان ناقصاً
- لا vitest/playwright/eslint/CI. لا migrations (DB عبر `db:push`). لا `APP_ENV`/`TEST_DATABASE_URL`.

## ما تم
- devDeps: `vitest`, `@playwright/test` (+chromium), `msw`, `eslint`, `eslint-config-next@15` (+`eslint.config.mjs`).
- `src/lib/env-guard.ts`: `APP_ENV` + `assertNotProduction`/`assertDevelopment`.
- `TEST_DATABASE_URL` (نفس السيرفر + `schema=sports_test`) + `DIRECT_URL` (non-pooler) في `.env`/`.env.example`.
- `prisma/migrations/0_baseline` (460 سطر من `migrate diff`) + `resolve --applied` — بدون مسح الداتا.
- `tests/helpers/test-db.ts` (حارس رفض) + `factories.ts` (branch/user/product/stock/customer + truncate آمن) + `setup-mocks.ts` (mock لـ `getServerSession`).
- `playwright.config.ts` (desktop+mobile) + `tests/e2e/smoke.spec.ts` (4 فحوص).
- Scripts: `test`, `test:unit`, `test:int`, `test:e2e`, `typecheck`, `lint` (بدل `next lint` المهمل).
- `.github/workflows/ci.yml` + `docs/testing.md`.

## RED ثم GREEN
- RED: `db-guard.test.ts` يفشل (لا helper) — ثم `setup-env` يفشل (لا `.env.test`) — ثم مسار import خاطئ — ثم `User` بدون quotes في TRUNCATE — ثم `taxinvoice` lowercase (الجداول quoted) — كلها موثقة وأُصلحت.
- GREEN النهائي: vitest 7/7، playwright desktop 4/4 + mobile 4/4، tsc نظيف، eslint **0 errors** (25 warnings مسجلة كـ baseline).

## انحراف موثق
- `migrate deploy` يفشل على Neon بـ P3018 (pooler) وP1002 advisory-lock (direct). التمهيد للاختبار يستخدم `db push` على سكيمة الاختبار؛ ملفات migrations تبقى مرجع الإنتاج.

## غير متحقق
- تشغيل CI على GitHub (لا push مسموح). e2e ضد `next start` بدل `dev` — لاحقاً.
