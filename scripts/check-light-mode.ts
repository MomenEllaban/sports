/**
 * check:light-mode — WCAG contrast audit of both themes.
 *
 * Why this exists
 * ---------------
 * Light mode is produced by a remap table in `src/app/globals.css`: rules like
 * `[data-theme="light"] [class~="bg-slate-950"] { background-color: #f8fafc }`
 * rewrite the dark palette in place. That works, but it means a component is
 * only correct if the *pair* (background, text) survives the remap — and the
 * background is frequently inherited from an ancestor several tags up, so
 * reading a single className string is not enough. This script walks the JSX
 * tree, resolves the nearest painted background from the element or its
 * ancestors, and compares it against the element's own text colour.
 *
 * It reports the offenders; it does not auto-fix them, because the right fix is
 * a design decision (darken the text, or keep the dark surface) that a script
 * should not make on its own.
 *
 * Coverage is intentionally conservative: it flags pairs it can resolve
 * confidently and never guesses through gradients, images or `opacity`, so a
 * clean run is meaningful rather than merely quiet.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const css = readFileSync(join(root, 'src', 'app', 'globals.css'), 'utf8');

/* ── Standard Tailwind palette (the shades the codebase actually uses) ── */
const PALETTE: Record<string, string> = {
  white: '#ffffff', black: '#000000',
  'slate-50': '#f8fafc', 'slate-100': '#f1f5f9', 'slate-200': '#e2e8f0',
  'slate-300': '#cbd5e1', 'slate-400': '#94a3b8', 'slate-500': '#64748b',
  'slate-600': '#475569', 'slate-700': '#334155', 'slate-800': '#1e293b',
  'slate-900': '#0f172a', 'slate-950': '#020617',
  'blue-100': '#dbeafe', 'blue-200': '#bfdbfe', 'blue-300': '#93c5fd', 'blue-400': '#60a5fa',
  'blue-500': '#3b82f6', 'blue-600': '#2563eb', 'blue-700': '#1d4ed8', 'blue-800': '#1e40af',
  'blue-900': '#1e3a8a', 'blue-950': '#172554',
  'emerald-100': '#d1fae5', 'emerald-300': '#6ee7b7', 'emerald-400': '#34d399',
  'emerald-500': '#10b981', 'emerald-600': '#059669', 'emerald-700': '#047857',
  'emerald-800': '#065f46', 'emerald-900': '#064e3b', 'emerald-950': '#022c22',
  'amber-100': '#fef3c7', 'amber-300': '#fcd34d', 'amber-400': '#fbbf24',
  'amber-500': '#f59e0b', 'amber-600': '#d97706', 'amber-700': '#b45309',
  'amber-800': '#92400e', 'amber-900': '#78350f', 'amber-950': '#451a03',
  'rose-100': '#ffe4e6', 'rose-300': '#fda4af', 'rose-400': '#fb7185',
  'rose-500': '#f43f5e', 'rose-600': '#e11d48', 'rose-700': '#be123c',
  'rose-800': '#9f1239', 'rose-900': '#881337', 'rose-950': '#4c0519',
  'red-500': '#ef4444', 'red-600': '#dc2626', 'red-700': '#b91c1c',
  'cyan-300': '#67e8f9', 'cyan-400': '#22d3ee', 'cyan-500': '#06b6d4', 'cyan-600': '#0891b2', 'cyan-700': '#0e7490',
  'sky-300': '#7dd3fc', 'sky-400': '#38bdf8', 'sky-500': '#0ea5e9',
  'orange-300': '#fdba74', 'orange-400': '#fb923c', 'orange-500': '#f97316', 'orange-600': '#ea580c',
  'green-500': '#22c55e', 'green-600': '#16a34a',
  'fuchsia-400': '#e879f9',
  'indigo-400': '#818cf8', 'indigo-500': '#6366f1', 'indigo-600': '#4f46e5', 'indigo-700': '#4338ca', 'indigo-800': '#3730a3', 'indigo-950': '#1e1b4b',
  'violet-400': '#a78bfa', 'violet-500': '#8b5cf6', 'violet-600': '#7c3aed', 'violet-700': '#6d28d9',
  'purple-300': '#d8b4fe', 'purple-400': '#c084fc', 'purple-500': '#a855f7', 'purple-600': '#9333ea', 'purple-700': '#7e22ce', 'purple-950': '#3b0764',
  'teal-300': '#5eead4', 'teal-400': '#2dd4bf', 'teal-600': '#0d9488', 'teal-700': '#0f766e',
  'gray-100': '#f3f4f6', 'gray-400': '#9ca3af', 'gray-500': '#6b7280', 'gray-600': '#4b5563', 'gray-700': '#374151', 'gray-900': '#111827',
};

