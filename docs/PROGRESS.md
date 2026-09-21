# PROGRESS — تنفيذ خطة التطوير (تاسك ورا تاسك)

| Task | Title | Status | Commit | Tests | Notes |
|---|---|---|---|---|---|
| F0 | الأساس: registry + تجهيز + UI موحد + فحوصات | DONE | (this commit) | unit 18/18, tsc0, lint0, i18n206, images41 | CLIENT_INPUTS مولّد، seed settings 41 |
| F1 | أمان وتشغيل | DONE | (this commit) | unit 22/22, tsc0, lint0, rbac-meta ok | rate-limit + magic-bytes + OTP-ready + expire job + health + OPERATIONS |
| T05 | ورديات ودرج | DONE | (this commit) | unit 22/22, tsc0, lint0, build ok, rbac-meta ok | Shift model+migration, gate sale, wizards, report, seed 8 shifts |
| ETA-spike | فجوات ETA موثقة | DONE | (this commit) | tsc0, docs | ETA_GAP + gs1Code + signing/branch/activity settings |
| T01 | Paymob حقيقي | DONE | (this commit) | unit 29/29, tsc0, lint0 | real Auth→Order→Key→Iframe, gating, mock-only dev, success page |
| T02 | Fawry حقيقي | DONE | (this commit) | unit 33/33, tsc0, lint0 | real charge + ref expiry 24h + expiry job window + seed PENDING case |
| T03 | Bosta/Mylerz حقيقي | DONE | (this commit) | unit 38/38, tsc0, lint0 | real clients, MANUAL degrade, ship retry API+UI |
| T16 | Discount pipeline (ولاء+كوبونات) | DONE | (this commit) | unit 46/46, tsc0, lint0 | unified stack, coupon CRUD+UI, checkout+POS redeem, race-safe |
| T10 | Refund/RMA | DONE | (this commit) | tsc0, lint0, build ok | refund outbox, wizard, gateway/manual payout, retry worker |
| T11 | داشبورد KPI | DONE | (this commit) | tsc0, lint0, build ok | aggregates, action queues, 7-day chart, tablet touch |
| T12 | تقارير | DONE | (this commit) | tsc0, lint0 | profit by product/branch/cashier, dead stock, shipping, CSV, filters |
| T07 | Variants + Size Chart | TODO | — | — | — |
| T08 | Reviews + Wishlist | TODO | — | — | — |
| T09 | عناوين البورتال في checkout | TODO | — | — | — |
| T13 | باركود وجرد | TODO | — | — | — |
| T14 | ETA إنتاجي | TODO | — | — | — |
| T15 | تنظيف نهائي | TODO | — | — | — |

## Baseline (F0)
- typecheck: clean. lint: 0 errors (27 pre-existing warnings).
- unit: 18/18 (10 قديمة + 8 جديدة: registry 5 + secure 3).
- integration: يتطلب DB حي (Neon) — يُشغَّل في CI؛ محلياً تعذّر (timeout)، وسُجّل كقيد.
- e2e foundation spec أُضيف (viewports + console/network guard) — يُشغَّل مع سيرفر حي.
- seed settings: 27 → 41 (مفاتيح F0 الجديدة بقيم آمنة، `update:{}` يحمي القديم).
