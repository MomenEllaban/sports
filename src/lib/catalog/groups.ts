/**
 * Variant display families (T07): SKUs stay independent (stock/pricing per
 * SKU), but the storefront groups siblings for size/color picking.
 * Family key = SKU minus trailing variant segments (sizes, numeric indices
 * like -00/-42, weights like 10oz). Brand/model segments are kept.
 */
const VARIANT_TOKEN = /^(\d+[a-z]*|[a-z]*\d+|xxxs|xxs|xs|s|m|l|xl|xxl|xxxl|\d+oz)$/i;

export function groupSlugForSku(sku: string): string {
  const parts = sku.split('-');
  let end = parts.length;
  while (end > 1 && VARIANT_TOKEN.test(parts[end - 1])) end--;
  if (end === parts.length) return sku.toLowerCase(); // single-SKU model
  return parts.slice(0, end).join('-').toLowerCase();
}

export interface VariantOption {
  id: string;
  size: string | null;
  color: string | null;
  price: number;
  stock: number;
}

export function sizesOf(variants: VariantOption[]): string[] {
  const out: string[] = [];
  for (const v of variants) if (v.size && !out.includes(v.size)) out.push(v.size);
  return out;
}

export function colorsOf(variants: VariantOption[]): string[] {
  const out: string[] = [];
  for (const v of variants) if (v.color && !out.includes(v.color)) out.push(v.color);
  return out;
}

/** Find the sibling SKU matching a size/color pick (exact match wins). */
export function pickVariant(variants: VariantOption[], size: string | null, color: string | null): VariantOption | null {
  const exact = variants.find((v) => (v.size || null) === (size || null) && (v.color || null) === (color || null));
  if (exact) return exact;
  if (size) {
    const bySize = variants.find((v) => v.size === size);
    if (bySize) return bySize;
  }
  if (color) {
    const byColor = variants.find((v) => v.color === color);
    if (byColor) return byColor;
  }
  return variants[0] || null;
}
