'use client';

import { useState, useEffect } from 'react';

/**
 * Tracks the user's `prefers-reduced-motion` preference. Used to gate JS-driven
 * animations that CSS/Framer can't automatically suppress (card entrance, swipe
 * hint, the Pocket Canvas portrait nudge, sticker entrance stagger).
 */
export function useMotion() {
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mq.matches);

    const handleChange = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener('change', handleChange);
    return () => mq.removeEventListener('change', handleChange);
  }, []);

  return { reducedMotion };
}
