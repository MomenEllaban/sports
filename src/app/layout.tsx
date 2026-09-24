import type { Metadata } from 'next';
import './globals.css';
import { getSiteUrl } from '@/lib/site-url';

export const metadata: Metadata = {
  title: {
    default: 'ابطال الرياضة الإبراهيمية | Sports Champions Alexandria',
    template: '%s | ابطال الرياضة',
  },
  description:
    'المقر الرئيسي للملابس والمعدات الرياضية بالإسكندرية (سباحة، جيم، كارديو، باليه). 92 شارع عمر لطفى، الإبراهيمية. Alexandria sports apparel & equipment store.',
  metadataBase: new URL(getSiteUrl()),
  alternates: { languages: { ar: '/ar', en: '/en' } },
  openGraph: {
    type: 'website',
    locale: 'ar_EG',
    alternateLocale: ['en_US'],
    siteName: 'ابطال الرياضة الإبراهيمية',
    title: 'ابطال الرياضة الإبراهيمية | Sports Champions Alexandria',
    description: 'ملابس ومعدات رياضية — الإسكندرية. Sports apparel & equipment — Alexandria.',
    images: [{ url: '/logo.avif', alt: 'Sports Champions logo' }],
  },
  twitter: { card: 'summary_large_image', title: 'ابطال الرياضة الإبراهيمية', description: 'ملابس ومعدات رياضية — الإسكندرية.' },
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