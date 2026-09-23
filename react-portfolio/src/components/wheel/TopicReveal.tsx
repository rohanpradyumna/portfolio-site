'use client';

import React, { useState } from 'react';
import { WheelTopicFlat } from '@/types';
import styles from './wheel.module.css';

interface TopicRevealProps {
  topic: WheelTopicFlat;
  onWrite: () => void;
  onSpinAgain: () => void;
  showWriteCta: boolean;
}

function buildResearchPrompt(topicText: string): string {
  return `Teach me this in about 10 minutes of reading, not a shallow summary, not an exhaustive deep dive:

"${topicText}"

Cover: what it actually means, why it matters, one concrete example or story, and one common misconception people have about it. Assume I'm curious and reasonably smart, but new to this specific topic.`;
}

// navigator.clipboard needs a secure context and can be blocked by permissions;
// fall back to the older execCommand technique so the button still works.
async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(textarea);
      return ok;
    } catch {
      return false;
    }
  }
}

export function TopicReveal({ topic, onWrite, onSpinAgain, showWriteCta }: TopicRevealProps) {
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'error'>('idle');

  const handleCopyPrompt = async () => {
    const ok = await copyToClipboard(buildResearchPrompt(topic.text));
    setCopyStatus(ok ? 'copied' : 'error');
    setTimeout(() => setCopyStatus('idle'), 2000);
  };

  return (
    <div className={styles.revealCard}>
      <span className={styles.categoryPill} style={{ background: topic.categoryColor }}>
        {topic.categoryLabel}
      </span>
      <div className={styles.topicText}>{topic.text}</div>

      <button type="button" className={styles.copyPromptButton} onClick={handleCopyPrompt}>
        {copyStatus === 'copied' ? (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6L9 17l-5-5" />
          </svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="8" y="4" width="8" height="4" rx="1" />
            <path d="M8 6H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-2" />
          </svg>
        )}
        <span aria-live="polite">
          {copyStatus === 'copied' ? 'Copied!' : copyStatus === 'error' ? "Couldn't copy" : 'Copy research prompt'}
        </span>
      </button>

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
