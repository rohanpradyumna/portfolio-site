'use client';

import React from 'react';
import { Sticker, StickerProps } from '../base/Sticker';
import { useResponsive } from '@/hooks/useDimensions';

interface FolderStickerProps extends Omit<StickerProps, 'children'> {
  /** Number of writing pieces inside — surfaced as a notification-style count
      badge so visitors can see at a glance there's more to read. */
  count?: number;
}

export function FolderSticker({ count, ...props }: FolderStickerProps) {
  const { s } = useResponsive();

  return (
    <Sticker {...props}>
      <div
        style={{
          width: s(100),
          height: s(80),
          position: 'relative',
        }}
      >
        {/* Folder body */}
        <svg width={s(100)} height={s(80)} viewBox="0 0 100 80" style={{ overflow: 'visible' }}>
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
            bottom: s(6),
            left: '50%',
            transform: 'translateX(-50%)',
            background: '#1a1a1a',
            color: '#faf7ef',
            fontFamily: "'Geist Mono', monospace",
            fontSize: s(8),
            fontWeight: 700,
            padding: `${s(3)}px ${s(8)}px`,
            borderRadius: s(4),
            letterSpacing: '0.08em',
            whiteSpace: 'nowrap',
            border: '2px solid #fff',
          }}
        >
          WRITING
        </div>

        {/* Count badge — the "more to read" affordance. Mirrors the email
            sticker's accent circle so it reads as a notification badge. Sits
            outside the folder's top-right corner. */}
        {count != null && count > 0 && (
          <div
            aria-hidden="true"
            style={{
              position: 'absolute',
              top: s(-6),
              right: s(-4),
              minWidth: s(24),
              height: s(24),
              padding: `0 ${s(5)}px`,
              boxSizing: 'border-box',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: '#e85d3a',
              color: '#fff',
              border: '2px solid #fff',
              borderRadius: s(12),
              fontFamily: "'Geist Mono', monospace",
              fontSize: s(12),
              fontWeight: 800,
              lineHeight: 1,
              boxShadow: '0 2px 6px rgba(26,24,22,0.28)',
            }}
          >
            {count}
          </div>
        )}
      </div>
    </Sticker>
  );
}
