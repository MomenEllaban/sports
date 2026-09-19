import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'ابطال الرياضة الإبراهيمية | Sports Champions Alexandria',
  description: 'المقر الرئيسي للملابس والمعدات الرياضية بالإسكندرية (سباحة، جيم، كارديو، باليه). 92 شارع عمر لطفى، الإبراهيمية.',
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