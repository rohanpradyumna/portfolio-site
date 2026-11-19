'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { animate, motion, useMotionValue, PanInfo, TargetAndTransition } from 'framer-motion';
import { CARDS } from '@/data/cards';
import { useResponsive, useCardDimensions } from '@/hooks/useDimensions';
import { useAudio } from '@/hooks/useAudio';
import { useMotion } from '@/hooks/useMotion';
import { CardBody } from './CardBody';
import styles from './CardStack.module.css';

function getChevBtnStyle(isMobile: boolean): React.CSSProperties {
  return {
    background: 'rgba(245,242,232,0.08)',
    border: '1px solid rgba(245,242,232,0.28)',
    color: 'rgba(245,242,232,0.9)',
    width: isMobile ? 40 : 32,
    height: isMobile ? 40 : 32,
    borderRadius: isMobile ? 20 : 16,
    cursor: 'pointer',
    fontSize: isMobile ? 20 : 18,
    fontFamily: 'serif',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
    lineHeight: 1,
    minWidth: 44,
    minHeight: 44,
  };
}

// Spring config for the static shadow pile behind the cards.
const cardSpring = {
  type: 'spring' as const,
  stiffness: 400,
  damping: 35,
};

// One timing family for every card that moves on a shuffle, so the throw, the
// rise of the next card and the cards behind read as a single gesture.
const stackSpring = { type: 'spring' as const, visualDuration: 0.25, bounce: 0 };
const fade = { duration: 0.22, ease: 'linear' as const };
const snapBack = { type: 'spring' as const, stiffness: 500, damping: 40 };

const DRAG_THRESHOLD = 80;
const FLING_VELOCITY = 500;
const THROW_TILT = 6;
// Safety net: an exiting card is unmounted after this even if its animation
// completion never reports (tab hidden, interrupted, etc).
const EXIT_FALLBACK_MS = 700;

type Dir = 1 | -1;
type ExitInfo = { role: 'throw' | 'back'; dir: Dir; vx: number };

// `pos` is an unwrapped counter (it can go negative or past CARDS.length), so
// every card instance has a unique, ever-ordered key `n`. Rendering keys in
// ascending order means React only ever inserts or removes card nodes, never
// moves them: moving a node mid-animation drops framer's in-flight animations.
type StackState = {
  pos: number;
  navigated: boolean;
  exiting: Record<number, ExitInfo>;
};

const wrap = (n: number) => ((n % CARDS.length) + CARDS.length) % CARDS.length;

function step(s: StackState, dir: Dir, vx: number): StackState {
  const exiting = { ...s.exiting };
  // Next throws the top card; prev slips the back card out as a new one lands on top.
  if (dir === 1) exiting[s.pos] = { role: 'throw', dir, vx };
  else exiting[s.pos + 2] = { role: 'back', dir, vx };
  const pos = s.pos + dir;
  // A card still on its way out that lands back in the window just retargets.
  for (let n = pos; n < pos + 3; n++) delete exiting[n];
  return { pos, navigated: true, exiting };
}

// How far a thrown card travels before it is gone: a keyboard or chevron press
// gets a fixed distance, a fling goes further the harder it was thrown.
function throwDistance(cardW: number, vx: number) {
  return Math.min(cardW * 0.6 + Math.abs(vx) * 0.15, cardW * 1.25);
}

// Every target carries all five keys: framer animates a key that disappears
// from `animate` back to its mount value, which would yank cards around.
function stackTarget(stackPos: number, stackOffset: number) {
  return {
    x: 0,
    rotate: 0,
    scale: 1 - stackPos * 0.03,
    y: stackPos * stackOffset,
    opacity: stackPos === 0 ? 1 : stackPos === 1 ? 0.95 : stackPos === 2 ? 0.6 : 0,
  };
}

type Release = 'next' | 'prev' | null;

interface StackCardProps {
  n: number;
  cardIdx: number;
  stackPos: number;
  exit?: ExitInfo;
  zIndex: number;
  skipInitial: boolean;
  isMobile: boolean;
  reducedMotion: boolean;
  cardW: number;
  cardMinH: number;
  cardPadding: string;
  stackOffset: number;
  onPrev: () => void;
  onNext: () => void;
  onRelease: (info: PanInfo) => Release;
  onExitDone: (n: number) => void;
}

