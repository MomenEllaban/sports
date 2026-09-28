/**
 * Storefront CMS contract — the single source of truth for the editable
 * storefront content, shared by the admin editor and the customer-facing pages.
 *
 * Why this module exists
 * ----------------------
 * The editor used to save through `PUT /api/admin/settings`, but that route
 * accepts only the keys in `REGISTRY_KEYS` (scalar business values surfaced in
 * the Settings screen). `cms.announcement` and `cms.heroBanners` were never
 * registered, so every save returned 400 "Setting is not editable" — and the
 * storefront hardcoded its hero anyway, so nothing was ever read back. Content
 * editing was broken at both ends.
 *
 * Everything stored under these keys is admin-supplied text that gets rendered
 * to every visitor, so it is normalised and length-capped here rather than
 * trusted at the point of use.
 */

import { prisma } from '@/lib/db';
import { parseStored } from '@/lib/settings-registry';
import { setSetting, clearSettingsCache } from '@/lib/settings';
import { cache } from 'react';

export const CMS_ANNOUNCEMENT_KEY = 'cms.announcement';
export const CMS_HERO_BANNERS_KEY = 'cms.heroBanners';

/** Upper bounds keep a single Setting row from bloating every storefront page. */
export const MAX_BANNERS = 8;
const MAX_TITLE = 140;
const MAX_SUBTITLE = 320;
const MAX_BADGE = 48;
const MAX_ANNOUNCEMENT = 200;
const MAX_CTA_TEXT = 40;
const MAX_URL = 2048;

export interface HeroBanner {
  id: string;
  titleAr: string;
  titleEn: string;
  subtitleAr: string;
  subtitleEn: string;
  ctaTextAr: string;
  ctaTextEn: string;
  ctaLink: string;
  imageUrl: string;
  badgeAr: string;
  badgeEn: string;
  isActive: boolean;
}

export interface AnnouncementSettings {
  enabled: boolean;
  textAr: string;
  textEn: string;
  link: string;
}

const str = (value: unknown, max: number): string =>
  typeof value === 'string' ? value.trim().slice(0, max) : '';

/**
 * Accepts only site-relative paths. Anything else (`javascript:`, `data:`,
 * protocol-relative `//evil.com`, absolute off-site URLs) is dropped, because
 * these values are rendered as href targets for every visitor.
 */
export function safeCmsLink(value: unknown): string {
  const raw = str(value, MAX_URL);
  if (!raw || !raw.startsWith('/') || raw.startsWith('//')) return '';
  // A backslash is treated as a path separator by some browsers, so `/\evil.com`
  // would escape the site just like a protocol-relative URL.
  if (raw.includes('\\')) return '';
  return raw;
}

/** Only http(s) images, so an admin cannot inject a `javascript:` background. */
function safeImageUrl(value: unknown): string {
  const raw = str(value, MAX_URL);
  if (!raw) return '';
  try {
    const parsed = new URL(raw);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.toString() : '';
  } catch {
    return '';
  }
}

/**
 * Coerces one stored/edited record into a renderable banner. A banner missing
 * a title in the active locale is dropped by `readHeroBanners` rather than
 * rendering an empty slide.
 */
function normaliseBanner(input: unknown, index: number): HeroBanner {
  const o = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
  const id = str(o.id, 64) || `banner-${index + 1}`;
  return {
    id,
    titleAr: str(o.titleAr, MAX_TITLE),
    titleEn: str(o.titleEn, MAX_TITLE),
    subtitleAr: str(o.subtitleAr, MAX_SUBTITLE),
    subtitleEn: str(o.subtitleEn, MAX_SUBTITLE),
    ctaTextAr: str(o.ctaTextAr, MAX_CTA_TEXT),
    ctaTextEn: str(o.ctaTextEn, MAX_CTA_TEXT),
    ctaLink: safeCmsLink(o.ctaLink),
    imageUrl: safeImageUrl(o.imageUrl),
    badgeAr: str(o.badgeAr, MAX_BADGE),
    badgeEn: str(o.badgeEn, MAX_BADGE),
    isActive: o.isActive !== false,
  };
}

