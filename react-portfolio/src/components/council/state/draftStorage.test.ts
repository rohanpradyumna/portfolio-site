import { afterEach, describe, expect, it, vi } from 'vitest';
import { readSavedDraft, writeSavedDraft } from './useCouncil';

function fakeStorage() {
  const items = new Map<string, string>();
  return {
    items,
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, value),
    removeItem: (key: string) => void items.delete(key),
  };
}

describe('the saved draft', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('comes back after a reload or a trip to another page', () => {
    const sessionStorage = fakeStorage();
    vi.stubGlobal('window', { sessionStorage });
    writeSavedDraft('Half a question about');
    expect(readSavedDraft()).toBe('Half a question about');
  });

  it('is removed, not left empty, once the composer is empty (the question was sent)', () => {
    const sessionStorage = fakeStorage();
    vi.stubGlobal('window', { sessionStorage });
    writeSavedDraft('A question');
    writeSavedDraft('');
    expect(sessionStorage.items.size).toBe(0);
    expect(readSavedDraft()).toBe('');
  });

  it('does without storage that is missing or throws', () => {
    vi.stubGlobal('window', {
      get sessionStorage(): Storage {
        throw new DOMException('denied', 'SecurityError');
      },
    });
    expect(() => writeSavedDraft('kept nowhere')).not.toThrow();
    expect(readSavedDraft()).toBe('');
  });
});
