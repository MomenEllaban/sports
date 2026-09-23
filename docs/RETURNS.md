# RETURNS — نظام المرتجعات الموحد (T-RMA)

> مسار واحد فقط: أي مرتجع (POS/أونلاين/واتساب/إدارة/شحن) يمر عبر `src/lib/returns/service.ts`.
> التفاصيل التقنية للفحص: `docs/RETURNS_AUDIT.md`.

## السياسة المطبقة (القيم من Settings — راجع `/admin/settings/setup`)
- التفعيل `returns.enabled`، مدة الاسترجاع `returns.windowDays` (14 يوم من التسليم/البيع)، ومدة الاستبدال `returns.exchangeWindowDays`.
- أقسام مستثناة `returns.nonReturnableCategories` (افتراضي: السباحة والدعامات — قرار العميل).
- الإيصال إجباري في POS (`returns.requireReceipt`)، وبدونه: بحث بالهاتف + PIN مدير.
- الأسباب `returns.reasons`، والصور إجبارية لأسباب `returns.requirePhotoForReasons` (افتراضي: العيب المصنعي).
- رد التوصيل `returns.refundDeliveryFee` (افتراضي: الكامل أو خطأنا فقط)، ورسوم إعادة التخزين `returns.restockingFeePct` (0 = معطلة، وتُخصم فقط لـ `CHANGED_MIND`).
- الاسترداد النقدي فوق `returns.cashRefundManagerThreshold` (500) يحتاج PIN، والاعتماد التلقائي في المحل حتى `returns.autoApproveMaxValue` (1000).
- طرق الاسترداد `returns.allowedRefundMethods`، والمدة المعلنة `returns.slaHours` (72h)، ونص السياسة `returns.policyText` (يظهر في المتجر والإيصال).

## دورة الحالات
`REQUESTED → APPROVED → RECEIVED → REFUND_PENDING → COMPLETED` مع `REJECTED` و`CANCELLED` (قبل الاستلام فقط).
- المحل: اعتماد تلقائي داخل السياسة أو PIN، وكل الحالات في استدعاء واحد.
- الأونلاين: العميل يطلب → المدير يعتمد → استلام بالفرع (أو شحن عكسي لو `returns.reverseCourierEnabled`) → فحص ومصير → استرداد.
- كل انتقال في AuditLog + إشعار (واتساب لو مفعّل).

## جدول الأثر
| المجال | السلوك |
|---|---|
| المخزون | `RESTOCK` يزيد المتاح في فرع الاستلام، `DAMAGED/INSPECT` سجل صفري مرئي، الكل نوع `RETURN` — exactly-once |
| الفلوس | `Refund` outbox (`PENDING→PROCESSING→DONE/FAILED/MANUAL_REQUIRED`) + `idempotencyKey` + retry؛ `paymentStatus=REFUNDED` عند الكامل فقط |
| الوردية | الكاش من درج مفتوح، ينقص `expectedCash` ويظهر في الإغلاق؛ فوق الحد PIN |
| الولاء | عكس المكتسب على القيمة المرتجعة + رد المستبدل بالتناسب؛ السالب حسب `loyalty.allowNegativeOnReturn` ويمنع الاستبدال حتى التعويض |
| الكوبونات | تُستعاد فقط للإرجاع الكامل لو `coupons.restoreOnFullReturn` (افتراضي لا) |
| العمولات | DONE refunds تُخصم من أساس عمولة الكاشير في مسودة المرتب |
| ETA | credit note بأصناف حقيقية، `PENDING_ETA` عند التعثر مع retry |
| الاستبدال | مرتجع + بيع جديد مرتبط (`exchangeSaleId`) مع فرق سعر، في Wizard واحد بالـ POS |
| الأوفلاين | المرتجع يحتاج اتصالاً دائماً — ممنوع من الـ queue |
| `OrderStatus.RETURNED` | للكامل فقط؛ الجزئي يُبقي `DELIVERED` مع `returnStatus=PARTIAL` |

## تشغيل موظف جديد
1. POS: زر "مرتجع / استبدال" → ابحث بالفاتورة أو الهاتف → حدد الأصناف والأسباب → (استبدال؟) → طريقة الاسترداد → تأكيد → اطبع الإيصال.
2. أدمن `/admin/returns`: راجع chips الحالات المحتاجة إجراء → افتح التفاصيل → اعتمد/استلم (حدد مصير كل صنف) → تابع الاسترداد (retry أو تسجيل يدوي بمرجع).
3. بورتال: العميل يطلب من التتبع → يتابع برقم RTN والهاتف.

## المطلوب من العميل (مرتجعات)
بنود `returns.*` + `loyalty.allowNegativeOnReturn` + `coupons.restoreOnFullReturn` في `docs/CLIENT_INPUTS.md` — كلها `DEFAULT_UNCONFIRMED` حتى التأكيد. بدون تأكيد البنود الإلزامية (`enabled`, `windowDays`, `refundDeliveryFee`) الميزة مقفولة بنضافة.

## المتبقي اليدوي
- اختبار refund حقيقي على sandbox لكل بوابة بعد وصول المفاتيح.
- مراجعة المحاسب لـ credit note قبل تفعيل ETA production.
- `pnpm refunds:process` كل 10 دقائق + `pnpm eta:retry` كل ساعة (انظر `docs/OPERATIONS.md`).
