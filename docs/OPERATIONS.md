# OPERATIONS — التشغيل والنسخ الاحتياطي (F1)

## البيئات
- **Production:** Vercel + Neon PostgreSQL (`DATABASE_URL`). متغيرات البيئة في Vercel فقط — ممنوع commit لأي secret.
- **Staging (مطلوب قبل T14):** مشروع Vercel ثانٍ + فرع Neon منفصل + `ETA mode=preprod` + بوابات sandbox.

## النسخ الاحتياطي (Neon)
- فعّل Point-in-Time Recovery من لوحة Neon (احتفاظ 7 أيام على الأقل).
- قبل أي migration خطيرة: خذ branch نسخة (`neon branches create --name pre-<date>`).
- الاسترجاع: `psql $DATABASE_URL < backup.sql` أو restore للـ branch.

## المتغيرات (Vercel → Settings)
| env | الغرض |
|---|---|
| `DATABASE_URL` / `DIRECT_URL` | اتصال Neon |
| `NEXTAUTH_SECRET` | جلسات الموظفين |
| `SETTINGS_ENCRYPTION_KEY` | تشفير أسرار Settings (32 بايت base64) — بدونه الأسرار لا تُخزن في production |
| `SENTRY_DSN` (اختياري) | مراقبة الأخطاء عبر `src/lib/monitor.ts` |
| بوابات الدفع/الشحن | تُدار من `/admin/settings` (مشفرة)، والـ env fallback للطوارئ فقط |

## الوظائف المجدولة
- `pnpm orders:expire` — إلغاء الطلبات الإلكترونية غير المدفوعة بعد `orders.unpaidExpiryHours` + تنبيه تسوية. شغّلها كل ساعة (Vercel Cron أو systemd timer).
- `pnpm refunds:process` — إعادة محاولة الاستردادات العالقة (T10). كل 10 دقائق.
- `pnpm eta:retry` — إعادة إرسال الإيصالات الفاشلة (T14). كل ساعة.
- `GET /api/health` — فحص حياة (DB ping). اربطه بأي uptime monitor.

## معدل الطلبات
- حماية in-process (`src/lib/rate-limit.ts`) للتتبع/البورتال/الرفع. في production فعّل throttling على مستوى Vercel/Edge أمامها.
