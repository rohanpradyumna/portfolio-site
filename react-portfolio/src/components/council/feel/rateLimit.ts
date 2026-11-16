// Two limits, both needed. The per-key gap stops one event from machine
// gunning (a scrub dragged back and forth across a boundary). The sliding
// window caps everything together, so no mix of events can turn into a
// continuous buzz.

export interface RateLimiterOptions {
  /** Length of the sliding window in milliseconds. */
  windowMs: number;
  /** The most firings allowed inside one window, across every key. */
  maxInWindow: number;
}

export interface RateLimiter {
  /** True if `key` may fire at `now`. A true answer is recorded as a firing. */
  allow(key: string, minGapMs: number, now: number): boolean;
  reset(): void;
}

export function createRateLimiter({ windowMs, maxInWindow }: RateLimiterOptions): RateLimiter {
  const lastByKey = new Map<string, number>();
  let recent: number[] = [];

  return {
    allow(key, minGapMs, now) {
      const last = lastByKey.get(key);
      if (last !== undefined && now - last < minGapMs) return false;
      recent = recent.filter((time) => now - time < windowMs);
      if (recent.length >= maxInWindow) return false;
      recent.push(now);
      lastByKey.set(key, now);
      return true;
    },
    reset() {
      lastByKey.clear();
      recent = [];
    },
  };
}
