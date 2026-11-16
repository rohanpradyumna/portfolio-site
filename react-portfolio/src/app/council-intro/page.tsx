import { notFound } from 'next/navigation';
import type { Metadata, Viewport } from 'next';
import { DevStage } from './DevStage';

// Dev page for reviewing the council intro on its own. Not linked from anywhere.
//   ?step=3         open already scrolled to that step: 0 to 5 are the members, 6 to 8 the beats
//   ?exit=fade      use the fallback exit instead of the shared-layout handoff
//   ?scene=1        mount it over the real /council scene instead of the stand-in
//   ?replay=1       fade the paper in, as the "Meet the council again" control would

export const metadata: Metadata = {
  title: 'Council intro (dev)',
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#faf7ef',
};

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function CouncilIntroDevPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  // Review page for development only. It must not ship.
  if (process.env.NODE_ENV === 'production') notFound();
  const params = await searchParams;
  const step = Number(first(params.step));
  return (
    <DevStage
      startStep={Number.isFinite(step) ? step : 0}
      exit={first(params.exit) === 'fade' ? 'fade' : 'handoff'}
      scene={first(params.scene) === '1'}
      replay={first(params.replay) === '1'}
    />
  );
}
