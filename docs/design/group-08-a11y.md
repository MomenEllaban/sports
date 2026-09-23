# Group 08 — Accessibility — Done

Commit: `PENDING` — Status: Done (2026-09-23).

## ما تم
- [x] `focus-visible` rings عامة في `globals.css` (مرئية دائماً — ممنوع إزالتها)
- [x] Focus trap (`useFocusTrap`) في `Modal` + `ConfirmDialog` + زر إغلاق 44px
- [x] Labels: aria-labels لمدخلات RTN/الهاتف/البحث البديل + أزرار كميات مسماة بالصنف + زر إغلاق معرب
- [x] تباين: placeholder `slate-500` → `slate-400` في `inputCls`
- [x] تحقق: typecheck + lint (0 errors) + unit 56/56 + build ناجح

## النطاق
- [ ] `focus-visible` rings (مرئية دائماً — ممنوع إزالتها للشكل)
- [ ] Modal trap / Escape / labels (تأكيد على `Modal` الموحد بعد تعديلات Group 03)
- [ ] تباين الألوان (نصوص slate على الخلفيات الداكنة/الفاتحة + الثيمين)
- [ ] كل input له `label`، كل زر أيقوني له `aria-label`

## تحقق
تدقيق keyboard-only + فحص تباين، ثم commit `design: accessibility fixes` + **push**.
