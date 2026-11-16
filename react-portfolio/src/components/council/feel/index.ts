'use client';

import { useSyncExternalStore } from 'react';
import { FEEL_SPECS, FeelEvent } from './events';
import { Haptics, createHaptics } from './haptics';
import { browserStorage, createBooleanPref } from './prefs';
import { createRateLimiter } from './rateLimit';
import { installSoundUnlock, playSound } from './sound';

// The council's sound and haptics engine. One call, feel('send'), from
// anywhere on the client: no hook, no provider, nothing to mount. Sound and
// touch are decoration. Every path here fails silent, and the feature behaves
// identically on a device that has neither.
//
//   feel(event)                  fire an event from the vocabulary in events.ts
//   feel(event, { intensity })   0 to 1, scales the sound (a harder landing)
//   isMuted() / setMuted(bool)   persisted sound preference
//   useFeelMuted()               the same, as React state for a toggle
//
// Haptics follow the device, not the mute switch: a muted visitor still gets
// the tick under their thumb, as on a phone with the ringer off.

export type { FeelEvent, FeelSpec, HapticName, SoundName } from './events';
export { FEEL_EVENTS, FEEL_SPECS, HAPTIC_PATTERNS } from './events';

const MUTE_KEY = 'council:muted';

const mutePref = createBooleanPref(MUTE_KEY, false, browserStorage);
const soundLimiter = createRateLimiter({ windowMs: 1000, maxInWindow: 14 });
let haptics: Haptics | null = null;

function getHaptics(): Haptics {
  if (!haptics) {
    haptics = createHaptics({
      navigator: window.navigator,
      document: window.document,
      matchMedia: (query) => window.matchMedia(query),
      setTimeout: (run, ms) => window.setTimeout(run, ms),
      now: () => performance.now(),
    });
  }
  return haptics;
}

export function isMuted(): boolean {
  return mutePref.get();
}

export function setMuted(muted: boolean): void {
  mutePref.set(muted);
}

/** [muted, setMuted] for a sound toggle. Renders unmuted on the server, then corrects itself. */
export function useFeelMuted(): [boolean, (muted: boolean) => void] {
  const muted = useSyncExternalStore(mutePref.subscribe, mutePref.get, () => false);
  return [muted, setMuted];
}

export interface FeelOptions {
  /** 0 to 1. Scales the loudness of the event's sound. Defaults to 1. */
  intensity?: number;
}

// The gesture listeners that wake audio go in as soon as any council page
// loads this module, so the context is already running by the first feel().
if (typeof window !== 'undefined') installSoundUnlock(() => !isMuted());

export function feel(event: FeelEvent, options: FeelOptions = {}): void {
  if (typeof window === 'undefined') return;
  try {
    const spec = FEEL_SPECS[event];
    const gap = spec.minGapMs ?? 0;
    if (spec.sound && !isMuted() && soundLimiter.allow(event, gap, performance.now())) {
      playSound(spec.sound, (spec.gain ?? 1) * (options.intensity ?? 1));
    }
    if (spec.haptic) getHaptics().fire(spec.haptic, { key: event, confirmsTap: spec.confirmsTap, minGapMs: gap });
  } catch {
    // Feedback is never worth an error.
  }
}
