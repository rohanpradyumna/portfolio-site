import type { Transition } from 'framer-motion';

// Every spring and duration the council uses lives here, so the feel can be
// retuned (or handed to an intro sequence) without hunting through components.
//
// House rule: anything a finger or cursor drives is a physical spring
// (stiffness/damping), because those accept a release velocity and can be
// retargeted mid-flight. Fixed durations are only for one-shot reactions that
// nothing can grab.

export const SPRINGS = {
  /** Seats travelling between the arc and the bench. Critically damped: a reseat, not a throw. */
  seatLayout: { type: 'spring', stiffness: 380, damping: 36, mass: 1 },
  /** Hover and press lift on a seat. Stiff so it answers on pointer-down. */
  seatLift: { type: 'spring', stiffness: 560, damping: 32, mass: 0.7 },
  /** The selection ring gliding from seat to seat. A touch of overshoot: it was flicked there. */
  selection: { type: 'spring', stiffness: 520, damping: 34, mass: 0.8 },
  /** Stance pager settle. Takes the finger's release velocity. */
  pager: { type: 'spring', stiffness: 320, damping: 34, mass: 1 },
  /** Cards and trays that change height or place when the thread state changes. */
  surface: { type: 'spring', stiffness: 340, damping: 36, mass: 1 },
  /** Notes landing on the board. */
  noteIn: { type: 'spring', stiffness: 420, damping: 30, mass: 0.9 },
  /** Small chrome: chips, tags, marks. */
  chip: { type: 'spring', stiffness: 600, damping: 36, mass: 0.6 },
} as const satisfies Record<string, Transition>;

export const DURATIONS = {
  /** Cross-fades (and the whole reduced-motion vocabulary). Seconds. */
  fade: 0.18,
  /** Exit of trays and popovers: quicker than their entrance. */
  exit: 0.12,
  /** The challenged wobble, start to rest. */
  wobble: 0.62,
  /** How long a seat stays in its challenged mood before it goes back to thinking. Milliseconds. */
  challengedMs: 900,
} as const;

/** Delays between things that arrive together, in seconds. Short: stagger is garnish, never a wait. */
export const STAGGER = {
  /** Seats leaving for, or returning from, the bench. */
  seats: 0.018,
  /** Reply notes landing in a row. */
  notes: 0.06,
  /** The blank sheets that hold the row while the council decides. */
  blanks: 0.07,
  /** How long the move tray waits for the last note to settle before it appears. */
  trayAfterNotes: 0.12,
} as const;

/** Rotation keyframes for the challenged wobble, in degrees, settling at the resting tilt. */
export const WOBBLE_KEYFRAMES = [0, -8, 6.5, -4, 2, 0] as const;

export const FADE: Transition = { duration: DURATIONS.fade, ease: [0.23, 1, 0.32, 1] };
export const FADE_OUT: Transition = { duration: DURATIONS.exit, ease: [0.23, 1, 0.32, 1] };

export const GESTURE = {
  /** Pixels of travel before a touch commits to being a horizontal swipe. */
  hysteresisPx: 8,
  /** Rubber-band stiffness past the first and last card (UIScrollView uses 0.55). */
  rubberBand: 0.55,
  /** Momentum projection rate. Slightly snappier than scroll deceleration (0.998). */
  decelerationRate: 0.994,
  /** Pointer samples older than this are ignored when measuring release velocity. Milliseconds. */
  velocityWindowMs: 90,
} as const;

/** Resting tilt per seat position, in degrees. Static: the board is hand-placed, not animated. */
export const SEAT_TILTS = [-5, 3.5, -2.5, 3, -4, 5] as const;

/** Progressive resistance past a boundary: the further the pull, the less the card follows. */
export function rubberBand(overshoot: number, dimension: number, constant: number = GESTURE.rubberBand): number {
  if (dimension <= 0) return 0;
  return (overshoot * dimension * constant) / (dimension + constant * Math.abs(overshoot));
}

/** Where a flick would come to rest, by exponential decay (the form UIKit uses). */
export function projectMomentum(velocityPxPerSec: number, rate: number = GESTURE.decelerationRate): number {
  return ((velocityPxPerSec / 1000) * rate) / (1 - rate);
}
