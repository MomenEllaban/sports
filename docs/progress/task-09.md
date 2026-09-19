# Task 09 — Central money math (DONE)

## RED ثم GREEN
- كتبت `pricing.ts` + `pricing.test.ts` (5 فحوص: قيم معروفة + خصائص fast-check) أولاً — خضراء فوراً لأنها مستخرجة من نفس الصيغ (الهدف: التثبيت لا الإصلاح).

## ما تم
- `src/lib/pricing.ts`: المصدر الوحيد — `money` (تقريب واحد)، `linesSubtotal`، `clampDiscount`، `vatAmount`، `computeTotals`، `loyaltyEarned`. دلالات موثقة: أسعار exclusive + 14%.
- الهجرة (بلا تغيير سلوكي): `pos/sale`، `orders/create`، `admin/orders` (كان يثق بسعر العميل — أُصلح ضمنياً)، `cartStore`، `posStore`.
- ملاحظة سلوكية وحيدة: `posStore.getSubtotal` كان يطرح `item.discount` (دائماً 0 عملياً) — الآن يتجاهله؛ الخصم عبر `discountAmount` فقط.

## النتائج
- unit pricing 5/5 (200 تشغيل خاصية لكل خاصية)، الكل 47/47، lint بلا errors، build أخضر.
