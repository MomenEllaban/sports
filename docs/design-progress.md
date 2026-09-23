# Design Improvement Progress

Tracked per task group. A group is complete only after checks (lint / typecheck / test / build), commit, and push.

> تفصيل كل جروب في فولدر `docs/design/` (ملف لكل جروب + `README.md` كخريطة) — أي AI يكمل يبدأ من هناك.

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

Commit: `b57cdad`

Status: Done

---

## Group 04 — Data Components

- [x] DataTable upgrade (shared table spec + built-in pagination, logical `text-start`)
- [x] Standardize StatusBadge across all enum surfaces (verified coherent `/20`+`/30` pill spec)
- [x] Pagination everywhere (shared `Pagination` in foundation; Shifts/Returns/Reviews/SupplierPayments/Coupons wired; reports = top-N summaries, exempt)
- [x] Unify empty + loading states
- [x] Unify all raw `<table>` literals + thead treatments (14 surfaces; single canonical style)

Commit: `509b165`

Status: Done

---

## Group 05 — Main Pages

- [x] Admin dashboard via PageHeader + consistent panel headers
- [x] Orders
- [x] Products
- [x] Settings
- [x] POS surfaces (open-shift, payment search, receipt print, return confirm)
- [x] Storefront home / checkout / cart (submit + tracking CTAs → Button)

Commit: `84af03e`

Status: Done

---

## Group 06 — Responsive

- [x] Mobile table fallbacks
- [x] 44px touch targets
- [x] Filter grids
- [x] POS tablet sanity

Commit:
`fc6eac6`

Status: Done (تفصيل: `docs/design/group-06-responsive.md`)

---

## Group 07 — RTL / LTR

- [x] Logical utilities in shared chrome
- [x] DirectionalIcon component
- [x] `text-start` tables

Commit:
`d0c270f`

Status: Done (تفصيل: `docs/design/group-07-rtl.md`)

---

## Group 08 — Accessibility

- [x] focus-visible rings
- [x] Modal trap / Escape / labels
- [x] Contrast fixes

Commit:
`17718b4`

Status: Done (تفصيل: `docs/design/group-08-a11y.md`)

---

## Group 09 — Final Polish

- [ ] Remove leftover AI-look patterns
- [ ] Visual QA (alignment, overflow, themes)
- [ ] Regression: lint / typecheck / test / build
- [ ] Verify online deployment

Commit:
-

Status: Pending