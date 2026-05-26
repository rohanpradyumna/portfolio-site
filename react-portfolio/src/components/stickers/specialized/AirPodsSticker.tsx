'use client';

import React, { useState } from 'react';
import { Sticker, StickerProps } from '../base/Sticker';
import { useAudio } from '@/hooks/useAudio';
import styles from './AirPodsSticker.module.css';

export interface AirPodsStickerProps extends Omit<StickerProps, 'children' | 'onClick'> {
  onPlay?: () => void;
}

export function AirPodsSticker({ onPlay, ...props }: AirPodsStickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const { playOpenSound } = useAudio();

  const handleClick = () => {
    if (isAnimating) return;
    setIsAnimating(true);
    setIsOpen(true);

    playOpenSound();

    setTimeout(() => {
      onPlay?.();
      setTimeout(() => {
        setIsOpen(false);
        setIsAnimating(false);
      }, 800);
    }, 400);
  };

  return (
    <Sticker {...props} onClick={handleClick}>
      <div
        style={{
          width: 90,
          height: 100,
          boxSizing: 'border-box',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          overflow: 'visible',
        }}
      >
        <img
          src="/assets/icons/earphone.png"
          alt="AirPods"
          draggable="false"
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            pointerEvents: 'none',
            transform: isOpen ? 'scale(1.1)' : 'scale(1)',
            transition: 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
          }}
        />
        {/* Music notes animation when open */}
        {isOpen && (
          <>
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className={styles.musicNote}
                style={{
                  top: -10 - i * 8,
                  left: 20 + i * 20,
                  animationDelay: `${i * 0.15}s`,
                }}
              >
                ♪
              </div>
            ))}
          </>
        )}
      </div>
    </Sticker>
  );
}
