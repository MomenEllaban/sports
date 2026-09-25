import { Suspense } from 'react';
import type { Metadata } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { routing } from '@/i18n/routing';
import { Cairo } from 'next/font/google';
import SessionProviderWrapper from '@/components/SessionProviderWrapper';
import { ToastProvider } from '@/components/Toast';
import Preloader from '@/components/Preloader';
import NavigationProgress from '@/components/layout/NavigationProgress';
import GlobalErrorBoundary from '@/components/GlobalErrorBoundary';
import ErrorEventHandler from '@/components/ErrorEventHandler';

const cairo = Cairo({
  subsets: ['arabic', 'latin'],
  weight: ['400', '500', '600', '700', '800', '900'],
  variable: '--font-cairo',
});

// Anti-FOUC: apply the saved theme before first paint so light mode
// doesn't flash dark. Runs directly in <head> before the body renders.
const themeInitScript = `(function(){try{var t=localStorage.getItem('theme');if(t==='light'){document.documentElement.setAttribute('data-theme','light');}}catch(e){}})();`;

// Document metadata must follow the active locale, otherwise /en pages ship
// Arabic <title>/description/OG tags to search engines and link previews.
const SITE = {
  ar: {
    name: 'ابطال الرياضة الإبراهيمية',
    defaultTitle: 'ابطال الرياضة الإبراهيمية | Sports Champions Alexandria',
    template: '%s | ابطال الرياضة',
    description:
      'المقر الرئيسي للملابس والمعدات الرياضية بالإسكندرية (سباحة، جيم، كارديو، باليه). 92 شارع عمر لطفى، الإبراهيمية.',
    shortDescription: 'ملابس ومعدات رياضية — الإسكندرية.',
    openGraphLocale: 'ar_EG',
    alternateLocale: ['en_US'],
  },
  en: {
    name: 'Sports Champions Alexandria',
    defaultTitle: 'Sports Champions Alexandria',
    template: '%s | Sports Champions',
    description:
      'Flagship store for sports apparel and equipment in Alexandria (swimming, gym, cardio, ballet). 92 Omar Lotfy Street, El Ibrahimia.',
    shortDescription: 'Sports apparel & equipment — Alexandria.',
    openGraphLocale: 'en_US',
    alternateLocale: ['ar_EG'],
  },
} as const;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const copy = SITE[locale === 'en' ? 'en' : 'ar'];
  return {
    title: { default: copy.defaultTitle, template: copy.template },
    description: copy.description,
    alternates: { languages: { ar: '/ar', en: '/en' } },
    openGraph: {
      type: 'website',
      locale: copy.openGraphLocale,
      alternateLocale: [...copy.alternateLocale],
      siteName: copy.name,
      title: copy.defaultTitle,
      description: copy.shortDescription,
      images: [{ url: '/logo.avif', alt: `${copy.name} logo` }],
    },
    twitter: { card: 'summary_large_image', title: copy.name, description: copy.shortDescription },
  };
}

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (!routing.locales.includes(locale as 'ar' | 'en')) {
    notFound();
  }

  setRequestLocale(locale);

  const messages = await getMessages();
  const dir = locale === 'ar' ? 'rtl' : 'ltr';

  return (
    <html lang={locale} dir={dir} className={cairo.variable}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="bg-slate-950 text-slate-100 antialiased min-h-screen flex flex-col font-sans">
        <SessionProviderWrapper>
          <NextIntlClientProvider messages={messages} locale={locale}>
            <ToastProvider>
              <ErrorEventHandler />
              <GlobalErrorBoundary>
                <Suspense fallback={null}>
                  <NavigationProgress />
                </Suspense>
                <Preloader />
                {children}
              </GlobalErrorBoundary>
            </ToastProvider>
          </NextIntlClientProvider>
        </SessionProviderWrapper>
      </body>
    </html>
  );
}
