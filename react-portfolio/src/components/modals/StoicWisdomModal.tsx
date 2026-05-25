'use client';

import React from 'react';
import { StoicQuote } from '@/types';
import { useResponsive } from '@/hooks/useDimensions';
import styles from './StoicWisdomModal.module.css';

interface StoicWisdomModalProps {
  open: boolean;
  onClose: () => void;
  quote: StoicQuote | null;
}

export function StoicWisdomModal({ open, onClose, quote }: StoicWisdomModalProps) {
  const { isMobile } = useResponsive();

  if (!open || !quote) return null;

  return (
    <div
      className={styles.overlay}
      onPointerDown={onClose}
      style={{
        alignItems: isMobile ? 'flex-end' : 'center',
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="stoic-title"
    >
      <div
        className={styles.content}
        onPointerDown={(e) => e.stopPropagation()}
        style={{
          borderRadius: isMobile ? '24px 24px 0 0' : 20,
          padding: isMobile ? '32px 24px 40px' : '40px 44px',
          maxWidth: isMobile ? '100%' : 440,
          width: isMobile ? '100%' : 'auto',
        }}
      >
        {/* Coffee ring stain decorations */}
        <div className={styles.coffeeRing1} />
        <div className={styles.coffeeRing2} />

        {/* Drag handle for mobile */}
        {isMobile && <div className={styles.dragHandle} />}

        {/* Close button */}
        <button
          onClick={onClose}
          className={styles.closeButton}
          style={{
            top: isMobile ? 24 : 16,
            right: isMobile ? 16 : 16,
          }}
          aria-label="Close modal"
        >
          ×
        </button>

        {/* Header with coffee cup icon */}
        <div className={styles.header}>
          <div className={styles.iconWrapper}>☕</div>
          <div>
            <div
              id="stoic-title"
              className={styles.title}
              style={{ fontSize: isMobile ? 20 : 24 }}
            >
              your daily brew
            </div>
            <div className={styles.subtitle}>a cup of stoic wisdom</div>
          </div>
        </div>

        {/* Quote */}
        <div
          className={styles.quote}
          style={{ fontSize: isMobile ? 20 : 24 }}
        >
          &ldquo;{quote.text}&rdquo;
        </div>

        {/* Author */}
        <div className={styles.author}>
          <span className={styles.authorLine} />
          {quote.author}
        </div>

        {/* Savor button */}
        <button onClick={onClose} className={styles.savorButton}>
          savor this thought ✨
        </button>
      </div>
    </div>
  );
}