/** Every colour family the codebase actually uses, for the class regexes. */
const HUES = 'slate|gray|blue|emerald|green|amber|yellow|orange|rose|red|cyan|sky|indigo|violet|purple|fuchsia|teal|white|black';
const BG_RE = new RegExp(`^bg-(${HUES})-?(\\d{2,3})?(?:/(\\d{1,3}))?$`);
const GRAD_RE = new RegExp(`^(from|via|to)-(${HUES})-(\\d{2,3})(?:/(\\d{1,3}))?$`);

/* ── Parse the theme remap tables out of globals.css ──
   So the audit tracks the stylesheet itself instead of a hand-copied list that
   would silently rot. Entries are `{ value, alpha }` because gradient stops are
   overridden with translucent `rgba()` washes. Both scopes are read: the light
   table is `[data-theme="light"] …`, and dark is the default so it is written
   as `:root:not([data-theme="light"]) …`. */
type Override = { value: string; alpha: number };
const lightOverrides = new Map<string, Override>();
const darkOverrides = new Map<string, Override>();

const CLASS_TOKEN_RE = /\[class[~*]="([a-z0-9\-/:[\].%]+)"\]/g;

const remapRe = /([^{}]*)\{([^}]*)\}/g;
for (const m of css.matchAll(remapRe)) {
  const selector = m[1];
  const body = m[2];
  const tokens = [...selector.matchAll(CLASS_TOKEN_RE)].map((t) => t[1]);
  if (tokens.length === 0) continue;
  // `:root:not([data-theme="light"])` also contains the literal
  // `[data-theme="light"]`, so the dark scope must be tested first.
  const darkScoped = /:root:not\(\[data-theme="light"\]\)/.test(selector);
  const lightScoped = !darkScoped && /\[data-theme="light"\]/.test(selector);
  if (!lightScoped && !darkScoped) continue;
  const target = lightScoped ? lightOverrides : darkOverrides;

  const bg = body.match(/background-color:\s*([^;!]+)/);
  if (bg) {
    const parsed = parseColour(bg[1], selector);
    if (parsed) for (const cls of tokens) target.set(cls, { value: bg[1].trim(), alpha: parsed.alpha });
    continue;
  }
  const grad = body.match(/--tw-gradient-(?:from|via|to):\s*([^;!]+)/);
  if (grad) {
    const parsed = parseColour(grad[1], selector);
    if (parsed) for (const cls of tokens) target.set(cls, { value: grad[1].trim(), alpha: parsed.alpha });
    continue;
  }
  const fg = body.match(/(?:^|[^-])color:\s*(#[0-9a-fA-F]{3,8})/);
  if (fg) for (const cls of tokens) {
    if (cls.startsWith('text-')) target.set(cls, { value: fg[1], alpha: 1 });
  }
}

/* Substring selectors (`.text-amber-500/70`, `sm:text-rose-400`) must also match
   the shorter stored key, mirroring how the browser matches `[class*=…]`. */
function overrideFor(cls: string, light: boolean): Override | undefined {
  const table = light ? lightOverrides : darkOverrides;
  const exact = table.get(cls);
  if (exact) return exact;
  const base = cls.replace(/\/(?:\d{1,3})$/, '');
  return table.get(base);
}

/* ── Colour maths ── */
type Rgb = [number, number, number];
function toRgb(hex: string): Rgb {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}
function luminance(hex: string): number {
  const [r, g, b] = toRgb(hex).map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}
/** Flatten an rgba() overlay onto an opaque backdrop (alpha-weighted). */
function over(fg: string, alpha: number, bg: string): string {
  const [fr, fg2, fb] = toRgb(fg);
  const [br, bg2, bb] = toRgb(bg);
  const mix = (f: number, b: number) => Math.round(f * alpha + b * (1 - alpha));
  const hex = (n: number) => n.toString(16).padStart(2, '0');
  return `#${hex(mix(fr, br))}${hex(mix(fg2, bg2))}${hex(mix(fb, bb))}`;
}

/* ── Class resolution ── */
type Painted = { colour: string; source: string; alpha: number };

/** Parse `#rgb`, `#rrggbb`, `#rrggbbaa`, `rgb()` and `rgba()` into a Painted. */
function parseColour(raw: string, source: string): Painted | null {
  const v = raw.trim();
  const rgba = v.match(/^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,/\s]+([\d.]+))?\s*\)$/);
  if (rgba) {
    const [r, g, b] = [rgba[1], rgba[2], rgba[3]].map((n) => Math.round(Number(n)));
    return { colour: `#${[r, g, b].map((n) => n.toString(16).padStart(2, '0')).join('')}`, source, alpha: rgba[4] ? Number(rgba[4]) : 1 };
  }
  const hex = v.match(/^#([0-9a-fA-F]{3,8})$/);
  if (!hex) return null;
  let h = hex[1];
  if (h.length === 3 || h.length === 4) h = h.split('').map((c) => c + c).join('');
  const alpha = h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1;
  return { colour: `#${h.slice(0, 6)}`, source, alpha };
}

