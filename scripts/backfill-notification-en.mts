/**
 * Backfills notifications whose `messageEn` was written as a copy of the Arabic
 * text (the returns service used to pass `messageEn: messageAr`).
 *
 * Only rows where the two columns are byte-identical are touched, so anything
 * already translated is left alone. The replacement is derived from the known
 * returns templates; rows that match no template are reported and skipped
 * rather than guessed at.
 *
 * Run with: npx tsx scripts/backfill-notification-en.mts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/** [Arabic pattern, English template]; `$1`, `$2`, ... are capture groups. */
const TEMPLATES: Array<[RegExp, string]> = [
  [/^تم استلام طلب المرتجع (\S+) وجارٍ المراجعة\.$/, 'Return request $1 received and now under review.'],
  [/^تم اعتماد المرتجع (\S+)\. الخطوة التالية: تسليم الأصناف لفرع الاستلام\.$/, 'Return $1 approved. Next step: hand the items to the pickup branch.'],
  [/^تم رفض طلب المرتجع (\S+):\s*(.*)$/, 'Return request $1 rejected: $2'],
  [/^تم استلام مرتجعك (\S+) — جارٍ إصدار الاسترداد \(([\d.]+) ج\.م\)\.$/, 'Your return $1 was received — the refund is being issued (EGP $2).'],
  [/^تم الاسترداد ([\d.]+) ج\.م للمرتجع (\S+) \((.*)\)\.$/, 'Refund of EGP $1 issued for return $2 ($3).'],
];

const all = await prisma.notification.findMany({ select: { id: true, messageAr: true, messageEn: true } });
const identical = all.filter((n) => n.messageEn === n.messageAr && /[\u0600-\u06FF]/.test(n.messageAr));

let updated = 0;
const skipped = new Set<string>();
for (const row of identical) {
  let replacement: string | null = null;
  for (const [pattern, template] of TEMPLATES) {
    const match = row.messageAr.match(pattern);
    if (match) {
      replacement = template.replace(/\$(\d)/g, (_, i: string) => match[Number(i)] ?? '');
      break;
    }
  }
  if (!replacement) {
    skipped.add(row.messageAr);
    continue;
  }
  await prisma.notification.update({ where: { id: row.id }, data: { messageEn: replacement } });
  updated += 1;
}

console.log(`total notifications      : ${all.length}`);
console.log(`identical AR/EN rows     : ${identical.length}`);
console.log(`backfilled to English    : ${updated}`);
if (skipped.size) {
  console.log(`skipped (no known template): ${skipped.size}`);
  for (const s of [...skipped].slice(0, 10)) console.log(`  - ${s}`);
}

await prisma.$disconnect();
