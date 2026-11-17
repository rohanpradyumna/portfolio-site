'use client';

import React, { CSSProperties } from 'react';
import { PortraitMood } from '@/lib/council/contract';
import { SEAT_LIST } from '@/data/council/seats';
import { PORTRAIT_ASPECT, SeatPortrait } from '@/components/council/portraits';
import { SEAT_TILTS } from '@/components/council/motion';
import { Film, clamp01, easeInOutCubic } from './timeline';
import styles from './promo.module.css';

// The first shot, and the film's thumbnail: the six real portraits standing
// together on the board, under the hook line (which is a caption, see
// Captions.tsx). They notice the camera one by one, start talking over each
// other, then part to let the camera through to the question card that has
// been waiting underneath. Drawn for a given time by paintOpening(). Where
// each of them stands, and which way it leaves, is the format's (timeline.ts).

export function Opening({ film, ref }: { film: Film; ref: React.Ref<HTMLDivElement> }) {
  const { OPENING } = film;
  const height = OPENING.size * PORTRAIT_ASPECT;
  return (
    <div className={styles.opening} ref={ref} aria-hidden="true">
      <div className={styles.openingBoard} data-opening-board />
      <p className={styles.openingOverline} data-opening-overline data-keep-clear>
        {OPENING.overline}
      </p>
      {SEAT_LIST.map((seat, index) => (
        <div
          key={seat.id}
          className={styles.openingSeat}
          data-opening-seat
          style={
            {
              left: OPENING.seats[index].x - OPENING.size / 2,
              top: OPENING.seats[index].y - height / 2 + OPENING.seats[index].lift,
              width: OPENING.size,
              rotate: `${SEAT_TILTS[index] * 0.7}deg`,
            } as CSSProperties
          }
        >
          <div className={styles.openingSticker}>
            <SeatPortrait seatId={seat.id} size={OPENING.size} mood="idle" />
          </div>
          <span className={styles.openingTag} data-odd={index % 2 === 1 || undefined}>
            {OPENING.shortTags ? seat.lensLabel.split(' ')[0] : seat.lensLabel}
          </span>
        </div>
      ))}
    </div>
  );
}

/** A quick lift that rings out: what a sticker does when it is flicked. */
const bump = (since: number, rate: number) => (since <= 0 ? 0 : Math.exp(-6.5 * since) * Math.sin(2 * Math.PI * rate * since));

function moodAt({ OPENING }: Film, index: number, t: number): PortraitMood {
  const noticed = t - (OPENING.rippleAt + index * OPENING.rippleGap);
  if (noticed >= 0 && noticed < 1.0) return 'challenged';
  if (t >= OPENING.talkAt + OPENING.talkStagger[index]) return 'speaking';
  return 'idle';
}

export function paintOpening(root: HTMLElement, t: number, film: Film): void {
  const { OPENING } = film;
  const parting = (t - OPENING.partAt) / OPENING.partOver;
  root.style.visibility = parting >= 1.05 ? 'hidden' : 'visible';
  if (parting >= 1.05) return;

  // The paper goes a beat after the stickers start to move, so the card is found behind them.
  const board = root.querySelector<HTMLElement>('[data-opening-board]');
  if (board) board.style.opacity = String(1 - easeInOutCubic(clamp01((parting - 0.12) / 0.6)));
  const overline = root.querySelector<HTMLElement>('[data-opening-overline]');
  if (overline) {
    const leaving = clamp01(parting / 0.45);
    overline.style.opacity = String(1 - leaving);
    overline.style.transform = `translate3d(0, ${(-24 * leaving * leaving).toFixed(2)}px, 0)`;
  }

  root.querySelectorAll<HTMLElement>('[data-opening-seat]').forEach((seat, index) => {
    const notice = bump(t - (OPENING.rippleAt + index * OPENING.rippleGap), 2.4);
    const speak = bump(t - (OPENING.talkAt + OPENING.talkStagger[index]), 2.8) * 0.5;
    const hop = notice + speak;

    // A curtain opening: each of them leaves its own way, slowly at first.
    const { exit } = OPENING.seats[index];
    const u = clamp01((t - OPENING.partAt - exit.wait) / (OPENING.partOver - 0.14));
    const away = u * u * u;

    const x = away * exit.x;
    const y = -18 * hop + away * exit.y;
    const turn = away * exit.turn;
    const scale = 1 + 0.07 * hop + 0.24 * away;
    seat.style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0) rotate(${turn.toFixed(2)}deg) scale(${scale.toFixed(4)})`;

    // The portrait's own moods are CSS keyed on this attribute. Written only on a change.
    const mood = moodAt(film, index, t);
    const portrait = seat.querySelector('svg[data-seat]');
    if (portrait && portrait.getAttribute('data-mood') !== mood) portrait.setAttribute('data-mood', mood);
  });
}
