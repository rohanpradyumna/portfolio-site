'use client';

import React from 'react';
import { Film, clamp01, easeOutCubic } from './timeline';
import styles from './promo.module.css';

// A stand-in pointer, so a click in the film has a hand behind it, and a
// stand-in text caret, because the real one blinks on the real clock and is
// hidden. Both are drawn in frame space, above the camera, and both are
// painted by the director from the timeline. On the desktop page the hand is
// a mouse arrow. On the phone's it is a fingertip: nobody has an arrow there.

export function Cursor({ pointer, ref }: { pointer: Film['POINTER']; ref: React.Ref<HTMLDivElement> }) {
  return (
    <div className={styles.pointerLayer} ref={ref} aria-hidden="true">
      <span className={styles.caret} data-caret />
      <span className={styles.ripple} data-ripple />
      <span className={styles.cursor} data-cursor data-pointer={pointer}>
        {pointer === 'arrow' && (
          <svg width="26" height="30" viewBox="0 0 26 30" fill="none">
            <path
              d="M4 2.6v20.2l5.1-4.6 3.5 8.2 3.5-1.5-3.5-8.1h7.1L4 2.6Z"
              fill="#1a1816"
              stroke="#fffefb"
              strokeWidth="1.8"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </span>
    </div>
  );
}

export interface CursorState {
  x: number;
  y: number;
  opacity: number;
  /** Seconds since the last press, or null if there has been none. */
  sincePress: number | null;
  /** Where that press landed. */
  pressX: number;
  pressY: number;
}

const PRESS = 0.2;
const RIPPLE = 0.55;

export function paintCursor(root: HTMLElement, state: CursorState): void {
  const cursor = root.querySelector<HTMLElement>('[data-cursor]');
  const ripple = root.querySelector<HTMLElement>('[data-ripple]');
  if (!cursor || !ripple) return;

  const pressing = state.sincePress !== null && state.sincePress < PRESS;
  // Down fast, back up slower: the dip of a finger on a trackpad.
  const dip = pressing && state.sincePress !== null ? Math.sin(Math.PI * Math.sqrt(state.sincePress / PRESS)) : 0;
  cursor.style.opacity = String(state.opacity);
  cursor.style.transform = `translate3d(${state.x.toFixed(2)}px, ${state.y.toFixed(2)}px, 0) scale(${(1 - 0.14 * dip).toFixed(3)})`;

  if (state.sincePress !== null && state.sincePress < RIPPLE) {
    const u = clamp01(state.sincePress / RIPPLE);
    ripple.style.opacity = String((1 - easeOutCubic(u)) * 0.55 * state.opacity);
    ripple.style.transform = `translate3d(${state.pressX.toFixed(2)}px, ${state.pressY.toFixed(2)}px, 0) scale(${(0.35 + 0.9 * easeOutCubic(u)).toFixed(3)})`;
  } else {
    ripple.style.opacity = '0';
  }
}

export interface CaretState {
  visible: boolean;
  x: number;
  y: number;
  height: number;
  width: number;
  color: string;
}

export function paintCaret(root: HTMLElement, state: CaretState): void {
  const caret = root.querySelector<HTMLElement>('[data-caret]');
  if (!caret) return;
  caret.style.opacity = state.visible ? '1' : '0';
  if (!state.visible) return;
  caret.style.transform = `translate3d(${state.x.toFixed(2)}px, ${state.y.toFixed(2)}px, 0)`;
  caret.style.height = `${state.height.toFixed(2)}px`;
  caret.style.width = `${state.width.toFixed(2)}px`;
  caret.style.background = state.color;
}
