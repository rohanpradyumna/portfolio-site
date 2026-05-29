'use client';

import React from 'react';
import { Sticker, StickerProps } from '../base/Sticker';
import { useResponsive } from '@/hooks/useDimensions';

export function PickleballSticker(props: Omit<StickerProps, 'children'>) {
  const { s } = useResponsive();

  return (
    <Sticker {...props}>
      <img
        src="/assets/icons/racket.png"
        alt="Pickleball"
        draggable="false"
        loading="lazy"
        style={{
          width: s(90),
          height: s(90),
          objectFit: 'contain',
          pointerEvents: 'none',
        }}
      />
    </Sticker>
  );
}
