'use client';

import React, { useEffect, useRef, useLayoutEffect, useState, useSyncExternalStore } from 'react';
import { motion, PanInfo, useMotionValue, useReducedMotion, animate } from 'framer-motion';
import { useAudio } from '@/hooks/useAudio';
import { Position } from '@/types';
import styles from './Sticker.module.css';

const COARSE = '(pointer: coarse)';
const subscribeCoarse = (cb: () => void) => {
  const mq = window.matchMedia(COARSE);
  mq.addEventListener('change', cb);
  return () => mq.removeEventListener('change', cb);
};
/** True on touch screens. The server renders for a mouse; phones correct on hydration. */
const useCoarsePointer = () =>
  useSyncExternalStore(subscribeCoarse, () => window.matchMedia(COARSE).matches, () => false);

// Magnetic snap configuration
const GRID_SIZE = 140; // Major grid lines (matches globals.css)
const SNAP_THRESHOLD = 35; // Distance in px to trigger snap

// Find nearest snap point if within threshold
const findSnapPoint = (value: number): number | null => {
  const nearestGrid = Math.round(value / GRID_SIZE) * GRID_SIZE;
  const distance = Math.abs(value - nearestGrid);
  return distance <= SNAP_THRESHOLD ? nearestGrid : null;
};

/** How a sticker arrives on first load. The lead grows in from furthest, the near ring
    a little less, the outer ring only fades, and 'none' is simply there. */
export type StickerEntrance = 'lead' | 'near' | 'outer' | 'none';

const EASE_OUT = [0.23, 1, 0.32, 1] as const;
const ENTRANCES: Record<Exclude<StickerEntrance, 'none'>, { from: number; duration: number }> = {
  lead: { from: 0.9, duration: 0.5 },
  near: { from: 0.93, duration: 0.4 },
  outer: { from: 1, duration: 0.4 },
};

// The board's entrance wave. The portrait leads with the card at 0ms; every other
// sticker starts by how far it sits from the card (t: 0 nearest, 1 furthest). The
// delays ease out, so the gaps shrink as the wave spreads instead of ticking like a
// metronome, and the whole board has started by WAVE_LAST.
const WAVE_FIRST = 120;
const WAVE_LAST = 600;
const NEAR_UNTIL = 0.4;

export function waveSlot(t: number): { entrance: StickerEntrance; entranceDelay: number } {
  const k = Math.min(1, Math.max(0, t));
  const eased = 1 - (1 - k) * (1 - k);
  return {
    entrance: k < NEAR_UNTIL ? 'near' : 'outer',
    entranceDelay: Math.round(WAVE_FIRST + (WAVE_LAST - WAVE_FIRST) * eased),
  };
}


export interface StickerProps {
  id: string;
  initial: Position;
  zBase?: number;
  children?: React.ReactNode;
  onClick?: (e: React.PointerEvent | React.MouseEvent) => void;
  onDragStart?: (id: string) => void;
  onDragEnd?: (id: string) => void;
  title?: string;
  className?: string;
  style?: React.CSSProperties;
  /** First-load entrance treatment (see StickerEntrance). */
  entrance?: StickerEntrance;
  /** Ms before the entrance starts; ignored under reduced motion. */
  entranceDelay?: number;
  scale?: number;
  /** Bounds the drag so the sticker can't be flung out of its container (mobile canvas). */
  dragConstraints?: React.RefObject<Element | null>;
  /** Skip the 140px magnetic grid snap; the desktop grid feels wrong in a small canvas. */
  disableSnap?: boolean;
  /** Let vertical swipes scroll the page (touch-action: pan-y) instead of dragging the
      sticker; without this, a scroll gesture that starts on a sticker hijacks the page. */
  allowPageScroll?: boolean;
  /** Spring back to the home position after a drag and disable fling momentum. Used by
      every mobile sticker: a scroll swipe that brushes a sticker fires pointercancel,
      which framer treats as a drag end WITH the swipe's velocity, so without this the
      sticker gets flung across the canvas and parked on top of its neighbors. */
  snapBackHome?: boolean;
  /** Quiet mono chip naming what's inside; revealed on hover (real pointers only). */
  peekLabel?: string;
  /** One small nudge a few seconds in, inviting the first click. */
  nudge?: boolean;
}

