'use client';

import React from 'react';
import { Caption, Film, clamp01, easeOutCubic, easeOutQuint } from './timeline';
import styles from './promo.module.css';

// Captions over the interface sit on a soft wash of paper that fades it out
// beneath them, so a line never fights the UI it is about. Where a caption
// goes in each format is CSS (promo.module.css). Nothing here animates on its
// own: paintCaptions() draws the state for a given time, and the director
// calls it once per frame.

const WORD_STAGGER = 0.055;
const WORD_RISE = 0.55;
const EXIT = 0.32;

export function Captions({ film, ref }: { film: Film; ref: React.Ref<HTMLDivElement> }) {
  return (
    <div className={styles.captions} ref={ref} aria-hidden="true">
      <div className={styles.wash} data-wash />
      {film.CAPTIONS.map((caption) => (
        <div key={caption.id} className={styles.caption} data-caption={caption.id} data-place={caption.place}>
          {caption.line && (
            <p className={styles.captionLine} data-keep-clear>
              {caption.line.split(' ').map((word, index) => (
                <span key={index} className={styles.captionWord} data-word>
                  {word}
                </span>
              ))}
            </p>
          )}
          {caption.small && (
            <p className={styles.captionSmall} data-small data-keep-clear>
              {caption.small}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

/** How much of the paper wash a caption calls for at `t`: up a little early, down a little late. */
function washFor(caption: Caption, t: number, { lead, rise }: Film['WASH']): number {
  return Math.min(clamp01((t - caption.from + lead) / rise), 1 - clamp01((t - caption.to - 0.1) / 0.55));
}

export function paintCaptions(root: HTMLElement, t: number, film: Film): void {
  let wash = 0;
  for (const caption of film.CAPTIONS) {
    if (caption.place === 'over') wash = Math.max(wash, washFor(caption, t, film.WASH));
    const node = root.querySelector<HTMLElement>(`[data-caption="${caption.id}"]`);
    if (!node) continue;
    const live = t >= caption.from && t <= caption.to + EXIT;
    node.style.visibility = live ? 'visible' : 'hidden';
    if (!live) continue;

    const leaving = easeOutCubic((t - caption.to) / EXIT);
    node.style.opacity = String(1 - leaving);
    node.style.transform = `translate3d(0, ${(-8 * leaving).toFixed(2)}px, 0)`;

    const words = node.querySelectorAll<HTMLElement>('[data-word]');
    words.forEach((word, index) => {
      const u = (t - caption.from - index * WORD_STAGGER) / WORD_RISE;
      word.style.opacity = String(easeOutCubic(u * 1.6));
      word.style.transform = `translate3d(0, ${((1 - easeOutQuint(u)) * 0.5).toFixed(3)}em, 0)`;
    });
    const small = node.querySelector<HTMLElement>('[data-small]');
    if (small) {
      const u = (t - caption.from - words.length * WORD_STAGGER - 0.2) / 0.5;
      small.style.opacity = String(easeOutCubic(u));
      small.style.transform = `translate3d(0, ${((1 - easeOutQuint(u)) * 6).toFixed(2)}px, 0)`;
    }
  }
  const washNode = root.querySelector<HTMLElement>('[data-wash]');
  if (washNode) washNode.style.opacity = String(easeOutCubic(wash));
}
