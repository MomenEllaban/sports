# جولة تصحيحات UX والميزات — Admin / POS / Storefront

**الفرع:** `refactor/admin-sidebar-restructure`  
**التاريخ:** 24 سبتمبر 2026  
**قاعدة التحديث:** كل بند يبدأ `❌`، ويصبح `🟡` عند التنفيذ الجزئي أو عند وجود blocker، و`✅` عند الاكتمال والاختبار.

## A) عام

- [x] ✅ **A1 — العربية default locale:** routing/middleware والـ redirect من `/` إلى `/ar`، مع اختبار Admin/POS/Storefront.
- [ ] 🟡 **A2 — الألوان والتباين:** أُضيفت semantic status tokens وطبقت على badges/لوحات Admin مع mappings للضوء؛ بقت مراجعة التباين البصري والـ legacy literals مرحلة تدريجية (لم يُثبت بعد فحص آلي WCAG لكل الصفحات).

## B) الطلبات

- [x] ✅ **B1 — تأكيد تغيير حالة الطلب:** Confirm Dialog يعرض رقم الطلب، الحالة الحالية→الجديدة، وأثر الإرجاع/التشغيل، مع endpoint متوقع الحالة وrollback للـ UI وتسجيل Audit.
- [x] ✅ **B2 — تعديل الطلب:** endpoint فعلي لـ PENDING/CONFIRMED مع optimistic version، server-side totals، stock delta داخل transaction، قيود الدفع/الفاتورة/المرتجع، وAudit Log؛ اختبارات rollback/stale مضافة.
- [x] ✅ **B3 — الفاتورة القديمة:** snapshot issuance للطلبات/المبيعات، عرض/إعادة طباعة مع توضيح أنها نسخة معادة، requestId/idempotency، وAudit/InvoiceReprint؛ السجلات القديمة تُعرض كـ legacy reconstructed بوسم واضح.

## C) المشتريات والموردون

- [x] ✅ **C1 — صفحة الموردين المستقلة:** `/admin/purchasing/suppliers` أصبحت Server Component مستقلة مع CRUD، اختيار مورد، ملخص الالتزامات والمدفوعات، POs والمدفوعات الخاصة، وحماية الحذف من السجلات المالية.
- [x] ✅ **C2 — نموذج Purchase Order:** بحث بالاسم/SKU/الباركود، اختيار أصناف غير مكررة، quantities/cost، إجمالي لحظي، validation responsive، وحفظ draft/confirm مع API server authoritative ومنع استلام المسودة.

## D) التقارير

- [x] ✅ **D1 — فصل التقارير:** routes مستقلة للمبيعات والمخزون والفروع والمالية وكشكول النواقص، وفهرس مُجمّع لم يعد alias واحدًا.
- [x] ✅ **D2 — فلاتر server-side:** from/to/search/branch وpagination في query/URL، أعمدة SKU/باركود/تصنيف/ماركة/أسعار/كميات الفروع، وتصدير CSV بنفس الفلاتر.
- [x] ✅ **D3 — تقرير كشكول النواقص:** reorderPoint/quantity لكل فرع، checkbox محفوظة في ReorderRequest مع user/date/note/supplier، فلاتر المتابعة، وإنشاء PO من المحدد.

## E) المخزون / الجرد

- [x] ✅ **E1 — Batch Stocktake:** StocktakeSession + StocktakeLine، جدول كل أصناف الفرع مع بحث/تصنيف، draft/approve transaction مع drift guard وInventoryLog، وتقرير/CSV فروقات.

## F) POS

- [ ] ❌ **F1 — POS category/brand filters:** chips touch-friendly مع خيار «الكل» والبحث/الباركود الحالي.

## G) Storefront / المنتجات

- [ ] ❌ **G1 — Product pagination:** server-side pagination/load-more في Admin وStorefront مع URL filters/order/count.
- [ ] ❌ **G2 — Wishlist:** زر non-nested، صفحة wishlist، DB للمسجل وlocalStorage للزائر مع merge/login، move-to-cart/delete/count.

## حالة التنفيذ الأولية

- لم يبدأ تنفيذ البنود الجديدة بعد؛ البنية السابقة في `SYSTEM_REPORT.md` تظل مرجعًا للحالة السابقة.
- أي migration جديدة ستُذكر هنا وفي `SYSTEM_REPORT.md` قبل/بعد تنفيذها.
- لا يتم_stage أو حذف الملفات المحلية غير المتتبعة الحالية (`scripts/debug-*.ts`, `scripts/.stock-snap.json`).
