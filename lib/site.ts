import type { Metadata } from 'next';

const productionUrl = 'https://reactiveui.beatleader.com';

// The deploy workflow passes each site's address, and builds outside it, like local ones, use production's
export const siteUrl = process.env.SITE_URL || productionUrl;

// Only production gets indexed, since the stage site would put a second copy of every page in search results
export const isProduction = siteUrl === productionUrl;

export const openGraph = {
  siteName: 'ReactiveUI',
  type: 'website',
} satisfies Metadata['openGraph'];

// Link previews show the home page with a large picture, and other pages with a small one, their own or the logo
export function smallPreview(image = '/preview.png'): Metadata {
  return {
    openGraph: { ...openGraph, images: image },
    twitter: { card: 'summary' },
  };
}