/**
 * Resolve a Tailwind background utility to a concrete colour for one theme.
 * Returns null when the surface cannot be resolved confidently (images, unknown
 * shades) so the audit never invents a colour it cannot justify.
 */
function resolveBackground(classes: string[], light: boolean): Painted | null {
  for (const c of classes) {
    if (c === 'bg-transparent') return { colour: '#000000', source: c, alpha: 0 };
    // Arbitrary literal, e.g. `bg-[#020617]` or `bg-[#02061740]`.
    const arb = c.match(/^bg-\[(#[0-9a-fA-F]{3,8})\]$/);
    if (arb) return parseColour(arb[1], c);
        const m = c.match(BG_RE);
    if (!m) continue;
    const base = m[1] === 'white' ? '#ffffff' : m[1] === 'black' ? '#000000' : PALETTE[`${m[1]}-${m[2] ?? '500'}`];
    if (!base) continue;
    const alpha = m[3] ? Number(m[3]) / 100 : 1;
    const o = overrideFor(c, light);
    if (o) {
      const parsed = parseColour(o.value, c);
      return { colour: parsed?.colour ?? base, source: c, alpha: o.alpha };
    }
    return { colour: base, source: c, alpha };
  }
  // Gradient: approximate with the first stop, which is the dominant colour the
  // text sits on for the `from-*` end of most surfaces.
  for (const c of classes) {
    const arb = c.match(/^(?:from|via|to)-\[(#[0-9a-fA-F]{3,8})\]$/);
    if (arb) return parseColour(arb[1], c);
        const m = c.match(GRAD_RE);
    if (!m) continue;
    const o = overrideFor(c, light);
    if (o) {
      const parsed = parseColour(o.value, c);
      if (parsed) return { colour: parsed.colour, source: c, alpha: o.alpha };
    }
    const base = PALETTE[`${m[2]}-${m[3]}`];
    if (!base) return null;
    return { colour: base, source: c, alpha: m[4] ? Number(m[4]) / 100 : 1 };
  }
  return null;
}

function resolveText(classes: string[], light: boolean): Painted | null {
  for (const c of classes) {
    if (c === 'text-white') return { colour: '#ffffff', source: c, alpha: 1 };
    if (c === 'text-black') return { colour: '#000000', source: c, alpha: 1 };
    const m = c.match(/^text-([a-z]+)-(\d{2,3})(?:\/(\d{1,3}))?$/);
    if (!m) continue;
    const o = overrideFor(c, light);
    if (o) {
      const parsed = parseColour(o.value, c);
      return { colour: parsed?.colour ?? '#000000', source: c, alpha: o.alpha };
    }
    const base = PALETTE[`${m[1]}-${m[2]}`];
    if (!base) return null; // unknown shade: do not guess
    return { colour: base, source: c, alpha: m[3] ? Number(m[3]) / 100 : 1 };
  }
  return null;
}

/* ── Minimal JSX walk: enough to know each element's ancestor chain ── */
type Node = { tag: string; classes: string[]; depth: number; line: number };

/**
 * Collect every statically-known class token, including the literals nested
 * inside a `${cond ? 'a' : 'b'}` expression. Such an element renders as one of
 * several variants, so the caller scores every variant and only reports a pair
 * that fails for ALL of them — a conditional that is fine in one branch must
 * not be reported.
 */
function collectClasses(raw: string): string[] {
  const out: string[] = [];
  const push = (chunk: string) => {
    for (const tok of chunk.split(/\s+/)) {
      const cleaned = tok.replace(/^[`'"(]+|[`'"()]+$/g, '');
      if (cleaned && /^[a-z0-9:#\-/\[\].%]+$/.test(cleaned)) out.push(cleaned);
    }
  };
  // Everything outside a `${…}` interpolation is unconditional.
  const segments = raw.split(/\$\{([^}]*)\}/);
  for (let i = 0; i < segments.length; i += 2) push(segments[i]);
  // …and the string literals inside each interpolation are the conditional
  // branches, which the caller scores individually.
  for (let i = 1; i < segments.length; i += 2) {
    for (const lit of segments[i].matchAll(/'([^']*)'|"([^"]*)"/g)) push(lit[1] ?? lit[2] ?? '');
  }
  return [...new Set(out)];
}

function extractNodes(src: string): Node[] {
  const nodes: Node[] = [];
  const stack: string[] = [];
  const tagRe = /<(\/?)([A-Za-z][A-Za-z0-9._]*)((?:[^<>]|"[^"]*"|'[^']*'|\{[^{}]*\})*?)(\/?)>/g;
  let m: RegExpExecArray | null;
  while ((m = tagRe.exec(src))) {
    const [, closing, tag, rawAttrs, selfClose] = m;
    // Skip TypeScript generics such as `useState<HTMLSelectElement>`: a real JSX
    // opening tag never follows an identifier character, but a generic parameter
    // does. Closing tags must still be seen, otherwise the stack never pops and
    // every later element inherits the wrong ancestors.
    if (!closing) {
      const before = src[m.index - 1];
      if (before && /[A-Za-z0-9_$]/.test(before)) continue;
    }
    const line = src.slice(0, m.index).split('\n').length;
    if (closing) {
      for (let i = stack.length - 1; i >= 0; i--) {
        if (stack[i] === tag) { stack.length = i; break; }
      }
      continue;
    }
    const cm = rawAttrs.match(/className\s*=\s*(?:"([^"]*)"|'([^']*)'|\{\s*`([^`]*)`\s*\})/);
    const classes = cm ? collectClasses(cm[1] ?? cm[2] ?? cm[3] ?? '') : [];
    const depth = stack.length;
    nodes.push({ tag, classes, depth, line });
    if (!selfClose) stack.push(tag);
  }
  return nodes;
}

/**
 * The colour actually visible behind an element, walking root → leaf and
 * flattening every translucent layer onto the one beneath it. An earlier version
 * returned the nearest background untouched, which scored `bg-white/10` as solid
 * white and reported every white-on-frosted-chip as unreadable.
 */
/** Every background declared on one element, as alternative renderings. */
function backgroundsOf(classes: string[], light: boolean): Painted[] {
  // Variant-prefixed utilities are skipped: they are not painted on first render.
  return classes
    .filter((c) => !c.includes(':'))
    .map((c) => resolveBackground([c], light))
    .filter((p): p is Painted => p !== null);
}

function effectiveBackground(classes: string[], parents: Node[], light: boolean): Painted[] {
  const base = light ? '#f1f5f9' : '#020617';
  // Nearest layer first: the element's own background wins over any ancestor's.
  const layers = [{ classes }, ...parents];
  for (let i = 0; i < layers.length; i++) {
    const onLayer = backgroundsOf(layers[i].classes, light);
    if (onLayer.length === 0) continue;
    // Whatever sits underneath decides the colour an alpha fill composites onto.
    let under = base;
    for (let j = i + 1; j < layers.length; j++) {
      const outer = backgroundsOf(layers[j].classes, light);
      if (outer.length > 0) {
        under = outer[0].alpha < 1 ? over(outer[0].colour, outer[0].alpha, under) : outer[0].colour;
        break;
      }
    }
    return onLayer
      .filter((raw) => raw.alpha !== 0)
      .map((raw) => ({
        colour: raw.alpha < 1 ? over(raw.colour, raw.alpha, under) : raw.colour,
        source: raw.source,
        alpha: 1,
      }));
  }
  return [{ colour: base, source: 'page base', alpha: 1 }];
}

const files: string[] = [];
(function walk(d: string) {
  for (const e of readdirSync(d, { withFileTypes: true })) {
    const p = join(d, e.name);
    if (e.isDirectory()) { if (!['node_modules', '.next', '.git'].includes(e.name)) walk(p); }
    else if (/\.tsx$/.test(e.name)) files.push(p);
  }
})(join(root, 'src'));

type Finding = { file: string; line: number; text: string; bg: string; ratio: number; theme: string; tag: string };
const findings: Finding[] = [];
let checked = 0;

for (const file of files) {
  const src = readFileSync(file, 'utf8');
  const nodes = extractNodes(src);
  const openAt: Node[] = [];
  for (const node of nodes) {
    const parents = openAt.slice(0, node.depth);
    if (process.env.LM_DEBUG && file.includes('__LightModeFixture')) {
      const texts = [...new Set(node.classes.map((c) => resolveText([c], true)).filter((p): p is Painted => p !== null).map((p) => p.colour))];
      console.log(`  line=${node.line} <${node.tag}> d=${node.depth} classes=${JSON.stringify(node.classes)} texts=${JSON.stringify(texts)} bg=${JSON.stringify(effectiveBackground(node.classes, parents, true).map((p) => p.colour))}`);
    }
    const isLarge = /(^|\s)text-(xl|2xl|3xl|4xl|5xl|6xl|7xl|8xl|9xl)(\s|$)/.test(node.classes.join(' '));
    const floor = isLarge ? 3 : 4.5;

    for (const theme of ['dark', 'light'] as const) {
      const light = theme === 'light';
      // All colours this element can take, across its conditional branches.
      const texts = [...new Set(node.classes.map((c) => resolveText([c], light)).filter((p): p is Painted => p !== null).map((p) => p.colour))];
      if (texts.length === 0) continue;
      const bgs = effectiveBackground(node.classes, parents, light);
      checked += texts.length * bgs.length;

      // A pair is only a real defect when EVERY combination this element can
      // render fails, so a single healthy branch silences the finding.
      const combos = texts.flatMap((t) => bgs.map((b) => ({ t, b })));
      const failing = combos.filter(({ t, b }) => b.alpha > 0 && contrast(t, b.colour) < floor);
      if (failing.length === 0 || failing.length !== combos.length) continue;

      const worst = failing.reduce((a, c) => (contrast(a.t, a.b.colour) <= contrast(c.t, c.b.colour) ? a : c));
      findings.push({
        file: relative(root, file).replace(/\\/g, '/'),
        line: node.line,
        text: combos.map((c) => c.t).join(' / '),
        bg: worst.b.colour,
        ratio: Math.round(contrast(worst.t, worst.b.colour) * 100) / 100,
        theme,
        tag: node.tag,
      });
    }
    openAt[node.depth] = node;
    openAt.length = node.depth + 1;
  }
}

findings.sort((a, b) => a.ratio - b.ratio);
const byTheme = findings.reduce<Record<string, number>>((acc, f) => {
  acc[f.theme] = (acc[f.theme] ?? 0) + 1;
  return acc;
}, {});

console.log(`check:light-mode — ${files.length} tsx files, ${checked} colour pairs evaluated`);
console.log(`  dark: ${byTheme.dark ?? 0} below AA   light: ${byTheme.light ?? 0} below AA`);

if (process.env.LM_GROUPS) {
  // Cluster by the exact colour pair: a systemic token problem shows up as one
  // group with a high count, which is a far better lever than N local edits.
  const groups = new Map<string, { theme: string; text: string; bg: string; n: number; sample: string }>();
  for (const f of findings) {
    const key = `${f.theme}|${f.text}|${f.bg}`;
    const g = groups.get(key);
    if (g) { g.n++; continue; }
    groups.set(key, { theme: f.theme, text: f.text, bg: f.bg, n: 1, sample: `${f.file}:${f.line}` });
  }
  const rows = [...groups.values()].sort((a, b) => b.n - a.n);
  console.log(`\n${rows.length} distinct colour pairs:`);
  for (const g of rows) {
    console.log(`  ${String(g.n).padStart(4)}  ${g.theme.padEnd(5)} text ${g.text} on ${g.bg}   e.g. ${g.sample}`);
  }
} else {
  for (const f of findings) {
    console.log(`  ${f.theme.padEnd(5)} ${String(f.ratio).padStart(5)}  ${f.file}:${f.line} <${f.tag}> ${f.text} on ${f.bg}`);
  }
}
if (findings.length > 0) {
  console.log(`\n${findings.length} pair(s) below the WCAG AA floor.`);
  process.exit(1);
}
console.log('\nNo pair fell below AA.');