function StackCard({
  n,
  cardIdx,
  stackPos,
  exit,
  zIndex,
  skipInitial,
  isMobile,
  reducedMotion,
  cardW,
  cardMinH,
  cardPadding,
  stackOffset,
  onPrev,
  onNext,
  onRelease,
  onExitDone,
}: StackCardProps) {
  const card = CARDS[cardIdx];
  const isTop = stackPos === 0 && !exit;
  const x = useMotionValue(0);

  const exiting = !!exit;
  useEffect(() => {
    if (!exiting) return;
    const t = setTimeout(() => onExitDone(n), EXIT_FALLBACK_MS);
    return () => clearTimeout(t);
  }, [exiting, n, onExitDone]);

  // Mount pose. Prev: the card comes back from the side next throws cards to
  // (exit matches entry). Next: the new back card fades up from a notch deeper.
  const initial = skipInitial
    ? false
    : reducedMotion
      ? { ...stackTarget(stackPos, stackOffset), opacity: 0 }
      : stackPos === 0
        ? { ...stackTarget(0, stackOffset), x: -throwDistance(cardW, 0), rotate: -THROW_TILT, opacity: 0 }
        : stackTarget(stackPos + 1, stackOffset);

  let target: TargetAndTransition;
  if (!exit) {
    target = stackTarget(stackPos, stackOffset);
  } else if (reducedMotion) {
    target = {
      ...stackTarget(exit.role === 'throw' ? 0 : 2, stackOffset),
      opacity: 0,
      transition: { default: { duration: 0 }, opacity: fade },
    };
  } else if (exit.role === 'throw') {
    // Carry the fling: the card keeps going the way the hand sent it.
    const side = -exit.dir;
    target = {
      ...stackTarget(0, stackOffset),
      x: side * throwDistance(cardW, exit.vx),
      rotate: side * THROW_TILT,
      opacity: 0,
      transition: {
        default: stackSpring,
        x: { ...stackSpring, velocity: exit.vx, restDelta: 1 },
        opacity: fade,
      },
    };
  } else {
    target = {
      ...stackTarget(3, stackOffset),
      transition: { default: stackSpring, opacity: { ...fade, duration: 0.15 } },
    };
  }

  const handleDragEnd = (_e: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    // A throw hands x to the exit target. Otherwise the card settles back to
    // center: below threshold that is the "not quite" feedback, on prev it is
    // the card sinking one notch as the previous card lands on top.
    const release = onRelease(info);
    if (release === 'next') return;
    const spring = release === 'prev' ? stackSpring : snapBack;
    animate(x, 0, reducedMotion ? { duration: 0 } : { ...spring, velocity: info.velocity.x });
  };

  return (
    <motion.div
      initial={initial}
      animate={target}
      transition={reducedMotion ? { default: { duration: 0 }, opacity: fade } : stackSpring}
      onAnimationComplete={(def) => {
        if (exit && (def as { opacity?: number }).opacity === 0) onExitDone(n);
      }}
      style={{
        x,
        position: 'absolute',
        left: '50%',
        top: '50%',
        translateX: '-50%',
        translateY: '-50%',
        width: cardW,
        minHeight: cardMinH,
        background: '#1a1a1a',
        color: '#f5f2e8',
        borderRadius: isMobile ? 14 : 18,
        padding: cardPadding,
        boxSizing: 'border-box',
        boxShadow:
          stackPos === 0
            ? '0 25px 50px rgba(20,15,5,0.4), 0 12px 24px rgba(20,15,5,0.3), 0 0 0 1px rgba(255,255,255,0.05) inset'
            : '0 10px 20px rgba(20,15,5,0.25)',
        zIndex,
        cursor: isTop ? 'grab' : 'default',
        // Horizontal drags move the card, vertical ones still scroll the page on phones.
        touchAction: 'pan-y',
        display: 'flex',
        flexDirection: 'column',
        pointerEvents: isTop ? 'auto' : 'none',
      }}
      drag={isTop ? 'x' : false}
      dragMomentum={false}
      onDragEnd={handleDragEnd}
      whileDrag={{ scale: 1.02, cursor: 'grabbing' }}
      role="group"
      aria-roledescription="slide"
      aria-label={`Card ${cardIdx + 1} of ${CARDS.length}`}
      aria-hidden={!isTop}
      inert={!isTop}
    >
      {/* Top chrome: prev / idx / next */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: isMobile ? 10 : 14,
          marginBottom: isMobile ? 12 : 16,
          fontFamily: 'var(--font-mono)',
          fontSize: isMobile ? 11 : 12,
          color: 'rgba(245,242,232,0.5)',
          whiteSpace: 'nowrap',
        }}
      >
        <motion.button
          onClick={(e) => {
            e.stopPropagation();
            onPrev();
          }}
          style={getChevBtnStyle(isMobile)}
          whileHover={{ scale: 1.05, background: 'rgba(245,242,232,0.15)' }}
          whileTap={{ scale: 0.95 }}
          aria-label="Previous card"
        >
          ‹
        </motion.button>
        <span
          style={{
            whiteSpace: 'nowrap',
            textAlign: 'center',
            display: 'inline-block',
            background: 'rgba(245,242,232,0.12)',
            border: '1px solid rgba(245,242,232,0.24)',
            padding: '6px 12px',
            borderRadius: 20,
            letterSpacing: '0.04em',
            fontVariantNumeric: 'tabular-nums',
          }}
          aria-live="polite"
        >
          <span style={{ color: '#f2c230', fontWeight: 600 }}>
            {String(cardIdx + 1).padStart(2, '0')}
          </span>
          <span style={{ color: 'rgba(245,242,232,0.65)' }}>
            &nbsp;/&nbsp;{String(CARDS.length).padStart(2, '0')}
          </span>
        </span>
        <motion.button
          onClick={(e) => {
            e.stopPropagation();
            onNext();
          }}
          style={getChevBtnStyle(isMobile)}
          whileHover={{ scale: 1.05, background: 'rgba(245,242,232,0.15)' }}
          whileTap={{ scale: 0.95 }}
          aria-label="Next card"
        >
          ›
        </motion.button>
      </div>

      <CardBody card={card} isMobile={isMobile} />
    </motion.div>
  );
}