export const DEFAULT_ANNOUNCEMENT: AnnouncementSettings = {
  enabled: true,
  textAr: 'شحن مجاني على جميع الطلبات فوق 1000 جنيه لفترة محدودة!',
  textEn: 'Free shipping on all orders over 1000 EGP for a limited time!',
  // The storefront catalogue lives at /catalog; the old default pointed at
  // /products, which does not exist and 404s.
  link: '/catalog',
};

export const DEFAULT_BANNERS: HeroBanner[] = [
  {
    id: 'banner-default',
    titleAr: 'أحدث التشكيلات الرياضية العالمية',
    titleEn: 'Latest World Sports Collections',
    subtitleAr: 'خصومات حصرية على أحذية الجري وملابس التدريب الأصلية من أشهر الماركات العالمية',
    subtitleEn: 'Exclusive discounts on genuine running shoes and training apparel from the world’s best-known brands',
    ctaTextAr: 'تسوق الآن',
    ctaTextEn: 'Shop Now',
    ctaLink: '/catalog',
    imageUrl: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=1600&q=80',
    badgeAr: 'تخفيضات الموسم',
    badgeEn: 'Season Sale',
    isActive: true,
  },
];

export function normaliseBanners(input: unknown, locale: 'ar' | 'en'): HeroBanner[] {
  if (!Array.isArray(input)) return [];
  return input
    .slice(0, MAX_BANNERS)
    .map(normaliseBanner)
    .filter((b) => b.isActive && (locale === 'ar' ? b.titleAr : b.titleEn).length > 0);
}

/**
 * Cached per request. Content changes are rare and every storefront page reads
 * these, so one `Setting` round-trip per key per render is enough.
 */
export const readAnnouncement = cache(async (): Promise<AnnouncementSettings> => {
  const row = await prisma.setting.findUnique({
    where: { key: CMS_ANNOUNCEMENT_KEY },
    select: { value: true },
  });
  const parsed = row ? parseStored(row.value, null).value : null;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { ...DEFAULT_ANNOUNCEMENT };
  }
  const o = parsed as Record<string, unknown>;
  return {
    enabled: o.enabled !== false,
    textAr: str(o.textAr, MAX_ANNOUNCEMENT) || DEFAULT_ANNOUNCEMENT.textAr,
    textEn: str(o.textEn, MAX_ANNOUNCEMENT) || DEFAULT_ANNOUNCEMENT.textEn,
    link: safeCmsLink(o.link),
  };
});

export const readHeroBanners = cache(async (locale: 'ar' | 'en'): Promise<HeroBanner[]> => {
  const row = await prisma.setting.findUnique({
    where: { key: CMS_HERO_BANNERS_KEY },
    select: { value: true },
  });
  if (!row) return DEFAULT_BANNERS;
  const stored = parseStored(row.value, null).value;
  // An unset or empty list falls back to the shipped default so the homepage
  // never renders an empty hero.
  const banners = normaliseBanners(stored, locale);
  return banners.length > 0 ? banners : DEFAULT_BANNERS;
});

export async function saveAnnouncement(value: unknown): Promise<AnnouncementSettings> {
  const o = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>;
  const next: AnnouncementSettings = {
    enabled: o.enabled !== false,
    textAr: str(o.textAr, MAX_ANNOUNCEMENT),
    textEn: str(o.textEn, MAX_ANNOUNCEMENT),
    link: safeCmsLink(o.link),
  };
  await setSetting(CMS_ANNOUNCEMENT_KEY, { v: next, _confirmed: true });
  clearSettingsCache();
  return next;
}

export async function saveHeroBanners(value: unknown): Promise<number> {
  if (!Array.isArray(value)) throw new Error('heroBanners must be an array');
  if (value.length > MAX_BANNERS) throw new Error(`at most ${MAX_BANNERS} banners are allowed`);
  const banners = value.map(normaliseBanner);
  // Refuse to persist a list that would leave the homepage with no hero at all,
  // rather than silently showing the fallback default instead of the admin's.
  if (banners.filter((b) => b.isActive).length === 0) {
    throw new Error('at least one banner must stay active');
  }
  await setSetting(CMS_HERO_BANNERS_KEY, { v: banners, _confirmed: true });
  clearSettingsCache();
  return banners.length;
}
