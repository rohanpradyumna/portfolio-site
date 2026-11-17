import { notFound } from 'next/navigation';
import type { Metadata, Viewport } from 'next';
import { PromoFilm } from './PromoFilm';
import { isFormat } from './timeline';

// Dev page that performs the council promo film. Not linked from anywhere.
// Open it in a tab to watch the performance live, or let /video/render.mjs
// film it frame by frame under a virtual clock.
//   ?hold=1            do not start until window.__promo.start() is called (the harness does this)
//   ?format=vertical   the 9:16 cut, on the product's phone layout. Wants a 432 by 768 viewport
//                      (device toolbar): the product lays itself out by the real width of the page.

export const metadata: Metadata = {
  title: 'Council promo film (dev)',
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#faf7ef',
};

export default async function CouncilPromoPage({ searchParams }: { searchParams: Promise<{ format?: string | string[] }> }) {
  // A film set for development only. It must not ship: in a production build this is a 404.
  if (process.env.NODE_ENV === 'production') notFound();
  const { format } = await searchParams;
  return <PromoFilm format={isFormat(format) ? format : 'landscape'} />;
}
