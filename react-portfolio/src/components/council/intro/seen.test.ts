import { describe, expect, it } from 'vitest';
import { SEEN_KEY } from './constants';
import { hasSeenCouncilIntro, markCouncilIntroSeen } from './seen';

function memoryStorage() {
  const data: Record<string, string> = {};
  return {
    data,
    getItem: (key: string) => (key in data ? data[key] : null),
    setItem: (key: string, value: string) => {
      data[key] = value;
    },
  };
}

const throwing = {
  getItem: () => {
    throw new Error('SecurityError');
  },
  setItem: () => {
    throw new Error('QuotaExceededError');
  },
};

describe('the seen flag', () => {
  it('starts unseen and remembers once marked', () => {
    const store = memoryStorage();
    expect(hasSeenCouncilIntro(store)).toBe(false);
    markCouncilIntroSeen(store);
    expect(store.data[SEEN_KEY]).toBe('1');
    expect(hasSeenCouncilIntro(store)).toBe(true);
  });

  it('is idempotent', () => {
    const store = memoryStorage();
    markCouncilIntroSeen(store);
    markCouncilIntroSeen(store);
    expect(hasSeenCouncilIntro(store)).toBe(true);
  });

  it('reads as unseen, and never throws, when storage throws (private windows)', () => {
    expect(hasSeenCouncilIntro(throwing)).toBe(false);
    expect(() => markCouncilIntroSeen(throwing)).not.toThrow();
  });

  it('reads as unseen with no storage at all, as on the server', () => {
    expect(hasSeenCouncilIntro(null)).toBe(false);
    expect(() => markCouncilIntroSeen(null)).not.toThrow();
    // No window in this test environment: the default argument must cope.
    expect(hasSeenCouncilIntro()).toBe(false);
    expect(() => markCouncilIntroSeen()).not.toThrow();
  });
});
