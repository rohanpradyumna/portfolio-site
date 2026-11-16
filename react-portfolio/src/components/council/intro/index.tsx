'use client';

import React, { CSSProperties, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AnimationPlaybackControls,
  MotionValue,
  animate,
  motion,
  motionValue,
  useMotionValue,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
  useTransform,
} from 'framer-motion';
import { SEAT_IDS, SeatId } from '@/lib/council/contract';
import { COUNCIL_COPY } from '@/data/council/copy';
import { SEAT_LIST, SEATS } from '@/data/council/seats';
import { feel, useFeelMuted } from '@/components/council/feel';
import { INTRO_UI, PORTRAIT_ASPECT } from './constants';
import { IntroLayout, Viewport, computeLayout } from './layout';
import { markCouncilIntroSeen } from './seen';
import {
  ASSEMBLY_STEP,
  BEATS,
  CONTACT,
  FLYBY_SPEED,
  LAST_STEP,
  LEAD_IN_MS,
  MEMBER_COUNT,
  SPRINGS,
  clampStep,
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
import { Sticker } from './Sticker';
import styles from './intro.module.css';

export { hasSeenCouncilIntro, markCouncilIntroSeen } from './seen';

// The first-visit intro for The Council: a sticky, scroll-driven sequence.
//
// The overlay is its own scroll container (the site's body never scrolls): a
// tall track with a full-viewport sticky stage. One motion value, `progress`,
// is the whole sequence (see sequence.ts), and the scroll position is the only
// thing that moves it. The six stickers, their bubbles and the beat card are
// pure functions of progress. Keys, the lineup and the scroll cue all work by
// scrolling this container, so there is one source of truth.
//
// Scrolling is never intercepted. Wheel and touch keep their native momentum
// and rubber band. A rest on a step is left where it is (each step holds
// across a wide plateau of scroll), and a rest between two steps is finished
// in the direction the visitor was going. The only things that play on their
// own are one-shot reactions to an arrival: the squash, the bubble, the sound.
//
// WIRING (for the scene)
//
//   <CouncilIntro onDone={(how) => setIntroDone(true)} />
//
//   - Render it as a sibling of the scene's scroller, inside the same
//     <LayoutGroup>, with no live seats mounted while it is up. Each sticker's
//     box carries layoutId `council-seat-<seatId>`. When onDone unmounts this
//     component and mounts the seats in the same commit, framer flies every
//     sticker from where the intro left it into its seat. No AnimatePresence
//     is needed: the overlay has already faded its own paper and words away
//     before it calls onDone, and only the stickers are left to hand over.
//   - The handoff is exact when the scene's scroller is at scrollTop 0 (framer
//     measures a fixed overlay and scrolled content in different spaces).
//   - Pass exit="fade" where there are no seats to fly to. Reduced motion
//     always uses the fade.
//   - It marks itself seen (markCouncilIntroSeen) when it ends, either way.
//   - It traps focus and handles Escape. Returning focus afterwards is the
//     caller's job, in onDone.

export interface CouncilIntroProps {
  /** Called once, when the overlay has finished leaving. Unmount it here. */
  onDone: (how: 'finished' | 'skipped') => void;
  /**
   * How it leaves. 'handoff' (default) fades everything but the stickers and
   * lets shared layout carry them into the scene. 'fade' fades the whole
   * overlay with a slight scale, for when nothing shares the layoutIds.
   */
  exit?: 'handoff' | 'fade';
  /** True when opened over a visible scene (the replay control): the paper fades in instead of cutting. */
  replay?: boolean;
  /** Dev: open already scrolled to this step (0 to 5 are members, 6 to 8 the beats). */
  startStep?: number;
}

const EASE_OUT = [0.23, 1, 0.32, 1] as const;
/** After this long without a scroll event, the visitor has stopped. Milliseconds. */
const REST_MS = 220;
/** After this much longer at rest, the cue starts asking. Milliseconds. */
const IDLE_MS = 1500;
/** The invitation ignores presses for this long after it appears, so a run of "next" presses cannot overshoot into it. */
const BEGIN_GUARD_MS = 450;

/** How a member's bubble is showing: 0 hidden, 1 the hello, 2 both lines. */
type Reveal = 0 | 1 | 2;
/** What the visitor is doing with the scroll: moving it, just stopped, or stopped for a while. */
type Activity = 'active' | 'rest' | 'idle';

function isControl(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest('button, a, input') !== null;
}

/** What the scroll cue promises next from a given step. Null on the last step, where it becomes the invitation. */
function nextUp(step: number): { name: string; accent: string | null } | null {
  if (step >= LAST_STEP) return null;
  if (step + 1 < MEMBER_COUNT) {
    const seat = SEATS[SEAT_IDS[step + 1]];
    return { name: seat.figure, accent: seat.accent };
  }
  const name = step + 1 === ASSEMBLY_STEP ? INTRO_UI.cueAssembly : step + 1 === LAST_STEP ? INTRO_UI.cueInvite : INTRO_UI.cueLimit;
  return { name, accent: null };
}

export function CouncilIntro({ onDone, exit = 'handoff', replay = false, startStep = 0 }: CouncilIntroProps) {
  const reduced = useReducedMotion() === true;
  const first = clampStep(startStep);
  const [muted, setMuted] = useFeelMuted();

  const rootRef = useRef<HTMLDivElement>(null);
  const probeRef = useRef<HTMLDivElement>(null);
  const cueRef = useRef<HTMLButtonElement>(null);
  const [viewport, setViewport] = useState<Viewport | null>(null);
  const layout = useMemo(() => (viewport ? computeLayout(viewport) : null), [viewport]);
  const height = viewport?.h ?? 0;
  const stops = useMemo(() => scrollStops(height), [height]);

  // --- Scroll to progress ------------------------------------------------------

  const { scrollY } = useScroll({ container: rootRef });
  /** Where the scroll says the sequence is: flat around each step, linear between. */
  const target = useTransform(scrollY, (y) => progressAtScroll(y, stops));
  /** Distance covered toward whoever is next. Never flat, so there is no dead scroll. */
  const fraction = useTransform(scrollY, (y) => nextUnlockFraction(y, stops));
  /** `target`, a few frames behind on a stiff spring. */
  const follow = useMotionValue(first);
  /** 0 to 1 once, when the overlay opens: the first member's arrival, which nobody scrolls for. */
  const entrance = useMotionValue(first === 0 && !reduced ? 0 : 1);
  const sprung = useTransform(() => follow.get() + entrance.get() - 1);
  /** The calm variant: whole steps only, swapped under a cross-fade. */
  const stepped = useMotionValue(first);
  const progress = reduced ? stepped : sprung;

  // The lineup's places empty out as the council gathers below them.
  const lineupOpacity = useTransform(progress, [ASSEMBLY_STEP - 1, ASSEMBLY_STEP - 0.4], [1, 0]);
  const backdropOpacity = useMotionValue(replay ? 0 : 1);
  const chromeOpacity = useMotionValue(1);
  const castOpacity = useMotionValue(1);
  const wordsOpacity = useMotionValue(1);
  const contentScale = useMotionValue(1);
  const gather = useMotionValue(0);
  const impacts = useMemo(() => SEAT_IDS.map(() => ({ press: motionValue(0), wobble: motionValue(0) })), []);

  const [step, setStep] = useState(first);
  // The last step fully arrived. The cue names the one after it.
  const [reached, setReached] = useState(first);
  // The furthest step the scroll has begun to bring in. Everyone past it is still locked.
  const [lead, setLead] = useState(first);
  const [reveal, setReveal] = useState<Reveal[]>(() => SEAT_IDS.map((_, i) => (i < first ? 2 : 0)));
  const [speaking, setSpeaking] = useState<SeatId | null>(null);
  const [activity, setActivity] = useState<Activity>('rest');
  const [exiting, setExiting] = useState(false);
  // On a replay the paper fades in over the scene, so the flat paper behind it waits for that.
  const [papered, setPapered] = useState(!replay);
  const [announcement, setAnnouncement] = useState('');

  // Mirrors for listeners that outlive a render.
  const stepRef = useRef(first);
  const stopsRef = useRef(stops);
  const reducedRef = useRef(reduced);
  const exitingRef = useRef(false);
  const jumpRef = useRef(false);
  const lastProgressRef = useRef(first === 0 ? -1 : first);
  const reachedLastAtRef = useRef(0);
  const followAnimRef = useRef<AnimationPlaybackControls | null>(null);
  const fadeTokenRef = useRef(0);
  const seenRef = useRef<Set<number>>(new Set());
  const announcedRef = useRef<Set<number>>(new Set());
  const timersRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());
  const speakTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const activityTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const activityRef = useRef<Activity>('rest');
  const reachedRef = useRef(first);
  const leadRef = useRef(first);
  const lastScrollRef = useRef(0);
  const directionRef = useRef<1 | -1>(1);
  const touchingRef = useRef(false);
  useEffect(() => {
    stopsRef.current = stops;
    reducedRef.current = reduced;
  }, [stops, reduced]);

  const later = useCallback((run: () => void, ms: number) => {
    const timer = setTimeout(() => {
      timersRef.current.delete(timer);
      run();
    }, ms);
    timersRef.current.add(timer);
    return timer;
  }, []);

  // --- Measuring ---------------------------------------------------------------

  useEffect(() => {
    const root = rootRef.current;
    const probe = probeRef.current;
    if (!root || !probe) return;
    // ResizeObserver reports once on observe, before the first paint, then on
    // every change: rotation, a browser toolbar sliding away, a window drag.
    const observer = new ResizeObserver(() => {
      const insets = getComputedStyle(probe);
      setViewport({
        w: root.clientWidth,
        h: root.clientHeight,
        safeTop: parseFloat(insets.paddingTop) || 0,
        safeBottom: parseFloat(insets.paddingBottom) || 0,
      });
    });
    observer.observe(root);
    return () => observer.disconnect();
  }, []);

  // --- Arrivals ----------------------------------------------------------------

  const showBubble = useCallback((member: number, level: Reveal) => {
    setReveal((current) => (current[member] >= level ? current : current.map((value, i) => (i === member ? level : value))));
  }, []);

  const slap = useCallback(
    (member: number, impact: number) => {
      const { press, wobble } = impacts[member];
      // Both start at rest and are kicked with a velocity, like the thing they
      // model: a sticker that has just been hit. A harder arrival kicks harder.
      animate(press, 0, { type: 'spring', velocity: -(1.5 + 0.45 * impact), stiffness: 620, damping: 15, mass: 0.6 });
      animate(wobble, 0, {
        type: 'spring',
        velocity: (member % 2 === 0 ? 1 : -1) * (24 + 9 * impact),
        stiffness: 420,
        damping: 11,
        mass: 0.6,
      });
    },
    [impacts],
  );

  /**
   * Progress has reached a step. Sound and touch only ever answer forward
   * scrolling. `how` says what kind of arrival it was:
   *   'landed'  put down at a readable speed: the squash, the slap, the bubble opening
   *   'passed'  flown through on a long flick: a tick, and the words simply there
   *   'quiet'   scrolled back to, or reached with motion reduced: no physics
   */
  const arrive = useCallback(
    (at: number, how: 'landed' | 'passed' | 'quiet', forward: boolean, speed: number) => {
      const firstTime = !seenRef.current.has(at);
      seenRef.current.add(at);

      if (how === 'passed') {
        feel('scrubTick');
        if (at < MEMBER_COUNT) showBubble(at, 2);
        return;
      }

      if (at < MEMBER_COUNT) {
        if (how === 'landed') {
          slap(at, speed);
          // The member stepping aside lands in the lineup at the same moment, lightly.
          if (at > 0) slap(at - 1, 0);
          feel('stickerLand', { intensity: Math.min(1, 0.55 + speed * 0.1) });
        }
        if (firstTime && how === 'landed') {
          showBubble(at, 1);
          later(() => feel('bubble'), 90);
          later(() => showBubble(at, 2), 430);
          const seatId = SEAT_IDS[at];
          setSpeaking(seatId);
          clearTimeout(speakTimerRef.current);
          speakTimerRef.current = setTimeout(() => setSpeaking((current) => (current === seatId ? null : current)), 2200);
        } else {
          showBubble(at, 2);
          if (firstTime && forward) feel('bubble');
        }
        return;
      }

      setSpeaking(null);
      if (!forward) return;
      if (at === ASSEMBLY_STEP && how === 'landed') {
        // The council assembles: six small landings in a quick run, one sound.
        SEAT_IDS.forEach((_, i) => later(() => slap(i, 1.2), i * 26));
        feel('stickerLand', { intensity: 0.9 });
      } else if (firstTime) {
        feel('bubble');
      }
      if (at === LAST_STEP && firstTime && how === 'landed') {
        // The cue has just become the invitation. It nudges itself, once.
        later(() => {
          cueRef.current?.animate(
            [{ transform: 'scale(1)' }, { transform: 'scale(1.05)', offset: 0.4 }, { transform: 'scale(1)' }],
            { duration: 460, easing: 'cubic-bezier(0.23, 1, 0.32, 1)' },
          );
        }, 160);
      }
    },
    [later, showBubble, slap],
  );
  const arriveRef = useRef(arrive);
  useEffect(() => {
    arriveRef.current = arrive;
  }, [arrive]);

  // Contact: the frame the drawn progress closes to within CONTACT of a step
  // is the frame that sticker meets the board. Squash, sound and haptic all
  // fire from here, on the same frame, once per crossing.
  useMotionValueEvent(sprung, 'change', (value) => {
    const previous = lastProgressRef.current;
    lastProgressRef.current = value;
    if (reducedRef.current || exitingRef.current) return;
    const at = Math.round(value);
    if (at < 0 || at > LAST_STEP || Math.abs(value - at) > CONTACT) return;
    const wasThere = Math.round(previous) === at && Math.abs(previous - at) <= CONTACT;
    if (wasThere) return;
    const forward = value > previous;
    const speed = Math.abs(sprung.getVelocity());
    arriveRef.current(at, !forward ? 'quiet' : speed > FLYBY_SPEED ? 'passed' : 'landed', forward, Math.min(8, speed));
  });

  // --- Following the scroll ----------------------------------------------------

  const visit = useCallback((next: number) => {
    stepRef.current = next;
    setStep(next);
    if (!announcedRef.current.has(next)) {
      announcedRef.current.add(next);
      setAnnouncement(stepAt(next).text);
    }
  }, []);

  /** The calm variant of a step change: the cast and the words fade out, the sequence jumps, they fade back. */
  const crossFadeTo = useCallback(
    (next: number) => {
      const token = ++fadeTokenRef.current;
      const from = stepped.get();
      const out = animate(castOpacity, 0, { duration: 0.12, ease: 'easeOut' });
      animate(wordsOpacity, 0, { duration: 0.12, ease: 'easeOut' });
      void out.then(() => {
        if (token !== fadeTokenRef.current || exitingRef.current) return;
        stepped.set(next);
        arriveRef.current(next, 'quiet', next > from, 0);
        animate(castOpacity, 1, { duration: 0.2, ease: 'easeOut' });
        animate(wordsOpacity, 1, { duration: 0.2, ease: 'easeOut' });
      });
    },
    [castOpacity, stepped, wordsOpacity],
  );

  useMotionValueEvent(target, 'change', (value) => {
    if (exitingRef.current) return;
    const nearest = clampStep(value);
    const changed = nearest !== stepRef.current;
    if (changed) visit(nearest);
    const arrived = reachedStep(value);
    if (arrived !== reachedRef.current) {
      reachedRef.current = arrived;
      setReached(arrived);
      if (arrived === LAST_STEP) reachedLastAtRef.current = performance.now();
    }
    const leading = clampStep(Math.ceil(value - 1e-6));
    if (leading !== leadRef.current) {
      leadRef.current = leading;
      setLead(leading);
    }
    if (reducedRef.current) {
      if (changed) crossFadeTo(nearest);
      return;
    }
    if (jumpRef.current) {
      followAnimRef.current?.stop();
      follow.jump(value);
      return;
    }
    followAnimRef.current?.stop();
    followAnimRef.current = animate(follow, value, { ...SPRINGS.follow, velocity: follow.getVelocity() });
  });

  // Moving, just stopped, or stopped for a while: the cue is quiet for the
  // first, calm for the second, and asks for the third.
  const noteActivity = useCallback((next: Activity) => {
    if (activityRef.current === next) return;
    activityRef.current = next;
    setActivity(next);
  }, []);
  /** Let go between two steps: carry the scroll on to the one the visitor was heading for. */
  const completeTravel = useCallback(() => {
    const root = rootRef.current;
    if (!root || reducedRef.current || exitingRef.current || touchingRef.current) return;
    const to = settleScroll(root.scrollTop, directionRef.current, stopsRef.current);
    if (to !== null) root.scrollTo({ top: to, behavior: 'smooth' });
  }, []);
  const settleActivity = useCallback(() => {
    clearTimeout(activityTimerRef.current);
    activityTimerRef.current = setTimeout(() => {
      noteActivity('rest');
      completeTravel();
      activityTimerRef.current = setTimeout(() => noteActivity('idle'), IDLE_MS);
    }, REST_MS);
  }, [completeTravel, noteActivity]);
  useMotionValueEvent(scrollY, 'change', (y) => {
    const delta = y - lastScrollRef.current;
    if (Math.abs(delta) > 0.5) directionRef.current = delta > 0 ? 1 : -1;
    lastScrollRef.current = y;
    noteActivity('active');
    settleActivity();
  });

  // A finger resting on the glass mid-drag is not a rest. Wait for it to lift.
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const onStart = () => {
      touchingRef.current = true;
    };
    const onEnd = (event: TouchEvent) => {
      touchingRef.current = event.touches.length > 0;
      if (!touchingRef.current) settleActivity();
    };
    root.addEventListener('touchstart', onStart, { passive: true });
    root.addEventListener('touchend', onEnd, { passive: true });
    root.addEventListener('touchcancel', onEnd, { passive: true });
    return () => {
      root.removeEventListener('touchstart', onStart);
      root.removeEventListener('touchend', onEnd);
      root.removeEventListener('touchcancel', onEnd);
    };
  }, [settleActivity]);

  const scrollToStep = useCallback((next: number) => {
    const root = rootRef.current;
    if (!root) return;
    root.scrollTo({ top: stopsRef.current[clampStep(next)], behavior: reducedRef.current ? 'auto' : 'smooth' });
  }, []);

  const forward = useCallback(() => {
    const next = stepAhead(target.get());
    if (next === stepRef.current && next === LAST_STEP) return;
    feel('advance');
    scrollToStep(next);
  }, [scrollToStep, target]);

  const back = useCallback(() => {
    if (target.get() <= 0) return;
    feel('advance');
    scrollToStep(stepBehind(target.get()));
  }, [scrollToStep, target]);

  const jump = useCallback(
    (next: number) => {
      feel('advance');
      scrollToStep(next);
    },
    [scrollToStep],
  );

  // The opening. Once the overlay has a size it is placed on its starting
  // step without travel, and then the first member is brought in: the one
  // arrival nobody scrolls for, so the board is never empty and the pattern
  // (a sticker lands, and speaks) is shown before it is asked for.
  const ready = layout !== null;
  useEffect(() => {
    const root = rootRef.current;
    if (!ready || !root) return;
    jumpRef.current = true;
    root.scrollTop = stopsRef.current[first];
    follow.jump(first);
    // The scroll event for that assignment arrives a frame or two later.
    const release = setTimeout(() => {
      jumpRef.current = false;
    }, 120);
    if (replay) void animate(backdropOpacity, 1, { duration: 0.22, ease: EASE_OUT }).then(() => setPapered(true));
    const open = setTimeout(
      () => {
        visit(first);
        reachedRef.current = first;
        setReached(first);
        settleActivity();
        if (first === 0 && !reducedRef.current) animate(entrance, 1, SPRINGS.entrance);
        else arriveRef.current(first, 'quiet', true, 0);
      },
      reducedRef.current ? 0 : LEAD_IN_MS,
    );
    return () => {
      clearTimeout(release);
      clearTimeout(open);
    };
    // Runs once, when the overlay first has a size.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  // A resize changes the scroll distances. Stay on the step the visitor was on.
  const anchoredRef = useRef<number[] | null>(null);
  useEffect(() => {
    const root = rootRef.current;
    if (!ready || !root) return;
    if (anchoredRef.current !== null && anchoredRef.current !== stops) {
      jumpRef.current = true;
      root.scrollTop = stops[stepRef.current];
      const release = setTimeout(() => {
        jumpRef.current = false;
      }, 120);
      anchoredRef.current = stops;
      return () => clearTimeout(release);
    }
    anchoredRef.current = stops;
  }, [ready, stops]);

  // --- Leaving -----------------------------------------------------------------

  const finish = useCallback(
    (how: 'finished' | 'skipped') => {
      if (exitingRef.current) return;
      exitingRef.current = true;
      setExiting(true);
      markCouncilIntroSeen();
      feel(how === 'finished' ? 'begin' : 'stop');
      const handoff = exit === 'handoff' && !reducedRef.current;
      // Skipped partway, the council is scattered: one on the stage, some in
      // the lineup, some still waiting. They are gathered first, so the scene
      // is always handed six stickers standing together.
      const scattered = progress.get() < ASSEMBLY_STEP - CONTACT;
      if (handoff) {
        // Paper and words go. The stickers stay, on top of the scene that is
        // appearing behind them, for framer to pick up.
        animate(wordsOpacity, 0, { duration: 0.14, ease: 'easeOut' });
        animate(chromeOpacity, 0, { duration: 0.16, ease: 'easeOut' });
        animate(backdropOpacity, 0, { duration: 0.24, ease: EASE_OUT });
        if (scattered) animate(gather, 1, SPRINGS.gather);
      } else {
        const duration = reducedRef.current ? 0.16 : 0.22;
        for (const value of [wordsOpacity, chromeOpacity, castOpacity, backdropOpacity]) {
          animate(value, 0, { duration, ease: EASE_OUT });
        }
        if (!reducedRef.current) animate(contentScale, 0.97, { duration, ease: EASE_OUT });
      }
      // The handoff does not wait for the last of the fade: by now the paper is
      // nearly gone, and a sticker left sitting on a finished scene reads as a stall.
      later(() => onDone(how), handoff ? (scattered ? 300 : 150) : reducedRef.current ? 170 : 230);
    },
    [backdropOpacity, castOpacity, chromeOpacity, contentScale, exit, gather, later, onDone, progress, wordsOpacity],
  );

  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      timers.forEach((timer) => clearTimeout(timer));
      clearTimeout(speakTimerRef.current);
      clearTimeout(activityTimerRef.current);
      followAnimRef.current?.stop();
    };
  }, []);

  // --- Keyboard and focus ------------------------------------------------------

  useEffect(() => {
    rootRef.current?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const root = rootRef.current;
      if (!root || exitingRef.current || event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;

      if (event.key === 'Escape') {
        event.preventDefault();
        finish('skipped');
        return;
      }

      if (event.key === 'Tab') {
        // Modal: Tab cycles inside the overlay.
        const controls = Array.from(root.querySelectorAll<HTMLElement>('button:not([disabled]):not([tabindex="-1"])'));
        if (controls.length === 0) {
          event.preventDefault();
          return;
        }
        const active = document.activeElement;
        const inside = active instanceof Node && root.contains(active) && active !== root;
        const firstControl = controls[0];
        const lastControl = controls[controls.length - 1];
        if (event.shiftKey && (!inside || active === firstControl)) {
          event.preventDefault();
          lastControl.focus({ preventScroll: true });
        } else if (!event.shiftKey && (!inside || active === lastControl)) {
          event.preventDefault();
          firstControl.focus({ preventScroll: true });
        }
        return;
      }

      // The keys a page scrolls with, taken a step at a time. They scroll the
      // same container the wheel does, so the sequence has one source of truth.
      switch (event.key) {
        case 'ArrowDown':
        case 'ArrowRight':
        case 'PageDown':
          event.preventDefault();
          forward();
          return;
        case 'ArrowUp':
        case 'ArrowLeft':
        case 'PageUp':
          event.preventDefault();
          back();
          return;
        case 'Home':
          event.preventDefault();
          scrollToStep(0);
          return;
        case 'End':
          event.preventDefault();
          scrollToStep(LAST_STEP);
          return;
        case ' ':
          // On a focused button, Space belongs to the button.
          if (isControl(event.target)) return;
          event.preventDefault();
          if (event.shiftKey) back();
          else forward();
          return;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [back, finish, forward, scrollToStep]);

  // --- Render ------------------------------------------------------------------

  const inBeats = step >= ASSEMBLY_STEP;
  const atEnd = reached === LAST_STEP;
  const showSuffix = (viewport?.w ?? 0) > 768;
  const upNext = nextUp(reached);

  const onCue = () => {
    if (!atEnd) {
      forward();
      return;
    }
    if (performance.now() - reachedLastAtRef.current < BEGIN_GUARD_MS) return;
    finish('finished');
  };

  return (
    <div
      ref={rootRef}
      className={styles.root}
      role="dialog"
      aria-modal="true"
      aria-label={INTRO_UI.title}
      tabIndex={-1}
      data-council-intro=""
      data-step={step}
      data-activity={activity}
      data-papered={(papered && !exiting) || undefined}
      data-exiting={exiting || undefined}
    >
      <div className={styles.track} style={viewport ? { height: viewport.h + stops[LAST_STEP] } : undefined}>
        <div className={styles.stage} style={viewport ? { height: viewport.h } : undefined}>
          <motion.div className={styles.backdrop} style={{ opacity: backdropOpacity }} aria-hidden="true" />
          <div ref={probeRef} className={styles.safeProbe} aria-hidden="true" />
          {/* One polite voice for the whole intro. Each step is spoken once, the first time it is reached. */}
          <p className={styles.srOnly} aria-live="polite" aria-atomic="true">
            {announcement}
          </p>

          <motion.div className={styles.content} style={{ scale: contentScale }}>
            <motion.div className={styles.layer} style={{ opacity: chromeOpacity }}>
              <header className={styles.topBar}>
                <h2 className={styles.title}>{INTRO_UI.title}</h2>
                <div className={styles.actions}>
                  <button
                    type="button"
                    className={styles.iconButton}
                    aria-label={muted ? INTRO_UI.soundOff : INTRO_UI.soundOn}
                    aria-pressed={!muted}
                    onClick={() => {
                      setMuted(!muted);
                      if (muted) feel('select');
                    }}
                  >
                    <SoundIcon muted={muted} />
                  </button>
                  <button type="button" className={styles.skip} onClick={() => finish('skipped')}>
                    <span className={styles.skipPill}>{COUNCIL_COPY.intro.skip}</span>
                  </button>
                </div>
              </header>

              {layout && (
                <motion.ol
                  className={styles.lineup}
                  aria-label={INTRO_UI.lineupLabel}
                  style={{ opacity: lineupOpacity }}
                >
                  {SEAT_LIST.map((seat, i) => (
                    <Place
                      key={seat.id}
                      index={i}
                      layout={layout}
                      scrollY={scrollY}
                      stops={stops}
                      state={i < step ? 'done' : i === step ? 'now' : 'locked'}
                      label={`${seat.figure}, ${seat.school}`}
                      accent={seat.accent}
                      interactive={!inBeats}
                      onJump={jump}
                    />
                  ))}
                </motion.ol>
              )}

              <ScrollCue
                buttonRef={cueRef}
                fraction={fraction}
                upNext={upNext}
                onPress={onCue}
              />
            </motion.div>

            {layout && (
              <>
                <motion.div className={styles.layer} style={{ opacity: castOpacity }} aria-hidden="true">
                  <div
                    className={styles.layer}
                    style={
                      {
                        '--r': `${layout.renderSize}px`,
                        '--k': layout.assembly[0].width / layout.renderSize,
                      } as CSSProperties
                    }
                  >
                    {SEAT_LIST.map((seat, i) => (
                      <Sticker
                        key={seat.id}
                        index={i}
                        seat={seat}
                        layout={layout}
                        progress={progress}
                        gather={gather}
                        press={impacts[i].press}
                        wobble={impacts[i].wobble}
                        // Locked until the scroll starts to bring them in: dimmed, waiting.
                        mood={i > lead && !exiting ? 'dimmed' : speaking === seat.id && step === i ? 'speaking' : 'idle'}
                        showSuffix={showSuffix}
                        shareLayout={exit === 'handoff'}
                      />
                    ))}
                  </div>
                </motion.div>

                <motion.div className={styles.layer} style={{ opacity: wordsOpacity }}>
                  {SEAT_IDS.map((seatId, i) => (
                    <Bubble
                      key={seatId}
                      index={i}
                      seatId={seatId}
                      layout={layout}
                      progress={progress}
                      level={reveal[i]}
                      current={step === i}
                    />
                  ))}
                  <BeatCard layout={layout} progress={progress} step={step} />
                </motion.div>
              </>
            )}
          </motion.div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pieces
// ---------------------------------------------------------------------------

interface PlaceProps {
  index: number;
  layout: IntroLayout;
  scrollY: MotionValue<number>;
  stops: number[];
  /** `locked` until the scroll reaches this member, `now` while they have the floor, `done` once they have stepped aside. */
  state: 'locked' | 'now' | 'done';
  label: string;
  accent: string;
  interactive: boolean;
  onJump: (index: number) => void;
}

/**
 * One kiss-cut outline in the lineup, dashed while its member is locked. The
 * stroke beneath it draws the scroll that unlocks them, pixel for pixel.
 */
function Place({ index, layout, scrollY, stops, state, label, accent, interactive, onJump }: PlaceProps) {
  const slot = layout.slots[index];
  const slotHeight = slot.width * PORTRAIT_ASPECT;
  const unlocked = useTransform(scrollY, (y) => unlockFraction(index, y, stops));
  return (
    <li
      className={styles.place}
      data-state={state}
      style={
        {
          left: slot.cx - slot.width / 2,
          top: slot.cy - slotHeight / 2,
          width: slot.width,
          height: slotHeight,
          '--seat-accent': accent,
        } as CSSProperties
      }
    >
      <button
        type="button"
        className={styles.slot}
        aria-label={label}
        aria-current={state === 'now' ? 'step' : undefined}
        tabIndex={interactive ? 0 : -1}
        onClick={() => onJump(index)}
      >
        <span className={styles.slotOutline} />
      </button>
      <span className={styles.mark} aria-hidden="true">
        <motion.span className={styles.markFill} style={{ scaleX: unlocked }} />
      </span>
    </li>
  );
}

interface ScrollCueProps {
  buttonRef: React.RefObject<HTMLButtonElement | null>;
  /** Distance covered toward the next step, 0 to 1. Fills the cue as the visitor scrolls. */
  fraction: MotionValue<number>;
  /** Who or what the scrolling unlocks next. Null on the last step: the cue is then the invitation. */
  upNext: { name: string; accent: string | null } | null;
  onPress: () => void;
}

/**
 * The one control at the bottom of the board. Through the sequence it says to
 * keep scrolling and names who that unlocks, filling as the scroll closes on
 * them. It is a real button, so pressing it scrolls one step for anyone who
 * cannot easily scroll. On the last step it becomes the invitation. How
 * insistent it is follows data-activity on the dialog (see the stylesheet).
 */
function ScrollCue({ buttonRef, fraction, upNext, onPress }: ScrollCueProps) {
  const final = upNext === null;
  return (
    <div className={styles.cueDock}>
      <button
        ref={buttonRef}
        type="button"
        className={styles.cue}
        data-final={final || undefined}
        aria-label={final ? undefined : INTRO_UI.cueLabel(upNext.name)}
        style={{ '--seat-accent': upNext?.accent ?? 'var(--ink-secondary)' } as CSSProperties}
        onClick={onPress}
      >
        {final ? (
          <>
            {COUNCIL_COPY.intro.begin}
            <ArrowIcon />
          </>
        ) : (
          <>
            <motion.span className={styles.cueFill} style={{ scaleX: fraction }} aria-hidden="true" />
            <span className={styles.cueGlyph} aria-hidden="true">
              <ScrollDoodle />
            </span>
            <span className={styles.cueText}>
              <span className={styles.cueVerb}>
                <span className={styles.forTouch}>{INTRO_UI.cueSwipe}</span>
                <span className={styles.forPointer}>{INTRO_UI.cueScroll}</span>
              </span>
              <span className={styles.cueDot} aria-hidden="true">
                ·
              </span>
              <span className={styles.cueNext}>{INTRO_UI.cueNext(upNext.name)}</span>
            </span>
          </>
        )}
      </button>
    </div>
  );
}

interface BubbleProps {
  index: number;
  seatId: SeatId;
  layout: IntroLayout;
  progress: MotionValue<number>;
  level: Reveal;
  /** This member has the floor. Only their words can be selected: the other bubbles are stacked here, unseen. */
  current: boolean;
}

function Bubble({ index, seatId, layout, progress, level, current }: BubbleProps) {
  // Scrolling on carries the words up and away, the way the page itself would go.
  const y = useTransform(progress, (value) => (index - value) * 70);
  // Gone by a third of the way out, before the next sticker arrives over the same ground.
  const opacity = useTransform(progress, [index - 0.4, index - 0.1, index + 0.06, index + 0.32], [0, 1, 1, 0]);
  const lines = COUNCIL_COPY.intro.seatLines[seatId];
  const seat = SEATS[seatId];
  return (
    <motion.div
      className={styles.bubbleTrack}
      style={{ y, opacity, left: layout.bubble.left, top: layout.bubble.top, width: layout.bubble.width }}
    >
      <div className={styles.bubbleAnchor} data-tail={layout.bubble.tail}>
        {/* The words are in the document from the first render. Only their paint waits for the sticker. */}
        <div
          className={styles.bubble}
          role="group"
          aria-label={seat.figure}
          data-level={level}
          data-current={current || undefined}
          style={{ '--seat-accent': seat.accent } as CSSProperties}
        >
          <p className={styles.hello}>
            <span>{lines.hello}</span>
          </p>
          <p className={styles.worldview}>{lines.worldview}</p>
        </div>
      </div>
    </motion.div>
  );
}

interface BeatCardProps {
  layout: IntroLayout;
  progress: MotionValue<number>;
  step: number;
}

function BeatCard({ layout, progress, step }: BeatCardProps) {
  // Dealt up from below as the council gathers.
  const y = useTransform(progress, [ASSEMBLY_STEP - 1, ASSEMBLY_STEP], [56, 0]);
  const opacity = useTransform(progress, [ASSEMBLY_STEP - 0.7, ASSEMBLY_STEP - 0.15], [0, 1]);
  const beat = Math.min(BEATS.length - 1, Math.max(0, step - ASSEMBLY_STEP));
  return (
    <motion.section
      className={styles.cardTrack}
      aria-label={INTRO_UI.cardLabel}
      style={{ y, opacity, left: layout.card.left, top: layout.card.top, width: layout.card.width }}
    >
      <div className={styles.card}>
        <div className={styles.cardHead} aria-hidden="true">
          <span>{INTRO_UI.cardName}</span>
          <span className={styles.cardCount}>
            <b>0{beat + 1}</b> / 0{BEATS.length}
          </span>
        </div>
        <div className={styles.beats}>
          {BEATS.map((item, i) => (
            <Beat key={item.id} index={i} line={item.line} progress={progress} />
          ))}
        </div>
      </div>
    </motion.section>
  );
}

function Beat({ index, line, progress }: { index: number; line: string; progress: MotionValue<number> }) {
  const at = ASSEMBLY_STEP + index;
  // The lines turn over inside the card like a ticker: up and out, the next rising in under it.
  const y = useTransform(progress, (value) => (at - Math.min(value, LAST_STEP)) * 44);
  const opacity = useTransform(progress, [at - 0.5, at - 0.14, at + 0.14, at + 0.5], [0, 1, 1, 0]);
  return (
    <motion.p className={styles.beat} data-invite={at === LAST_STEP || undefined} style={{ y, opacity }}>
      {line}
    </motion.p>
  );
}

function SoundIcon({ muted }: { muted: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 7.6h2.6L9.4 4.4v11.2L5.6 12.4H3z" fill="currentColor" fillOpacity="0.12" />
      {muted ? (
        <path d="M12.6 7.8l4.4 4.4M17 7.8l-4.4 4.4" />
      ) : (
        <>
          <path d="M12.3 7.6a3.4 3.4 0 010 4.8" />
          <path d="M14.5 5.4a6.5 6.5 0 010 9.2" />
        </>
      )}
    </svg>
  );
}

/** A pencilled arrow, a little off true. It points the way the content is asked to go. */
function ScrollDoodle() {
  return (
    <svg width="16" height="20" viewBox="0 0 16 20" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M8.2 2.2c-.6 4.4.5 8.6-.1 14.6" />
      <path d="M3 12.2c1.9 1.5 3.4 3 5 5.2 1.3-2.3 2.9-3.9 5-5.6" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg width="18" height="12" viewBox="0 0 18 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M1 6h15M11.5 1.5L16 6l-4.5 4.5" />
    </svg>
  );
}
