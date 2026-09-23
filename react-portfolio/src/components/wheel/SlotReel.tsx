'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { motion, MotionValue, useVelocity, useTransform } from 'framer-motion';
import { WHEEL_TOPICS } from '@/data/wheelTopics';
import styles from './wheel.module.css';

// How many times WHEEL_TOPICS is repeated to build the scrollable strip. Large
// enough that a spin's travel (see WheelCanvas's EXTRA_LOOPS) never reaches
// either end, so the reel never visibly "runs out" of rows.
const LOOP_COUNT = 10;

export const ROW_HEIGHT = 76;
export const VIEWPORT_ROWS = 5;
export const VIEWPORT_HEIGHT = ROW_HEIGHT * VIEWPORT_ROWS;
// y-offset that centers row 0 in the viewport; see WheelCanvas's targeting math.
export const CENTER_OFFSET = VIEWPORT_HEIGHT / 2 - ROW_HEIGHT / 2;
export const TOTAL_ROWS = WHEEL_TOPICS.length * LOOP_COUNT;

interface SlotReelProps {
  y: MotionValue<number>;
  // Increments once per landing; SlotReel watches it to fire a brief flourish
  // on the selection window without WheelCanvas needing to know about that UI.
  landedPulse: number;
}

export function SlotReel({ y, landedPulse }: SlotReelProps) {
  const rows = useMemo(
    () => Array.from({ length: TOTAL_ROWS }, (_, i) => WHEEL_TOPICS[i % WHEEL_TOPICS.length]),
    []
  );

  // A touch of motion blur while the reel is moving fast, sharpening back to
  // 0 as it decelerates into the landing - reads as "spinning", not just scrolling.
  const velocity = useVelocity(y);
  const blurFilter = useTransform(velocity, (v) => `blur(${Math.min(Math.abs(v) / 700, 3.5).toFixed(2)}px)`);

  // landedPulse increments once per landing; detect that change during render
  // (React's documented pattern for "adjust state when a prop changes") rather
  // than in an effect body, then let an effect own only the timed reset.
  const [seenPulse, setSeenPulse] = useState(landedPulse);
  const [flash, setFlash] = useState(false);
  if (landedPulse !== seenPulse) {
    setSeenPulse(landedPulse);
    if (landedPulse > 0) setFlash(true);
  }
  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(false), 550);
    return () => clearTimeout(t);
  }, [flash]);

  return (
    <div className={styles.reelViewport} style={{ height: VIEWPORT_HEIGHT }}>
      <motion.div className={styles.reelStrip} style={{ y, filter: blurFilter }}>
        {rows.map((topic, i) => (
          <div key={i} className={styles.reelRow} style={{ height: ROW_HEIGHT }}>
            <span className={styles.reelDot} style={{ background: topic.categoryColor }} />
            <span className={styles.reelText}>{topic.text}</span>
          </div>
        ))}
      </motion.div>
      <div
        className={`${styles.reelSelection} ${flash ? styles.reelSelectionFlash : ''}`}
        style={{ height: ROW_HEIGHT }}
        aria-hidden="true"
      />
    </div>
  );
}
