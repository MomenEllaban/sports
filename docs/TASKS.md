# جولة تصحيحات UX والميزات — Admin / POS / Storefront

**الفرع:** `refactor/admin-sidebar-restructure`  
**التاريخ:** 24 سبتمبر 2026  
**قاعدة التحديث:** كل بند يبدأ `❌`، ويصبح `🟡` عند التنفيذ الجزئي أو عند وجود blocker، و`✅` عند الاكتمال والاختبار.

## A) عام

- [ ] ❌ **A1 — العربية default locale:** routing/middleware والـ redirect من `/` إلى `/ar`، مع اختبار Admin/POS/Storefront.
- [ ] ❌ **A2 — الألوان والتباين:** توحيد semantic tokens، وخفض الإجهاد البصري للأصفر، ومراجعة Dark/Light وWCAG AA.

## B) الطلبات

- [ ] ❌ **B1 — تأكيد تغيير حالة الطلب:** Confirm Dialog يعرض الطلب، الحالة الحالية→الجديدة، والأثر، مع rollback للـ UI.
- [ ] ❌ **B2 — تعديل الطلب:** تعديل بيانات العميل/العنوان/الأصناف/الخصم/الملاحظات في الحالات المسموحة، مع server totals وstock delta وAudit Log.
- [ ] ❌ **B3 — الفاتورة القديمة:** زر عرض/إعادة طباعة snapshot الطلب أو البيع، مع توضيح أنها نسخة معادة الطباعة وتسجيلها في Audit.

## C) المشتريات والموردون

- [ ] ❌ **C1 — صفحة الموردين المستقلة:** `/admin/purchasing/suppliers` ببياناتها وCRUD وكشف الحساب والمدفوعات وPOs الخاصة.
- [ ] ❌ **C2 — نموذج Purchase Order:** بحث الصنف بالاسم/الباركود، quantities/cost، total فوري، منع التكرار، validation، responsive، draft/confirm.

## D) التقارير

- [ ] ❌ **D1 — فصل التقارير:** routes ومكونات مستقلة وفهرس مُجمّع بدل aliases.
- [ ] ❌ **D2 — فلاتر server-side:** from/to/search/branch/فلاتر خاصة، URL query params، pagination، أعمدة المنتج الكاملة، CSV/Excel.
- [ ] ❌ **D3 — تقرير كشكول النواقص:** low-stock/reorder point، checkbox encoded supplier/user/date/note، filter، وإنشاء PO من المحدد.

## E) المخزون / الجرد

- [ ] ❌ **E1 — Batch Stocktake:** StocktakeSession + StocktakeLine، جدول كامل، draft/approve transaction، InventoryLog، variance report/export.

## F) POS

- [ ] ❌ **F1 — POS category/brand filters:** chips touch-friendly مع خيار «الكل» والبحث/الباركود الحالي.

## G) Storefront / المنتجات

- [ ] ❌ **G1 — Product pagination:** server-side pagination/load-more في Admin وStorefront مع URL filters/order/count.
- [ ] ❌ **G2 — Wishlist:** زر non-nested، صفحة wishlist، DB للمسجل وlocalStorage للزائر مع merge/login، move-to-cart/delete/count.

## حالة التنفيذ الأولية

- لم يبدأ تنفيذ البنود الجديدة بعد؛ البنية السابقة في `SYSTEM_REPORT.md` تظل مرجعًا للحالة السابقة.
- أي migration جديدة ستُذكر هنا وفي `SYSTEM_REPORT.md` قبل/بعد تنفيذها.
- لا يتم_stage أو حذف الملفات المحلية غير المتتبعة الحالية (`scripts/debug-*.ts`, `scripts/.stock-snap.json`).
