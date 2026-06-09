'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Dimensions } from '@/types';

const DEBOUNCE_MS = 150;

// Default dimensions for SSR - will be updated on client mount
const DEFAULT_DIMS: Dimensions = { w: 1440, h: 900 };

// Fixed design canvas the desktop board is laid out in. Everything is positioned
// once at this size, then the whole stage is uniformly scaled to fit the viewport
// (see Stage.tsx, which fits the measured content bounding box).
export const DESIGN_W = 1440;
export const DESIGN_H = 900;

export function useDimensions(): Dimensions {
  // Always start from the SSR default so the server HTML and the client's first
  // render agree (no hydration mismatch). Reading window here instead would make
  // the client's first render differ from the server markup; combined with the
  // Stage's suppressHydrationWarning, React would keep the stale server transform
  // in the DOM and the post-mount update would be a no-op patch, leaving the
  // board scaled for 1440x900 until the user happened to resize. Updating in the
  // effect below guarantees a real state change that forces React to repaint.
  const [dims, setDims] = useState<Dimensions>(DEFAULT_DIMS);

  useEffect(() => {
    // Snap to the real viewport size on mount (changes DEFAULT_DIMS -> actual).
    setDims({ w: window.innerWidth, h: window.innerHeight });

    let timeoutId: NodeJS.Timeout;
    let rafId: number;

    const handleResize = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        cancelAnimationFrame(rafId);
        rafId = requestAnimationFrame(() => {
          setDims({ w: window.innerWidth, h: window.innerHeight });
        });
      }, DEBOUNCE_MS);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(timeoutId);
      cancelAnimationFrame(rafId);
    };
  }, []);

  return dims;
}

export function useResponsive() {
  const dims = useDimensions();

  const isMobile = dims.w <= 768;
  const isSmallMobile = dims.w <= 380;
  const isTablet = dims.w > 768 && dims.w <= 1024;
  const isDesktop = dims.w > 1024;

  // Desktop is laid out at a fixed design size and uniformly scaled by the Stage,
  // so element-level scaling is now identity. This removes the old width-only
  // scaling that distorted the layout on large screens.
  const scale = 1;

  // Single scale function for both sizes and distances (matches vanilla)
  const s = useCallback((size: number) => Math.round(size * scale), [scale]);
  const d = useCallback((dist: number) => Math.round(dist * scale), [scale]);

  // Mobile scale factor
  const mobileScale = isSmallMobile ? 0.75 : 0.85;

  // Layout key for forcing re-mount on significant viewport changes
  const layoutKey = `${Math.floor(dims.w / 100)}-${Math.floor(dims.h / 100)}`;

  return useMemo(
    () => ({
      dims,
      isMobile,
      isSmallMobile,
      isTablet,
      isDesktop,
      scale,
      s,
      d,
      mobileScale,
      layoutKey,
    }),
    [dims, isMobile, isSmallMobile, isTablet, isDesktop, scale, s, d, mobileScale, layoutKey]
  );
}

// Card dimensions hook
export function useCardDimensions() {
  const { dims, isMobile, scale } = useResponsive();

  return useMemo(() => {
    const cardW = isMobile ? Math.min(dims.w - 32, 400) : Math.round(440 * scale);
    const cardH = isMobile ? 'auto' : Math.round(320 * scale);
    const cardMinH = isMobile ? 280 : Math.round(300 * scale);
    const cardPadding = isMobile
      ? '24px 20px 22px'
      : `${Math.round(28 * scale)}px ${Math.round(30 * scale)}px ${Math.round(26 * scale)}px`;

    return {
      cardW,
      cardH,
      cardMinH,
      cardPadding,
    };
  }, [dims.w, isMobile, scale]);
}
