import { SEAT_IDS, SeatId } from '@/lib/council/contract';
import { COUNCIL_COPY } from '@/data/council/copy';

// The intro is one number. `progress` runs from 0 to LAST_STEP, whole numbers
// are steps (six members, then three beats), and every position, size and
// opacity on screen is a pure function of it.
//
// The visitor's scrolling is the only clock. The overlay is a tall scroll
// track with a sticky stage, and this file owns the map from scroll position
// to progress. Nothing here runs on a timer: stop scrolling and the council
// stops with you.

export const MEMBER_COUNT = SEAT_IDS.length;
export const BEATS = COUNCIL_COPY.intro.beats;
export const BEAT_COUNT = BEATS.length;
/** The step at which the council is assembled and the first beat plays. */
export const ASSEMBLY_STEP = MEMBER_COUNT;
export const STEP_COUNT = MEMBER_COUNT + BEAT_COUNT;
export const LAST_STEP = STEP_COUNT - 1;

export type IntroStep =
  | { kind: 'member'; index: number; seatId: SeatId; text: string }
  | { kind: 'beat'; index: number; beatIndex: number; text: string };

export function stepAt(index: number): IntroStep {
  const i = clampStep(index);
  if (i < MEMBER_COUNT) {
    const seatId = SEAT_IDS[i];
    const { hello, worldview } = COUNCIL_COPY.intro.seatLines[seatId];
    return { kind: 'member', index: i, seatId, text: `${hello} ${worldview}` };
  }
  const beatIndex = i - MEMBER_COUNT;
  return { kind: 'beat', index: i, beatIndex, text: BEATS[beatIndex].line };
}

export function clampStep(index: number): number {
  if (!Number.isFinite(index)) return 0;
  return Math.min(LAST_STEP, Math.max(0, Math.round(index)));
}

// --- Scroll: how far, and where it rests --------------------------------------

export const SCROLL = {
  /** Scroll that unlocks one member, as a share of the viewport height, and its pixel limits. */
  memberVh: 0.75,
  memberMinPx: 420,
  memberMaxPx: 720,
  /** The three beats are one line each, so they ask for less. */
  beatVh: 0.5,
  beatMinPx: 300,
  beatMaxPx: 460,
  /**
   * Each stretch between two steps is hold, travel, hold. For this share of
   * it after a step, and this share before the next, progress does not move:
   * the member on stage stays put with both lines legible, so a rest does not
   * have to hit an exact pixel. The travel in between is the scroll-linked part.
   */
  holdAfter: 0.26,
  holdBefore: 0.26,
} as const;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/**
 * The scroll offset, in pixels, at which each step is centred on its plateau.
 * Keys, the lineup and the cue scroll to these. stops[0] is 0: the first
 * member arrives on their own when the overlay opens, and everyone after
 * that is scrolled for.
 */
export function scrollStops(viewportHeight: number): number[] {
  const member = clamp(viewportHeight * SCROLL.memberVh, SCROLL.memberMinPx, SCROLL.memberMaxPx);
  const beat = clamp(viewportHeight * SCROLL.beatVh, SCROLL.beatMinPx, SCROLL.beatMaxPx);
  const stops = [0];
  for (let step = 1; step <= LAST_STEP; step++) {
    // Up to and including the assembly, a step costs a member's worth of scroll.
    stops.push(Math.round(stops[step - 1] + (step <= ASSEMBLY_STEP ? member : beat)));
  }
  return stops;
}

/** Index of the stretch a scroll offset falls in: stops[i] <= y < stops[i + 1]. Clamped to the ends. */
function stretchAt(scrollTop: number, stops: number[]): number {
  let i = 0;
  while (i < stops.length - 2 && scrollTop >= stops[i + 1]) i++;
  return i;
}

/** Progress for a scroll offset: flat around every stop, linear in between. */
export function progressAtScroll(scrollTop: number, stops: number[]): number {
  const last = stops.length - 1;
  // Negative offsets are the top rubber band on iOS. The council does not follow it.
  if (scrollTop <= 0) return 0;
  if (scrollTop >= stops[last]) return last;
  const i = stretchAt(scrollTop, stops);
  const t = (scrollTop - stops[i]) / (stops[i + 1] - stops[i]);
  if (t <= SCROLL.holdAfter) return i;
  if (t >= 1 - SCROLL.holdBefore) return i + 1;
  return i + (t - SCROLL.holdAfter) / (1 - SCROLL.holdAfter - SCROLL.holdBefore);
}

/**
 * The scroll offset at which a step has fully arrived: the start of the
 * plateau before its stop. Scrolling from one landing to the next is what
 * "unlocks" a member.
 */
export function landingAt(step: number, stops: number[]): number {
  if (step <= 0) return 0;
  return stops[step] - (stops[step] - stops[step - 1]) * SCROLL.holdBefore;
}

