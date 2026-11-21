import type { MetadataRoute } from 'next';
import { isProduction, siteUrl } from '@/lib/site';

export default function robots(): MetadataRoute.Robots {
  return {
    // The stage site is open to crawlers too, since some link previews obey this file, and its pages ask
    // not to be indexed instead
    rules: {
      userAgent: '*',
      allow: '/',
    },
    sitemap: isProduction ? new URL('/sitemap.xml', siteUrl).href : undefined,
  };
}
