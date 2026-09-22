# المهمة الجاية (NEXT TASK) — متابعة مشروع Sports Champions

> هذا الملف هو سجل الحالة الحالية للعمل. أي جلسة قادمة تبدأ من هنا.
> تاريخ آخر تحديث: 22 سبتمبر 2026 (بعد دمج 20 commit جديدة من `origin/main`)

---

## 1. ملخص سريع

- **الريبو الرسمي:** `https://github.com/MomenEllaban/sports.git` — `main` محليًا عند `c8c6ba5` = دمج آخر تحديث ريموت.
- **الريبو القديم (مهمل):** `momendevelopertech/sports` (الـ remote اتشال).
- **الـ site:** `https://sports-livid-eight.vercel.app` (مُرفع عبر Vercel CLI، مش Git Integration).
- **الـ stack:** Next.js 15 (App Router) + React 19 + TS + Prisma/Neon Postgres + NextAuth v4 (JWT) + Zustand + next-intl (ar/en) + Tailwind v4 + Cloudinary.
- **الاستخدام الحقيقي:** storefront + POS كاشير + داش بورد إدارة يستخدمه موظف في المكان.

---

## 2. آخر ما تم عمله (مرفوع)

| Commit | الوصف |
|---|---|
| `3bd7c69` | chore(deploy): `.vercelignore` |
| `7e0b900` | perf(nav): persistent layouts + loaders + progress bar |
| `df68359` | fix(pos): branch selector أول تحميل |
| `0f4c21a` | fix(images): SVG عبر next/image + CSP |
| `a0141c9` | feat(seed): داتا ديمو idempotent (orders/sales/POs/transfers/payroll) |
| `868407d` | perf(db) direct URL + AdminHeader role/ETA + LoginForm + POS header/offline toast + `scripts/cleanup-ops-data.ts` + أول نسخة من هذا الملف |
| `c8c6ba5` | **merge origin/main** (20 commit ريموت + فض التعارضات + فيكس توست المزامنة) |

### الـ 20 commit اللي جت من الريموت (متدمجة دلوقتي)
returns/RMA خدمة موحدة + outbox payout / inventory (باركود labels, stocktake wizard, supplier returns) / ETA production mandates (GS1 UI + retry INVALID) / مدفوعات Paymob حقيقية (Auth→Order→Key→Iframe) + Fawry charge / Bosta+Mylerz عملاء حقيقيين / كوبونات-لويالتي-PIN / refunds (restock-first gateway retry worker) / داش بورد KPI + رسم بياني للايرادات / تقارير profitability-cashier-shipping-dead-stock CSV / variants display families / reviews + guest wishlist / portal saved addresses / rate limits (tracking + verified uploads) / **cashier shifts (POS بيقفل على وردية مفتوحة)** / settings registry + setup checklist + LocaleSwitcher.

- ملاحظة: الحاجة دي اتدمجت من الـ repository (مش معروف مين عملها/على أي جهاز) — **أي شغل جاي يجب `git fetch` أولًا قبل التعديلات.**

---

## 3. المهام الأربعة اللي طلبها المستخدم — الحالة

1. **تحليل عميق للمشروع (gaps):** تم والنتائج في سيكشن 5 + `SYSTEM_AUDIT_AND_GAPS_REPORT.md`. الريبو الريموت غطّى جزء من الفجوات HIGH/MEDIUM (مدفوعات، رسم داش بورد، rate limits، saved addresses، shifts).
2. **بطء اللوجن ↓ (ROOT CAUSE + FIX):** السبب = pooler Neon (~700ms/query) vs direct (~140ms). الفيكس في `src/lib/db.ts` → `datasources: { db: { url: DIRECT_URL || DATABASE_URL } }`، اللوجن الدافي ~212ms. ✅ مدمج ومرفوع ضمن `c8c6ba5`. الخطوة الباقية: deploy + قياس على الـ live.
3. **زر تبديل اللغة في الناف بار الداش بورد:** ✅ **تم** — استخدمنا `LocaleSwitcher` (جاي من الريبو الريموت في `src/components/ui/foundation`) في `AdminHeader` (كنت عملت Globe يدوي واتشال لأنه مكرر). التبديل ar↔en شغال في كل صفحات الأدمن.
4. **تنظيف داتا الديمو من الداش بورد:** ✅ **تم على الـ DB اللive مباشرة** عبر `scripts/cleanup-ops-data.ts` (idempotent, FK-safe, مرفوع).
   - المتبقي الفعلي في الـ DB: `branches=2 / users=7 / categories=6 / brands=8 / products=141 / inventoryRows=282 / settings=27`.
   - سيدات الديمو (transactions/run/catalog) محفوظة في الكود للرجوع لها يوم ما.

---

## 4. فيكسات إضافية اتعملت في تعديلات محلية + نصّها في الدمج

- POS: اسم الكاشير من session (بدل "سارة فهمي") + بايل ETA "(وضع تجريبي)" + toast الحفظ offline.
- **فيكس توست نجاح المزامنة** (`handleSyncOffline`): سطر `else if (offlineQueue.length > 0)` كان دايمًا false بعد `clearOfflineQueue()` → أضفنا `const queuedCount = offlineQueue.length` قبل اللوب ونجرّبها. ✅ مرجّح في الدمج.
- تعارضات الدمج اتحلت: `AdminHeader` (مسحوب setup banner الريموت + بايل ETA "مقفلة") و `pos/page.tsx` (LocaleSwitcher + shift gate الريموت + اسم الكاشير + ETA experiment).

