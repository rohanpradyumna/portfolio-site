'use client';

import React from 'react';
import { Sticker, StickerProps } from '../base/Sticker';
import { useResponsive } from '@/hooks/useDimensions';

export function LegoSticker(props: Omit<StickerProps, 'children'>) {
  const { s } = useResponsive();

  return (
    <Sticker {...props}>
      <svg width={s(88)} height={s(76)} viewBox="0 0 100 88" style={{ overflow: 'visible' }}>
        <rect x="8" y="24" width="84" height="54" rx="5" fill="#d4584f" stroke="#fff" strokeWidth="5" />
        <rect x="8" y="24" width="84" height="8" fill="#c44a42" />
        {[[30, 18], [58, 18]].map(([cx, cy], i) => (
          <g key={i}>
            <ellipse cx={cx} cy={(cy as number) + 6} rx="12" ry="4" fill="#8a3028" />
            <rect
              x={(cx as number) - 12}
              y={(cy as number) - 5}
              width="24"
              height="11"
              fill="#d4584f"
              stroke="#fff"
              strokeWidth="3"
            />
            <ellipse cx={cx} cy={(cy as number) - 5} rx="12" ry="5" fill="#e06a62" stroke="#fff" strokeWidth="3" />
          </g>
        ))}
      </svg>
    </Sticker>
  );
}
