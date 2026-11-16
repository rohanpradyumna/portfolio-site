import { beforeEach, describe, expect, it } from 'vitest';
import { endFirstVisit, readFirstVisit, resetFirstVisitForTest } from './introLatch';

describe('the first-visit latch', () => {
  beforeEach(() => resetFirstVisitForTest());

  it('reports a first visit when the intro has not been seen', () => {
    expect(readFirstVisit(() => false)).toBe(true);
  });

  it('reports a return visit when it has', () => {
    expect(readFirstVisit(() => true)).toBe(false);
  });

  it('holds its answer while the intro is on screen, even after the intro marks itself seen', () => {
    let seen = false;
    expect(readFirstVisit(() => seen)).toBe(true);
    seen = true; // the intro writes this as it starts to leave
    expect(readFirstVisit(() => seen)).toBe(true);
  });

  it('lets go when the intro ends, so coming back in the same page load does not replay it', () => {
    expect(readFirstVisit(() => false)).toBe(true);
    endFirstVisit();
    // A second mount of the page, same module instance, storage now says seen.
    expect(readFirstVisit(() => true)).toBe(false);
    // And it does not depend on storage having been written at all (private mode).
    expect(readFirstVisit(() => false)).toBe(false);
  });

  it('still replays for a visitor who left before the intro ended', () => {
    expect(readFirstVisit(() => false)).toBe(true);
    // No endFirstVisit: they navigated away mid-intro and came back.
    expect(readFirstVisit(() => false)).toBe(true);
  });
});
