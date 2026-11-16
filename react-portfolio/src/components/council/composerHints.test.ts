import { describe, expect, it } from 'vitest';
import { COUNCIL_LIMITS } from '@/lib/council/contract';
import { COUNCIL_COPY } from '@/data/council/copy';
import { composerHints } from './composerHints';

const MAX = COUNCIL_LIMITS.maxInputChars;
const ofLength = (length: number) => 'x'.repeat(length);

describe('composerHints', () => {
  it('says nothing while there is plenty of room', () => {
    expect(composerHints('A real question?', false)).toEqual({ blocked: false, problem: null, hint: null, spoken: '' });
  });

  it('shows the countdown for the last 200 characters without reading out every keystroke', () => {
    const spokenAt: number[] = [];
    for (let left = 200; left >= 0; left--) {
      const hints = composerHints(ofLength(MAX - left), false);
      expect(hints.hint).toBe(COUNCIL_COPY.scene.charsLeft(left));
      if (hints.spoken !== '') spokenAt.push(left);
    }
    expect(spokenAt).toEqual([100, 50, 20, 10, 0]);
  });

  it('reads the milestone out in the same words that are on screen', () => {
    expect(composerHints(ofLength(MAX - 50), false).spoken).toBe(COUNCIL_COPY.scene.charsLeft(50));
  });

  it('announces going over the limit, and blocks sending', () => {
    const hints = composerHints(ofLength(MAX + 1), false);
    expect(hints.blocked).toBe(true);
    expect(hints.problem).toBe(COUNCIL_COPY.scene.tooLong(MAX));
    expect(hints.spoken).toBe(hints.problem);
  });

  it('blocks an empty question quietly, and explains only once sending was tried', () => {
    expect(composerHints('   ', false)).toMatchObject({ blocked: true, problem: null, spoken: '' });
    expect(composerHints('   ', true)).toMatchObject({ blocked: true, problem: COUNCIL_COPY.scene.emptyQuestion, spoken: COUNCIL_COPY.scene.emptyQuestion });
  });

  it('treats a single character like an empty question, as the server does', () => {
    expect(composerHints(' ? ', true).blocked).toBe(true);
    expect(composerHints('No', true).blocked).toBe(false);
  });
});
