'use client';

import React from 'react';
import { CouncilEntryArt } from '@/components/council/portraits';
import { Film, clamp01, easeOutCubic, easeOutQuint, mix } from './timeline';
import styles from './promo.module.css';

// The last shot: the homepage's entry sticker slapped onto a clean board, the
// name, the promise and the address. Drawn for a given time by paintEndCard().

export function EndCard({ film, ref }: { film: Film; ref: React.Ref<HTMLDivElement> }) {
  const { END_CARD } = film;
  return (
    <div className={styles.end} ref={ref} aria-hidden="true">
      <div className={styles.endArt} data-end-art>
        <CouncilEntryArt size={END_CARD.artSize} />
      </div>
      <h2 className={styles.endTitle} data-keep-clear>
        {END_CARD.title.split(' ').map((word, index) => (
          <span key={index} className={styles.endWord} data-end-word>
            {word}
          </span>
        ))}
      </h2>
      <p className={styles.endPromise} data-keep-clear>
        {END_CARD.promise.map((sentence) => (
          <span key={sentence} className={styles.endSentence} data-end-sentence>
            {sentence}
          </span>
        ))}
      </p>
      <p className={styles.endUrl} data-end-url data-keep-clear>
        <span className={styles.endHost}>{END_CARD.host}</span>
        <span className={styles.endPath}>{END_CARD.path}</span>
      </p>
      <p className={styles.endSmall} data-end-small data-keep-clear>
        {END_CARD.small}
      </p>
    </div>
  );
}

const rise = (node: HTMLElement, u: number, distance: number) => {
  node.style.opacity = String(easeOutCubic(u * 1.5));
  node.style.transform = `translate3d(0, ${((1 - easeOutQuint(u)) * distance).toFixed(2)}px, 0)`;
};

/** `t` is film time. Before END_CARD.at the card is not in the frame at all. */
export function paintEndCard(root: HTMLElement, t: number, { END_CARD }: Film): void {
  const local = t - END_CARD.at;
  root.style.visibility = local >= 0 ? 'visible' : 'hidden';
  if (local < 0) return;
  root.style.opacity = String(easeOutCubic(local / END_CARD.paperIn));

  const art = root.querySelector<HTMLElement>('[data-end-art]');
  if (art) {
    const fall = (local - END_CARD.artAt) / END_CARD.artFall;
    if (fall < 0) {
      art.style.opacity = '0';
    } else if (fall < 1) {
      // Coming down onto the board, fastest at the moment it touches.
      const down = fall * fall;
      art.style.opacity = String(clamp01(fall * 4));
      art.style.transform = `translate3d(0, ${mix(-26, 0, down).toFixed(2)}px, 0) rotate(${mix(-13, -5, down).toFixed(2)}deg) scale(${mix(1.62, 1, down).toFixed(4)})`;
    } else {
      // Contact: one squash and a wobble that dies away, as in the intro.
      const since = local - END_CARD.artAt - END_CARD.artFall;
      const squash = 0.085 * Math.exp(-11 * since) * Math.sin(2 * Math.PI * 4.6 * since);
      const wobble = 4.2 * Math.exp(-6.5 * since) * Math.sin(2 * Math.PI * 3.1 * since);
      art.style.opacity = '1';
      art.style.transform = `rotate(${(-5 + wobble).toFixed(3)}deg) scale(${(1 + squash).toFixed(4)}, ${(1 - squash).toFixed(4)})`;
    }
  }

  root.querySelectorAll<HTMLElement>('[data-end-word]').forEach((word, index) => {
    rise(word, (local - END_CARD.titleAt - index * 0.09) / 0.6, 34);
  });
  root.querySelectorAll<HTMLElement>('[data-end-sentence]').forEach((sentence, index) => {
    rise(sentence, (local - END_CARD.promiseAt - index * END_CARD.promiseGap) / 0.55, 12);
  });
  const url = root.querySelector<HTMLElement>('[data-end-url]');
  if (url) rise(url, (local - END_CARD.urlAt) / 0.5, 14);
  const small = root.querySelector<HTMLElement>('[data-end-small]');
  if (small) rise(small, (local - END_CARD.smallAt) / 0.6, 8);
}
