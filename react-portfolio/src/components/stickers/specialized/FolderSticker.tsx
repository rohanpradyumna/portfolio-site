'use client';

import React from 'react';
import { Sticker, StickerProps } from '../base/Sticker';

export function FolderSticker(props: Omit<StickerProps, 'children'>) {
  return (
    <Sticker {...props}>
      <div
        style={{
          width: 100,
          height: 80,
          position: 'relative',
        }}
      >
        {/* Folder body */}
        <svg width="100" height="80" viewBox="0 0 100 80" style={{ overflow: 'visible' }}>
          {/* Back of folder */}
          <path
            d="M 8 20 L 8 70 Q 8 76 14 76 L 86 76 Q 92 76 92 70 L 92 20 Z"
            fill="#e8c766"
            stroke="#fff"
            strokeWidth="4"
          />
          {/* Tab */}
          <path d="M 8 20 L 8 14 Q 8 8 14 8 L 38 8 L 44 18 L 8 18 Z" fill="#d4b44a" stroke="#fff" strokeWidth="4" />
          {/* Front flap with slight fold */}
          <path
            d="M 8 26 L 92 26 L 92 70 Q 92 76 86 76 L 14 76 Q 8 76 8 70 Z"
            fill="#f2d36a"
            stroke="#fff"
            strokeWidth="4"
          />
          {/* Paper peeking out */}
          <rect x="20" y="32" width="60" height="6" rx="1" fill="#faf7ef" opacity="0.9" />
          <rect x="24" y="42" width="52" height="4" rx="1" fill="#faf7ef" opacity="0.7" />
        </svg>
        {/* WRITING label */}
        <div
          style={{
            position: 'absolute',
            bottom: 6,
            left: '50%',
            transform: 'translateX(-50%)',
            background: '#1a1a1a',
            color: '#faf7ef',
            fontFamily: "'Geist Mono', monospace",
            fontSize: 8,
            fontWeight: 700,
            padding: '3px 8px',
            borderRadius: 4,
            letterSpacing: '0.08em',
            whiteSpace: 'nowrap',
            border: '2px solid #fff',
          }}
        >
          WRITING
        </div>
      </div>
    </Sticker>
  );
}
