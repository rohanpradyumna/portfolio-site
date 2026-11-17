import React from 'react';
import styles from './council.module.css';

// Hand-drawn marks shared across the council: one pen, one weight. All
// decorative, so all hidden from assistive tech; meaning is carried in text.

/** The loop drawn around the chosen seat. Stretches to its box; the stroke does not. */
export function RingDoodle() {
  return (
    <svg className={styles.ringSvg} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      <path
        d="M52 4C24 2 5 22 4 50c-1 27 18 46 45 47 28 1 48-19 47-47C95 25 80 7 56 5c-9-1-17 1-24 5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

/** Pencil loops for "still deciding". The portraits draw their own thinking mark; this one is for the routing line. */
export function ScribbleDoodle({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 44 26" aria-hidden="true">
      <path
        className={styles.scribblePath}
        pathLength={1}
        d="M3 18c3-9 8-13 11-9s-2 11-5 8 3-13 9-12 2 12-1 10 5-12 10-10 1 11-2 9 6-10 11-7 4 8 5 8"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function TickIcon() {
  return (
    <svg viewBox="0 0 12 12" style={{ width: `calc(10 * var(--u, 1px))`, height: `calc(10 * var(--u, 1px))` }} aria-hidden="true">
      <path d="M2.2 6.4 5 9l5-6.2" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function CloseIcon() {
  return (
    <svg viewBox="0 0 12 12" style={{ width: `calc(10 * var(--u, 1px))`, height: `calc(10 * var(--u, 1px))` }} aria-hidden="true">
      <path d="M2.5 2.5l7 7M9.5 2.5l-7 7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function ArrowIcon() {
  return (
    <svg viewBox="0 0 16 12" style={{ width: `calc(15 * var(--u, 1px))`, height: `calc(11 * var(--u, 1px))` }} aria-hidden="true">
      <path d="M1.5 6h12M9.5 1.8 13.8 6l-4.3 4.2" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function StopIcon() {
  return (
    <svg viewBox="0 0 10 10" style={{ width: `calc(9 * var(--u, 1px))`, height: `calc(9 * var(--u, 1px))` }} aria-hidden="true">
      <rect x="1" y="1" width="8" height="8" rx="1.5" fill="currentColor" />
    </svg>
  );
}

export function PencilIcon() {
  return (
    <svg viewBox="0 0 16 16" style={{ width: `calc(14 * var(--u, 1px))`, height: `calc(14 * var(--u, 1px))` }} aria-hidden="true">
      <path
        d="m2.5 13.5.7-3.2 7.6-7.6a1.4 1.4 0 0 1 2 0l.5.5a1.4 1.4 0 0 1 0 2l-7.6 7.6-3.2.7ZM9.6 3.9l2.5 2.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Two lines leaving one point: the mark on a synthesis note. */
export function ForkDoodle({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 40 40" aria-hidden="true">
      <path
        d="M6 34c5-10 9-13 14-14M20 20c3-6 3-10 2-15M20 20c6 0 10 2 15 6M18 7l4-3 3 5M30 24l5 2-2 5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
