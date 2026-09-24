import type { MetadataRoute } from 'next';
import { getSiteUrl } from '@/lib/site-url';

const BASE = getSiteUrl();

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/admin', '/pos', '/api/', '/ar/admin', '/en/admin', '/ar/pos', '/en/pos'] }],
    sitemap: `${BASE}/sitemap.xml`,
  };
}
