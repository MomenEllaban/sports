# DECISIONS — سجل القرارات (الأمن افتراضياً)

## F0
1. **تشفير الأسرار بـ AES-256-GCM في Settings** بدل `.env` فقط — لأن العميل سيدير المفاتيح من الـ UI. بدون `SETTINGS_ENCRYPTION_KEY` في production: رفض صريح (fail-closed)؛ وفي dev: `plain:` موسوم للترحيل.
2. **قيم seed الجديدة `DEFAULT_UNCONFIRMED`** — أي افتراضي من عندنا يحتاج تأكيد أدمن عبر `/admin/settings/setup` قبل اعتباره نهائياً.
3. **Paymob/Fawry/Bosta مخفية بدون مفاتيح** — لا روابط وهمية في production؛ `provider=mock` للتجارب فقط (يُطبق في T01–T03).
4. **envelope `{v, _confirmed}`** للقيم المؤكدة — يحافظ على توافق القرّاء القدامى عبر unwrap في `getSetting`.
5. **إخفاء الأسرار في GET** (`masked` آخر 4 أحرف) — الـ UI يرسل blank للإبقاء، وقيمة جديدة للاستبدال.
6. **اختبار integration محلياً معطّل (DB)** — البوابة تُستكمل في CI؛ الوحدات والـ static gates خضراء محلياً.

## F1
7. **إزالة fallback أسرار Cloudinary من الكود** — كانت مفاتيح حقيقية مكشوفة (`cloudinary.ts`)؛ الآن fail-closed برسالة واضحة.
8. **التتبع لا يقبل الهاتف وحده** — يتطلب رقم الطلب معه، والهاتف يُقنّع (`010****6876`) والعنوان الكامل لا يُعرض (zone فقط). صفحة التتبع تدعم الحقلين وتملؤهما من رابط التأكيد.
9. **دخول البورتال برسالة موحدة** — لا 404 يكشف وجود الهاتف (anti-enumeration)؛ و`portal.otpMode=sms` يرجع `otpRequired` تصميماً للمستقبل.
10. **الإلغاء التلقائي للكتروني فقط** — COD يبقى (الدفع عند التسليم)؛ الطلبات العالقة ذات `paymentRef` تُرفع كتنبيه `NEW_ORDER` بعنوان تسوية (لا نوع إشعار جديد لتفادي migration).
11. **Rate limit in-process** — كافٍ لنسخة واحدة؛ موثق في OPERATIONS أن production يحتاج throttling على الحافة.

## T05
12. **البيع يرفض بلا وردية (422)** — حتى المدير؛ الوردية تُفتح من POS أولاً. `resolvePosContext` يرجع `shift` ويُسجل في `Sale.shiftId`.
13. **مبيعات الأوفلاين تُنسب لوردية وقت البيع** — `shiftId` يسافر مع الـ queue؛ السيرفر يقبله فقط لو لنفس الكاشير+الفرع (مفتوحة أو مغلقة)، وإلا الحالية.
14. **المتوقع = الافتتاح + الكاش فقط** — الفيزا/InstaPay لا تدخل الدرج؛ العجز فوق `shifts.maxShortage` يتطلب تفسيراً مكتوباً.
15. **لا partial index لوردية واحدة** — القفل عبر re-check داخل transaction + `updateMany` شرطي عند الإغلاق (يعمل على Postgres بدون migration معقدة).

## ETA-spike
16. **لا تغيير سلوكي** — `gs1Code` nullable، ومفاتيح ETA الجديدة افتراضيات آمنة؛ `signingUrl` من Settings مع env fallback بنفس السلوك القديم.

## T01
17. **قيم placeholder لا تُعتبر إعداداً** — `.env` كان فيه `paymob_api_key_placeholder` وتُعامل كجاهز (كان سيعرض Paymob حياً ليفشل 403)؛ الآن deny-list ترفضها. ينطبق نفس المبدأ على Fawry/الشحن في T02/T03.
18. **المجاميع بالقرش** — `amount_cents` أعداد صحيحة (`Math.round(EGP*100)`) في كل خطوات Paymob.
19. **التحقق في success page من السيرفر** — لا ثقة في URL params؛ الحالة من track API.

## T02
20. **ترتيب حقول توقيع Fawry يحتاج تأكيد sandbox** — الباني معزول في `fawryChargeSignature` لتعديل سطر واحد؛ التشغيل الحي يتطلب مفاتيح حقيقية + اختبار sandbox (انظر FINAL_REPORT لاحقاً).
21. **نافذة انتهاء Fawry أقصر (24h)** — `orders:expire` يلغي FAWRY غير المدفوعة بعد 24h بدل `unpaidExpiryHours` لأن المرجع يموت عند البوابة.
