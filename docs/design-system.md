# Design System — Sports Champions Alexandria

Single source of truth for the visual language. Dark-first; light mode flips the token layer.

---

## Colors

Semantic tokens (available as utilities: `bg-*`, `text-*`, `border-*`, ...).

| Token | Dark | Light | Usage |
| --- | --- | --- | --- |
| `base` | `#0f172a` | `#f1f5f9` | App background |
| `surface` | `#1e293b` | `#ffffff` | Cards, panels, header/sidebar |
| `elevated` | `#0f172a` | `#f8fafc` | Raised panels, table headers |
| `card` | `rgba(15,23,42,.6)` | `rgba(248,250,252,.9)` | Card surfaces (translucent) |
| `panel` | `rgba(30,41,59,.85)` | `rgba(255,255,255,.92)` | Modal/panel surfaces |
| `ink` | `#f8fafc` | `#0f172a` | Primary text |
| `ink-soft` | `#cbd5e1` | `#334155` | Secondary text |
| `ink-muted` | `#94a3b8` | `#64748b` | Hints, captions, placeholders |
| `line` | `rgba(255,255,255,.1)` | `rgba(0,0,0,.1)` | Default borders, dividers |
| `line-strong` | `#1e293b` | `#e2e8f0` | Strong borders, table divides |
| `primary` | `#2563eb` | `#2563eb` | Primary action (buttons, links) |
| `primary-hover` | `#3b82f6` | `#3b82f6` | Primary hover |
| `primary-active` | `#1d4ed8` | `#1d4ed8` | Primary active/pressed |
| `brand` | `#f59e0b` | `#f59e0b` | Brand gold — POS, stars, currency, logo |
| `brand-hover` | `#fbbf24` | `#fbbf24` | Brand hover |
| `success` | `#059669` | `#059669` | Success fills |
| `success-ink` | `#34d399` | `#047857` | Success text |
| `warning` | `#f59e0b` | `#d97706` | Warning |
| `danger` | `#e11d48` | `#e11d48` | Danger fills |
| `danger-ink` | `#fb7185` | `#be123c` | Danger text |
| `info` | `#3b82f6` | `#2563eb` | Informational |

Domain accents (use only inside their domain):
- Orange `#f97316` — returns surfaces only.
- Purple `#8b5cf6` — coupon surfaces only.

Rules:
- Semantic tints are capped at `/15` `/30` two steps: subtle fill and outline.
- Dark theme `ink-muted` = `#94a3b8` (4.5:1+ on `surface`); never use `slate-500/600`-style hints below AA on dark backgrounds.
- Numbers always use `tabular-nums`.

## Typography

Font: Cairo (`--font-cairo`), loaded **400 – 900** so `font-black` is real.

| Role | Class | Description |
| --- | --- | --- |
| Page title | `text-2xl font-black` | Start of every page |
| Panel title | `text-base font-extrabold` | Card/section headings |
| Eyebrow | `text-xs font-bold uppercase tracking-wider text-ink-muted` | Small section kicker |
| Body | `text-sm font-medium` | Default prose |
| Dense body | `text-xs font-medium` | Tables, managers, POS |
| Label | `text-xs font-bold text-ink-soft` | Field labels |
| Hint/caption | `text-xs text-ink-muted` | Help text, captions |
| Micro | `text-[11px]` | Only the most compact metadata |

Rules:
- Do not use `font-semibold` for headings on dark; use `font-black` only at heading tiers.
- Line height: headings `leading-tight`, body `leading-relaxed`.
- All numeric columns use `tabular-nums`; phone/currency keep `dir="ltr"` wrapping.

## Spacing

Use Tailwind's default scale, constrained to these steps for card/page rhythm:
`gap-1` `2` `3` `4` `6` `8`, padding `2.5` `3` `4` `5` `6` `8`.
- Card padding: `p-4` (dense) / `p-6` (standard).
- Page content: storefront `py-8`, admin `space-y-6`.
- Touch targets: interactive elements `min-h-[44px]`.

## Radius

| Token | Value | Usage |
| --- | --- | --- |
| `--radius-chip` | `0.5rem` | Badges, pills, small chips |
| `--radius-control` | `0.75rem` | Buttons, inputs, selects, cards-at-small, page-buttons |
| `--radius-card` | `1rem` | Cards, item rows, KPI tiles |
| `--radius-panel` | `1.5rem` | Hero panels, modals, main containers |