export function CardStack() {
  const [stack, setStack] = useState<StackState>({ pos: 0, navigated: false, exiting: {} });
  const { pos } = stack;

  const { isMobile } = useResponsive();
  const { cardW, cardH, cardMinH, cardPadding } = useCardDimensions();
  const { playShuffleSound, triggerHaptic } = useAudio();
  const { reducedMotion } = useMotion();

  // First-visit swipe hint (mobile only, once ever, respects reduced motion).
  const [showSwipeHint, setShowSwipeHint] = useState(false);
  useEffect(() => {
    if (!isMobile || reducedMotion) return;
    if (typeof window === 'undefined') return;
    if (localStorage.getItem('pf_card_hint')) return;
    setShowSwipeHint(true);
    localStorage.setItem('pf_card_hint', '1');
    const t = setTimeout(() => setShowSwipeHint(false), 1900);
    return () => clearTimeout(t);
  }, [isMobile, reducedMotion]);

  // No lock: every press or fling advances immediately, even mid-throw.
  const next = useCallback(
    (vx = 0) => {
      playShuffleSound();
      if (isMobile) triggerHaptic(15);
      setStack((s) => step(s, 1, vx));
    },
    [playShuffleSound, isMobile, triggerHaptic]
  );

  const prev = useCallback(
    (vx = 0) => {
      playShuffleSound();
      if (isMobile) triggerHaptic(15);
      setStack((s) => step(s, -1, vx));
    },
    [playShuffleSound, isMobile, triggerHaptic]
  );

  const handleRelease = useCallback(
    (info: PanInfo): Release => {
      const velocity = info.velocity.x;
      const offset = info.offset.x;
      if (offset < -DRAG_THRESHOLD || velocity < -FLING_VELOCITY) {
        next(Math.min(velocity, 0));
        return 'next';
      }
      if (offset > DRAG_THRESHOLD || velocity > FLING_VELOCITY) {
        prev(Math.max(velocity, 0));
        return 'prev';
      }
      return null;
    },
    [next, prev]
  );

  const handleExitDone = useCallback((n: number) => {
    setStack((s) => {
      if (!(n in s.exiting)) return s;
      const exiting = { ...s.exiting };
      delete exiting[n];
      return { ...s, exiting };
    });
  }, []);

  // The chevron that was pressed sits on the card that just left (now inert), so
  // focus would drop to the page. Hand it to the same chevron on the new top card.
  const containerRef = useRef<HTMLDivElement>(null);
  const pendingFocus = useRef<'Previous' | 'Next' | null>(null);
  const goPrev = useCallback(() => {
    pendingFocus.current = 'Previous';
    prev();
  }, [prev]);
  const goNext = useCallback(() => {
    pendingFocus.current = 'Next';
    next();
  }, [next]);
  useEffect(() => {
    const label = pendingFocus.current;
    if (!label) return;
    pendingFocus.current = null;
    containerRef.current
      ?.querySelector<HTMLButtonElement>(`[role="group"]:not([inert]) [aria-label="${label} card"]`)
      ?.focus({ preventScroll: true });
  }, [pos]);

  // Keyboard navigation
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Don't shuffle the board behind an open takeover or while typing.
      if (document.querySelector('[aria-modal="true"]')) return;
      if ((e.target as HTMLElement | null)?.closest?.('input, textarea, [contenteditable]')) return;
      if (e.key === 'ArrowRight' || e.key === 'j') next();
      if (e.key === 'ArrowLeft' || e.key === 'k') prev();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [next, prev]);

  const stackOffset = isMobile ? 6 : 10;

  const mounted = Array.from(
    new Set([pos, pos + 1, pos + 2, ...Object.keys(stack.exiting).map(Number)])
  ).sort((a, b) => a - b);

  const animateEntrance = isMobile && !reducedMotion;

  return (
    <motion.div
      ref={containerRef}
      className={styles.container}
      initial={animateEntrance ? { opacity: 0, y: 24 } : false}
      animate={animateEntrance ? { opacity: 1, y: 0 } : undefined}
      transition={{ duration: 0.5, ease: [0.2, 0.8, 0.2, 1] }}
      style={{
        position: isMobile ? 'relative' : 'absolute',
        left: isMobile ? 'auto' : '50%',
        top: isMobile ? 'auto' : '50%',
        transform: isMobile ? undefined : 'translate(-50%, -50%)',
        width: cardW,
        height: cardH,
        minHeight: cardMinH,
        zIndex: 500,
        margin: isMobile ? '28px auto 0' : 0,
      }}
      role="region"
      aria-label="Card stack"
      aria-roledescription="carousel"
    >
      {/* Pile of cards behind */}
      {[5, 4, 3, 2, 1].map((n) => (
        <motion.div
          key={'shadow' + n}
          animate={{
            y: n * stackOffset,
            scale: 1 - n * 0.018,
            rotate: n * 0.3,
          }}
          transition={cardSpring}
          style={{
            position: 'absolute',
            inset: 0,
            background: n <= 2 ? '#232323' : '#1a1a1a',
            borderRadius: isMobile ? 14 : 18,
            opacity: n <= 2 ? 0.95 : 0.4 - n * 0.06,
            boxShadow: n <= 2 ? '0 4px 12px rgba(0,0,0,0.15)' : 'none',
            zIndex: -n,
          }}
        />
      ))}

      {mounted.map((n) => {
        const exit = stack.exiting[n];
        const stackPos = n - pos;
        // Thrown cards stay above the new top card; the oldest throw stays highest.
        const zIndex = exit ? (exit.role === 'throw' ? 110 + (pos - n) : 90) : 100 - stackPos;
        return (
          <StackCard
            key={n}
            n={n}
            cardIdx={wrap(n)}
            stackPos={stackPos}
            exit={exit}
            zIndex={zIndex}
            skipInitial={!stack.navigated}
            isMobile={isMobile}
            reducedMotion={reducedMotion}
            cardW={cardW}
            cardMinH={cardMinH}
            cardPadding={cardPadding}
            stackOffset={stackOffset}
            onPrev={goPrev}
            onNext={goNext}
            onRelease={handleRelease}
            onExitDone={handleExitDone}
          />
        );
      })}

      {/* First-visit swipe hint: a chevron that sweeps left once, then never again */}
      {showSwipeHint && (
        <motion.div
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: [0, 0.9, 0.9, 0], x: [30, -30, -30, -70] }}
          transition={{ duration: 1.6, ease: 'easeInOut', times: [0, 0.2, 0.7, 1] }}
          style={{
            position: 'absolute',
            top: '50%',
            right: 16,
            transform: 'translateY(-50%)',
            fontSize: 32,
            color: '#f2c230',
            fontFamily: 'serif',
            pointerEvents: 'none',
            zIndex: 600,
            textShadow: '0 2px 8px rgba(0,0,0,0.4)',
          }}
          aria-hidden="true"
        >
          ‹‹
        </motion.div>
      )}
    </motion.div>
  );
}
