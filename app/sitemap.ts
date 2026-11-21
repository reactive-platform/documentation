import type { MetadataRoute } from 'next';
import { siteUrl } from '@/lib/site';
import { source } from '@/lib/source';

export default function sitemap(): MetadataRoute.Sitemap {
  const paths = ['/', '/playground', ...source.getPages().map((page) => page.url)];

  return paths.map((path) => ({ url: new URL(path, siteUrl).href }));
}
