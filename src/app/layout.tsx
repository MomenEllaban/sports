import type { Metadata } from 'next';
import './globals.css';
import { getSiteUrl } from '@/lib/site-url';

// Locale-specific copy (title/description/OG) lives in [locale]/layout.tsx so
// the /en routes never render Arabic document metadata. This root layout only
// carries locale-independent values that every page inherits.
export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  icons: {
    icon: [
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/logo.avif', type: 'image/avif' },
    ],
    shortcut: '/favicon.ico',
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <>{children}</>;
}