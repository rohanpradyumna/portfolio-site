import { describe, expect, it } from 'vitest';
import type { FeedbackEvent } from '../feedback';
import { FEEL_EVENTS, FEEL_SPECS, FeelEvent, HAPTIC_PATTERNS, vibrationMs } from './events';

// Compile-time tripwire: feel() must accept every event the scene already
// fires through feedback(), so the swap stays a one-line change. If the scene
// adds an event, tsc fails on this line until the vocabulary learns it.
const sceneEventsAreCovered: FeedbackEvent extends FeelEvent ? true : never = true;

describe('the feel vocabulary', () => {
  it('covers every scene event that feedback.ts fires', () => {
    expect(sceneEventsAreCovered).toBe(true);
    const scene: FeedbackEvent[] = ['select', 'page', 'send', 'turnStart', 'turnEnd', 'challenge', 'stop', 'limit', 'error'];
    for (const event of scene) expect(FEEL_EVENTS).toContain(event);
  });

  it('has the scene additions and the intro events', () => {
    for (const event of ['deselect', 'routing', 'stickerLand', 'bubble', 'advance', 'scrubTick', 'begin']) {
      expect(FEEL_EVENTS).toContain(event);
    }
  });

  it('gives every event a spec, and nothing else', () => {
    expect(Object.keys(FEEL_SPECS).sort()).toEqual([...FEEL_EVENTS].sort());
    expect(new Set(FEEL_EVENTS).size).toBe(FEEL_EVENTS.length);
  });

  it('only points at haptics that exist', () => {
    for (const event of FEEL_EVENTS) {
      const { haptic } = FEEL_SPECS[event];
      if (haptic) expect(HAPTIC_PATTERNS[haptic]).toBeDefined();
    }
  });

  it('marks exactly the direct taps as tap confirmations', () => {
    const confirming = FEEL_EVENTS.filter((event) => FEEL_SPECS[event].confirmsTap);
    expect(confirming.sort()).toEqual(['advance', 'begin', 'challenge', 'deselect', 'select', 'send', 'stop']);
  });

  it('rate limits everything a drag or a stream can repeat', () => {
    for (const event of ['page', 'scrubTick', 'stickerLand', 'bubble', 'turnStart', 'routing'] as const) {
      expect(FEEL_SPECS[event].minGapMs).toBeGreaterThanOrEqual(70);
    }
  });

  it('keeps relative gains inside 0 to 1', () => {
    for (const event of FEEL_EVENTS) {
      const gain = FEEL_SPECS[event].gain ?? 1;
      expect(gain).toBeGreaterThan(0);
      expect(gain).toBeLessThanOrEqual(1);
    }
  });
});

describe('haptic patterns', () => {
  it('are four distinct shapes: tick, thud, success and warning or error', () => {
    const shapes = (['tick', 'thud', 'success', 'warning', 'error'] as const).map((name) =>
      JSON.stringify(HAPTIC_PATTERNS[name].vibrate),
    );
    expect(new Set(shapes).size).toBe(shapes.length);
  });

  it('carry weight by duration: a thud is heavier than a tick, an error heavier than a warning', () => {
    expect(vibrationMs(HAPTIC_PATTERNS.thud.vibrate)).toBeGreaterThan(vibrationMs(HAPTIC_PATTERNS.tick.vibrate) * 2);
    expect(vibrationMs(HAPTIC_PATTERNS.error.vibrate)).toBeGreaterThan(vibrationMs(HAPTIC_PATTERNS.warning.vibrate));
    expect(vibrationMs([10, 60, 22])).toBe(32);
    expect(vibrationMs(8)).toBe(8);
  });

  it('stay short: nothing buzzes for more than a tenth of a second in total', () => {
    for (const pattern of Object.values(HAPTIC_PATTERNS)) {
      expect(vibrationMs(pattern.vibrate)).toBeLessThanOrEqual(100);
    }
  });

  it('give iOS one tick per pulse, the first one inside the gesture', () => {
    for (const pattern of Object.values(HAPTIC_PATTERNS)) {
      const pulses = typeof pattern.vibrate === 'number' ? 1 : Math.ceil(pattern.vibrate.length / 2);
      expect(pattern.taps).toHaveLength(pulses);
      expect(pattern.taps[0]).toBe(0);
    }
  });
});
