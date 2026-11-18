'use client';

import React from 'react';
import { Sticker, StickerProps } from '../base/Sticker';
import { useResponsive } from '@/hooks/useDimensions';

export const RABBIT_HOLE_W = 104;
export const RABBIT_HOLE_H = 120;

const INK = 'var(--ink)';

/** A little three-reel slot machine with its lever up. Opens /wheel, the rabbit-hole machine. */
export function WheelSticker(props: Omit<StickerProps, 'children'>) {
  const { s } = useResponsive();

  return (
    <Sticker {...props}>
      <div style={{ width: s(RABBIT_HOLE_W), height: s(RABBIT_HOLE_H), position: 'relative' }}>
        <svg
          width="100%"
          height="100%"
          viewBox="0 0 104 120"
          aria-hidden="true"
          style={{ position: 'absolute', inset: 0, overflow: 'visible' }}
        >
          {/* die-cut white edge */}
          <g stroke="var(--paper)" strokeWidth={8} strokeLinejoin="round" strokeLinecap="round" fill="var(--paper)">
            <rect x={8} y={18} width={76} height={80} rx={10} />
            <path d="M84 62L94 62L94 30" fill="none" />
            <circle cx={94} cy={24} r={8} />
          </g>

          {/* lever */}
          <path d="M84 62L94 62L94 30" fill="none" stroke={INK} strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" />
          <path d="M84 62L94 62L94 30" fill="none" stroke="var(--paper-depth)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          <circle cx={94} cy={24} r={7} fill="var(--accent-yellow)" stroke={INK} strokeWidth={2.5} />

          {/* cabinet */}
          <rect x={8} y={18} width={76} height={80} rx={10} fill="var(--accent-orange)" stroke={INK} strokeWidth={3} />
          <rect x={14} y={24} width={64} height={14} rx={4} fill="var(--accent-yellow)" stroke={INK} strokeWidth={2} />
          <circle cx={24} cy={31} r={2} fill={INK} />
          <circle cx={46} cy={31} r={2} fill={INK} />
          <circle cx={68} cy={31} r={2} fill={INK} />

          {/* three reels: a question, a book, a spark */}
          <rect x={14} y={44} width={64} height={30} rx={4} fill="var(--note-paper)" stroke={INK} strokeWidth={2.5} />
          <path d="M35.3 46V72M56.7 46V72" stroke={INK} strokeWidth={2} />
          <path d="M16 59H76" stroke="var(--highlighter)" strokeWidth={9} />
          <text
            x={24.6}
            y={65}
            textAnchor="middle"
            fontFamily="var(--font-sans)"
            fontWeight={800}
            fontSize={17}
            fill="var(--accent-blue)"
          >
            ?
          </text>
          <path
            d="M39.5 54.5Q43 52.5 46 54.5Q49 52.5 52.5 54.5L52.5 64Q49 62 46 64Q43 62 39.5 64Z M46 54.5V64"
            fill="var(--paper)"
            stroke="var(--accent-green)"
            strokeWidth={1.8}
            strokeLinejoin="round"
          />
          <path
            d="M67.4 51.5L69.2 56.8L74.5 59L69.2 61.2L67.4 66.5L65.6 61.2L60.3 59L65.6 56.8Z"
            fill="var(--accent-yellow)"
            stroke={INK}
            strokeWidth={1.4}
            strokeLinejoin="round"
          />

          {/* payout slot with a ticket peeking out */}
          <rect x={30} y={82} width={32} height={6} rx={3} fill={INK} />
          <path d="M34 85H58V96L54 94L50 96L46 94L42 96L38 94L34 96Z" fill="var(--note-paper)" stroke={INK} strokeWidth={1.6} strokeLinejoin="round" />
        </svg>
        <div
          style={{
            position: 'absolute',
            bottom: -2,
            left: '46%',
            transform: 'translateX(-50%)',
            background: 'var(--card-bg)',
            color: 'var(--paper)',
            fontFamily: 'var(--font-mono)',
            fontSize: s(11),
            fontWeight: 700,
            lineHeight: 1.2,
            padding: `${s(3)}px ${s(8)}px`,
            borderRadius: s(4),
            letterSpacing: '0.03em',
            whiteSpace: 'nowrap',
            border: '2px solid var(--paper)',
          }}
        >
          RABBIT HOLES
        </div>
      </div>
    </Sticker>
  );
}
