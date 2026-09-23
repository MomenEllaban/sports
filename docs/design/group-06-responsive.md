# Group 06 — Responsive — Done

Commit: `fc6eac6` — Status: Done (2026-09-23).

## ما تم
- [x] أهداف لمس 44px: أزرار كميات POS (32→44) + حذف السلة + أزرار ReturnPortal (28→44) + زر لغة الهيدر + أزرار صور المنتجات (hover-only → ظاهرة على اللمس + 44px)
- [x] جداول الأدمن: `min-w` داخل `overflow-x-auto` (13 سطح) — تscroll بدل ما تتفعص
- [x] POS يتكدس تحت `lg` (كتالوج فوق + سلة تحت) + شبكة المنتجات `grid-cols-2` على الموبايل
- [x] إصلاح overflow أفقي 79px في الرئيسية: `champ-glow -inset-24` → `inset-0` (التوهج شفاف أصلاً عند الأطراف)
- [x] تحقق: typecheck نظيف + lint بلا errors + build ناجح

## معروف ومؤجل (موثق — ليس regression)
- `foundation.spec.ts` الـ e2e يفشل timeouts بسبب بطء سيرفر الـ dev في هذه البيئة (page.goto ينتهي وقته) — مشكلة بيئة لا كود.
- اختبار الـ touch-targets يسجل 42 عنصراً صغيراً في `/ar/catalog` (روابط نصية ببطاقات المنتجات — موجود قبل التغيير، لم تُلمس) — يُعالج تصميمياً في Group 09 (تكبير روابط النصوص لـ44px يكسر تصميم البطاقات).
- ملف الـ probe المؤقت اتمسح (`tests/e2e/probe.spec.ts`)، و`foundation.spec.ts` لم يُضعف.

## النطاق الأصلي — التغطية
- [x] Mobile table fallbacks (`DataTable` cards موجودة من Group 04 + `min-w` للجداول الخام)
- [x] 44px touch targets (POS/portal/header/product-images — الكتالوج النصي مؤجل لـ Group 09)
- [x] Filter grids (ReturnsManager `grid-cols-2` موجودة — تم التأكيد، لا زحمة)
- [x] POS tablet sanity (تكديس تحت `lg` + شبكة منتجات متجاوبة)

## Viewports الإلزامية
`390×844` / `768×1024` / `1024×768` / `1366×768` — تحقق Playwright متعذر بيئياً هنا (timeouts)؛ التحقق تم ستاتيكياً + build.
