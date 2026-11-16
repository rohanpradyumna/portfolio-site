import { describe, expect, it } from 'vitest';
import { SEAT_IDS } from '@/lib/council/contract';
import { COUNCIL_COPY } from '@/data/council/copy';
import {
  ASSEMBLY_STEP,
  CONTACT,
  LAST_STEP,
  MEMBER_COUNT,
  SCROLL,
  STEP_COUNT,
  clampStep,
  landingAt,
  liftAt,
  nextUnlockFraction,
  progressAtScroll,
  reachedStep,
  scrollStops,
  settleScroll,
  stepAhead,
  stepAt,
  stepBehind,
  unlockFraction,
} from './sequence';

const PHONE = 844;
const LAPTOP = 900;

describe('the sequence', () => {
  it('is six members, then the three beats', () => {
    expect(MEMBER_COUNT).toBe(6);
    expect(STEP_COUNT).toBe(9);
    expect(ASSEMBLY_STEP).toBe(6);
    expect(LAST_STEP).toBe(8);
  });

  it('gives each member step both of its lines, in seat order, unedited', () => {
    SEAT_IDS.forEach((seatId, i) => {
      const step = stepAt(i);
      const { hello, worldview } = COUNCIL_COPY.intro.seatLines[seatId];
      expect(step).toMatchObject({ kind: 'member', seatId });
      expect(step.text).toBe(`${hello} ${worldview}`);
    });
  });

  it('ends on the invitation', () => {
    expect(stepAt(LAST_STEP)).toMatchObject({ kind: 'beat', beatIndex: 2, text: COUNCIL_COPY.intro.beats[2].line });
    expect(COUNCIL_COPY.intro.beats[2].id).toBe('invite');
  });

  it('clamps anything to a real step', () => {
    expect(clampStep(-3)).toBe(0);
    expect(clampStep(99)).toBe(LAST_STEP);
    expect(clampStep(2.6)).toBe(3);
    expect(clampStep(Number.NaN)).toBe(0);
  });
});

describe('scroll stops', () => {
  it('has one rest per step, starting at the top and only ever going down', () => {
    for (const height of [568, 667, PHONE, LAPTOP, 1300]) {
      const stops = scrollStops(height);
      expect(stops).toHaveLength(STEP_COUNT);
      expect(stops[0]).toBe(0);
      for (let i = 1; i < stops.length; i++) expect(stops[i]).toBeGreaterThan(stops[i - 1]);
    }
  });

  it('asks for about three quarters of a viewport per member, and less for a beat', () => {
    const stops = scrollStops(PHONE);
    const member = stops[1] - stops[0];
    const beat = stops[LAST_STEP] - stops[LAST_STEP - 1];
    expect(member / PHONE).toBeGreaterThanOrEqual(0.7);
    expect(member / PHONE).toBeLessThanOrEqual(1);
    expect(beat).toBeLessThan(member);
    // Every member, and the gathering, costs the same.
    for (let i = 1; i <= ASSEMBLY_STEP; i++) expect(stops[i] - stops[i - 1]).toBe(member);
    for (let i = ASSEMBLY_STEP + 1; i <= LAST_STEP; i++) expect(stops[i] - stops[i - 1]).toBe(beat);
  });

  it('keeps a step a sensible distance on very short and very tall screens', () => {
    expect(scrollStops(400)[1]).toBe(SCROLL.memberMinPx);
    expect(scrollStops(2000)[1]).toBe(SCROLL.memberMaxPx);
    expect(scrollStops(0)[1]).toBe(SCROLL.memberMinPx);
  });

  it('is deliberate but not tedious: the whole sequence is under seven viewports', () => {
    for (const height of [667, PHONE, LAPTOP]) {
      const total = scrollStops(height)[LAST_STEP];
      expect(total / height).toBeGreaterThan(4);
      expect(total / height).toBeLessThan(7);
    }
  });
});

