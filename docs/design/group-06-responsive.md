# Group 06 — Responsive — NEXT (Pending)

Status: Pending — يبدأ بعد مراجعة البرومبت (البرومبت §26: انتظار approval قبل أول جروب).

## النطاق (من `docs/design-progress.md`)
- [ ] Mobile table fallbacks (تأكيد `DataTable` cards على 390px لكل الجداول المربوطة)
- [ ] 44px touch targets (مسح شامل للأزرار/الأيقونات تحت 44px)
- [ ] Filter grids (شبكات الفلاتر على الموبايل بدل الزحمة)
- [ ] POS tablet sanity (768–1024: الكتالوج + السلة + الدفع بدون scroll زيادة)

## Viewports الإلزامية
`390×844` / `768×1024` / `1024×768` / `1366×768` — فشل لو overflow أفقي أو عنصر مقصوص.

## خطوات التنفيذ (لأي AI يكمل)
1. `git pull --rebase` أولاً. اقرأ `docs/design-system.md` (قواعد Responsive).
2. افحص كل صفحة على الـ 4 viewports (Playwright أو متصفح).
3. نفذ الإصلاحات بأقل تدخل (لا تعيد كتابة layouts شغالة).
4. تحقق: `lint` + `typecheck` + `build` + Playwright viewports.
5. حدث `docs/design-progress.md` + هذا الملف (Commit + Status: Done).
6. Commit مستقل `design: improve responsive layouts` ثم **push**.

## ملفات متوقعة
- `src/components/ui/foundation.tsx` (DataTable cards)
- صفحات الأدمن ذات الفلاتر + `src/app/[locale]/pos/page.tsx`
