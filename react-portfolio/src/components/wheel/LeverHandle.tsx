'use client';

import React, { useCallback } from 'react';
import { motion, useMotionValue, animate } from 'framer-motion';
import { useAudio } from '@/hooks/useAudio';
import { useMotion } from '@/hooks/useMotion';
import styles from './LeverHandle.module.css';

const TRACK_LENGTH = 120;
const PULL_THRESHOLD = TRACK_LENGTH * 0.65;

interface LeverHandleProps {
  onPull: () => void;
  disabled: boolean;
}

export function LeverHandle({ onPull, disabled }: LeverHandleProps) {
  const y = useMotionValue(0);
  const { playShuffleSound, triggerHaptic } = useAudio();
  const { reducedMotion } = useMotion();

  const springBack = useCallback(() => {
    if (reducedMotion) {
      y.set(0);
    } else {
      animate(y, 0, { type: 'spring', stiffness: 340, damping: 18 });
    }
  }, [reducedMotion, y]);

  const fire = useCallback(() => {
    triggerHaptic(15);
    playShuffleSound();
    onPull();
  }, [triggerHaptic, playShuffleSound, onPull]);

  const handleDragEnd = useCallback(() => {
    if (!disabled && y.get() >= PULL_THRESHOLD) {
      fire();
    }
    springBack();
  }, [disabled, y, fire, springBack]);

  const handleFallbackClick = () => {
    if (disabled) return;
    fire();
  };

  return (
    <div className={styles.leverWrap}>
      <div className={styles.rail}>
        <motion.div
          className={`${styles.knob} ${disabled ? styles.knobDisabled : ''}`}
          style={{ y }}
          drag={disabled ? false : 'y'}
          dragConstraints={{ top: 0, bottom: TRACK_LENGTH }}
          dragElastic={0.15}
          dragMomentum={false}
          onDragEnd={handleDragEnd}
          whileTap={disabled ? undefined : { scale: 1.05 }}
          role="button"
          tabIndex={-1}
          aria-hidden="true"
        />
      </div>
      {/* WCAG 2.2 dragging-movements: a single-pointer alternative to the drag gesture. */}
      <button type="button" className={styles.fallbackButton} onClick={handleFallbackClick} disabled={disabled}>
        tap to pull
      </button>
    </div>
  );
}