describe('scroll to progress', () => {
  const stops = scrollStops(PHONE);
  const member = stops[1];

  it('is each whole step exactly at its stop', () => {
    stops.forEach((top, step) => expect(progressAtScroll(top, stops)).toBe(step));
  });

  it('holds still on a plateau either side of every stop', () => {
    for (let step = 1; step < LAST_STEP; step++) {
      const before = stops[step] - (stops[step] - stops[step - 1]) * (SCROLL.holdBefore - 0.01);
      const after = stops[step] + (stops[step + 1] - stops[step]) * (SCROLL.holdAfter - 0.01);
      expect(progressAtScroll(before, stops)).toBe(step);
      expect(progressAtScroll(after, stops)).toBe(step);
    }
  });

  it('gives a member a plateau wide enough to rest on without aiming', () => {
    const plateau = member * (SCROLL.holdBefore + SCROLL.holdAfter);
    expect(plateau).toBeGreaterThan(250);
  });

  it('travels linearly between plateaus, and is halfway at the midpoint', () => {
    expect(progressAtScroll(member * 0.5, stops)).toBeCloseTo(0.5, 6);
    const a = progressAtScroll(member * 0.4, stops);
    const b = progressAtScroll(member * 0.6, stops);
    expect(a).toBeGreaterThan(0);
    expect(b).toBeLessThan(1);
    expect(b - 0.5).toBeCloseTo(0.5 - a, 6);
  });

  it('never goes backwards as the scroll goes down, and has no jumps', () => {
    let previous = 0;
    for (let y = 0; y <= stops[LAST_STEP]; y += 2) {
      const value = progressAtScroll(y, stops);
      expect(value).toBeGreaterThanOrEqual(previous);
      // Two pixels of scroll never move the sequence more than a sliver.
      expect(value - previous).toBeLessThan(0.02);
      previous = value;
    }
    expect(previous).toBe(LAST_STEP);
  });

  it('ignores the rubber band past either end', () => {
    expect(progressAtScroll(-80, stops)).toBe(0);
    expect(progressAtScroll(stops[LAST_STEP] + 80, stops)).toBe(LAST_STEP);
  });

  it('rounds to the nearer step either side of a midpoint', () => {
    expect(clampStep(progressAtScroll(member * 0.49, stops))).toBe(0);
    expect(clampStep(progressAtScroll(member * 0.51, stops))).toBe(1);
  });
});

describe('landings and unlocking', () => {
  const stops = scrollStops(LAPTOP);
  const member = stops[1];

  it('lands a step where its plateau begins, the first one at the top', () => {
    expect(landingAt(0, stops)).toBe(0);
    for (let step = 1; step <= LAST_STEP; step++) {
      const landing = landingAt(step, stops);
      expect(landing).toBeLessThan(stops[step]);
      expect(progressAtScroll(landing, stops)).toBeCloseTo(step, 6);
      expect(progressAtScroll(landing - 4, stops)).toBeLessThan(step);
    }
  });

  it('counts a step as reached only once it has fully arrived', () => {
    expect(reachedStep(0)).toBe(0);
    expect(reachedStep(0.99)).toBe(0);
    expect(reachedStep(1)).toBe(1);
    expect(reachedStep(2.5)).toBe(2);
    expect(reachedStep(-1)).toBe(0);
    expect(reachedStep(99)).toBe(LAST_STEP);
  });

  it('unlocks a member from the last landing to their own, and shows every pixel on the way', () => {
    expect(unlockFraction(0, 0, stops)).toBe(1);
    expect(unlockFraction(1, 0, stops)).toBe(0);
    expect(unlockFraction(1, landingAt(1, stops), stops)).toBe(1);
    expect(unlockFraction(2, landingAt(1, stops), stops)).toBe(0);
    expect(unlockFraction(2, landingAt(2, stops), stops)).toBe(1);
    expect(unlockFraction(2, stops[5], stops)).toBe(1);
    expect(unlockFraction(4, stops[1], stops)).toBe(0);
    // Across the plateau after a stop, progress holds but the unlock keeps moving.
    expect(progressAtScroll(member * 0.1, stops)).toBe(0);
    expect(unlockFraction(1, member * 0.1, stops)).toBeGreaterThan(0.1);
  });

  it('has no dead scroll: the cue fraction rises with every pixel until the next landing', () => {
    for (let step = 0; step < LAST_STEP; step++) {
      let previous = -1;
      for (let y = landingAt(step, stops) + 1; y < landingAt(step + 1, stops) - 1; y += 3) {
        const value = nextUnlockFraction(y, stops);
        expect(value).toBeGreaterThan(previous);
        previous = value;
      }
      expect(previous).toBeGreaterThan(0.97);
    }
  });

  it('empties the cue the moment someone lands, and is full for good at the end', () => {
    expect(nextUnlockFraction(landingAt(3, stops) - 2, stops)).toBeGreaterThan(0.98);
    expect(nextUnlockFraction(landingAt(3, stops) + 2, stops)).toBeLessThan(0.02);
    expect(nextUnlockFraction(stops[LAST_STEP], stops)).toBe(1);
    expect(nextUnlockFraction(landingAt(LAST_STEP, stops) + 1, stops)).toBe(1);
  });
});

