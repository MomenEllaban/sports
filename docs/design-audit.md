# Design Audit — Sports Champions Alexandria

Date: 2026-09-23
Scope: storefront, admin ERP, POS (Next.js 15 App Router / React 19 / Tailwind v4 / RTL-first AR+EN)

---

## 1. Current visual problems

1. No centralized token system — colors, radius, shadows and spacing are repeated as literal UI classes across ~60 files.
2. Light mode is implemented through a large `!important` remap of slate utilities (`globals.css` lines 112–181) that is brittle and duplicated for every variant.
3. Radius is inflated and inconsistent: `rounded-xl` (~200 uses) is the workhorse for everything from buttons to tags; `rounded-sm` is never used; the same role uses different radii in different files (buttons `rounded-xl` vs `rounded-2xl`, panels `rounded-2xl` vs `rounded-3xl`, tiny chips `rounded-lg`/`rounded-md`/plain/`rounded-full`).
4. Two parallel reveal/animation systems (`Reveal` IntersectionObserver component vs `animate-fade-up`/`stagger-*` CSS) that behave differently across pages.
5. Micro-typography fragmentation: `text-[9px]`, `text-[10px]`, `text-[11px]`, `text-xs`, `text-sm` all used as "small text".
6. Icon color-coding on sidebar nav items assigns a unique hue per module (blue, amber, emerald, purple, cyan, indigo, teal, rose, orange) — a rainbow navigation.
7. `font-black` (weight 900) is used widely but Cairo is only loaded 400–800, causing synthetic bold rendering.
8. Interaction feedback is inconsistent: primary buttons in some managers carry `shadow-lg shadow-blue-600/25`, others carry none.

## 2. AI-generated design patterns found

- Glassmorphism overuse: `.glass-panel` ~90+ usages with `backdrop-filter: blur(12px)` on cards, panels, modals and even loading skeletons; `.glass-card` hover lift (`translateY(-4px)`) applied to category/feature tiles.
- Blue/amber "AI SaaS" gradients concentrated on landing surfaces only: announcement bar `from-blue-900 via-slate-900 to-amber-950`, homepage ERPs/branch CTA `from-blue-950/40 via-slate-950 to-amber-950/30`, `gold-gradient-text`, HeroBanner blur orbs, preloader conic/radial rings.
- Functional pages (catalog/cart/checkout/admin) are flat slate, so the hero decorative vocabulary does not carry through — the app reads as "different products per tab".
- Blue-gradient primary CTA (`from-blue-600 to-blue-700` + `shadow-blue-600/25|30`) in HeroBanner/checkout/cart while admin uses solid `bg-blue-600`.
- `animate-float-slow` on decorative orbs, floating WhatsApp `animate-ping` ring.
- Decorative gold glow `drop-shadow-[0_0_10px_rgba(245,166,35,.35)]` on the logo in header, sidebar and footer.
- Card-in-card: glass panel shells containing inner `bg-slate-900` cards (checkout ×5, settings, POS summary vs modals).

## 3. Branding / logo issues

- Single `logo.avif` used consistently (header, sidebar, footer, login, preloader) — this is good; keep it.
- The gold glow drop-shadow is the only decorative license issue.
- No defined "eyebrow kicker" rule: section labels oscillate between `text-blue-400`, `text-amber-400`, `text-xs uppercase tracking-wider`, and plain bold text.
- Sidebar brand subtitle `ERP الإسكندرية` and header tagline use different font sizes/weights (10px vs 10px but different tracking).

## 4. Typography problems

- Cairo loaded 400–800; `font-black` (900) used as the main heading weight → synthetic 900 everywhere.
- No type scale: heads mix `text-2xl font-black`, `text-xl font-black`, `text-sm font-extrabold`; body mixes `text-xs`/`text-sm`.
- No hierarchy rule tying a page/component type to a fixed tier.
- `tabular-nums` applied inconsistently to numbers in tables/headers/totals.
- Letter-spacing used ad hoc (`tracking-wide`, `tracking-wider`, `tracking-tight`) with no convention.

## 5. Color problems

- Accent fragmentation: blue (default actions) + amber (brand/POS/stars) + orange (returns) + purple (coupon) + teal/indigo/cyan (sidebar) — 10+ accent hues.
- `text-amber-400` doubles as brand accent and semantic warning (e.g., low stock) — conflicting meaning.
- Semantic tints mix `/10 /15 /20 /25 /30 /40` opacity fills without a convention.
- Light mode handled by remap rules per-class; new utilities need manual remapping to keep light mode working.
- Status text on dark: `text-slate-500` hints on slate-900 surfaces ≈ 3.5:1 contrast (below AA for normal text); `text-slate-600` on dark fails.

## 6. Spacing problems

- No explicit spacing scale above Tailwind defaults; page/mobile density varies between `p-4` and `p-8` for the same card role.
- Admin `p-6 space-y-6` interstitial spacing vs `gap-4`/`gap-6` grids are broadly consistent but un-enforced.
- Touch targets inconsistent: POS enforces `min-h-[44px]`, admin/manager inputs often don't.

## 7. Component inconsistencies

- Two toast systems: `components/Toast.tsx` (root provider) and an unused `ToastProvider` in `components/ui/foundation.tsx`.
- Table systems: 14+ native `<table className="w-full text-xs text-right">` copies vs shared `DataTable` (Reports/Shifts/Returns) which lacks row-hover and pagination.
- Five+ modal treatments:
  1. shared `Modal` in `components/admin/ui.tsx` (`bg-slate-950/80 backdrop-blur-md`, `rounded-3xl bg-slate-900`)
  2. ShiftsManager inline (`bg-black/70 backdrop-blur-sm glass-panel`)
  3. POS payment/receipt (`bg-black/80 backdrop-blur-md glass-panel`)
  4. ReturnWizard (`bg-black/70`, plain shell)
  5. POS quick-customer (`bg-slate-950/80 backdrop-blur-sm`)
