'use client';

import { RefObject, useLayoutEffect } from 'react';

interface CanvasFit {
  /** Design width and height the canvas is laid out at. */
  width: number;
  height: number;
  min: number;
  max: number;
  /** Below this viewport width the canvas is off and content flows normally (phones). */
  fromWidth?: number;
}

/**
 * The board's Stage idea for a takeover: lay a screen out once at a fixed size,
 * then scale it uniformly to its frame, so a 13" laptop and a large monitor see
 * the same composition. Writes --k, --ox and --oy on `frame`; the CSS positions
 * and scales `canvas` with them. If content outgrows the design height, the fit
 * uses the real height instead, so new copy shrinks the canvas rather than clipping.
 */
export function useCanvasFit(
  frame: RefObject<HTMLElement | null>,
  canvas: RefObject<HTMLElement | null>,
  { width, height, min, max, fromWidth = 769 }: CanvasFit
) {
  useLayoutEffect(() => {
    const f = frame.current;
    const c = canvas.current;
    if (!f || !c) return;
    const wide = window.matchMedia(`(min-width: ${fromWidth}px)`);

    const fit = () => {
      if (!wide.matches) {
        ['--k', '--ox', '--oy'].forEach((p) => f.style.removeProperty(p));
        return;
      }
      const h = Math.max(height, c.scrollHeight);
      const vw = f.clientWidth;
      const vh = f.clientHeight;
      const k = Math.min(max, Math.max(min, Math.min(vw / width, vh / h)));
      f.style.setProperty('--k', String(k));
      f.style.setProperty('--ox', `${Math.max(0, (vw - width * k) / 2)}px`);
      f.style.setProperty('--oy', `${Math.max(0, (vh - h * k) / 2)}px`);
    };

    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(f);
    // The canvas box is fixed; its children grow when content changes (a card appears).
    Array.from(c.children).forEach((child) => ro.observe(child));
    wide.addEventListener('change', fit);
    return () => {
      ro.disconnect();
      wide.removeEventListener('change', fit);
    };
  }, [frame, canvas, width, height, min, max, fromWidth]);
}
