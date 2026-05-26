'use client';

import React from 'react';
import { Sticker, StickerProps } from '../base/Sticker';

export function LaptopSticker(props: Omit<StickerProps, 'children'>) {
  return (
    <Sticker {...props}>
      <div
        style={{
          width: 100,
          height: 90,
          padding: 6,
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
        }}
      >
        <img
          src="/assets/icons/programming.png"
          alt="My Work"
          draggable="false"
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            pointerEvents: 'none',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: -2,
            left: '50%',
            transform: 'translateX(-50%)',
            background: '#1a1a1a',
            color: '#faf7ef',
            fontFamily: "'Geist Mono', monospace",
            fontSize: 8,
            fontWeight: 700,
            padding: '3px 8px',
            borderRadius: 4,
            letterSpacing: '0.05em',
            whiteSpace: 'nowrap',
            border: '2px solid #fff',
          }}
        >
          MY WORK
        </div>
      </div>
    </Sticker>
  );
}