- `ConfirmDialog` exists in foundation but is unused except ReturnWizard; other places use `window.confirm`.
- Three input class variants for identical text inputs: `bg-slate-950` (`inputCls`), `bg-slate-900` (`fieldInputCls`), and storefront `bg-slate-900 border-slate-800`.
- Four focus conventions: blue (majority), amber (Shifts, Reviews, POS), orange (ReturnPortal tracker), purple (checkout coupon).
- Button primitives fragmented into ~9 literal class patterns with duplicated text.
- Empty states: foundation `EmptyState` (dashed box) vs inline `text-center text-slate-500 py-12` divs.
- Loading states: text-swap vs `Loader2 animate-spin` vs `'...'`.
- Pagination: shared `Pagination` in 4 files; others silently `.slice(0,10|15)`.

## 8. Responsive problems

- POS is a fixed 12-col grid with no small-screen fallbacks; it is the main tablet surface so this matters.
- Native tables only get `overflow-x-auto`; no mobile card fallback outside `DataTable`.
- Filter grids `grid-cols-2 md:grid-cols-5` are cramped on small phones.
- Storefront primary buttons are ~38px tall; POS buttons respect 44px.
- Header mobile menu is a plain stacked list; announcement bar truncates in English.
- Admin `p-6 space-y-6` + `text-xs` tables degrade below ~640px.

## 9. Accessibility problems

- Focus is color-only (`focus:outline-none focus:border-*`) everywhere — no `focus-visible` ring, weak for keyboard users.
- Modals lack focus trap, Escape handling and return-focus; some lack `aria-describedby`.
- Contrast failures on `text-slate-500`/`text-slate-600` hints on dark surfaces.
- Some icon-only buttons rely on `title` instead of `aria-label`.
- Toast auto-dismiss (3.5–4.2s) has no persistent affordance.
- `ThemeToggle.tsx` calls `useLocale()` conditionally (rules-of-hooks violation).

## 10. RTL / LTR problems

- Physical directional utilities used throughout (`left-*`, `right-*`, `ml-*`, `mr-*`, `pl-*`, `pr-*`, `-right-1`) instead of logical (`start/end/ms/me/ps/pe`) — 57+ matches.
- All data tables hardcode `text-right`, so English (LTR) pages render right-aligned tables.
- Chevrons are manually swapped via `isAr ? ArrowLeft : ArrowRight` per site; `rtl-flip` utility exists but is barely used.
- `AdminHeader` profile block uses `border-r pr-4` (physical) — wrong side in RTL.
- POS barcode/search icons use physical `right-3`/`left-3`.

## 11. Duplicate components

| Duplication | Locations |
|---|---|
| Toast providers | `components/Toast.tsx` + `components/ui/foundation.tsx` |
| Table markup (×14+) | Orders, Products, Customers, Cod, Expenses, Payroll, Inventory, Accounting, Audit, Users, Suppliers |
| Modal markup (×5) | admin ui Modal, ShiftsManager, POS payment/receipt, ReturnWizard, quick-customer |
| Input class (×3) | local `inputCls`, `fieldInputCls`, storefront variant |
| Primary button (×2) | glow variant (Orders/Products/Customers) vs no-glow (Settings/Reports/Returns/Shifts) |
| Empty state (×2) | foundation `EmptyState` vs inline div |
| Focus border (×4) | blue / amber / orange / purple |
| Dashboard KPI cards | admin dashboard, accounting, shifts |

## 12. Recommended design system (summary)

- Semantic tokens via Tailwind v4 `@theme` (additive names: `--color-base|surface|elevated|card|ink|ink-soft|ink-muted|line|line-strong|primary|primary-hover|brand|success|warning|danger|info`; `--radius-chip|control|card|panel|modal`; `--shadow-control|card|float|modal`).
- Keep dark-slate base + brand gold + one blue action + emerald success + rose danger. Retire orange/purple/teal/indigo/cyan as global accents, keep them only inside their domain (returns stays orange within returns surfaces).
- Cairo 400–900 loaded so `font-black` is real.
- Single reveal system; decorative gradient/orb vocabulary removed from landing surfaces.
- Full spec in `docs/design-system.md`.

## 13. Recommended component standards

Standardized kit (Group 03): `Button` (primary/secondary/danger/ghost/icon), `Field` + canonical `inputCls`, `Modal` (trap + Escape + label), `ConfirmDialog`, single `ToastProvider`, `Badge` (StatusBadge unified), `EmptyState`, `Skeleton`, upgraded `DataTable` (+hover + optional pagination + density), shared `Pagination`.

## 14. Proposed task groups

- Group 01 — Design Foundation (tokens, typography, dead-class fixes, docs)
- Group 02 — Global Navigation (header, sidebar, footer, mobile nav, page-header)
- Group 03 — Core Components (buttons, inputs, forms, cards, badges, modals, toasts)
- Group 04 — Data Components (tables, filters, search, pagination, empty/loading states)
- Group 05 — Main Pages (dashboard, orders, products, settings, POS, storefront home/checkout/cart)
- Group 06 — Responsive (desktop → tablet → mobile)
- Group 07 — RTL/LTR (logical utilities, chevron component, text-start)
- Group 08 — Accessibility (focus-visible, modal a11y, contrast)
- Group 09 — Final Polish (QA, leftovers, regression, build, deploy)