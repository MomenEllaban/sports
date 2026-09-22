# RETURNS AUDIT — فحص نظام المرتجعات الحالي (المرحلة A)
**التاريخ:** 2026-09-22 — الفرع `main@3fd7411`. كل نقطة بأدلتها من الكود الفعلي.

## 1) مسار `RETURNED` في `src/lib/orders/status.ts` — موجود (كامل فقط)
- `ORDER_TRANSITIONS` (`status.ts:11`): `SHIPPED→RETURNED` و`DELIVERED→RETURNED` مسموحان؛ `RETURNED` نهائية.
- `transitionOrder` (`status.ts:75`): عند `CANCELLED/RETURNED` يرد **كامل الكميات** لكل سطر إلى `order.branchId` ويسجل `InventoryLog` نوع `RETURN` بمرجع رقم الطلب + `createdById` (المستخدم المنفذ).
- **لا يمس** `paymentStatus` إطلاقاً. **لا سبب** (لا حقل reason). منفذو الاستدعاء: API الإدارة (`orders/[id]/route.ts:29`)، خدمة الاسترداد (`refunds/service.ts:41`)، وwebhooks الشحن (`logistics/webhook.ts:27`).
- الحكم: **موجود لكن بدائي** — full-only، بلا سبب، بلا ربط مالي.

## 2) UI للمرتجعات — جزئي (إدارة فقط)
- **أدمن الطلبات** (`OrdersManager.tsx`): wizard استرداد كامل فقط (زر "استرداد الطلب" يظهر لطلبات `DELIVERED+PAID` بلا refund سابق) + chips حالة الـ Refund + retry. لا RMA، لا جزئي، لا استبدال.
- **POS** (`pos/page.tsx`): **غير موجود** — صفر نتائج لكلمات مرتجع/استبدال/إرجاع.
- **بورتال العميل** (`AccountClient.tsx`) و**التتبع**: **غير موجود** — لا زر ولا حالة.
- الحكم: **جزئي** — يُبنى POS + بورتال + `/admin/returns`، ويُدمج wizard الإدارة القديم في المسار الجديد.

## 3) استرجاع جزئي — غير موجود
- لا نموذج سطور مرتجعة، لا كميات جزئية، لا فحص `returned ≤ sold`. أي `CANCELLED/RETURNED` يرد الكل.
- الحكم: **يُبنى** (`ReturnItem` + فحص ذري).

## 4) `submitEtaCreditNote` (`eta.ts:243`) — جزئي
- تأخذ أصنافاً حقيقية منذ T10 (اختيارية `items?`)، وتُستدعى من **مكان واحد فقط**: `refunds/service.ts:123` (بعد نجاح الاسترداد، best-effort لا يُفشل العملية).
- T14 جعل production يرفض بلا توقيع/GS1، مع retry (`tax-invoices/[id]/retry` + `pnpm eta:retry`).
- الفجوة: لا credit note للمرتجع الجزئي (تُبنى في المسار الجديد)، ولا حالة `PENDING_ETA` — تُضاف.
- الحكم: **يُحسّن ويُعاد استخدامه** (لا يُبنى مرتين).

## 5) أثر الاسترجاع على باقي النظام — غير موجود (7 فجوات)
| المجال | الحالة | الدليل |
|---|---|---|
| نقاط مكتسبة | لا تُعكس | `pos/sale/route.ts:235` يضيف فقط |
| نقاط مستبدلة | لا تُرد | `redeemPoints` بلا عكس |
| كوبونات | لا تُستعاد | `consumeCoupon` أحادي الاتجاه |
| عمولات المرتبات | لا تُخصم | `payroll-runs/route.ts:31` تجمع مبيعات POS الخام |
| الوردية/الدرج | لا أثر | `Sale.shiftId` يُسجل، والاسترداد لا يمس `expectedCash` |
| POS مقابل ORD | المرتجع للطلبات فقط | لا RMA لفواتير `SALE` |
| التقارير | الإيراد يشمل المرتجعات | `reports/summary` لا يستبعد `RETURNED`؛ `order-status` test يغطي restock فقط |

## 6) بوابات الدفع refund/void — موجود (أساسي)
- `refunds/service.ts:59`: `paymobVoidRefund` (حقيقي، يُختبر بـ mock) + `fawryRefund` (best-effort يحتاج تأكيد sandbox) + تسوية يدوية لغير البوابات. `MANUAL_METHODS` تشمل COD/CASH/CARD/INSTAPAY/VODAFONE/KASHIER.
- الإنشاء نفسه حقيقي منذ T01/T02 (ليس mock كما افترض البرومبت — البرومبت قديم هنا).
- الحكم: **يُعاد استخدامه** كنواة تنفيذ `Refund` الجديد (مع `idempotencyKey` و`MANUAL_REQUIRED`).

## 7) الاختبارات والقرّاء الحاليون لـ RETURNED
- `order-status.test.ts:116`: `DELIVERED→RETURNED` يرد المخزون. `invariants.test.ts:45`: طلبات CANCELLED/RETURNED بلا RETURN log تُكتشف. `refund-outbox.test.ts:67`: الاسترداد يقلب `RETURNED`.
- القرّاء: `applyCourierStatus` (webhook شحن)، `reports/summary` (عدّ مرتجعات الشحن)، داشبورد KPI (يستبعدها من معلق الدفع فقط).
- الحكم: **تُحدّث** لتعكس `returnStatus` الجزئي، **دون حذف** تغطية الـ restock.

## القرار النهائي (ملزم)
1. **يُبنى**: `ReturnRequest` + `ReturnItem` + `Refund`(الجديد) + `calc.ts` + `Return Service` الوحيد + POS wizard + `/admin/returns` + portal wizard + إيصال RTN + seed + tests + تقارير.
2. **يُحسّن ويُدمج**: `transitionOrder` (تبقى للمخزون الكامل/الإلغاء)، `submitEtaCreditNote`، `paymobVoidRefund/fawryRefund`، wizard الإدارة القديم (يتحول لواجهة فوق المسار الجديد).
3. **يُمسح**: `RefundRequest` القديم (T10) بعد ترحيل صفوفه — لا outbox مزدوج. `transitionOrder→RETURNED` المباشر من API الإدارة وwebhooks يتحول للمسار الجديد (webhook الشحن يسجل RMA إداري `source=AUTO_COURIER` بدل قلب الحالة وحده).
4. **ثابت واحد**: أي restock لمرتجع يمر عبر `Return Service` فقط؛ `returnStatus` المشتق (`NONE|PARTIAL|FULL`) هو مصدر الحقيقة للعرض، و`OrderStatus.RETURNED` للكامل فقط.