export function Sticker({
  id,
  initial,
  zBase = 1,
  children,
  onClick,
  onDragStart,
  onDragEnd,
  title,
  className = '',
  style = {},
  entrance = 'near',
  entranceDelay = 0,
  dragConstraints,
  disableSnap = false,
  allowPageScroll = false,
  snapBackHome = false,
  peekLabel,
  nudge = false,
}: StickerProps) {
  // Use refs instead of state to avoid re-renders during drag
  const hasMoved = useRef(false);
  const coarse = useCoarsePointer();
  const elementRef = useRef<HTMLDivElement>(null);
  const zIndexRef = useRef(zBase);

  // Motion values for magnetic snap
  const x = useMotionValue(initial.x);
  const y = useMotionValue(initial.y);

  const { playTapSound, triggerHaptic } = useAudio();
  const reduceMotion = useReducedMotion();
  const enter = entrance === 'none' ? null : ENTRANCES[entrance];
  const grows = !!enter && enter.from < 1;

  // The nudge only plays where it can be seen: about 2.5s into the visit if the
  // sticker is already on screen (desktop), or shortly after it scrolls into view
  // (phones, where it starts below the fold).
  const [nudgeStarted, setNudgeStarted] = useState(false);
  useEffect(() => {
    const el = elementRef.current;
    if (!nudge || !el) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const io = new IntersectionObserver(
      ([entry]) => {
        clearTimeout(timer);
        if (!entry.isIntersecting) return;
        timer = setTimeout(() => {
          io.disconnect();
          setNudgeStarted(true);
        }, Math.max(400, 2500 - performance.now()));
      },
      { threshold: 0.6 }
    );
    io.observe(el);
    return () => {
      io.disconnect();
      clearTimeout(timer);
    };
  }, [nudge]);
  const nudging = nudge && nudgeStarted;

  // framer-motion force-sets touch-action: none on drag-enabled elements,
  // overriding the style prop, so re-apply pan-y on the DOM node after every
  // render. With pan-y the browser owns vertical pans (page scroll fires
  // pointercancel and aborts the drag) while horizontal drags still work.
  useLayoutEffect(() => {
    if (allowPageScroll && elementRef.current) {
      elementRef.current.style.touchAction = 'pan-y';
    }
  });

  const handleDragStart = () => {
    playTapSound();
    triggerHaptic(10);
    hasMoved.current = false;
    // Update z-index directly via DOM to avoid re-render
    if (elementRef.current) {
      elementRef.current.style.zIndex = '9999';
      // Touch stickers rest without their own layer; give it one while it moves.
      elementRef.current.style.willChange = 'transform';
    }
    onDragStart?.(id);
  };

  const handleDrag = (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (Math.abs(info.offset.x) + Math.abs(info.offset.y) > 5) {
      hasMoved.current = true;
    }
  };

  const handleDragEnd = (_event: MouseEvent | TouchEvent | PointerEvent, _info: PanInfo) => {
    if (hasMoved.current) {
      zIndexRef.current = zBase + 10;

      // Spring home after a drag. dragSnapToOrigin won't do: it animates the
      // motion values to 0, not to the seeded `initial` position.
      if (snapBackHome) {
        animate(x, initial.x, { type: 'spring', stiffness: 280, damping: 26 });
        animate(y, initial.y, { type: 'spring', stiffness: 280, damping: 26 });
      }

      // Check for magnetic snap after momentum settles (skipped on mobile canvas
      // where the 140px desktop grid would feel wrong in a ~360px space).
      if (!disableSnap) setTimeout(() => {
        const currentX = x.get();
        const currentY = y.get();
        const snapX = findSnapPoint(currentX);
        const snapY = findSnapPoint(currentY);

        // Only snap if both axes are near grid lines (creates satisfying corner snaps)
        if (snapX !== null && snapY !== null) {
          animate(x, snapX, { type: 'spring', stiffness: 500, damping: 30 });
          animate(y, snapY, { type: 'spring', stiffness: 500, damping: 30 });
          triggerHaptic(5); // Subtle haptic for snap
        }
      }, 300); // Wait for momentum to settle
    } else {
      zIndexRef.current = zBase;
    }
    // Update z-index directly via DOM
    if (elementRef.current) {
      elementRef.current.style.zIndex = String(zIndexRef.current);
    }
    onDragEnd?.(id);
  };

  // Reset the moved flag at the start of every interaction. Without this, the
  // flag set during a drag would persist (a plain tap never fires onDragStart),
  // so after moving a sticker the next click would be swallowed by handleTap's
  // guard, so the sticker would only open from its original, un-dragged position.
  const handlePointerDown = () => {
    hasMoved.current = false;
  };

  // Handle tap/click - only fires if not dragging
  const handleTap = (event: MouseEvent | TouchEvent | PointerEvent) => {
    if (!hasMoved.current) {
      playTapSound();
      triggerHaptic(10);
      onClick?.(event as unknown as React.PointerEvent);
    }
  };

  return (
    <motion.div
      ref={elementRef}
      className={`${styles.sticker} ${className}`}
      suppressHydrationWarning
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        x,
        y,
        rotate: initial.rot || 0,
        zIndex: zBase,
        cursor: 'grab',
        touchAction: allowPageScroll ? 'pan-y' : 'none',
        ...style,
      }}
      // Phones drag sideways only. framer's pan session adds window scroll to the
      // drag while it is live, and iOS keeps it live through a scroll, so a y axis
      // let the sticker ride the page down over its neighbours. Vertical is the page's.
      drag={allowPageScroll ? 'x' : true}
      dragDirectionLock={allowPageScroll}
      dragConstraints={dragConstraints}
      dragMomentum={!snapBackHome}
      dragElastic={0.12}
      dragTransition={{
        power: 0.15,
        timeConstant: 250,
      }}
      whileHover={{ scale: 1.05, rotate: (initial.rot || 0) + 1.5 }}
      whileDrag={{ scale: 1.08, cursor: 'grabbing' }}
      // On touch, a press is usually the start of a scroll: grow only once it is really a drag.
      whileTap={coarse ? undefined : { scale: 1.08 }}
      onPointerDown={handlePointerDown}
      // The browser took the touch for a scroll: whatever moved goes home.
      onPointerCancel={snapBackHome ? () => {
        animate(x, initial.x, { type: 'spring', stiffness: 280, damping: 26 });
        animate(y, initial.y, { type: 'spring', stiffness: 280, damping: 26 });
      } : undefined}
      onDragStart={handleDragStart}
      onDrag={handleDrag}
      onDragEnd={handleDragEnd}
      onTap={handleTap}
      title={title}
      role="button"
      tabIndex={0}
      aria-label={title || `Sticker ${id}`}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick?.(e as unknown as React.PointerEvent);
        }
      }}
    >
      {/* The entrance and the nudge live on this inner layer, so they never touch
          the outer element's drag x/y or its hover and press scale. A transform
          string (not the scale shorthand) lets framer hand it to WAAPI, which
          keeps the wave smooth while the page is still hydrating. */}
      <motion.div
        className={`${styles.inner} ${nudging ? styles.nudge : ''}`}
        initial={enter ? { opacity: 0, ...(grows && { transform: `scale(${enter.from})` }) } : false}
        animate={enter ? { opacity: 1, ...(grows && { transform: 'scale(1)' }) } : undefined}
        transition={
          reduceMotion
            ? { opacity: { duration: 0.2 }, transform: { duration: 0 } }
            : { duration: enter?.duration, delay: entranceDelay / 1000, ease: EASE_OUT }
        }
      >
        {children}
        {peekLabel && (
          <span className={styles.peekLabel} aria-hidden="true">
            {peekLabel}
          </span>
        )}
      </motion.div>
    </motion.div>
  );
}
