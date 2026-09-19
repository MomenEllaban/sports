# Testing (T01)

## Layers
- **unit** (`tests/unit`): pure logic, no DB. Run: `npm run test:unit`.
- **integration** (`tests/integration`): real Postgres, NEVER mocked (per mission rules).
  Run: `npm run test:int`. Requires `TEST_DATABASE_URL`.
- **e2e** (`tests/e2e`, Playwright, desktop + mobile projects): boots `npm run dev -- --port 3102`
  automatically (`reuseExistingServer` locally). Run: `npm run test:e2e`.
- Legacy ad-hoc checks: `npm run test:smoke` (tsx script, dev DB).

## Test database + refusal guard
- `TEST_DATABASE_URL` = same Neon server, `&schema=sports_test` (see `.env.example`).
- `tests/helpers/test-db.ts` → `assertSafeTestDatabaseUrl()` REFUSES unless the URL
  contains `test`, differs from `DATABASE_URL`, and `APP_ENV=development`.
- Schema sync for tests: `prisma db push` against `TEST_DATABASE_URL` (documented deviation:
  `migrate deploy` advisory-lock (P1002) fails on this project's Neon pooler AND direct host;
  `prisma/migrations/0_baseline` stays the source of truth for production `migrate deploy`).
- `DIRECT_URL` (non-pooler host) exists for migrations per mission section 2.
- Clean state: `resetTestDb()` truncates all app tables (`CASCADE`) in `beforeAll` of each
  integration file. Strategy: per-file reset (fast enough at this scale; revisit if slow).
  Integration tests must be ORDER-INDEPENDENT (files can share workers): never assert global
  emptiness — create and clean up your own rows.

## Mocking sessions (`callAs` pattern)
- `tests/setup-mocks.ts` (vitest setupFiles) mocks `next-auth` `getServerSession` to resolve
  `globalThis.__mockSession`.
- `setMockSession(session|null)` from the same module installs the session.
- `sessionFor(user)` in `tests/helpers/factories.ts` builds the shape from a DB user.
- Example:
  `setMockSession(sessionFor(admin)); const res = await PATCH(req, { params: ... });`
- Factories: `makeBranch`, `makeUser(role)`, `makeCategory`, `makeProduct`, `stock`, `makeCustomer`.

## Quality gates
- `npm run typecheck` (tsc), `npm run lint` (eslint, **0 errors**; 25 pre-existing warnings
  recorded as T01 baseline), `npm run build`.
- CI (`.github/workflows/ci.yml`): quality job (typecheck+lint+unit), integration job
  (Postgres service + db push + int tests + build), e2e job.
