import { describe, it, expect } from 'vitest';
import {
  safeCmsLink,
  normaliseBanners,
  DEFAULT_BANNERS,
  DEFAULT_ANNOUNCEMENT,
  MAX_BANNERS,
} from '@/lib/website/cms';

const banner = (over: Record<string, unknown> = {}) => ({
  id: 'b1',
  titleAr: 'عنوان',
  titleEn: 'Title',
  subtitleAr: 'وصف',
  subtitleEn: 'Subtitle',
  ctaTextAr: 'تسوق',
  ctaTextEn: 'Shop',
  ctaLink: '/catalog',
  imageUrl: 'https://cdn.example.com/a.jpg',
  badgeAr: 'جديد',
  badgeEn: 'New',
  isActive: true,
  ...over,
});

describe('safeCmsLink', () => {
  it('keeps site-relative paths', () => {
    expect(safeCmsLink('/catalog')).toBe('/catalog');
    expect(safeCmsLink('/catalog?category=running')).toBe('/catalog?category=running');
    expect(safeCmsLink('/branches')).toBe('/branches');
  });

  it('drops anything that could leave the site or execute script', () => {
    expect(safeCmsLink('javascript:alert(1)')).toBe('');
    expect(safeCmsLink('JavaScript:alert(1)')).toBe('');
    expect(safeCmsLink('data:text/html,<script>')).toBe('');
    // Protocol-relative URLs resolve off-origin.
    expect(safeCmsLink('//evil.example.com')).toBe('');
    // Backslashes are normalised to slashes by browsers, so /\\ escapes too.
    expect(safeCmsLink('/\\evil.example.com')).toBe('');
    expect(safeCmsLink('https://evil.example.com')).toBe('');
    expect(safeCmsLink('  /catalog  ')).toBe('/catalog');
    expect(safeCmsLink('')).toBe('');
    expect(safeCmsLink(null)).toBe('');
    expect(safeCmsLink(42)).toBe('');
  });
});

describe('normaliseBanners', () => {
  it('drops banners that are hidden or have no title in the active locale', () => {
    const list = normaliseBanners(
      [banner({ id: 'a' }), banner({ id: 'b', isActive: false }), banner({ id: 'c', titleEn: '' })],
      'en',
    );
    expect(list.map((b) => b.id)).toEqual(['a']);
  });

  it('requires a title in the requested locale only', () => {
    const arOnly = banner({ titleEn: '' });
    expect(normaliseBanners([arOnly], 'ar')).toHaveLength(1);
    expect(normaliseBanners([arOnly], 'en')).toHaveLength(0);
  });

  it('rejects non-http image protocols', () => {
    const [b] = normaliseBanners([banner({ imageUrl: 'javascript:alert(1)' })], 'en');
    expect(b.imageUrl).toBe('');
  });

  it('caps the number of banners and text lengths', () => {
    const many = Array.from({ length: MAX_BANNERS + 5 }, (_, i) => banner({ id: `b${i}` }));
    expect(normaliseBanners(many, 'en')).toHaveLength(MAX_BANNERS);

    const [long] = normaliseBanners([banner({ titleEn: 'x'.repeat(500) })], 'en');
    expect(long.titleEn.length).toBeLessThanOrEqual(140);
  });

  it('survives malformed stored values', () => {
    expect(normaliseBanners(null, 'en')).toEqual([]);
    expect(normaliseBanners('not-an-array', 'en')).toEqual([]);
    expect(normaliseBanners([null, 5, {}], 'en')).toEqual([]);
  });
});

describe('shipped defaults', () => {
  it('point at routes that exist in the storefront', () => {
    // /products does not exist; the catalogue is /catalog. A 404 CTA is the
    // most visible possible CMS bug, so it is asserted here.
    expect(DEFAULT_ANNOUNCEMENT.link).toBe('/catalog');
    for (const b of DEFAULT_BANNERS) {
      expect(b.ctaLink.startsWith('/catalog')).toBe(true);
      expect(b.imageUrl.startsWith('https://')).toBe(true);
    }
  });
});
