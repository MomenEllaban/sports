import type { MetadataRoute } from 'next';

const BASE = (process.env.NEXT_PUBLIC_SITE_URL || 'https://sports-champions.example.com').replace(/\/$/, '');

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/admin', '/pos', '/api/'] }],
    sitemap: `${BASE}/sitemap.xml`,
  };
}
