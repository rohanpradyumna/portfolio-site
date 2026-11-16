import { describe, expect, it } from 'vitest';
import { createRateLimiter } from './rateLimit';

describe('createRateLimiter', () => {
  it('holds one key to its minimum gap', () => {
    const limiter = createRateLimiter({ windowMs: 1000, maxInWindow: 100 });
    expect(limiter.allow('scrubTick', 70, 0)).toBe(true);
    expect(limiter.allow('scrubTick', 70, 30)).toBe(false);
    expect(limiter.allow('scrubTick', 70, 69)).toBe(false);
    expect(limiter.allow('scrubTick', 70, 70)).toBe(true);
  });

  it('measures the gap from the last firing that was allowed, not the last one asked for', () => {
    const limiter = createRateLimiter({ windowMs: 1000, maxInWindow: 100 });
    expect(limiter.allow('a', 100, 0)).toBe(true);
    expect(limiter.allow('a', 100, 60)).toBe(false);
    expect(limiter.allow('a', 100, 110)).toBe(true);
  });

  it('keeps keys independent', () => {
    const limiter = createRateLimiter({ windowMs: 1000, maxInWindow: 100 });
    expect(limiter.allow('a', 500, 0)).toBe(true);
    expect(limiter.allow('b', 500, 1)).toBe(true);
    expect(limiter.allow('a', 500, 2)).toBe(false);
  });

  it('caps the total across keys inside the window', () => {
    const limiter = createRateLimiter({ windowMs: 1000, maxInWindow: 3 });
    expect(limiter.allow('a', 0, 0)).toBe(true);
    expect(limiter.allow('b', 0, 10)).toBe(true);
    expect(limiter.allow('c', 0, 20)).toBe(true);
    expect(limiter.allow('d', 0, 30)).toBe(false);
    // The window slides: the first firing ages out at 1000ms.
    expect(limiter.allow('d', 0, 999)).toBe(false);
    expect(limiter.allow('d', 0, 1000)).toBe(true);
  });

  it('cannot be scrubbed into a continuous buzz', () => {
    const limiter = createRateLimiter({ windowMs: 1000, maxInWindow: 8 });
    let fired = 0;
    // A frantic drag asking for a tick every 4ms for three seconds.
    for (let now = 0; now < 3000; now += 4) if (limiter.allow('scrubTick', 70, now)) fired++;
    expect(fired).toBeLessThanOrEqual(24);
    expect(fired).toBeGreaterThan(0);
  });

  it('a refused firing does not use up budget', () => {
    const limiter = createRateLimiter({ windowMs: 1000, maxInWindow: 2 });
    expect(limiter.allow('a', 200, 0)).toBe(true);
    for (let now = 1; now < 100; now++) expect(limiter.allow('a', 200, now)).toBe(false);
    expect(limiter.allow('b', 0, 100)).toBe(true);
  });

  it('forgets everything on reset', () => {
    const limiter = createRateLimiter({ windowMs: 1000, maxInWindow: 1 });
    expect(limiter.allow('a', 500, 0)).toBe(true);
    expect(limiter.allow('a', 500, 1)).toBe(false);
    limiter.reset();
    expect(limiter.allow('a', 500, 2)).toBe(true);
  });
});
