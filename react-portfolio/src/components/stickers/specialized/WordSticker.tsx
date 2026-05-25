'use client';

import React from 'react';
import { Sticker, StickerProps } from '../base/Sticker';

export interface WordStickerProps extends Omit<StickerProps, 'children'> {
  text: string;
  bg?: string;
  fg?: string;
  font?: string;
  fontSize?: number;
  padX?: number;
  padY?: number;
  rotate?: number;
  shape?: 'rect' | 'pill';
}

export function WordSticker({
  text,
  bg = '#1a1a1a',
  fg = '#f5f2e8',
  font = "'Geist Mono', monospace",
  fontSize = 22,
  padX = 18,
  padY = 10,
  rotate = 0,
  shape = 'rect',
  ...rest
}: WordStickerProps) {
  return (
    <Sticker {...rest}>
      <div
        style={{
          background: bg,
          color: fg,
          fontFamily: font,
          fontSize,
          fontWeight: 700,
          padding: `${padY}px ${padX}px`,
          borderRadius: shape === 'pill' ? 100 : 10,
          border: '4px solid #ffffff',
          letterSpacing: '0.02em',
          whiteSpace: 'nowrap',
          transform: `rotate(${rotate}deg)`,
          textTransform: 'uppercase',
        }}
      >
        {text}
      </div>
    </Sticker>
  );
}
