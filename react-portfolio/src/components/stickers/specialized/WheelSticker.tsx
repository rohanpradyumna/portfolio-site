'use client';

import React from 'react';
import { Sticker, StickerProps } from '../base/Sticker';
import { useResponsive } from '@/hooks/useDimensions';

export function WheelSticker(props: Omit<StickerProps, 'children'>) {
  const { s } = useResponsive();
  const size = s(96);

  return (
    <Sticker {...props}>
      <div style={{ position: 'relative', width: size, height: size }}>
        {/* washi tape, echoing the card taped to the board behind this sticker */}
        <div
          style={{
            position: 'absolute',
            top: -s(6),
            left: '50%',
            transform: `translateX(-50%) rotate(-4deg)`,
            width: s(34),
            height: s(14),
            background: 'rgba(230,179,42,0.85)',
            boxShadow: '0 2px 3px rgba(0,0,0,0.15)',
          }}
        />
        {/* note card: a text-only sticker instead of an illustrated object */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            transform: 'rotate(-3deg)',
            background: '#fdfbf7',
            border: `${s(4)}px solid #2a251f`,
            borderRadius: s(10),
            boxShadow: '0 6px 10px rgba(40,30,10,0.20), 0 2px 4px rgba(40,30,10,0.16)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: s(2),
          }}
        >
          <span
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontWeight: 700,
              fontSize: s(20),
              lineHeight: 1,
              letterSpacing: '0.02em',
              color: '#2a251f',
            }}
          >
            PULL
          </span>
          <span
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontWeight: 700,
              fontSize: s(20),
              lineHeight: 1,
              letterSpacing: '0.02em',
              color: '#2a251f',
            }}
          >
            ME
          </span>
          <span
            style={{
              width: s(24),
              height: s(4),
              marginTop: s(4),
              background: '#e6b32a',
              borderRadius: s(2),
            }}
          />
        </div>
      </div>
    </Sticker>
  );
}
