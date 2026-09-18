# System Review — Gaps & Tasks (Sports Champions ERP)

## Analysis summary (2026-09-18)

### A. Form UX — labels/placeholders (CONFIRMED GAP)
- 71 `<input>` across the app. Most manager forms use `placeholder`-only with no `<label>` above the input
  (ProductsManager, EmployeesManager, SuppliersManager, BranchManager, UsersManager, TransfersManager,
  PurchasingManager, ExpensesManager, POS discount/PIN/customer fields, checkout phone/name).
- No shared `Field` component; no `aria-label`s; no hint text; numeric fields lack `min`/units.
- **Fix:** shared `Field` wrapper (label + input + hint + error) in `components/admin/ui.tsx`,
  migrate every form to it.

### B. Light (white) mode (CONFIRMED BROKEN)
- `ThemeToggle` exists but mounted ONLY in `AdminHeader`. `data-theme="light"` CSS vars exist in
  `globals.css` but **0 components consume them** (76× `bg-slate-950`, plus hundreds of other hardcoded
  dark utilities) → toggle does nothing visually.
- **Fix:** `[data-theme="light"]` utility overrides in `globals.css` for the slate palette used across
  the app + mount toggle in storefront `Header` + anti-FOUC init script in root layout.

### C. CRUD coverage
- Backend: full GET/POST/PATCH/DELETE for users, employees, customers, categories, brands, branches,
  suppliers, products. ✅
- Missing backend: PO cancel, expense edit/delete, notification delete. ❌
- Frontend: delete handlers in Branch/Employees/Products/Users managers use `alert()` (7 occurrences). ❌
- **Fix:** add missing endpoints + inline error states (no alerts).

### D. Cross-linking data↔pages (WEAK)
- Orders table shows customer as plain text (no link to customer filter).
- Products table shows stock as plain numbers (no link to inventory).
- Low-stock alerts have no action (should link to purchasing).
- Dashboard cards partially link (orders/products) — extend to all.
- **Fix:** wire deep links (query params) + anchor targets.

### E. Error handling / console (MOSTLY OK, 7 ALERTS)
- 0 `console.error` in client code ✅, server-side logging ✅, error boundaries exist ✅.
- 7× `alert()` in delete flows ❌ → inline errors (see C).

---

## Tasks
- [x] T1 — Shared `Field` component + migrate ALL forms (admin managers, POS, checkout, tracking, login)
- [x] T2 — Replace 7 `alert()` with inline error states
- [x] T3 — Real light mode: CSS overrides + toggles + FOUC guard, tested
- [x] T4 — Missing CRUD endpoints (PO cancel, expense edit/delete, notification delete) + UI wiring
- [x] T5 — Cross-linking (orders↔customers, products↔inventory, low-stock→purchasing, dashboard cards)
- [x] T6 — Full verification: tsc + smoke + build + runtime E2E (both themes, both locales) + commit/push
