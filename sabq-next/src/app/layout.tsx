import type { Metadata } from 'next';
import './globals.css';

/**
 * Root Layout - Sabq News Platform
 * RTL direction, Arabic fonts, global metadata
 */

export const metadata: Metadata = {
  title: {
    default: 'صحيفة سبق الإلكترونية',
    template: '%s | صحيفة سبق الإلكترونية',
  },
  description: 'صحيفة سبق الإلكترونية - أخبار السعودية والعالم، عاجل، رياضة، اقتصاد، تقنية، ثقافة',
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://sabq.org'),
  openGraph: {
    type: 'website',
    locale: 'ar_SA',
    siteName: 'صحيفة سبق الإلكترونية',
  },
  twitter: {
    card: 'summary_large_image',
    site: '@sababorgsabq',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800;900&family=Noto+Naskh+Arabic:wght@400;500;600;700&family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
        <link rel="icon" href="/favicon.ico" sizes="any" />
      </head>
      <body className="antialiased min-h-screen flex flex-col">
        {children}
      </body>
    </html>
  );
}
