'use client';

import React, { useState } from 'react';
import { motion, MotionValue, useMotionValueEvent, useTransform, useVelocity } from 'framer-motion';
import styles from './wheel.module.css';

export const ROW_H = 60;

/** Row index sitting on the payline for a given strip offset. */
export const rowAt = (y: number) => Math.round(-y / ROW_H);
/** Strip offset that puts row `i` on the payline. */
export const yFor = (i: number) => -i * ROW_H;

interface ReelProps {
  y: MotionValue<number>;
  /** What row `i` shows. The strip is endless, so only the rows in view are ever rendered. */
  itemAt: (i: number) => React.ReactNode;
}

/**
 * One slot-machine window. The old reel mounted every topic ten times over
 * (about 35,000 nodes); this one renders the rows around the payline and
 * slides them with the motion value, so a long spin costs the same as a short one.
 * How many rows show (three on desktop, one on phones) is CSS: --reel-half.
 */
export function Reel({ y, itemAt }: ReelProps) {
  const [center, setCenter] = useState(() => rowAt(y.get()));
  useMotionValueEvent(y, 'change', (v) => {
    const c = rowAt(v);
    setCenter((prev) => (prev === c ? prev : c));
  });

  // A touch of blur while the strip is fast, gone by the time it lands.
  const velocity = useVelocity(y);
  const filter = useTransform(velocity, (v) => {
    const b = Math.min(Math.abs(v) / 1100, 1.6);
    return b < 0.05 ? 'none' : `blur(${b.toFixed(2)}px)`;
  });

  const rows = [];
  for (let i = center - 2; i <= center + 2; i++) {
    rows.push(
      <div key={i} className={`${styles.reelRow} ${i === center ? styles.reelRowOn : ''}`} style={{ top: i * ROW_H }}>
        <span className={styles.reelText}>{itemAt(i)}</span>
      </div>
    );
  }

  return (
    <div className={styles.reelWindow} aria-hidden="true">
      <motion.div className={styles.reelStrip} style={{ y, filter }}>
        {rows}
      </motion.div>
      <div className={styles.payline} />
    </div>
  );
}
