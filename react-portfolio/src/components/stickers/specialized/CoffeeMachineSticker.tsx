'use client';

import React, { useState } from 'react';
import { Sticker, StickerProps } from '../base/Sticker';
import { useAudio } from '@/hooks/useAudio';
import { useResponsive } from '@/hooks/useDimensions';
import styles from './CoffeeMachineSticker.module.css';

export interface CoffeeMachineStickerProps extends Omit<StickerProps, 'children' | 'onClick'> {
  onBrew?: () => void;
}

export function CoffeeMachineSticker({ onBrew, ...props }: CoffeeMachineStickerProps) {
  const [brewing, setBrewing] = useState(false);
  const { playBrewSound } = useAudio();
  const { s } = useResponsive();

  const handleClick = () => {
    if (brewing) return;
    setBrewing(true);
    playBrewSound();

    setTimeout(() => {
      setBrewing(false);
      onBrew?.();
    }, 2200);
  };

  return (
    <Sticker {...props} onClick={handleClick}>
      <div style={{ position: 'relative', width: s(100), height: s(130) }}>
        {/* Steam particles - only visible when brewing */}
        <div
          className={styles.steamContainer}
          style={{
            opacity: brewing ? 1 : 0,
          }}
        >
          {[0, 1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className={brewing ? styles.steam : ''}
              style={{
                left: s(10 + i * 10),
                animationDelay: `${i * 0.12}s`,
                animationDuration: `${0.8 + i * 0.15}s`,
              }}
            />
          ))}
        </div>

        {/* Coffee machine body */}
        <div
          className={brewing ? styles.machineShake : ''}
          style={{
            width: s(100),
            height: s(110),
            boxSizing: 'border-box',
          }}
        >
          <img
            src="/assets/icons/coffee-machine.png"
            alt="Coffee Machine"
            draggable="false"
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'contain',
              pointerEvents: 'none',
            }}
          />

          {/* Coffee drip animation overlay */}
          {brewing && <div className={styles.coffeeDrip} />}
        </div>

        {/* BREW ME label */}
        <div
          className={!brewing ? styles.brewPulse : ''}
          style={{
            position: 'absolute',
            bottom: 0,
            left: '50%',
            transform: 'translateX(-50%)',
            background: brewing ? '#8B4513' : '#6b3a1f',
            color: '#faf7ef',
            fontFamily: "'Geist Mono', monospace",
            fontSize: s(9),
            fontWeight: 700,
            padding: `${s(4)}px ${s(10)}px`,
            borderRadius: s(6),
            letterSpacing: '0.08em',
            whiteSpace: 'nowrap',
            border: '2px solid #fff',
            transition: 'background 0.3s',
          }}
        >
          {brewing ? '☕ BREWING...' : '☕ BREW ME'}
        </div>
      </div>
    </Sticker>
  );
}
