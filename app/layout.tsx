import './global.css';
import { RootProvider } from 'fumadocs-ui/provider/next';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import type { ReactNode } from 'react';
import { isProduction, openGraph, siteUrl } from '@/lib/site';

const inter = Inter({
  subsets: ['latin'],
});

// Pages set their own title and description, which link previews pick up too. The home page shows the large
// picture from opengraph-image.tsx, and other pages swap it for a small one with smallPreview
export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: 'ReactiveUI',
  description:
    'Write the view in C#, next to the code that drives it. Values that change live in states, and whatever ' +
    'reads a state follows it, with no markup to parse and nothing to refresh by hand.',
  openGraph,
  twitter: {
    card: 'summary_large_image',
  },
  // The stage site stays out of search results
  robots: isProduction ? undefined : { index: false, follow: false },
};

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={inter.className} suppressHydrationWarning>
      <body className="flex flex-col min-h-screen">
        <RootProvider>{children}</RootProvider>
      </body>
    </html>
  );
}
