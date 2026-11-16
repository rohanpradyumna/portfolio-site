import type { Metadata, Viewport } from 'next';
import { CouncilExperience } from '@/components/council/CouncilExperience';
import { COUNCIL_COPY } from '@/data/council/copy';

const title = 'The Council · Rohan Pradyumna';
const description = `${COUNCIL_COPY.promise} Six philosophical lenses, as stickers, argue about your question. AI interpretations, open to challenge.`;

export const metadata: Metadata = {
  title,
  description,
  alternates: {
    canonical: '/council',
  },
  openGraph: {
    title,
    description,
    url: '/council',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title,
    description,
  },
};

// Same as the root viewport, plus interactiveWidget: on Android the keyboard
// then shrinks the page instead of covering the composer.
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#faf7ef',
  interactiveWidget: 'resizes-content',
};

export default function CouncilPage() {
  return <CouncilExperience />;
}
