'use client';

import React from 'react';
import { Sticker, StickerProps } from '../base/Sticker';

export interface ImageStickerProps extends Omit<StickerProps, 'children'> {
  src: string;
  size?: number;
  bg?: string;
  pad?: number;
  radius?: number;
}

export function ImageSticker({
  src,
  size = 86,
  bg = '#ffffff',
  pad = 8,
  radius = 18,
  ...rest
}: ImageStickerProps) {
  return (
    <Sticker {...rest}>
      <div
        style={{
          width: size,
          height: size,
          background: bg,
          borderRadius: radius,
          padding: pad,
          boxSizing: 'border-box',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <img
          src={src}
          alt=""
          draggable="false"
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            pointerEvents: 'none',
          }}
        />
      </div>
    </Sticker>
  );
}
