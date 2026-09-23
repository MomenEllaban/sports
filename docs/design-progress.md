# Design Improvement Progress

Tracked per task group. A group is complete only after checks (lint / typecheck / test / build), commit, and push.

---

## Group 01 — Design Foundation

- [x] Create `docs/design-audit.md`
- [x] Create `docs/design-system.md`
- [x] Define semantic design tokens (colors, radius, shadows, font) in `globals.css`
- [x] Load Cairo 400–900 so `font-black` is real
- [x] Fix dead classes (`animate-scale-in`, `scrollbar-none`)
- [x] Verify dark + light themes, run checks, build
- [x] Commit + push (`6b152c8`)

Commit: `6b152c8`

Status: Done

---

## Group 02 — Navigation

- [x] Header / announcement bar standardization (de-gradient, neutral surface)
- [x] Sidebar icon + active treatment unification (single icon color, no glow)
- [x] Footer polish (logo glow removed, chips → `rounded-chip`)
- [x] Mobile navigation (44px touch targets on wishlist/cart/menu)
- [x] Page-header pattern (`PageHeader` primitive, applied on admin dashboard)

Commit: `2728d25`

Status: Done

---

## Group 03 — Core Components

- [x] Unified Button (`Button` + `btnBaseCls`/`btnVariants`, tokens, 44px)
- [x] Unified Input / Field (`inputCls`, polished `Field`; 8 managers + admin/ui unified onto one class)
- [x] Unified Modal + ConfirmDialog (single `Modal` with Escape/focus/scroll-lock; `ConfirmDialog` a11y upgrade; duplicate admin Modal removed)
- [x] Single ToastProvider (duplicate Toast stripped from foundation; `@/components/Toast` is the one source)
- [x] Badge (StatusBadge stays in admin/ui, shared tone spec)
- [x] EmptyState + Skeleton (`Skeleton` added to foundation kit)

Commit:
-

Status: In Progress

---

## Group 04 — Data Components

- [ ] DataTable upgrade (hover, pagination, density)
- [ ] Standardize StatusBadge across all enum surfaces
- [ ] Pagination everywhere
- [ ] Unify empty + loading states

Commit:
-

Status: Pending

---

## Group 05 — Main Pages

- [ ] Admin dashboard
- [ ] Orders
- [ ] Products
- [ ] Settings
- [ ] POS surfaces
- [ ] Storefront home / checkout / cart

Commit:
-

Status: Pending

---

## Group 06 — Responsive

- [ ] Mobile table fallbacks
- [ ] 44px touch targets
- [ ] Filter grids
- [ ] POS tablet sanity

Commit:
-

Status: Pending

---

## Group 07 — RTL / LTR

- [ ] Logical utilities in shared chrome
- [ ] DirectionalIcon component
- [ ] `text-start` tables

Commit:
-

Status: Pending

---

## Group 08 — Accessibility

- [ ] focus-visible rings
- [ ] Modal trap / Escape / labels
- [ ] Contrast fixes

Commit:
-

Status: Pending

---

## Group 09 — Final Polish

- [ ] Remove leftover AI-look patterns
- [ ] Visual QA (alignment, overflow, themes)
- [ ] Regression: lint / typecheck / test / build
- [ ] Verify online deployment

Commit:
-

Status: Pending