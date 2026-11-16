// The council's feedback vocabulary. Call sites speak in meanings
// (feel('send')), and this table decides what each meaning sounds and feels
// like, so the whole palette can be retuned here without touching a component.

export const FEEL_EVENTS = [
  // The scene. These names match FeedbackEvent in ../feedback.ts one for one.
  'select', // a seat was chosen
  'deselect', // a seat was cleared, back to the whole council
  'page', // the stance pager settled on a neighbouring seat
  'send', // a question or follow-up was submitted
  'routing', // the council is deciding who answers
  'turnStart', // a seat began replying
  'turnEnd', // a reply finished
  'challenge', // the visitor pushed back on a seat
  'stop', // the visitor interrupted
  'limit', // the thread or the day ran out
  'error',
  // The intro.
  'stickerLand', // a sticker made contact with the board
  'bubble', // a speech bubble opened
  'advance', // the visitor tapped or keyed to the next step
  'scrubTick', // a drag crossed from one member to the next
  'begin', // the visitor accepted the invitation
] as const;

export type FeelEvent = (typeof FEEL_EVENTS)[number];

/** The sounds in the palette. Paper and sticker noises, nothing that beeps. */
export type SoundName = 'tick' | 'tickLow' | 'slap' | 'pop' | 'scratch' | 'flick' | 'knock' | 'chime';

/** The haptic vocabulary: four shapes, with two weights of the single tap. */
export type HapticName = 'tick' | 'thud' | 'double' | 'success' | 'warning' | 'error';

export interface FeelSpec {
  sound?: SoundName;
  /** Relative loudness of this event's sound, 0 to 1. Defaults to 1. */
  gain?: number;
  haptic?: HapticName;
  /**
   * True when the event is the direct result of the visitor's own tap or key.
   * Only these may vibrate under prefers-reduced-motion, and only these can
   * reach the iOS haptic at all (it needs a live user gesture).
   */
  confirmsTap?: boolean;
  /** Minimum milliseconds between two firings of this event. */
  minGapMs?: number;
}

export const FEEL_SPECS: Record<FeelEvent, FeelSpec> = {
  select: { sound: 'tick', haptic: 'tick', confirmsTap: true },
  deselect: { sound: 'tickLow', haptic: 'tick', confirmsTap: true },
  page: { haptic: 'tick', minGapMs: 70 },
  send: { sound: 'flick', haptic: 'thud', confirmsTap: true },
  // routing and turnStart follow the stream, not a gesture, so they stay very
  // quiet. Delete their sound here if replies should arrive in silence.
  routing: { sound: 'scratch', gain: 0.7, minGapMs: 600 },
  turnStart: { sound: 'pop', gain: 0.55, haptic: 'tick', minGapMs: 250 },
  turnEnd: {},
  challenge: { sound: 'slap', haptic: 'double', confirmsTap: true },
  stop: { sound: 'tickLow', haptic: 'thud', confirmsTap: true },
  limit: { sound: 'knock', gain: 0.8, haptic: 'warning', minGapMs: 400 },
  error: { sound: 'knock', haptic: 'error', minGapMs: 400 },

  stickerLand: { sound: 'slap', haptic: 'thud', minGapMs: 90 },
  bubble: { sound: 'pop', gain: 0.7, minGapMs: 90 },
  // The landing that follows is the sound. The tap itself only gets a tick in the hand.
  advance: { haptic: 'tick', confirmsTap: true, minGapMs: 40 },
  scrubTick: { sound: 'tick', gain: 0.5, haptic: 'tick', minGapMs: 70 },
  begin: { sound: 'chime', haptic: 'success', confirmsTap: true },
};

export interface HapticPattern {
  /** navigator.vibrate pattern in milliseconds (Android). */
  vibrate: number | number[];
  /**
   * Start times, in milliseconds, of the single ticks that approximate the
   * pattern on iOS, where the only primitive is one light tap.
   */
  taps: number[];
}

// A phone motor cannot change sharpness, so weight is carried by duration:
// 8ms reads as a tick, 20ms as a thud. Pauses under about 40ms blur together.
export const HAPTIC_PATTERNS: Record<HapticName, HapticPattern> = {
  tick: { vibrate: 8, taps: [0] },
  thud: { vibrate: 20, taps: [0] },
  double: { vibrate: [10, 45, 16], taps: [0, 90] },
  success: { vibrate: [10, 60, 22], taps: [0, 110] },
  warning: { vibrate: [8, 80, 8], taps: [0, 130] },
  error: { vibrate: [18, 55, 18, 55, 18], taps: [0, 100, 200] },
};

/** Total buzzing time of a pattern, pauses excluded. Used by the tests to keep the weights in order. */
export function vibrationMs(pattern: number | number[]): number {
  if (typeof pattern === 'number') return pattern;
  return pattern.reduce((sum, ms, index) => (index % 2 === 0 ? sum + ms : sum), 0);
}
