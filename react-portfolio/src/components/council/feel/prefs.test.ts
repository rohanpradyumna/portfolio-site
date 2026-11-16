import { describe, expect, it, vi } from 'vitest';
import { StorageLike, createBooleanPref } from './prefs';

function memoryStorage(initial: Record<string, string> = {}): StorageLike & { data: Record<string, string> } {
  const data = { ...initial };
  return {
    data,
    getItem: (key) => (key in data ? data[key] : null),
    setItem: (key, value) => {
      data[key] = value;
    },
  };
}

const throwingStorage: StorageLike = {
  getItem: () => {
    throw new Error('SecurityError');
  },
  setItem: () => {
    throw new Error('QuotaExceededError');
  },
};

describe('createBooleanPref', () => {
  it('uses the fallback when nothing is stored', () => {
    expect(createBooleanPref('k', false, () => memoryStorage()).get()).toBe(false);
    expect(createBooleanPref('k', true, () => memoryStorage()).get()).toBe(true);
  });

  it('reads a stored choice', () => {
    expect(createBooleanPref('k', false, () => memoryStorage({ k: '1' })).get()).toBe(true);
    expect(createBooleanPref('k', true, () => memoryStorage({ k: '0' })).get()).toBe(false);
  });

  it('ignores junk in storage', () => {
    expect(createBooleanPref('k', false, () => memoryStorage({ k: 'true' })).get()).toBe(false);
    expect(createBooleanPref('k', true, () => memoryStorage({ k: '' })).get()).toBe(true);
  });

  it('persists a change and serves it from memory afterwards', () => {
    const storage = memoryStorage();
    const pref = createBooleanPref('council:muted', false, () => storage);
    pref.set(true);
    expect(storage.data['council:muted']).toBe('1');
    expect(pref.get()).toBe(true);
    pref.set(false);
    expect(storage.data['council:muted']).toBe('0');
    expect(pref.get()).toBe(false);
  });

  it('survives a second instance, as after a reload', () => {
    const storage = memoryStorage();
    createBooleanPref('k', false, () => storage).set(true);
    expect(createBooleanPref('k', false, () => storage).get()).toBe(true);
  });

  it('never throws when storage throws, and still remembers for the session', () => {
    const pref = createBooleanPref('k', false, () => throwingStorage);
    expect(pref.get()).toBe(false);
    expect(() => pref.set(true)).not.toThrow();
    expect(pref.get()).toBe(true);
  });

  it('never throws when there is no storage at all, or when reaching for it throws', () => {
    const none = createBooleanPref('k', false, () => null);
    expect(none.get()).toBe(false);
    none.set(true);
    expect(none.get()).toBe(true);

    const hostile = createBooleanPref('k', true, () => {
      throw new Error('SecurityError');
    });
    expect(hostile.get()).toBe(true);
    expect(() => hostile.set(false)).not.toThrow();
    expect(hostile.get()).toBe(false);
  });

  it('does not touch storage until first use', () => {
    const getStorage = vi.fn(() => memoryStorage());
    const pref = createBooleanPref('k', false, getStorage);
    expect(getStorage).not.toHaveBeenCalled();
    pref.get();
    pref.get();
    expect(getStorage).toHaveBeenCalledTimes(1);
  });

  it('notifies subscribers on change, and stops after unsubscribe', () => {
    const pref = createBooleanPref('k', false, () => memoryStorage());
    const listener = vi.fn();
    const unsubscribe = pref.subscribe(listener);
    pref.set(true);
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
    pref.set(false);
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
