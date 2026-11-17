import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import type { CSSProperties } from 'react';
import { HatArt, RohanPortrait } from '@/components/hats/portrait/RohanPortrait';
import { HATS, HatId } from '@/components/hats/portrait/hats';

// Dev gallery for the hat rack art. Not linked from anywhere. ?size=200

export const metadata: Metadata = {
  title: 'Hat portraits (dev gallery)',
  robots: { index: false, follow: false },
};

const HAT_IDS = Object.keys(HATS) as HatId[];

const board: CSSProperties = {
  position: 'fixed',
  inset: 0,
  overflowY: 'auto',
  backgroundColor: 'var(--paper)',
  backgroundImage:
    'linear-gradient(to right, var(--grid) 1px, transparent 1px), linear-gradient(to bottom, var(--grid) 1px, transparent 1px)',
  backgroundSize: '28px 28px',
  padding: 40,
};
const label: CSSProperties = { fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--ink-secondary)' };

export default async function HatsPortraits({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (process.env.NODE_ENV === 'production') notFound();
  const sp = await searchParams;
  const size = Number(Array.isArray(sp.size) ? sp.size[0] : sp.size) || 200;

  return (
    <div style={board}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 48, alignItems: 'flex-end', paddingTop: 60 }}>
        {[null, ...HAT_IDS].map((h) => (
          <figure key={h ?? 'none'} style={{ margin: 0, filter: 'var(--shadow-sticker)' }}>
            <RohanPortrait size={size} hat={h} />
            <figcaption style={label}>{h ?? 'hatless'}</figcaption>
          </figure>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 40, marginTop: 60 }}>
        {HAT_IDS.map((h) => (
          <HatArt key={h} hat={h} size={110} />
        ))}
      </div>
    </div>
  );
}
