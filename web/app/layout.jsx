import '@fontsource-variable/inter';
import '@fontsource-variable/unbounded';
import '@fontsource-variable/bricolage-grotesque';
import './globals.css';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { SITE } from '@/lib/site';

export const metadata = {
  metadataBase: new URL(SITE.url),
  title: { default: `${SITE.name}: ${SITE.tagline}`, template: `%s | ${SITE.name}` },
  description: SITE.tagline,
  applicationName: SITE.name,
  alternates: { canonical: '/', types: { 'application/rss+xml': [{ url: '/rss.xml', title: SITE.name }] } },
  openGraph: { siteName: SITE.name, type: 'website', locale: 'en_US', images: [{ url: '/brand/logo.png', width: 1200, height: 488 }] },
  twitter: { card: 'summary_large_image' },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1, 'max-video-preview': -1 } },
  icons: {
    icon: [{ url: '/favicon.svg', type: 'image/svg+xml' }, { url: '/brand/favicon-32.png', sizes: '32x32', type: 'image/png' }],
    apple: '/brand/apple-touch-icon.png',
  },
  manifest: '/site.webmanifest',
  other: SITE.adsClient ? { 'google-adsense-account': SITE.adsClient } : {},
};

export const viewport = { themeColor: '#16112A', colorScheme: 'dark' };

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        {SITE.adsClient && (
          <script async src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${SITE.adsClient}`} crossOrigin="anonymous" />
        )}
        {SITE.gtm && (
          <>
            {/* Google tag (Analytics), loaded through the Tag Manager container Google created */}
            <script async src={`https://www.googletagmanager.com/gtm.js?id=${SITE.gtm}`} />
            <script
              dangerouslySetInnerHTML={{
                __html: `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());`,
              }}
            />
          </>
        )}
        {SITE.ga4 && (
          <>
            <script async src={`https://www.googletagmanager.com/gtag/js?id=${SITE.ga4}`} />
            <script
              dangerouslySetInnerHTML={{
                __html: `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${SITE.ga4}');`,
              }}
            />
          </>
        )}
      </head>
      <body>
        <a href="#main" className="sr-only">Skip to content</a>
        <Header />
        <main id="main">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