/**
 * How far the scroll has come toward unlocking one step, 0 to 1, measured
 * from the previous step's landing to this one's. Unlike progress this never
 * holds still, so it is what the lineup strokes and the "keep scrolling" cue
 * draw: every pixel of scroll shows, plateau or not.
 */
export function unlockFraction(step: number, scrollTop: number, stops: number[]): number {
  if (step <= 0) return 1;
  const from = landingAt(step - 1, stops);
  const to = landingAt(step, stops);
  return clamp((scrollTop - from) / (to - from), 0, 1);
}

/** The last step that has fully arrived at a given progress. */
export function reachedStep(progress: number): number {
  return Math.min(LAST_STEP, Math.max(0, Math.floor(progress + 1e-6)));
}

/** unlockFraction for whoever is next at this scroll offset. 1 once the last step is in. */
export function nextUnlockFraction(scrollTop: number, stops: number[]): number {
  const reached = reachedStep(progressAtScroll(scrollTop, stops));
  return reached >= LAST_STEP ? 1 : unlockFraction(reached + 1, scrollTop, stops);
}

/**
 * Where to carry the scroll when the visitor lets go between two steps, or
 * null when no help is needed. This stands in for CSS scroll-snap, which in
 * Chrome pulls a short wheel scroll back to where it started. The rule here
 * never reverses the visitor: a rest on a plateau is left exactly where it
 * is, and a rest mid-travel is finished in the direction they were going,
 * to a little way inside the plateau they were heading for.
 */
export function settleScroll(scrollTop: number, direction: 1 | -1, stops: number[]): number | null {
  const last = stops.length - 1;
  if (scrollTop <= 0 || scrollTop >= stops[last]) return null;
  const i = stretchAt(scrollTop, stops);
  const length = stops[i + 1] - stops[i];
  const t = (scrollTop - stops[i]) / length;
  if (t <= SCROLL.holdAfter || t >= 1 - SCROLL.holdBefore) return null;
  const inset = direction > 0 ? 1 - SCROLL.holdBefore / 2 : SCROLL.holdAfter / 2;
  return Math.round(stops[i] + length * inset);
}

/** The step a "forward" press should scroll to from a given progress. Never past the end. */
export function stepAhead(progress: number): number {
  return clampStep(Math.floor(progress + 1e-3) + 1);
}

/** The step a "back" press should scroll to from a given progress. */
export function stepBehind(progress: number): number {
  return clampStep(Math.ceil(progress - 1e-3) - 1);
}

// --- Springs ------------------------------------------------------------------

export const SPRINGS = {
  /**
   * The light smoothing between the scroll position and what is drawn.
   * Critically damped and stiff: it rounds off wheel notches and gives the
   * stickers a little weight, at a lag short enough to still feel attached.
   */
  follow: { type: 'spring', stiffness: 520, damping: 46, mass: 1, restDelta: 0.0005, restSpeed: 0.005 },
  /** The first member's arrival when the overlay opens. The one move the visitor does not scroll for. */
  entrance: { type: 'spring', stiffness: 210, damping: 26, mass: 1, restDelta: 0.0008, restSpeed: 0.01 },
  /** The gather on a skip. Quick and flat: the visitor asked to be done. */
  gather: { type: 'spring', stiffness: 340, damping: 34, mass: 1 },
} as const;

/** Pause between the overlay appearing and the first arrival. Milliseconds. */
export const LEAD_IN_MS = 320;

/**
 * Arriving faster than this, in steps per second, a sticker is being flown
 * past, not put down: it gets a tick, and the slap is kept for the one the
 * visitor actually stops on.
 */
export const FLYBY_SPEED = 5;

// --- Lift: how far a sticker is off the board ---------------------------------

/** Within this distance of its step, in progress units, a sticker is touching the board. */
export const CONTACT = 0.08;
/** The share of the approach spent picking the sticker up from where it waits. */
const PICKUP = 0.22;

/**
 * 0 on the board, 1 held well above it. A member waits on the board at the
 * edge of the stage, is picked up as the scroll reaches them, and comes down
 * on their step. The descent is steepest at the very end, so the sticker is
 * still moving toward the board at the instant it touches: a slap, not a soft
 * landing. Stepping aside afterwards is a small hop.
 */
export function liftAt(member: number, progress: number): number {
  const d = progress - member;
  if (d <= -1) return 0;
  if (d < 0) {
    const t = d + 1;
    if (t < PICKUP) {
      const up = t / PICKUP;
      return 1 - (1 - up) * (1 - up);
    }
    const remaining = (1 - CONTACT - t) / (1 - CONTACT - PICKUP);
    return remaining <= 0 ? 0 : Math.pow(remaining, 0.6);
  }
  // Stage to lineup (or, for the last member, straight to the assembly).
  if (d < 1) return 0.38 * Math.sin(Math.PI * d);
  // Lineup to the assembly, once everyone has spoken.
  const gather = progress - (ASSEMBLY_STEP - 1);
  if (gather > 0 && gather < 1) return 0.3 * Math.sin(Math.PI * gather);
  return 0;
}
