# المطلوب من العميل (CLIENT_INPUTS)

> مولّد تلقائياً من `src/lib/settings-registry.ts` عبر `pnpm docs:client-inputs`. لا تعدّل يدوياً.

| البند | المجموعة | إلزامي | المسؤول | القيمة الافتراضية | ملاحظات |
|---|---|---|---|---|---|
| اسم المتجر (عربي) (`store.nameAr`) | بيانات المتجر والفروع | نعم | CLIENT | `"ابطال الرياضة الإبراهيمية"` | يظهر في الإيصالات والمتجر. أكّد الاسم التجاري.|
| اسم المتجر (إنجليزي) (`store.nameEn`) | بيانات المتجر والفروع | نعم | CLIENT | `"Sports Champions Alexandria"` | الاسم بالإنجليزية للفواتير والنسخة الإنجليزية.|
| التليفون الأرضي (`store.landline`) | بيانات المتجر والفروع | نعم | CLIENT | `"03 5926908"` | رقم الفرع الرئيسي ويظهر أعلى المتجر وفي الإيصال. مثال: `03 5926908` |
| رقم واتساب الطلبات (`store.whatsapp`) | بيانات المتجر والفروع | نعم | CLIENT | `"01224226876"` | الرقم الذي يستقبل طلبات الواتساب المباشرة من كروت المنتجات. مثال: `01224226876` |
| عنوان الفرع (عربي) (`store.addressAr`) | بيانات المتجر والفروع | نعم | CLIENT | `"92 شارع عمر لطفى، الإبراهيمية بحري، سيدي جابر، الإسكندرية"` | عنوان الاستلام المجاني والإيصالات.|
| عنوان الفرع (إنجليزي) (`store.addressEn`) | بيانات المتجر والفروع | لا | CLIENT | `"92 Omar Lotfy St, Ibrahimeyah, Sidi Gaber, Alexandria"` | نفس العنوان بالإنجليزية.|
| الرقم الضريبي (احتياطي) (`store.taxNumber`) | بيانات المتجر والفروع | نعم | ACCOUNTANT | `"123-456-789"` | يُستخدم في QR الإيصال عند غياب إعداد ETA. هاته من البطاقة الضريبية. مثال: `123-456-789` |
| جداول المقاسات (`sizecharts`) | بيانات المتجر والفروع | لا | CLIENT | `[]` | جداول مقاسات لكل قسم، تظهر في صفحة المنتج (T07).|
| نسبة ضريبة القيمة المضافة (`vat.rate`) | الضريبة والإيصالات | نعم | ACCOUNTANT | `0.14` | النسبة المطبقة على كل الفواتير (0.14 = 14%). أكّدها مع المحاسب. مثال: `0.14` |
| ترويسة الإيصال (`receipt.headerAr`) | الضريبة والإيصالات | لا | CLIENT | `"ابطال الرياضة الإبراهيمية — شكراً لتسوقكم معنا"` | سطر يطبع أعلى الإيصال الحراري.|
| تذييل الإيصال (سياسة الاسترجاع) (`receipt.footerAr`) | الضريبة والإيصالات | نعم | CLIENT | `"الاستبدال والاسترجاع خلال 14 يوماً بالفاتورة"` | يحدد للعميل مدة وشروط الاستبدال والاسترجاع. راجع T10 لسياسة الأيام.|
| طرق الدفع المفعّلة (`payments.methods`) | بوابات الدفع | نعم | CLIENT | `[{"id":"COD","enabled":true}]` | تحكم أي طرق تظهر في checkout. Paymob/Fawry لا تظهر إلا بعد ملء مفاتيحها.|
| Paymob API Key (`paymob.apiKey`) | بوابات الدفع | لا | PROVIDER | — (فارغ: الميزة مقفولة) | من لوحة Paymob ← Developers ← API Keys. بدونه الدفع بالبطاقة مخفي.|
| Paymob Integration ID (`paymob.integrationId`) | بوابات الدفع | لا | PROVIDER | — (فارغ: الميزة مقفولة) | رقم الـ Integration (بطاقات/محافظ) من لوحة Paymob.|
| Paymob Iframe ID (`paymob.iframeId`) | بوابات الدفع | لا | PROVIDER | — (فارغ: الميزة مقفولة) | رقم الـ Iframe الذي يُعرض فيه الدفع.|
| Paymob HMAC Secret (`paymob.hmacSecret`) | بوابات الدفع | لا | PROVIDER | — (فارغ: الميزة مقفولة) | يُستخدم للتحقق من webhooks. من إعدادات الـ Integration.|
| Fawry Merchant Code (`fawry.merchantCode`) | بوابات الدفع | لا | PROVIDER | — (فارغ: الميزة مقفولة) | كود التاجر من حساب Fawry Business.|
| Fawry Secure Key (`fawry.secureKey`) | بوابات الدفع | لا | PROVIDER | — (فارغ: الميزة مقفولة) | مفتاح التوقيع من حساب Fawry Business (سرّي).|
| مناطق وأسعار الشحن (`shipping.zones`) | الشحن والتوصيل | نعم | CLIENT | `[]` | راجع أسعار المناطق مع شركات الشحن ثم أكّدها هنا.|
| Bosta API Key (`couriers.bostaApiKey`) | الشحن والتوصيل | لا | PROVIDER | — (فارغ: الميزة مقفولة) | من لوحة Bosta ← API. بدونه تُنشأ الشحنات يدوياً.|
| Mylerz API Key (`couriers.mylerzApiKey`) | الشحن والتوصيل | لا | PROVIDER | — (فارغ: الميزة مقفولة) | من حساب Mylerz للأعمال.|
| الشراء اللازم لنقطة (ج.م) (`loyalty.earnPerEgp`) | الولاء والخصومات | نعم | CLIENT | `10` | كل كام جنيه يمنح نقطة (الافتراضي 10).|
| قيمة النقطة عند الاستبدال (ج.م) (`loyalty.redeemRate`) | الولاء والخصومات | لا | CLIENT | `1` | قيمة الخصم لكل نقطة عند الدفع (T16).|
| أقصى نسبة خصم بالنقاط % (`loyalty.maxRedeemPct`) | الولاء والخصومات | لا | CLIENT | `20` | سقف خصم الولاء من الإجمالي (مثلاً 20%).|
| حد موافقة المدير على الخصم (ج.م) (`discount.approvalThreshold`) | الولاء والخصومات | نعم | CLIENT | `100` | أي خصم فوقه يطلب PIN المدير في POS.|
| أقصى خصم كلي % (كل القنوات) (`discount.maxTotalPct`) | الولاء والخصومات | لا | CLIENT | `30` | سقف مجموع (كوبون+ولاء+PIN) من الإجمالي (T16).|
| قواعد الجمع بين الخصومات (`discount.stacking`) | الولاء والخصومات | لا | CLIENT | `{"allowCouponLoyalty":true,"allowCouponPin":false}` | هل يجتمع الكوبون مع الولاء؟ ومع خصم المدير؟ (T16).|
| حد النواقص الافتراضي (`stock.lowThreshold`) | المخزون | نعم | CLIENT | `5` | يُستخدم عند إنشاء صنف جديد؛ يمكن تخصيصه لكل صنف/فرع.|
| مدة الركود للأصناف الميتة (أيام) (`reports.deadStockDays`) | المخزون | لا | CLIENT | `60` | صنف بمخزون بلا بيع خلالها = ميت (T12). الافتراضي 60.|
| وضع ETA (`eta.mode`) | الفاتورة الإلكترونية ETA | نعم | ACCOUNTANT | `"off"` | off حتى تجهز بيانات... ثم preprod للتجربة ثم production.|
| ETA Client ID (`eta.clientId`) | الفاتورة الإلكترونية ETA | لا | ACCOUNTANT | — (فارغ: الميزة مقفولة) | من بوابة مصلحة الضرائب (eInvoicing).|
| ETA Client Secret (`eta.clientSecret`) | الفاتورة الإلكترونية ETA | لا | ACCOUNTANT | — (فارغ: الميزة مقفولة) | سرّي — يُخزن مشفراً.|
| رقم التسجيل الضريبي (9 أرقام) (`eta.taxRegNumber`) | الفاتورة الإلكترونية ETA | لا | ACCOUNTANT | `"123-456-789"` | من البطاقة الضريبية. إلزامي لأي إرسال. مثال: `123-456-789` |
| كود الفرع لدى ETA (`eta.branchCode`) | الفاتورة الإلكترونية ETA | لا | ACCOUNTANT | `"0"` | كود الفرع المسجل في المنظومة (من المحاسب). يُستخدم في T14. مثال: `0` |
| كود النشاط (`eta.activityCode`) | الفاتورة الإلكترونية ETA | لا | ACCOUNTANT | — (فارغ: الميزة مقفولة) | كود نشاط بيع التجزئة الرياضية (من المحاسب). يُستخدم في T14. مثال: `5239` |
| رابط خدمة التوقيع الإلكتروني (`eta.signingUrl`) | الفاتورة الإلكترونية ETA | لا | ACCOUNTANT | — (فارغ: الميزة مقفولة) | رابط خدمة توقيع المستندات CAdES (HSM/Token). إلزامي في production (T14).|
| وضع واتساب (`whatsapp.mode`) | واتساب للأعمال | نعم | CLIENT | `"off"` | off للوضع التجريبي (سجل فقط)، cloud للإرسال الحقيقي عبر Meta.|
| WhatsApp Phone Number ID (`whatsapp.phoneId`) | واتساب للأعمال | لا | PROVIDER | — (فارغ: الميزة مقفولة) | من Meta Business ← WhatsApp ← API Setup.|
| WhatsApp API Token (`whatsapp.token`) | واتساب للأعمال | لا | PROVIDER | — (فارغ: الميزة مقفولة) | توكن دائم من Meta (سرّي — يُخزن مشفراً).|
| قالب تأكيد الطلب (`whatsapp.templateOrder`) | واتساب للأعمال | لا | CLIENT | `"order_confirmation"` | اسم القالب المعتمد في Meta (مثل order_confirmation).|
| تفعيل بوابة العميل (`portal.enabled`) | بوابة العميل | لا | CLIENT | `true` | إتاحة دخول العملاء لمتابعة طلباتهم ونقاطهم.|
| وضع التحقق OTP (`portal.otpMode`) | بوابة العميل | لا | CLIENT | `"off"` | off: دخول برقم الطلب (حالياً). sms: يتطلب OTP — يُفعّل بعد تركيب مزود SMS (T-مستقبل).|
| تفعيل المرتجعات (`returns.enabled`) | المرتجعات والاستبدال | نعم | CLIENT | `true` | إتاحة طلبات المرتجع/الاستبدال في كل القنوات.|
| مدة الاسترجاع (أيام) (`returns.windowDays`) | المرتجعات والاستبدال | نعم | CLIENT | `14` | خلالها يُقبل المرتجع من تاريخ التسليم/البيع.|
| مدة الاستبدال (أيام) (`returns.exchangeWindowDays`) | المرتجعات والاستبدال | لا | CLIENT | `14` | لتغيير المقاس عادة. اتركها فارغة = نفس مدة الاسترجاع.|
| أقسام غير قابلة للاسترجاع (`returns.nonReturnableCategories`) | المرتجعات والاستبدال | لا | CLIENT | `["swimming-gear","medical-protection"]` | slugs الأقسام المستثناة (مثل ملابس السباحة والدعامات لأسباب صحية) — قرارك.|
| الإيصال إجباري في POS؟ (`returns.requireReceipt`) | المرتجعات والاستبدال | لا | CLIENT | `true` | بدونه: البحث برقم الهاتف + موافقة مدير بـ PIN.|
| أكواد الأسباب (`returns.reasons`) | المرتجعات والاستبدال | لا | CLIENT | `["SIZE_ISSUE","DEFECTIVE","WRONG_ITEM","NOT_AS_DESCRIBED","CHANGED_MIND","OTHER"]` | القائمة المعتمدة للأسباب (SIZE_ISSUE/DEFECTIVE/WRONG_ITEM/NOT_AS_DESCRIBED/CHANGED_MIND/OTHER).|
| أسباب تتطلب صورة (`returns.requirePhotoForReasons`) | المرتجعات والاستبدال | لا | CLIENT | `["DEFECTIVE"]` | مثل DEFECTIVE — صورة إثبات إجبارية عند الطلب.|
| سياسة رد التوصيل (`returns.refundDeliveryFee`) | المرتجعات والاستبدال | نعم | ACCOUNTANT | `"FULL_RETURN_OR_OUR_FAULT"` | ALWAYS أو FULL_RETURN_OR_OUR_FAULT أو NEVER — راجعها مع المحاسب.|
| رسوم إعادة التخزين % (`returns.restockingFeePct`) | المرتجعات والاستبدال | لا | CLIENT | `0` | تُخصم فقط لسبب CHANGED_MIND عند التفعيل (0 = معطلة).|
| من يدفع شحن الإرجاع؟ (`returns.whoPaysReturnShipping`) | المرتجعات والاستبدال | لا | CLIENT | `"STORE_IF_OUR_FAULT"` | CUSTOMER أو STORE أو STORE_IF_OUR_FAULT.|
| حد الاسترداد النقدي لموافقة المدير (ج.م) (`returns.cashRefundManagerThreshold`) | المرتجعات والاستبدال | لا | CLIENT | `500` | فوقه يلزم PIN مدير في POS.|
| سقف الاعتماد التلقائي في POS (ج.م) (`returns.autoApproveMaxValue`) | المرتجعات والاستبدال | لا | CLIENT | `1000` | مرتجع المحل داخله يُعتمد تلقائياً، وفوقه بـ PIN.|
| حد مرتجعات العميل شهرياً (تحذير) (`returns.maxReturnsPerCustomerPerMonth`) | المرتجعات والاستبدال | لا | CLIENT | `5` | تجاوزه تنبيه فقط لا منع.|
| طرق الاسترداد المسموحة (`returns.allowedRefundMethods`) | المرتجعات والاستبدال | لا | CLIENT | `["CASH","ORIGINAL_GATEWAY","INSTAPAY","VODAFONE","BANK_TRANSFER"]` | CASH/ORIGINAL_GATEWAY/INSTAPAY/VODAFONE/BANK_TRANSFER.|
| مدة المعالجة المعلنة (ساعات) (`returns.slaHours`) | المرتجعات والاستبدال | لا | CLIENT | `72` | تظهر للعميل في صفحة الحالة.|
| نص السياسة (عربي/إنجليزي) (`returns.policyText`) | المرتجعات والاستبدال | لا | CLIENT | `[{"ar":"الاستبدال والاسترجاع خلال 14 يوماً بالفاتورة","en":"Returns within 14 days with receipt"}]` | يظهر في المتجر والإيصال. اكتبه بصياغتك النهائية.|
| الاستلام الافتراضي (`returns.receiveBranchDefault`) | المرتجعات والاستبدال | لا | CLIENT | `"SALE_BRANCH"` | SALE_BRANCH (فرع البيع) أو معرف فرع ثابت.|
| شحن الإرجاع العكسي (`returns.reverseCourierEnabled`) | المرتجعات والاستبدال | لا | CLIENT | `false` | يتطلب إعداد Bosta reverse — وإلا الاستلام في الفرع فقط.|
| السماح بسالب الولاء عند المرتجع (`loyalty.allowNegativeOnReturn`) | المرتجعات والاستبدال | لا | CLIENT | `true` | الافتراضي: سالب صغير مسموح مع منع الاستبدال حتى التعويض.|
| استعادة الكوبون عند الإرجاع الكامل (`coupons.restoreOnFullReturn`) | المرتجعات والاستبدال | لا | CLIENT | `false` | الافتراضي: لا تُستعاد الاستخدامات.|
| إشعار واتساب لحالات المرتجع (`returns.notifyWhatsapp`) | المرتجعات والاستبدال | لا | CLIENT | `true` | يعمل فقط لو تكامل واتساب مفعّل.|
| حد تتبع الطلبات / دقيقة / IP (`ratelimit.trackPerMin`) | الأمان والحدود | لا | DEV | `30` | يمنع تخمين أرقام الطلبات آلياً. الافتراضي 30.|
| حد محاولات دخول البورتال / دقيقة (`ratelimit.portalLoginPerMin`) | الأمان والحدود | لا | DEV | `10` | يمنع التخمين على البورتال. الافتراضي 10.|
| حد رفع الإيصالات / دقيقة / IP (`ratelimit.uploadPerMin`) | الأمان والحدود | لا | DEV | `20` | يمنع إغراق التخزين. الافتراضي 20.|
| أقصى حجم لصورة الإيصال (MB) (`upload.receiptMaxMb`) | الأمان والحدود | لا | CLIENT | `5` | صور PNG/JPEG/WebP/GIF فقط مع فحص البصمة. الافتراضي 5.|
| مهلة إلغاء الطلب غير المدفوع (ساعات) (`orders.unpaidExpiryHours`) | التشغيل (طلبات/ورديات) | لا | CLIENT | `48` | بعدها يُلغى تلقائياً مع إرجاع المخزون (F1).|
| رصيد بداية الدرج الافتراضي (ج.م) (`shifts.openingFloat`) | التشغيل (طلبات/ورديات) | لا | CLIENT | `500` | يُقترح عند فتح الوردية ويمكن تعديله (T05).|
| حد العجز المسموح بالدرج (ج.م) (`shifts.maxShortage`) | التشغيل (طلبات/ورديات) | لا | CLIENT | `50` | فوقه يُطلب تفسير إجباري عند الإغلاق.|

## تنبيهات
- أي بند عليه * ولم يُؤكَّد = الميزة المرتبطة به مقفولة بنضافة (لا تظهر في checkout ولا تسبب crash).
- الأسرار (مفاتيح البوابات/الشحن/ETA) تُخزن مشفرة ولا تظهر كاملة لأي مستخدم.
