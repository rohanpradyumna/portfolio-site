'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Dimensions } from '@/types';

const DEBOUNCE_MS = 150;

// Default dimensions for SSR - will be updated on client mount
const DEFAULT_DIMS: Dimensions = { w: 1440, h: 900 };

export function useDimensions(): Dimensions {
  // Initialize with actual window dimensions if available, otherwise default
  const [dims, setDims] = useState<Dimensions>(() => {
    if (typeof window !== 'undefined') {
      return { w: window.innerWidth, h: window.innerHeight };
    }
    return DEFAULT_DIMS;
  });

  useEffect(() => {
    // Ensure we have correct dimensions on mount
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

  // Scale factor for larger screens with progressive boost for perception
  // Base: 1.0 at 1440px, applies 20% boost to compensate for perception gap on large screens
  const baseWidth = 1440;
  const rawScale = dims.w / baseWidth;
  const boost = rawScale > 1 ? 1 + (rawScale - 1) * 0.4 : 1;
  const scale = isMobile ? 1 : Math.max(1, rawScale * boost);

  // Helper to scale sizes
  const s = useCallback((size: number) => Math.round(size * scale), [scale]);

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
      mobileScale,
      layoutKey,
    }),
    [dims, isMobile, isSmallMobile, isTablet, isDesktop, scale, s, mobileScale, layoutKey]
  );
}

// Card dimensions hook
export function useCardDimensions() {
  const { dims, isMobile, scale, s } = useResponsive();

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
  }, [dims.w, isMobile, scale, s]);
}
