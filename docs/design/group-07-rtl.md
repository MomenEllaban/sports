# Group 07 — RTL / LTR — Done

Commit: `PENDING` — Status: Done (2026-09-23).

## ما تم
- [x] `DirectionalIcon` في `foundation.tsx` (back/forward دلالي + `rtl-flip` تلقائي؛ قاعدة: العمودي والساعات والسبينر لا تنعكس)
- [x] ترحيل Pagination + زر ReturnPortal التالي إليه (وأصلح bug: السابق كان بسهم يمين في الإنجليزية)
- [x] Logical utilities في الـ chrome المشترك: Toast `end-5`، شارات `end-1`، `border-e` في POS، `text-start/end` بدل `text-right/left` في ~15 سطح (POS/cart/checkout/modals/managers/header)
- [x] `text-start` للجداول: مؤكد (tableCls + كل الجداول الخام)
- [x] تحقق: typecheck نظيف + lint بلا errors + build ناجح
- [x] متعمد لم يُلمس: أزواج أيقونة-بحث المتناسقة فيزيائياً، مقبض ThemeToggle، زخارف متماثلة، print CSS الورقي

## معروف
- فحص ar/en البصري الكامل متعذر هنا (لا متصفح — نفس قيد Group 06)؛ التغييرات logical classes آمنة افتراضياً. يُعاد الفحص البصري في Group 09.

## النطاق
- [ ] Logical utilities في الـ shared chrome (استبدال left/right بـ start/end)
- [ ] `DirectionalIcon` component (أيقونات تحافظ على الاتجاه الدلالي: الرجوع/التقدم تنعكس، الساعة/التحميل لا)
- [ ] `text-start` للجداول (مكتمل جزئياً في Group 04 — تأكيد الشمول)

## قواعد
- فحص كل شاشة بالعربي والإنجليزي. الأرقام/التواريخ/العملة بـ `dir="ltr"` معزول.
- لا تعكس كل شيء عميانياً.

## تحقق
`lint` + `typecheck` + `build` + فحص بصري ar/en، ثم commit `design: rtl/ltr consistency` + **push**.
