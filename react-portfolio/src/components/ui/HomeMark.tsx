'use client';

import React from 'react';
import styles from './HomeMark.module.css';

interface HomeMarkProps {
  /** Closes the takeover; these screens sit over the board, so home is one step back. */
  onClick: () => void;
  /** Pinned to the board header's spot, or laid out inline (inside the Dock's menu bar). */
  pinned?: boolean;
  className?: string;
}

/** The constant way home: the same "rohan ·" mark as the board and The Council. */
export function HomeMark({ onClick, pinned = false, className }: HomeMarkProps) {
  const cls = [styles.mark, pinned ? styles.pinned : '', className ?? ''].filter(Boolean).join(' ');
  return (
    <button type="button" className={cls} onClick={onClick} aria-label="rohan, back to the board" data-autofocus>
      <span className={styles.name}>rohan</span>
      <span className={styles.dot} aria-hidden="true" />
    </button>
  );
}
