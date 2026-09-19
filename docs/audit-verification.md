# Audit Verification (T00) — claims vs code

Legend: CONFIRMED / NOT CONFIRMED / DIFFERENT. All paths under `E:\sports`.

## G1 — POS protection & identity
- CONFIRMED: middleware (`src/middleware.ts:21-36`) protects only `/admin/*`; `/pos`, `/api/pos/*` are NOT matched by any auth check (matcher at :44 excludes `api`).
- CONFIRMED: `/api/pos/sale` uses first active branch (`src/app/api/pos/sale/route.ts:11`) and first CASHIER user (:15-16), never the session.
- CONFIRMED: manager PIN `1234`/`9999` checked client-side only (`src/store/posStore.ts:124-125`); server `POST /api/pos/sale` accepts any `discountAmount` with no approval.
- CONFIRMED: `POST /api/pos/products` is public (no guard, `src/app/api/pos/products/route.ts:1-29`).

## G4 — cancel/return & oversell
- CONFIRMED: `PATCH /api/admin/orders/[id]` (`src/app/api/admin/orders/[id]/route.ts:9-41`) updates status with no restock and no RETURN log.
- CONFIRMED: `/api/orders/create` allows oversell via `Math.max(0, stock - qty)` (`src/app/api/orders/create/route.ts:65`); no rejection. (POS sale route DOES reject oversell with 400 since the POS overhaul — DIFFERENT for POS only, `src/app/api/pos/sale/route.ts:47-54`.)
- No online return flow exists at all.

## G5 — transactions
- CONFIRMED: zero `prisma.$transaction` in `src/` (grep: no matches). Stock decrement + log + sale/order + invoice are sequential awaits in both `orders/create` and `pos/sale`.
- CONFIRMED: no idempotency key (`clientSaleId` absent); offline queue can double-create on retry.

## G7 — product creation scope & WhatsApp
- CONFIRMED: `POST /api/admin/products` creates inventory row only for flagship branch (`src/app/api/admin/products/route.ts:33,63`).
- CONFIRMED: WhatsApp number hardcoded `201001234567` in `src/components/storefront/ProductCard.tsx:55`. DISCREPANCY: POS receipt/floaters use `0122 422 6876`; payments text uses `01001234567` (`src/lib/payments/index.ts:69`). Three different numbers — T12 must unify via settings.

## G8 — role checks
- CONFIRMED: `requireAdminSession` checks session only (`src/lib/admin-guard.ts`). All `/api/admin/*` use it; none checks role.
- CONFIRMED (escalation): `POST /api/admin/users` lets ANY logged-in user create ANY role (`src/app/api/admin/users/route.ts:34-73`); PATCH allows editing own role; no guard against creating SUPER_ADMIN.
- CONFIRMED: admin pages have no server-side role gate (middleware = session only; sidebar filters UI only, defaults to SUPER_ADMIN when no session).

## Money, VAT, variants, timezone
- All money columns are `Float` (47 matches in `schema.prisma`; no `Decimal`).
- VAT semantics: prices are VAT-EXCLUSIVE base; 14% added on top (`cartStore.ts:90`, `posStore.ts:157`, `orders/create:85`, `pos/sale:92`). DECISION NEEDED (T09 keeps this).
- Variants: `size`/`color` are nullable strings on `Product` (schema:311-312); each SKU is its own row (no model grouping).
- Timezone: no explicit Africa/Cairo handling; `toLocaleString('ar-EG')` and `Date.now()`/`new Date()` everywhere.
- Rounding: `Math.round(x*100)/100` scattered in ~8 places (no single module).

## Session / i18n / tests / baseline
- Session JWT exposes `id`, `role`, `branchIds[]` (`src/lib/auth.ts:44-58`); no singular `branchId`. `User.branchIds: String[]`; `Employee.branchId` FK exists.
- next-intl middleware composes AFTER auth logic in one middleware (`middleware.ts:8-39`); matcher: `['/', '/(ar|en)/:path*', '/((?!api|_next|_vercel|.*\\..*).*)']`. Routes exist under both `/ar` and `/en` via `[locale]` + `generateStaticParams`.
- Tests: NONE (no vitest/playwright/jest). Only `scripts/smoke-test.ts` (ts-executed checks) and ad-hoc python scripts outside repo.
- Baseline: `tsc --noEmit` exit 0; `npm run lint` = `next lint` deprecated no-op (NO eslint config in repo); `npm run build` exit 0.
- No `prisma/migrations/` (schema deployed via `db:push`); `TEST_DATABASE_URL`, `APP_ENV` absent.