---

## 5. تقرير الفجوات — المتبقي الفعلي (مرتب حسب الخطورة)

### HIGH (لسه مفتوح)
1. **مدفوعات:** الريبو الريموت ضاف كود Paymob/Fawry حقيقي لكنه **مشبوك بإنف bottom** — محتاج مفاتيح الـ provider للتفعيل الفعلي (شوف سيكشن 6). بدونها في ظل mock/fallback.
2. **Offline queue الـ POS ذاكرة فقط** (مفيش localStorage) + الـ manager PIN مش بيتبعت مع المزامنة + idempotency `clientSaleId` خارج الـ transaction.
3. **AuditLog ميت** — `writeAudit` مستدعى في مكان واحد.
4. **مساحة رقم الأوردر صغيرة** `ORD-2026-${1000..9999}` + مفيش idempotency أوردر (double-submit).

### MEDIUM (لسه مفتوح)
5. الـ admin queries غير bounded (سحب كامل في الذاكرة).
6. Portal track: keyspace صغير + بيانات عميل للجهال.
7. تحويل `paymentStatus` يدوي لـ PAID من غير مبلغ/مرجع مدفوعات.
8. ETA fallback الضريبة الوهمية `'123-456-789'` + أسماء أصناف hardcoded.
9. مفيش تغيير/نسيان باسورد ذاتي (WhatsApp only رسائل).

### مُعالَج من الريبو الريموت ✅
كارت KPI + شارت ايرادات (7), rate limits tracking/uploads (8/11), saved addresses portal, shifts، setup checklist، dashboard stats.

---

## 6. بيانات الـ env المفقودة (مطلوبة للتفعيل الحقيقي على الـ live)

التالية **مش موجودة في `.env`** — مطلوبة من المالك/المصدر لتشغيل التكاملات الحقيقية (في غيابها الكود بيشتغل mock/fallback):
- `PAYMOB_PROVIDER` + `PAYMOB_HMAC_SECRET` (مدفوعات)
- `FAWRY_PROVIDER` + `FAWRY_SECURE_KEY` (مدفوعات)
- `BOSTA_WEBHOOK_SECRET` + `MYLERZ_WEBHOOK_SECRET` (شحن/webhooks)
- `ETA_SIGNING_URL` (ETA live)
- `SETTINGS_ENCRYPTION_KEY` (تشفير أسرار الإعدادات)
- `NEXT_PUBLIC_SITE_URL` (sitemap/metadata)
- ⚠️ توكن Vercel الصحيح (momenellaban) محفوظ في `.env` فقط (gitignored). ملف `.env` الحالي فيه توكن قديم بحساب momendevelopertech — ممنوع استخدامه. فرق الـ deploy: team `momenellabans-projects`, project `sports`, alias `https://sports-livid-eight.vercel.app`.

---

## 7. الحالة التقنية بعد الدمج

- `npm install` ✅ (أضاف `jsbarcode`) — `prisma generate` ✅ — **`npx prisma db push` تم على الـ Neon** (الجداول الجديدة: shifts/returns/reviews/... @sync) ✅
- `npx tsc --noEmit` ✅ نظيف | `npm run lint` ✅ 0 errors / 34 warnings | `npm run test:unit` ✅ **56/56** (كانت 10) | `npm run check:invariants` ✅ CLEAN | `npm run build` ✅.

---

## 8. To-Do الجلسة القادمة (بالترتيب)

- [ ] 1. `git push origin main` (رفع الدمج `c8c6ba5`).
- [ ] 2. `vercel deploy --prod` (توكن momenellaban) + smoke live: سرعة اللوجن (~200ms), زر اللغة في الناف بار, داش بورد فاضي من الديمو, POS شغال بـ shifts.
- [ ] 3. إضافة مفاتيح الـ env الناقصة (سيكشن 6) لتفعيل المدفوعات/الشحن/ETA الحقيقية — أو إغلاقها تمامًا لو مش هتتستخدم.
- [ ] 4. قرار مع المستخدم على فجوات HIGH المتبقية: أيونها نصلّح الآن؟ (أقترح: #3 audit log + #2 offline persistence أولًا).
- [ ] 5. (اختياري) دمج `SYSTEM_AUDIT_AND_GAPS_REPORT.md` مع `docs/FINAL_REPORT.md` اللي جالنا من الريموت.

---

## 9. مفاتيح/ملاحظات

- **الأوامر:** `npm run test:unit` • `npm run test:smoke` (`--env-file=.env`) • `npm run check:invariants` • `npx tsx scripts/cleanup-ops-data.ts` (آمن تكرار).
- **تسجيل دخول الديمو:** `admin@sports-champions.local` / `Test@123456`.
- **Cloudinary:** `CLOUDINARY_CLOUD_NAME="djseokhow"`.
- ⚠️ **قاعدة الريبو:** `main` بيمنع **merge commits** (linear history مطلوب). أي دمج قادم = `git pull --rebase` ثم push، ولو في شغل محلي قديم استخدم `git reset --soft origin/main && git commit -m ...` ليصبح commit خطي واحد.
- ⚠️ الريموت عليه **collaborator نشط** بدفع بانتظام (returns/rea…). دايمًا `git fetch` + `--rebase` قبل الشغل.
- **Neon:** pooler `DATABASE_URL` vs direct `DIRECT_URL` — الـ client على direct دائمًا (أسرع 5x).