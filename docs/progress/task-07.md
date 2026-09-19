# Task 07 — Atomic inventory + idempotent sync (DONE)

## RED ثم GREEN
- RED: `clientSaleId` غير موجود + سلوك غير ذري.
- GREEN: `pos-atomic` (5/5) + الكل 37/37 + build أخضر.

## ما تم
- `src/lib/inventory/service.ts`: المصدر الوحيد — `decrementStock` ذري بشرط `quantity >= qty` + `InventoryLog`، و`incrementStock` (ينشئ الصف عند غيابه).
- `eta.ts`: `buildEtaReceipt` نقي (بلا DB) + `submitToEta` كما هو للتوافق.
- `pos/sale`: معاملة واحدة (مخزون + لوجات + بيع + فاتورة) + `clientSaleId` فريد (إعادة نفس المعرف ترجع الأصل بلا خصم مكرر) + إعادة توليد الرقم عند تعارض + الولاء والإشعارات بعد الـ commit فقط.
- `orders/create`: نفس النمط + **رفض** نقص المخزون بحمولة `{productId, sku, available, requested}` بدل السماح بالسالب.
- Migration `4_sale_idempotency` + مزامنة الأوفلاين ترسل `clientSaleId`.
- اختبارات: فوز واحد على آخر قطعة، منع السالب، تكرار المعرف، أرقام فريدة متوازية، فشل منتصف المعاملة، رفض الأونلاين.

## إصلاحات عرضية
- استيرادات `.js` تكسر webpack (37 ملفاً → بلا لاحقة في `src`؛ الاختبارات تبقى `.js` لأن vitest يحلها).
