import React from 'react';
import { PortraitMood } from '@/lib/council/contract';
import { Halo, ThoughtMark, VB_H, VB_W } from '@/components/council/portraits/kit';
import seat from '@/components/council/portraits/portraits.module.css';
import { rohan } from './Rohan';
import { HATS, HatId } from './hats';
import styles from './hats.module.css';

interface RohanPortraitProps {
  size: number;
  mood?: PortraitMood;
  hat?: HatId | null;
  /** How a new hat arrives: falls from above (tap) or settles in place (dragged on). */
  entry?: 'drop' | 'settle';
  className?: string;
}

/**
 * Rohan's sticker bust, on the council portrait structure so he shares its
 * moods (blink, thinking, speaking). The hat lives inside the head group so it
 * nods with the head; keying it by id replays the drop on every swap.
 */
export function RohanPortrait({ size, mood = 'idle', hat = null, entry = 'drop', className }: RohanPortraitProps) {
  const def = HATS[hat ?? 'pm'];
  const arrive = entry === 'settle' ? styles.settle : styles.drop;
  return (
    <svg
      className={className ? `${seat.root} ${className}` : seat.root}
      width={size}
      height={(size * VB_H) / VB_W}
      viewBox={`0 0 ${VB_W} ${VB_H}`}
      aria-hidden="true"
      focusable="false"
      data-mood={mood}
      style={{ '--blink-dur': '5.6s', '--blink-delay': '-1.8s' } as React.CSSProperties}
    >
      <g className={seat.figure}>
        <Halo shapes={rohan.sil.body} />
        <g className={seat.head}>
          <Halo shapes={rohan.sil.head} />
          {hat && (
            <g key={hat} className={arrive}>
              <Halo shapes={def.sil} />
            </g>
          )}
        </g>

        <g className={seat.art}>
          {rohan.body}
          <g className={seat.head}>
            {rohan.head}
            {hat && (
              <g key={hat} className={arrive}>
                {def.art}
              </g>
            )}
          </g>
        </g>

        <ThoughtMark accent="#e6b32a" stroke={rohan.scribble} x={176} y={30} />
      </g>
    </svg>
  );
}

/** A lone hat, for the rack pegs and the board sticker. */
export function HatArt({ hat, size, className }: { hat: HatId; size: number; className?: string }) {
  const def = HATS[hat];
  // The hats occupy roughly x 30-170, y -20-95 of the portrait space.
  return (
    <svg
      className={className}
      width={size}
      height={(size * 128) / 156}
      viewBox="22 -30 156 128"
      aria-hidden="true"
      focusable="false"
      style={{ overflow: 'visible' }}
    >
      <Halo shapes={def.sil} />
      {def.art}
    </svg>
  );
}
