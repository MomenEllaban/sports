# Task 06 — Server-authoritative pricing and discounts (DONE)

## RED ثم GREEN
- RED: حقول `managerPinHash`/`approvedById` غير موجودة (Prisma validation) + سلوك قديم يقبل أي خصم.
- GREEN: `pos-discount` (7/7) + الكل 32/32.

## ما تم
- Migration `3_discount_auth`: `User.managerPinHash/pinFailedAttempts/pinLockedUntil` + `Sale.approvedById`.
- `src/lib/pos/discount.ts`: `authorizeDiscount` (عتبة من settings ببديل 100) + `setManagerPin` + قفل 15 دقيقة بعد 5 محاولات على حساب الطالب.
- `pos/sale`: ثلاث مراحل (تحقق بلا كتابة → خصم واعتماد → كتابة). سعر العميل مُتجاهل (DB فقط). كميات صحيحة موجبة فقط. خصم 음ي/NaN/أكبر من المجموع مرفوض. `approvedById` محفوظ. PIN يُقبل من أي مدير نشط، والمسجل هو صاحب الـ PIN (أو BM/SA نفسه).
- العميل: `posStore.applyDiscount` بلا PIN مكتوب (السيرفر يقرر) + إرسال `managerPin` + إزالة تلميح 1234.
- SUPER_ADMIN يعيّن PIN من نافذة المستخدم (API + UI، تحقق 4-8 أرقام).
- Seed: PINs مشفرة للمديرين (ibrahimeyah 1234 / smouha 9999).

## ملاحظات
- T09 سينقل الحسابات إلى `pricing.ts` المشترك؛ الوحدة الحالية متوافقة مع نفس الدلالات (exclusive).
- القفل per-actor وليس per-PIN (موثق كقرار: أبسط وأمن ضد التخمين الموزع على الحساب الواحد).
