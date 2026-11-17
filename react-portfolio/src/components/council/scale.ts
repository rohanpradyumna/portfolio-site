'use client';

import { useSyncExternalStore } from 'react';

// On a desktop the scene scales so its first view fits the window's height.
// This is the same curve as `--u` in council.module.css, for the sizes that
// live in JS (portrait widths, the pager gap, the intro's choreography).

/** Width the layout was drawn at. Growing past 1 also needs this much width per unit. */
export const DESIGN_W = 1512;
/** Height of the first view (title, arc, card, starters, footer) at scale 1. */
export const FIRST_VIEW_H = 1020;
export const MIN_SCALE = 0.68;
export const MAX_SCALE = 1.7;
/** At and below this width the phone layout applies: drawn size, scrolling. */
export const PHONE_MAX_W = 768;

export function viewScale(w: number, h: number): number {
  if (!(w > 0) || !(h > 0) || w <= PHONE_MAX_W) return 1;
  const fit = Math.min(Math.max(1, w / DESIGN_W), h / FIRST_VIEW_H);
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, fit));
}

const subscribe = (onChange: () => void) => {
  window.addEventListener('resize', onChange);
  return () => window.removeEventListener('resize', onChange);
};

/** The scale for the current window. 1 on the server and during hydration. */
export function useViewScale(): number {
  return useSyncExternalStore(
    subscribe,
    () => viewScale(window.innerWidth, window.innerHeight),
    () => 1,
  );
}
