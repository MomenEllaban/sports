import type { Metadata } from 'next';
import Script from 'next/script';
import './globals.css';

export const metadata: Metadata = {
  title: 'ابطال الرياضة الإبراهيمية | Sports Champions Alexandria',
  description: 'المقر الرئيسي للملابس والمعدات الرياضية بالإسكندرية (سباحة، جيم، كارديو، باليه). 92 شارع عمر لطفى، الإبراهيمية.',
};

// Anti-FOUC: apply saved theme before hydration so light mode has no dark flash.
// (The <html> tag is rendered by src/app/[locale]/layout.tsx.)
const themeInitScript = `(function(){try{var t=localStorage.getItem('theme');if(t==='light'){document.documentElement.setAttribute('data-theme','light');}}catch(e){}})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      <Script id="theme-init" strategy="beforeInteractive" dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      {children}
    </>
  );
}
