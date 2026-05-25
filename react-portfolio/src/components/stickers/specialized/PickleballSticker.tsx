'use client';

import React from 'react';
import { Sticker, StickerProps } from '../base/Sticker';

export function PickleballSticker(props: Omit<StickerProps, 'children'>) {
  return (
    <Sticker {...props}>
      <img
        src="/assets/icons/racket.png"
        alt="Pickleball"
        draggable="false"
        style={{
          width: 90,
          height: 90,
          objectFit: 'contain',
          pointerEvents: 'none',
        }}
      />
    </Sticker>
  );
}
