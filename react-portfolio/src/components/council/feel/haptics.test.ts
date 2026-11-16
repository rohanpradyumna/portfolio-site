import { describe, expect, it, vi } from 'vitest';
import { HAPTIC_PATTERNS } from './events';
import { HAPTIC_WINDOW, HapticEnv, createHaptics, detectHapticDriver, iosSwitchTick, mayFireHaptic } from './haptics';

type Listener = (event: { stopPropagation: () => void }) => void;

// The smallest fake DOM the iOS driver touches: createElement, head, label.click().
function fakeDocument({ supportsSwitch = true } = {}) {
  const log = { clicks: 0, appended: 0, removed: 0, switchAttr: false, ariaHidden: false, display: '' };
  const make = (tag: string) => {
    const listeners: Record<string, Listener[]> = {};
    const element: Record<string, unknown> = {
      tag,
      type: '',
      tabIndex: 0,
      style: {},
      children: [] as unknown[],
      setAttribute(name: string, value: string) {
        if (name === 'switch') log.switchAttr = true;
        if (name === 'aria-hidden' && value === 'true') log.ariaHidden = true;
      },
      addEventListener(type: string, listener: Listener) {
        (listeners[type] ??= []).push(listener);
      },
      appendChild(child: unknown) {
        (element.children as unknown[]).push(child);
      },
      click() {
        log.clicks++;
        log.display = (element.style as { display?: string }).display ?? '';
        const stopPropagation = vi.fn();
        listeners.click?.forEach((listener) => listener({ stopPropagation }));
        expect(stopPropagation).toHaveBeenCalled();
      },
    };
    if (tag === 'input' && supportsSwitch) element.switch = false;
    return element;
  };
  const document = {
    createElement: make,
    head: {
      appendChild: () => void log.appended++,
      removeChild: () => void log.removed++,
    },
  } as unknown as NonNullable<HapticEnv['document']>;
  return { document, log };
}

const coarse = (query: string) => ({ matches: query.includes('pointer: coarse') });
const coarseReduced = () => ({ matches: true });
const fine = () => ({ matches: false });

describe('detectHapticDriver', () => {
  it('prefers navigator.vibrate where it exists', () => {
    expect(detectHapticDriver({ navigator: { vibrate: () => true }, ...fakeDocument(), matchMedia: coarse })).toBe('vibrate');
  });

  it('falls back to the iOS switch on a touch device that has one', () => {
    expect(detectHapticDriver({ navigator: {}, ...fakeDocument(), matchMedia: coarse })).toBe('ios-switch');
  });

  it('is none on a touch device without the switch control (older iOS)', () => {
    expect(detectHapticDriver({ navigator: {}, ...fakeDocument({ supportsSwitch: false }), matchMedia: coarse })).toBe('none');
  });

  it('is none with a fine pointer, even where the switch exists (desktop Safari)', () => {
    expect(detectHapticDriver({ navigator: {}, ...fakeDocument(), matchMedia: fine })).toBe('none');
  });

  it('is none with nothing to work with, and never throws', () => {
    expect(detectHapticDriver({})).toBe('none');
    expect(
      detectHapticDriver({
        navigator: {},
        ...fakeDocument(),
        matchMedia: () => {
          throw new Error('nope');
        },
      }),
    ).toBe('none');
    const hostile = { createElement: () => { throw new Error('nope'); }, head: {} } as unknown as HapticEnv['document'];
    expect(detectHapticDriver({ navigator: {}, document: hostile, matchMedia: coarse })).toBe('none');
  });
});

describe('mayFireHaptic', () => {
  const base = { confirmsTap: false, reducedMotion: false, hasBeenActive: true, gestureActive: false, driver: 'vibrate' as const };

  it('never fires without a driver', () => {
    expect(mayFireHaptic({ ...base, driver: 'none', confirmsTap: true, gestureActive: true })).toBe(false);
  });

  it('under reduced motion, only a confirmation of the visitor’s own tap survives', () => {
    expect(mayFireHaptic({ ...base, reducedMotion: true })).toBe(false);
    expect(mayFireHaptic({ ...base, reducedMotion: true, confirmsTap: true })).toBe(true);
    expect(mayFireHaptic({ ...base, reducedMotion: true, driver: 'ios-switch', gestureActive: true })).toBe(false);
  });

  it('never vibrates before the first interaction', () => {
    expect(mayFireHaptic({ ...base, hasBeenActive: false })).toBe(false);
    expect(mayFireHaptic({ ...base, hasBeenActive: false, confirmsTap: true })).toBe(false);
    expect(mayFireHaptic(base)).toBe(true);
  });

  it('only reaches for the iOS tick inside a gesture', () => {
    expect(mayFireHaptic({ ...base, driver: 'ios-switch' })).toBe(false);
    expect(mayFireHaptic({ ...base, driver: 'ios-switch', gestureActive: true })).toBe(true);
    expect(mayFireHaptic({ ...base, driver: 'ios-switch', confirmsTap: true })).toBe(true);
  });
});

describe('iosSwitchTick', () => {
  it('clicks a hidden, aria-hidden switch through its label and cleans up', () => {
    const { document, log } = fakeDocument();
    iosSwitchTick(document);
    expect(log).toEqual({ clicks: 1, appended: 1, removed: 1, switchAttr: true, ariaHidden: true, display: 'none' });
  });
});

