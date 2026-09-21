# PROGRESS — تنفيذ خطة التطوير (تاسك ورا تاسك)

| Task | Title | Status | Commit | Tests | Notes |
|---|---|---|---|---|---|
| F0 | الأساس: registry + تجهيز + UI موحد + فحوصات | DONE | (this commit) | unit 18/18, tsc0, lint0, i18n206, images41 | CLIENT_INPUTS مولّد، seed settings 41 |
| F1 | أمان وتشغيل | DONE | (this commit) | unit 22/22, tsc0, lint0, rbac-meta ok | rate-limit + magic-bytes + OTP-ready + expire job + health + OPERATIONS |
| T05 | ورديات ودرج | TODO | — | — | — |
| ETA-spike | فجوات ETA موثقة | TODO | — | — | — |
| T01 | Paymob حقيقي | TODO | — | — | — |
| T02 | Fawry حقيقي | TODO | — | — | — |
| T03 | Bosta/Mylerz حقيقي | TODO | — | — | — |
| T16 | Discount pipeline (ولاء+كوبونات) | TODO | — | — | — |
| T10 | Refund/RMA | TODO | — | — | — |
| T11 | داشبورد KPI | TODO | — | — | — |
| T12 | تقارير | TODO | — | — | — |
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