describe('settling a rest', () => {
  const stops = scrollStops(PHONE);
  const member = stops[1];

  it('leaves a rest on a plateau exactly where it is', () => {
    expect(settleScroll(stops[2], 1, stops)).toBeNull();
    expect(settleScroll(stops[2] + member * 0.2, 1, stops)).toBeNull();
    expect(settleScroll(stops[2] - member * 0.2, -1, stops)).toBeNull();
    expect(settleScroll(0, 1, stops)).toBeNull();
    expect(settleScroll(stops[LAST_STEP], 1, stops)).toBeNull();
    expect(settleScroll(-40, -1, stops)).toBeNull();
  });

  it('finishes a rest between two steps in the direction the visitor was going', () => {
    const mid = stops[1] + member * 0.4;
    const onward = settleScroll(mid, 1, stops);
    const back = settleScroll(mid, -1, stops);
    expect(onward).not.toBeNull();
    expect(back).not.toBeNull();
    expect(onward!).toBeGreaterThan(mid);
    expect(back!).toBeLessThan(mid);
    expect(progressAtScroll(onward!, stops)).toBe(2);
    expect(progressAtScroll(back!, stops)).toBe(1);
  });

  it('never reverses: even just past a plateau, forward stays forward', () => {
    const justLeft = stops[1] + member * (SCROLL.holdAfter + 0.02);
    expect(settleScroll(justLeft, 1, stops)!).toBeGreaterThan(justLeft);
    const nearlyThere = stops[2] - member * (SCROLL.holdBefore + 0.02);
    expect(settleScroll(nearlyThere, -1, stops)!).toBeLessThan(nearlyThere);
  });

  it('lands a little way inside the plateau, so the rest is stable', () => {
    const to = settleScroll(stops[1] + member * 0.5, 1, stops)!;
    expect(settleScroll(to, 1, stops)).toBeNull();
    expect(settleScroll(to - 20, -1, stops)).toBeNull();
    expect(to).toBeLessThan(stops[2]);
    // It never carries the scroll further than the travel itself.
    expect(to - (stops[1] + member * SCROLL.holdAfter)).toBeLessThan(member * 0.65);
  });
});

describe('stepping with a key or the cue', () => {
  it('goes to the next step from a rest', () => {
    expect(stepAhead(2)).toBe(3);
    expect(stepBehind(2)).toBe(1);
  });

  it('finishes the step in flight instead of skipping it', () => {
    expect(stepAhead(2.6)).toBe(3);
    expect(stepBehind(2.6)).toBe(2);
    expect(stepAhead(2.2)).toBe(3);
    expect(stepBehind(2.2)).toBe(2);
  });

  it('stops at the ends', () => {
    expect(stepAhead(LAST_STEP)).toBe(LAST_STEP);
    expect(stepBehind(0)).toBe(0);
    expect(stepAhead(-1)).toBe(0);
  });
});

describe('lift', () => {
  it('has a member waiting on the board, then on the board again at their step', () => {
    expect(liftAt(2, 0.5)).toBe(0);
    expect(liftAt(2, 1)).toBe(0);
    expect(liftAt(2, 2)).toBe(0);
  });

  it('picks them up early in the approach and holds them high', () => {
    expect(liftAt(2, 1.05)).toBeGreaterThan(0.3);
    expect(liftAt(2, 1.25)).toBeGreaterThan(0.95);
  });

  it('touches down at the contact distance, coming down all the way from the top of the pickup', () => {
    expect(liftAt(2, 2 - CONTACT)).toBeCloseTo(0, 6);
    expect(liftAt(2, 2 - CONTACT / 2)).toBe(0);
    expect(liftAt(2, 2 - CONTACT - 0.01)).toBeGreaterThan(0.01);
    let previous = 1;
    for (let p = 1.25; p <= 2; p += 0.02) {
      const lift = liftAt(2, p);
      expect(lift).toBeLessThanOrEqual(previous + 1e-9);
      previous = lift;
    }
  });

  it('hops when stepping aside, then rests in the lineup', () => {
    expect(liftAt(1, 1.5)).toBeGreaterThan(0.2);
    expect(liftAt(1, 2)).toBeCloseTo(0);
    expect(liftAt(1, 3.5)).toBe(0);
  });

  it('hops once more to gather, and is down for the beats', () => {
    for (let member = 0; member < MEMBER_COUNT; member++) {
      expect(liftAt(member, ASSEMBLY_STEP - 0.5)).toBeGreaterThan(0.2);
      expect(liftAt(member, ASSEMBLY_STEP)).toBeCloseTo(0);
      expect(liftAt(member, LAST_STEP)).toBeCloseTo(0);
    }
  });

  it('stays between 0 and 1 everywhere', () => {
    for (let member = 0; member < MEMBER_COUNT; member++) {
      for (let p = -1.5; p <= LAST_STEP + 0.5; p += 0.05) {
        const lift = liftAt(member, p);
        expect(lift).toBeGreaterThanOrEqual(0);
        expect(lift).toBeLessThanOrEqual(1);
      }
    }
  });
});
