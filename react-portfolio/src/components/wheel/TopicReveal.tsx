'use client';

import React from 'react';
import { WheelTopicFlat } from '@/types';
import styles from './wheel.module.css';

interface TopicRevealProps {
  topic: WheelTopicFlat;
  onWrite: () => void;
  onSpinAgain: () => void;
  showWriteCta: boolean;
}

export function TopicReveal({ topic, onWrite, onSpinAgain, showWriteCta }: TopicRevealProps) {
  return (
    <div className={styles.revealCard}>
      <span className={styles.categoryPill} style={{ background: topic.categoryColor }}>
        {topic.categoryLabel}
      </span>
      <div className={styles.topicText}>{topic.text}</div>
      <div className={styles.ctaRow}>
        {showWriteCta && (
          <button className={styles.spinButton} onClick={onWrite}>
            Write your response
          </button>
        )}
        <button className={styles.secondaryButton} onClick={onSpinAgain}>
          Pull again
        </button>
      </div>
    </div>
  );
}
