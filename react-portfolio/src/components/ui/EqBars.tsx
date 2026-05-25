'use client';

import React from 'react';
import styles from './EqBars.module.css';

interface EqBarsProps {
  playing: boolean;
}

export function EqBars({ playing }: EqBarsProps) {
  return (
    <div className={styles.container}>
      {[0, 1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className={playing ? styles[`bar${i}`] : styles.barIdle}
        />
      ))}
    </div>
  );
}
