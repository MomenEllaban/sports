const PLACEHOLDER_HOSTS = new Set(['sports-champions.example.com', 'example.com']);

export function getSiteUrl(): string {
  const configured = (process.env.NEXT_PUBLIC_SITE_URL || '').trim();
  if (!configured) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('REFUSED: NEXT_PUBLIC_SITE_URL must be set in production.');
    }
    return 'http://localhost:3000';
  }
  try {
    const url = new URL(configured);
    if (process.env.NODE_ENV === 'production' && (url.hostname === 'localhost' || PLACEHOLDER_HOSTS.has(url.hostname))) {
      throw new Error('REFUSED: NEXT_PUBLIC_SITE_URL must be the real production host.');
    }
    return url.toString().replace(/\/$/, '');
  } catch {
    throw new Error('REFUSED: NEXT_PUBLIC_SITE_URL must be a valid absolute URL.');
  }
}
