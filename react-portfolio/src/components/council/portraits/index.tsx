import React from 'react';
import { SEAT_ACCENTS, SeatId, SeatPortraitProps } from '@/lib/council/contract';
import { Halo, PortraitDef, ThoughtMark, VB_H, VB_W } from './kit';
import { stoic } from './Stoic';
import { pragmatist } from './Pragmatist';
import { existentialist } from './Existentialist';
import { absurdist } from './Absurdist';
import { advaita } from './Advaita';
import { marxist } from './Marxist';
import styles from './portraits.module.css';

export { CouncilEntryArt } from './EntryArt';

const PORTRAITS: Record<SeatId, PortraitDef> = { stoic, pragmatist, existentialist, absurdist, advaita, marxist };

/** Height / width of every portrait. The box never changes between moods. */
export const PORTRAIT_ASPECT = VB_H / VB_W;

// Staggered blink clocks, so a row of seats never blinks in unison.
const BLINK: Record<SeatId, [string, string]> = {
  stoic: ['6.1s', '-1.2s'],
  pragmatist: ['4.7s', '-3.1s'],
  existentialist: ['5.3s', '-0.4s'],
  absurdist: ['5.9s', '-4.4s'],
  advaita: ['7.3s', '-2.6s'],
  marxist: ['5.1s', '-2.0s'],
};

export function SeatPortrait({ seatId, size, mood = 'idle', className }: SeatPortraitProps) {
  const def = PORTRAITS[seatId];
  const accent = SEAT_ACCENTS[seatId];
  const [blinkDur, blinkDelay] = BLINK[seatId];

  return (
    <svg
      className={className ? `${styles.root} ${className}` : styles.root}
      width={size}
      height={size * PORTRAIT_ASPECT}
      viewBox={`0 0 ${VB_W} ${VB_H}`}
      aria-hidden="true"
      focusable="false"
      data-seat={seatId}
      data-mood={mood}
      style={{ '--blink-dur': blinkDur, '--blink-delay': blinkDelay } as React.CSSProperties}
    >
      <g className={styles.figure}>
        {/* Die-cut border. The head's share moves with the head. */}
        <Halo shapes={def.sil.body} />
        <g className={styles.head}>
          <Halo shapes={def.sil.head} />
        </g>
        {def.sil.front && <Halo shapes={def.sil.front} />}

        <g className={styles.art}>
          {def.body}
          <g className={styles.head}>{def.head}</g>
          {def.front}
        </g>

        <ThoughtMark accent={accent} stroke={def.scribble} />
      </g>
    </svg>
  );
}
