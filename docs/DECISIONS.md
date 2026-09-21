# DECISIONS — سجل القرارات (الأمن افتراضياً)

## F0
1. **تشفير الأسرار بـ AES-256-GCM في Settings** بدل `.env` فقط — لأن العميل سيدير المفاتيح من الـ UI. بدون `SETTINGS_ENCRYPTION_KEY` في production: رفض صريح (fail-closed)؛ وفي dev: `plain:` موسوم للترحيل.
2. **قيم seed الجديدة `DEFAULT_UNCONFIRMED`** — أي افتراضي من عندنا يحتاج تأكيد أدمن عبر `/admin/settings/setup` قبل اعتباره نهائياً.
3. **Paymob/Fawry/Bosta مخفية بدون مفاتيح** — لا روابط وهمية في production؛ `provider=mock` للتجارب فقط (يُطبق في T01–T03).
4. **envelope `{v, _confirmed}`** للقيم المؤكدة — يحافظ على توافق القرّاء القدامى عبر unwrap في `getSetting`.
5. **إخفاء الأسرار في GET** (`masked` آخر 4 أحرف) — الـ UI يرسل blank للإبقاء، وقيمة جديدة للاستبدال.
6. **اختبار integration محلياً معطّل (DB)** — البوابة تُستكمل في CI؛ الوحدات والـ static gates خضراء محلياً.