Mapping from legacy: `rounded-lg`→chip/control, `rounded-xl`→control/card, `rounded-2xl`→card/panel, `rounded-3xl`→panel, `rounded-full`→pills only.

## Shadows

| Token | Value | Usage |
| --- | --- | --- |
| `--shadow-control` | `0 2px 8px -2px rgb(0 0 0 / .3)` | Raised interactive elements |
| `--shadow-card` | `0 8px 20px -8px rgb(0 0 0 / .35)` | Floating cards |
| `--shadow-float` | `0 16px 32px -12px rgb(0 0 0 / .45)` | Popovers, dropdowns |
| `--shadow-modal` | `0 24px 48px -12px rgb(0 0 0 / .5)` | Modals |

Rules: never put a glow (`shadow-blue-*>`) on repeated buttons; brand glow is reserved for the POS pay CTA.

## Buttons

| Variant | Base | Hover | Notes |
| --- | --- | --- | --- |
| Primary | `bg-primary text-white` | `bg-primary-hover` | Solid, no gradient |
| Brand | `bg-brand text-slate-950` | `bg-brand-hover` | POS primary, CTA |
| Secondary | `bg-surface text-ink-soft border border-line-strong` | `bg-featured` | Neutral |
| Danger | `bg-danger text-white` | `--danger at 20% fill` | Destructive |
| Ghost | `text-ink-soft hover:bg-surface` | — | Text/inline |
| Icon | `min-h-[44px] min-w-[44px] rounded-control` | tinted fill | Icon-only |

All: `rounded-control`, `font-bold text-xs`, `min-h-[44px]`, `focus-visible:ring-2`.

## Inputs

Canonical: `w-full min-h-[44px] rounded-control bg-[token input] border border-line-strong text-ink pl/pr p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40`.
- Field label above (see Field), hint + error under.
- One focus color per surface: primary blue (storefront/admin); brand amber (POS).

## Cards

- Surfaces: `bg-surface border border-line-strong rounded-card`.
- Translucent (on busy backgrounds): use `bg-card`.
- Standard: `p-4` dense / `p-6` default. One card idiom everywhere; no nested glass.

## Tables

- `DataTable` is the single primitive (native tables migrate to it).
- `text-start` alignment (RTL/LTR safe), `text-xs`, header `text-ink-muted`, row `hover:bg-surface`, `divide-line-strong`.
- Density: row `p-3`, header `p-3`, minimal borders.
- Pagination always via shared `Pagination`; empty state always via `EmptyState`.

## Modals

- Scrim: `bg-black/70` + `backdrop-blur-md`; shell `bg-panel border-line-strong rounded-panel shadow-modal`.
- Trap focus, close on Escape, `aria-modal="true"`, labeled; return focus on close.
- Single `Modal` + `ConfirmDialog` primitives everywhere.

## Navigation

- Sticky translucent header (`bg-base/85 backdrop-blur-md border-b line-strong`).
- Sidebar: fixed width `w-64`, section labels, single accent color for icons (no per-module rainbow), active item `bg-primary/15 text-primary`.
- Mobile: drawer/menu reuses same item styling with 44px targets.

## States

- Loading: skeleton via `animate-pulse` blocks; busy buttons swap to inline spinner.
- Empty: `EmptyState` (icon + title + hint + optional action).
- Error: boxed `role="alert"` tint with `danger` text.
- Toast: single provider, bottom start, `role="status"`, 3.5–4.2s.

## Responsive rules

- Storefront: `sm` (640) → `lg` (1024); grid `1 → 2 → 4`.
- Admin: content scroll container; grids `1 → lg:2/4`; filters `1 → sm:2 → md:4`.
- POS: tablet-first, fixed heights, thumb-sized targets ≥48px for money keys.
- Tables: mobile fallback = label/value cards.

## RTL / LTR rules

- Always logical utilities: `ps/pe/ms/me/start/end` — never `pl/pr/ml/mr/left/right`.
- Table text align: `text-start`.
- Directional icons (chevrons, arrows) via one `DirectionalIcon` that flips with `[dir]` — no per-site ternaries.
- Numbers, phones, currency: `dir="ltr"` + `tabular-nums`.
- Fixed-position helpers (WhatsApp FAB) may stay physical where side is intentionally consistent.