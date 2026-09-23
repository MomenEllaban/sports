# Group 07 — RTL / LTR — Pending

Status: Pending — بعد Group 06.

## النطاق
- [ ] Logical utilities في الـ shared chrome (استبدال left/right بـ start/end)
- [ ] `DirectionalIcon` component (أيقونات تحافظ على الاتجاه الدلالي: الرجوع/التقدم تنعكس، الساعة/التحميل لا)
- [ ] `text-start` للجداول (مكتمل جزئياً في Group 04 — تأكيد الشمول)

## قواعد
- فحص كل شاشة بالعربي والإنجليزي. الأرقام/التواريخ/العملة بـ `dir="ltr"` معزول.
- لا تعكس كل شيء عميانياً.

## تحقق
`lint` + `typecheck` + `build` + فحص بصري ar/en، ثم commit `design: rtl/ltr consistency` + **push**.
