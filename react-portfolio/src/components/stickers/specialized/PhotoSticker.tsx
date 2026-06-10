'use client';

import React from 'react';
import { Sticker, StickerProps } from '../base/Sticker';

export interface PhotoStickerProps extends Omit<StickerProps, 'children'> {
  src: string;
  w?: number;
  h?: number;
  shape?: 'rounded' | 'circle' | 'sharp';
  noBorder?: boolean;
}

export function PhotoSticker({
  src,
  w = 140,
  h = 180,
  shape = 'rounded',
  noBorder = false,
  ...rest
}: PhotoStickerProps) {
  const radius = shape === 'circle' ? '50%' : shape === 'rounded' ? '14px' : '4px';

  if (noBorder) {
    return (
      <Sticker {...rest}>
        <img
          src={src}
          alt=""
          draggable="false"
          style={{
            width: w,
            height: h,
            objectFit: 'contain',
            // Chained white drop-shadows trace the cutout's alpha edge, giving
            // the photo the same die-cut border the illustrated stickers have.
            filter:
              'drop-shadow(2px 0 0 #fff) drop-shadow(-2px 0 0 #fff) drop-shadow(0 2px 0 #fff) drop-shadow(0 -2px 0 #fff) drop-shadow(0 6px 12px rgba(40,30,10,0.25))',
            pointerEvents: 'none',
          }}
        />
      </Sticker>
    );
  }

  return (
    <Sticker {...rest}>
      <div
        style={{
          width: w,
          height: h,
          background: '#fff',
          borderRadius: radius,
          padding: 8,
          boxSizing: 'border-box',
        }}
      >
        <div
          style={{
            width: '100%',
            height: '100%',
            backgroundImage: `url(${src})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center top',
            borderRadius: shape === 'circle' ? '50%' : '6px',
          }}
        />
      </div>
    </Sticker>
  );
}
