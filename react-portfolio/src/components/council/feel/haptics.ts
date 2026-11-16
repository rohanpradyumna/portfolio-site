import { HAPTIC_PATTERNS, HapticName } from './events';
import { createRateLimiter } from './rateLimit';

// Haptics on the web, as of late 2026:
//
// Android has navigator.vibrate. It needs the page to have been touched once.
//
// iOS Safari has never shipped a vibration API. The one way in is a side
// effect: toggling <input type="checkbox" switch> plays the system switch
// tick. Clicking a hidden one through its label from script gave a free light
// tap from iOS 17.4. WebKit then required a user gesture to be in progress
// (WebKit change 288403, early 2025), and iOS 26.5 closed the scripted path
// altogether: only a real finger on a real switch ticks now. So this driver
// helps iPhones on 17.4 to 26.4 when called straight from a tap handler, and
// on anything newer it toggles a detached checkbox and nothing is felt. That
// is the honest ceiling. There is no way to detect which side of the patch a
// device is on, so the driver is picked by capability and allowed to be a
// silent no-op.

export type HapticDriver = 'vibrate' | 'ios-switch' | 'none';

/** The slice of the browser the haptics need. Injected so the logic can be tested without one. */
export interface HapticEnv {
  navigator?: {
    vibrate?: (pattern: number | number[]) => boolean;
    userActivation?: { hasBeenActive: boolean; isActive: boolean };
  };
  document?: Pick<Document, 'createElement' | 'head'>;
  matchMedia?: (query: string) => { matches: boolean };
  setTimeout?: (run: () => void, ms: number) => unknown;
  now?: () => number;
}

function matches(env: HapticEnv, query: string): boolean {
  try {
    return env.matchMedia ? env.matchMedia(query).matches : false;
  } catch {
    return false;
  }
}

export function detectHapticDriver(env: HapticEnv): HapticDriver {
  try {
    if (typeof env.navigator?.vibrate === 'function') return 'vibrate';
    // A fine pointer means a Mac, where the switch exists but there is no Taptic Engine to tick.
    if (!env.document || !matches(env, '(pointer: coarse)')) return 'none';
    const probe = env.document.createElement('input');
    probe.type = 'checkbox';
    return 'switch' in probe ? 'ios-switch' : 'none';
  } catch {
    return 'none';
  }
}

export interface HapticDecision {
  /** The event is the direct result of the visitor's own tap or key press. */
  confirmsTap: boolean;
  reducedMotion: boolean;
  /** The page has been interacted with at least once. */
  hasBeenActive: boolean;
  /** A user gesture is being handled right now. */
  gestureActive: boolean;
  driver: HapticDriver;
}

/** Whether a haptic may fire at all, before rate limiting. */
export function mayFireHaptic({ confirmsTap, reducedMotion, hasBeenActive, gestureActive, driver }: HapticDecision): boolean {
  if (driver === 'none') return false;
  // Vibration is motion. With reduced motion on, the only buzz left is the
  // one that answers the visitor's own finger.
  if (reducedMotion && !confirmsTap) return false;
  // Chrome refuses, and logs, a vibration before the first interaction.
  if (driver === 'vibrate') return hasBeenActive;
  // The iOS tick only exists inside a gesture. Outside one the call is wasted work.
  return confirmsTap || gestureActive;
}

/**
 * One iOS tick: a switch checkbox toggled through its label, the recipe the
 * ios-haptics library established. The element never renders and is removed
 * at once. Its events are stopped at the source so a synthetic click cannot
 * reach a click-outside handler higher up.
 */
export function iosSwitchTick(doc: Pick<Document, 'createElement' | 'head'>): void {
  const label = doc.createElement('label');
  label.setAttribute('aria-hidden', 'true');
  label.style.display = 'none';
  const input = doc.createElement('input');
  input.type = 'checkbox';
  input.setAttribute('switch', '');
  input.tabIndex = -1;
  const stop = (event: Event) => event.stopPropagation();
  for (const type of ['click', 'input', 'change']) {
    input.addEventListener(type, stop);
    label.addEventListener(type, stop);
  }
  label.appendChild(input);
  doc.head.appendChild(label);
  try {
    label.click();
  } finally {
    doc.head.removeChild(label);
  }
}

export interface Haptics {
  readonly driver: HapticDriver;
  /** Fires `name` if policy and the rate limits allow it. Returns whether it fired. Never throws. */
  fire(name: HapticName, options: { key: string; confirmsTap?: boolean; minGapMs?: number }): boolean;
}

/** No more than this many haptics in any one second, whatever asks for them. */
export const HAPTIC_WINDOW = { windowMs: 1000, maxInWindow: 8 } as const;
/** Even unlimited events keep this far apart: closer than this, a motor smears two taps into one buzz. */
export const HAPTIC_MIN_GAP_MS = 35;

export function createHaptics(env: HapticEnv): Haptics {
  let driver: HapticDriver | null = null;
  const limiter = createRateLimiter(HAPTIC_WINDOW);
  const now = env.now ?? (() => Date.now());

  const resolveDriver = (): HapticDriver => {
    if (driver === null) driver = detectHapticDriver(env);
    return driver;
  };

  return {
    get driver() {
      return resolveDriver();
    },
    fire(name, { key, confirmsTap = false, minGapMs = 0 }) {
      try {
        const active = resolveDriver();
        const activation = env.navigator?.userActivation;
        const allowed = mayFireHaptic({
          confirmsTap,
          reducedMotion: matches(env, '(prefers-reduced-motion: reduce)'),
          // Browsers without the userActivation API predate the vibrate gate too.
          hasBeenActive: activation ? activation.hasBeenActive : true,
          gestureActive: activation ? activation.isActive : false,
          driver: active,
        });
        if (!allowed) return false;
        if (!limiter.allow(key, Math.max(minGapMs, HAPTIC_MIN_GAP_MS), now())) return false;

        const pattern = HAPTIC_PATTERNS[name];
        if (active === 'vibrate') {
          env.navigator?.vibrate?.(pattern.vibrate);
          return true;
        }
        const doc = env.document;
        if (!doc) return false;
        pattern.taps.forEach((at) => {
          if (at === 0) iosSwitchTick(doc);
          // Later ticks leave the gesture, so newer iOS drops them. Best effort.
          else env.setTimeout?.(() => {
            try {
              iosSwitchTick(doc);
            } catch {
              // Decoration only.
            }
          }, at);
        });
        return true;
      } catch {
        return false;
      }
    },
  };
}
