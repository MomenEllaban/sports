# Seed v1 (T02)

## Commands (all require `APP_ENV=development` for destructive ones)
- `npm run seed:minimal` — branches, users, settings, categories.
- `npm run seed:demo` — everything below. Safe to re-run (upserts by natural keys).
- `npm run seed:reset` — wipe app tables + `seed:demo`. REFUSES unless development.
- `npx tsx prisma/seed/gen-images.ts` — regenerate local SVG placeholders.

## Modules (`prisma/seed/`)
`utils` (mulberry32 PRNG seed 20260919, EAN-13 `2…`, synthetic phones `01000000001+`),
`branches` (fixed ids `branch-ibrahimeyah`/`branch-smouha` for idempotent upserts),
`users` (7 users `@sports-champions.local`, password `SEED_DEFAULT_PASSWORD` or `Test@123456`,
manager PINs `1234`/`9999` printed, hashed in T06),
`catalog-base` (6 categories, 8 brands), `catalog` (41 models / 141 SKUs, cost 55–75% via PRNG,
`/seed-images/*.svg`), `stock` (inventory rows for BOTH branches, incl. low/out/single-branch),
`people` (6 suppliers with `FAKE-` tax ids, 40 synthetic customers, 8 employees, ~23 expenses over 3 months),
`settings` (18 keys: identity, VAT 0.14 exclusive, zones, payment handles, loyalty, thresholds, receipt texts,
integration flags all false).

## Live demo data (after `seed:reset`)
branches 2, users 7, settings 18, categories 6, brands 8, models 41, skus 141,
inventoryRows 282, suppliers 6, customers 40, employees 8, expenses 23.

## Changed/removed vs old seed
- Old one-shot `prisma/seed.ts` (12 Unsplash products, 1 order/sale/PO, hardcoded `Admin@123456`)
  replaced by modular idempotent seeder; old file kept as thin delegating wrapper.
- Seed emails moved to `@sports-champions.local`; login form prefill + demo list updated.
- Product images now local `/seed-images/*.svg` (was Unsplash hotlinks).
- Transactional history (orders/sales/POs/payroll) intentionally NOT seeded here — T37 via real services.