describe('createHaptics', () => {
  function android(overrides: Partial<HapticEnv> = {}) {
    const vibrate = vi.fn(() => true);
    let time = 0;
    const env: HapticEnv = {
      navigator: { vibrate, userActivation: { hasBeenActive: true, isActive: false } },
      matchMedia: fine,
      now: () => time,
      ...overrides,
    };
    return { haptics: createHaptics(env), vibrate, advance: (ms: number) => (time += ms) };
  }

  it('plays the named pattern through navigator.vibrate', () => {
    const { haptics, vibrate } = android();
    expect(haptics.driver).toBe('vibrate');
    expect(haptics.fire('success', { key: 'begin', confirmsTap: true })).toBe(true);
    expect(vibrate).toHaveBeenCalledWith(HAPTIC_PATTERNS.success.vibrate);
  });

  it('stays silent before the page has been touched', () => {
    const { haptics, vibrate } = android({
      navigator: { vibrate: vi.fn(() => true), userActivation: { hasBeenActive: false, isActive: false } },
    });
    expect(haptics.fire('tick', { key: 'select', confirmsTap: true })).toBe(false);
    expect(vibrate).not.toHaveBeenCalled();
  });

  it('honors reduced motion except for tap confirmations', () => {
    const { haptics, vibrate } = android({ matchMedia: (query) => ({ matches: query.includes('reduced-motion') }) });
    expect(haptics.fire('thud', { key: 'stickerLand' })).toBe(false);
    expect(haptics.fire('tick', { key: 'scrubTick' })).toBe(false);
    expect(haptics.fire('tick', { key: 'advance', confirmsTap: true })).toBe(true);
    expect(vibrate).toHaveBeenCalledTimes(1);
  });

  it('holds an event to its minimum gap', () => {
    const { haptics, vibrate, advance } = android();
    expect(haptics.fire('tick', { key: 'scrubTick', minGapMs: 70 })).toBe(true);
    advance(40);
    expect(haptics.fire('tick', { key: 'scrubTick', minGapMs: 70 })).toBe(false);
    advance(40);
    expect(haptics.fire('tick', { key: 'scrubTick', minGapMs: 70 })).toBe(true);
    expect(vibrate).toHaveBeenCalledTimes(2);
  });

  it('caps the total per second however hard a drag scrubs', () => {
    const { haptics, vibrate, advance } = android();
    for (let i = 0; i < 500; i++) {
      haptics.fire('tick', { key: 'scrubTick', minGapMs: 70 });
      advance(4);
    }
    // Two seconds of asking: at most two windows' worth.
    expect(vibrate.mock.calls.length).toBeLessThanOrEqual(HAPTIC_WINDOW.maxInWindow * 2);
    expect(vibrate.mock.calls.length).toBeGreaterThan(0);
  });

  it('uses the iOS switch inside a gesture and schedules the later ticks', () => {
    const { document, log } = fakeDocument();
    const timers: Array<[() => void, number]> = [];
    const haptics = createHaptics({
      navigator: { userActivation: { hasBeenActive: true, isActive: true } },
      document,
      matchMedia: coarse,
      setTimeout: (run, ms) => timers.push([run, ms]),
      now: () => 0,
    });
    expect(haptics.driver).toBe('ios-switch');
    expect(haptics.fire('success', { key: 'begin', confirmsTap: true })).toBe(true);
    expect(log.clicks).toBe(1);
    expect(timers.map(([, ms]) => ms)).toEqual(HAPTIC_PATTERNS.success.taps.slice(1));
    timers.forEach(([run]) => run());
    expect(log.clicks).toBe(2);
    expect(log.appended).toBe(log.removed);
  });

  it('skips the iOS switch outside a gesture', () => {
    const { document, log } = fakeDocument();
    const haptics = createHaptics({
      navigator: { userActivation: { hasBeenActive: true, isActive: false } },
      document,
      matchMedia: coarse,
      now: () => 0,
    });
    expect(haptics.fire('thud', { key: 'stickerLand' })).toBe(false);
    expect(log.clicks).toBe(0);
  });

  it('skips non-confirming iOS ticks under reduced motion', () => {
    const { document, log } = fakeDocument();
    const haptics = createHaptics({
      navigator: { userActivation: { hasBeenActive: true, isActive: true } },
      document,
      matchMedia: coarseReduced,
      now: () => 0,
    });
    expect(haptics.fire('tick', { key: 'scrubTick' })).toBe(false);
    expect(haptics.fire('tick', { key: 'advance', confirmsTap: true })).toBe(true);
    expect(log.clicks).toBe(1);
  });

  it('does nothing, quietly, where there is no haptic hardware path', () => {
    const haptics = createHaptics({ navigator: {}, matchMedia: fine });
    expect(haptics.driver).toBe('none');
    expect(haptics.fire('error', { key: 'error' })).toBe(false);
    expect(createHaptics({}).fire('tick', { key: 'select', confirmsTap: true })).toBe(false);
  });

  it('swallows a driver that throws', () => {
    const haptics = createHaptics({
      navigator: {
        vibrate: () => {
          throw new Error('NotAllowedError');
        },
        userActivation: { hasBeenActive: true, isActive: true },
      },
      matchMedia: fine,
      now: () => 0,
    });
    expect(() => haptics.fire('tick', { key: 'select', confirmsTap: true })).not.toThrow();
    expect(haptics.fire('tick', { key: 'send', confirmsTap: true })).toBe(false);
  });
});
