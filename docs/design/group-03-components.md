# Group 03 — Core Components — Done

Commit: `b57cdad` — Status: Done (verified 2026-09-23).

## ما تم
- [x] `Button` موحد (`btnBaseCls`/`btnVariants`, tokens, 44px)
- [x] `inputCls` + `Field` موحد (8 managers + admin/ui على class واحد)
- [x] `Modal` واحد (Escape/focus/scroll-lock) + `ConfirmDialog` a11y — المكرر في admin اتشال
- [x] Toast واحد فقط: `@/components/Toast` هو المصدر (المكرر في foundation اتشال)
- [x] `StatusBadge` في admin/ui + `EmptyState` + `Skeleton`

## ملاحظات
- ممنوع إنشاء Modal/Toast/Input جديد — استخدم الموجود في `foundation.tsx` و`admin/ui.tsx`.
