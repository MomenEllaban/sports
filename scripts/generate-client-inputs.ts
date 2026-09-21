/**
 * pnpm docs:client-inputs — generates docs/CLIENT_INPUTS.md from the
 * settings registry (F0 §1.1). Hand this document to the client.
 */
import { writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SETTINGS_REGISTRY, SETUP_GROUPS } from '../src/lib/settings-registry.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out: string[] = [];
out.push('# المطلوب من العميل (CLIENT_INPUTS)');
out.push('');
out.push('> مولّد تلقائياً من `src/lib/settings-registry.ts` عبر `pnpm docs:client-inputs`. لا تعدّل يدوياً.');
out.push('');
out.push('| البند | المجموعة | إلزامي | المسؤول | القيمة الافتراضية | ملاحظات |');
out.push('|---|---|---|---|---|---|');

for (const g of SETUP_GROUPS) {
  for (const d of SETTINGS_REGISTRY.filter((x) => x.group === g.id)) {
    const def = d.defaultValue === '' || d.defaultValue === undefined ? '— (فارغ: الميزة مقفولة)' : `\`${JSON.stringify(d.defaultValue)}\``;
    out.push(`| ${d.labelAr} (\`${d.key}\`) | ${g.ar} | ${d.required ? 'نعم' : 'لا'} | ${d.owner} | ${def} | ${d.helpAr}${d.example ? ` مثال: \`${d.example}\` ` : ''}|`);
  }
}

out.push('');
out.push('## تنبيهات');
out.push('- أي بند عليه * ولم يُؤكَّد = الميزة المرتبطة به مقفولة بنضافة (لا تظهر في checkout ولا تسبب crash).');
out.push('- الأسرار (مفاتيح البوابات/الشحن/ETA) تُخزن مشفرة ولا تظهر كاملة لأي مستخدم.');
out.push('');
writeFileSync(join(root, 'docs', 'CLIENT_INPUTS.md'), out.join('\n'), 'utf8');
console.log(`docs/CLIENT_INPUTS.md generated (${SETTINGS_REGISTRY.length} keys).`);
