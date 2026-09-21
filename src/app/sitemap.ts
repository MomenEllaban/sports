import type { MetadataRoute } from 'next';
import { prisma } from '@/lib/db';

const BASE = (process.env.NEXT_PUBLIC_SITE_URL || 'https://sports-champions.example.com').replace(/\/$/, '');

/** Bilingual sitemap (T15): static storefront routes + live product pages. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticPaths = ['', '/catalog', '/cart', '/checkout', '/tracking', '/branches', '/wishlist', '/account'];
  const entries: MetadataRoute.Sitemap = [];
  for (const locale of ['ar', 'en']) {
    for (const p of staticPaths) {
      entries.push({ url: `${BASE}/${locale}${p}`, lastModified: new Date(), changeFrequency: 'daily', priority: p === '' ? 1 : 0.7 });
    }
  }
  try {
    const products = await prisma.product.findMany({
      where: { isActive: true },
      select: { id: true, updatedAt: true },
      take: 500,
    });
    for (const p of products) {
      for (const locale of ['ar', 'en']) {
        entries.push({ url: `${BASE}/${locale}/catalog/${p.id}`, lastModified: p.updatedAt, changeFrequency: 'weekly', priority: 0.6 });
      }
    }
  } catch {
    /* build-time DB unavailable: static routes only */
  }
  return entries;
}
