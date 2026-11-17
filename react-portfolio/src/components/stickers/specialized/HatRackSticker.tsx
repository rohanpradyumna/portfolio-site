'use client';

import React from 'react';
import { Sticker, StickerProps } from '../base/Sticker';
import { useResponsive } from '@/hooks/useDimensions';
import { HatArt } from '@/components/hats/portrait/RohanPortrait';

export const HAT_RACK_W = 110;
export const HAT_RACK_H = 124;

const WOOD = '#8b6140';
const INK = '#2a251f';

/** A little coat stand with three of the five hats on it. Opens "what you get". */
export function HatRackSticker(props: Omit<StickerProps, 'children'>) {
  const { s } = useResponsive();

  const hat = (style: React.CSSProperties, children: React.ReactNode) => (
    <div style={{ position: 'absolute', ...style }}>{children}</div>
  );

  return (
    <Sticker {...props}>
      <div style={{ width: s(HAT_RACK_W), height: s(HAT_RACK_H), position: 'relative' }}>
        <svg
          width="100%"
          height="100%"
          viewBox="0 0 110 124"
          aria-hidden="true"
          style={{ position: 'absolute', inset: 0, overflow: 'visible' }}
        >
          <g stroke="#fdfbf7" strokeWidth={9} strokeLinecap="round" fill="none">
            <path d="M55 22L55 108M55 40L30 52M55 40L80 52M55 62L33 70M55 62L77 70" />
          </g>
          <ellipse cx={55} cy={108} rx={28} ry={7} fill={WOOD} stroke={INK} strokeWidth={2.5} />
          <g strokeLinecap="round" fill="none">
            <path d="M55 22L55 108M55 40L30 52M55 40L80 52M55 62L33 70M55 62L77 70" stroke={INK} strokeWidth={6} />
            <path d="M55 22L55 108M55 40L30 52M55 40L80 52M55 62L33 70M55 62L77 70" stroke={WOOD} strokeWidth={2.5} />
          </g>
          <circle cx={30} cy={52} r={3.5} fill={WOOD} stroke={INK} strokeWidth={2} />
          <circle cx={80} cy={52} r={3.5} fill={WOOD} stroke={INK} strokeWidth={2} />
        </svg>
        {hat({ left: '27%', top: '-4%', width: '46%' }, <HatArt hat="pm" size={s(50)} />)}
        {hat(
          { left: '-6%', top: '24%', transform: 'rotate(-14deg)' },
          <HatArt hat="entrepreneur" size={s(44)} />
        )}
        {hat({ right: '-8%', top: '30%', transform: 'rotate(12deg)' }, <HatArt hat="designer" size={s(46)} />)}
        <div
          style={{
            position: 'absolute',
            bottom: -2,
            left: '50%',
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
          WHAT YOU GET
        </div>
      </div>
    </Sticker>
  );
}
