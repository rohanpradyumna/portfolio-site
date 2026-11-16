import { SEEN_KEY } from './constants';

type SeenStorage = Pick<Storage, 'getItem' | 'setItem'>;

function storage(): SeenStorage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    // Reading the property itself throws in some private modes.
    return null;
  }
}

/**
 * Whether this browser has already been through the intro. False when storage
 * is unavailable, so a private window simply meets the council every visit.
 */
export function hasSeenCouncilIntro(store: SeenStorage | null = storage()): boolean {
  try {
    return store?.getItem(SEEN_KEY) === '1';
  } catch {
    return false;
  }
}

/** Remembers that the intro has been seen. Safe to call anywhere, any number of times. */
export function markCouncilIntroSeen(store: SeenStorage | null = storage()): void {
  try {
    store?.setItem(SEEN_KEY, '1');
  } catch {
    // Nothing to remember it in. The intro will offer itself again next time.
  }
}
