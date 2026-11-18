'use client';

import React, { useEffect, useRef, useState } from 'react';
import { WheelTopicFlat } from '@/types';
import { RabbitHoleMode } from '@/data/rabbitHoleModes';
import styles from './wheel.module.css';

// navigator.clipboard needs a secure context and can be blocked by permissions;
// fall back to the older execCommand technique so the button still works.
async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const area = document.createElement('textarea');
      area.value = text;
      area.style.position = 'fixed';
      area.style.opacity = '0';
      document.body.appendChild(area);
      area.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(area);
      return ok;
    } catch {
      return false;
    }
  }
}

type Copied = 'none' | 'prompt' | 'link' | 'failed';

/** A stable ticket number per topic, so a shared ticket keeps its number. */
function ticketNo(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return String(h % 10000).padStart(4, '0');
}

interface TicketProps {
  topic: WheelTopicFlat;
  mode: RabbitHoleMode;
}

/** What the machine prints: the topic, how to learn it, and the prompt, ready for any AI. */
export function Ticket({ topic, mode }: TicketProps) {
  const prompt = mode.prompt(topic.text);
  const [copied, setCopied] = useState<Copied>('none');
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  const flash = (state: Copied) => {
    setCopied(state);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied('none'), 2000);
  };

  const copyPrompt = async () => flash((await copyText(prompt)) ? 'prompt' : 'failed');
  const copyLink = async () => {
    const url = `${window.location.origin}/wheel?t=${encodeURIComponent(topic.id)}&m=${encodeURIComponent(mode.id)}`;
    flash((await copyText(url)) ? 'link' : 'failed');
  };

  const q = encodeURIComponent(prompt);

  return (
    <article className={styles.ticket} aria-labelledby="ticket-topic">
      <div className={styles.stub}>
        <span>No. {ticketNo(topic.id)}</span>
        <span className={styles.stubSubject}>
          <span className={styles.subjectDot} style={{ background: topic.categoryColor }} />
          {topic.categoryLabel}
        </span>
        <span>{mode.label}</span>
      </div>
      <h2 id="ticket-topic" className={styles.ticketTopic}>
        {topic.text}
      </h2>

      <details className={styles.promptDetails}>
        <summary className={styles.promptSummary}>Read the prompt</summary>
        <p className={styles.promptText}>{prompt}</p>
      </details>

      <div className={styles.actions}>
        <a className={styles.ctaPrimary} href={`https://claude.ai/new?q=${q}`} target="_blank" rel="noopener noreferrer">
          Open in Claude
        </a>
        <a className={styles.ctaSecondary} href={`https://chatgpt.com/?q=${q}`} target="_blank" rel="noopener noreferrer">
          Open in ChatGPT
        </a>
        <button type="button" className={styles.ctaSecondary} onClick={copyPrompt}>
          {copied === 'prompt' ? 'Copied' : 'Copy prompt'}
        </button>
        <button type="button" className={styles.linkButton} onClick={copyLink}>
          {copied === 'link' ? 'Link copied' : 'Share this one'}
        </button>
      </div>
      <p className={styles.srOnly} aria-live="polite">
        {copied === 'prompt' ? 'Prompt copied' : copied === 'link' ? 'Link copied' : copied === 'failed' ? "Couldn't copy" : ''}
      </p>
      {copied === 'failed' && <p className={styles.copyFail}>Couldn&apos;t copy. Open the prompt above and select it.</p>}
    </article>
  );
}
