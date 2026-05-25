'use client';

import React from 'react';
import { Sticker, StickerProps } from '../base/Sticker';

export function EmailSticker(props: Omit<StickerProps, 'children'>) {
  return (
    <Sticker {...props}>
      <svg width="100" height="74" viewBox="0 0 120 90" style={{ overflow: 'visible' }}>
        <rect x="6" y="10" width="108" height="70" rx="8" fill="#faf7ef" stroke="#fff" strokeWidth="6" />
        <rect x="6" y="10" width="108" height="70" rx="8" fill="#faf7ef" stroke="#1a1a1a" strokeWidth="3" />
        <path
          d="M 12 18 L 60 52 L 108 18"
          fill="none"
          stroke="#1a1a1a"
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="98" cy="18" r="16" fill="#e85d3a" stroke="#fff" strokeWidth="4" />
        <text
          x="98"
          y="25"
          textAnchor="middle"
          fill="#fff"
          fontSize="18"
          fontWeight="800"
          fontFamily="'Geist Mono', monospace"
        >
          @
        </text>
      </svg>
    </Sticker>
  );
}
