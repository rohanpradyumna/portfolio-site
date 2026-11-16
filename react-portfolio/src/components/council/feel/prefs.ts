// A persisted on/off preference that never throws. Private windows and
// locked-down browsers throw on any localStorage access, so every touch is
// guarded and the in-memory value is the source of truth for the session.

export type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

export interface BooleanPref {
  get(): boolean;
  set(value: boolean): void;
  /** Calls `listener` after every change. Returns the unsubscribe. */
  subscribe(listener: () => void): () => void;
}

export function createBooleanPref(
  key: string,
  fallback: boolean,
  /** Resolved lazily so nothing touches `window` at import time or on the server. */
  getStorage: () => StorageLike | null | undefined,
): BooleanPref {
  let cached: boolean | null = null;
  const listeners = new Set<() => void>();

  const read = (): boolean => {
    try {
      const raw = getStorage()?.getItem(key);
      if (raw === '1') return true;
      if (raw === '0') return false;
    } catch {
      // Storage is unavailable. The fallback stands.
    }
    return fallback;
  };

  return {
    get() {
      if (cached === null) cached = read();
      return cached;
    },
    set(value) {
      cached = value;
      try {
        getStorage()?.setItem(key, value ? '1' : '0');
      } catch {
        // Not persisted. The choice still holds for this page.
      }
      listeners.forEach((listener) => listener());
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

/** window.localStorage, or null where reading the property itself throws. */
export function browserStorage(): StorageLike | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}
