'use client';

import React from 'react';
import { Sticker, StickerProps } from '../base/Sticker';
import { useResponsive } from '@/hooks/useDimensions';

export function CameraSticker(props: Omit<StickerProps, 'children'>) {
  const { s } = useResponsive();

  return (
    <Sticker {...props}>
      <svg width={s(96)} height={s(76)} viewBox="0 0 100 80" style={{ overflow: 'visible' }}>
        <rect x="6" y="20" width="88" height="54" rx="8" fill="#1a1a1a" stroke="#fff" strokeWidth="5" />
        <rect x="32" y="8" width="30" height="16" rx="4" fill="#1a1a1a" stroke="#fff" strokeWidth="4" />
        <circle cx="50" cy="48" r="18" fill="#3a3a3a" stroke="#fff" strokeWidth="3" />
        <circle cx="50" cy="48" r="12" fill="#1a1a1a" />
        <circle cx="54" cy="44" r="4" fill="#f5f2e8" />
        <circle cx="80" cy="32" r="4" fill="#e85d3a" />
      </svg>
    </Sticker>
  );
}
