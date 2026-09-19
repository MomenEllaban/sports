import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'ابطال الرياضة الإبراهيمية | Sports Champions Alexandria',
  description: 'المقر الرئيسي للملابس والمعدات الرياضية بالإسكندرية (سباحة، جيم، كارديو، باليه). 92 شارع عمر لطفى، الإبراهيمية.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <>{children}</>;
}