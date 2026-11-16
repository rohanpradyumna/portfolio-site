'use client';

import { useCallback, useEffect, useSyncExternalStore } from 'react';

const noop = () => () => {};

/** window.location.search, or null on the server and during hydration. */
export function useLocationSearch(): string | null {
  return useSyncExternalStore(
    noop,
    () => window.location.search,
    () => null,
  );
}

/** A media query that renders `serverDefault` on the server, then corrects itself after hydration. */
export function useMediaQuery(query: string, serverDefault = false): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const list = window.matchMedia(query);
      list.addEventListener('change', onChange);
      return () => list.removeEventListener('change', onChange);
    },
    [query],
  );
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => serverDefault,
  );
}

export const usePrefersReducedMotion = () => useMediaQuery('(prefers-reduced-motion: reduce)');

/** Calls `onEscape` for the Escape key while `active`. */
export function useEscape(active: boolean, onEscape: () => void): void {
  useEffect(() => {
    if (!active) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !event.defaultPrevented) {
        event.preventDefault();
        onEscape();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active, onEscape]);
}

/** "9:00 PM" for a reset later today, "Tue 9:00 AM" for one further out. Null if unusable. */
export function formatResetAt(resetAt: string | null, now: Date = new Date()): string | null {
  if (!resetAt) return null;
  const date = new Date(resetAt);
  if (Number.isNaN(date.getTime()) || date.getTime() <= now.getTime()) return null;
  const sameDay = date.toDateString() === now.toDateString();
  const time = date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  return sameDay ? time : `${date.toLocaleDateString(undefined, { weekday: 'short' })} ${time}`;
}
