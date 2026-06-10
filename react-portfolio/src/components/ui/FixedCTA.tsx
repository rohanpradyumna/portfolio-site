'use client';

import React, { useEffect, useState } from 'react';
import styles from './FixedCTA.module.css';

/**
 * Quiet, persistent contact affordance. The desktop board doesn't scroll, so
 * the email sticker is easy to miss among the cluster; this pill appears after
 * the visitor has had a moment to look around and gives them a one-tap path.
 * Rendered outside the Stage so it sits at true viewport scale.
 */
const APPEAR_DELAY_MS = 6000;

export function FixedCTA() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), APPEAR_DELAY_MS);
    return () => clearTimeout(timer);
  }, []);

  if (!visible) return null;

  return (
    <a href="mailto:pradyumnarohan@gmail.com" className={styles.pill} aria-label="Email Rohan">
      <span className={styles.dot} aria-hidden="true" />
      <span>let&apos;s build something</span>
      <span className={styles.arrow} aria-hidden="true">
        →
      </span>
    </a>
  );
}
