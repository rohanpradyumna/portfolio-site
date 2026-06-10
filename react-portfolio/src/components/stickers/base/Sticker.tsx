'use client';

import React, { useRef } from 'react';
import { motion, PanInfo, useMotionValue, animate } from 'framer-motion';
import { useAudio } from '@/hooks/useAudio';
import { Position } from '@/types';
import styles from './Sticker.module.css';

// Magnetic snap configuration
const GRID_SIZE = 140; // Major grid lines (matches globals.css)
const SNAP_THRESHOLD = 35; // Distance in px to trigger snap

// Find nearest snap point if within threshold
const findSnapPoint = (value: number): number | null => {
  const nearestGrid = Math.round(value / GRID_SIZE) * GRID_SIZE;
  const distance = Math.abs(value - nearestGrid);
  return distance <= SNAP_THRESHOLD ? nearestGrid : null;
};


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
  entranceDelay?: number;
  scale?: number;
  /** Bounds the drag so the sticker can't be flung out of its container (mobile canvas). */
  dragConstraints?: React.RefObject<Element | null>;
  /** Skip the 140px magnetic grid snap; the desktop grid feels wrong in a small canvas. */
  disableSnap?: boolean;
  /** Quiet mono chip naming what's inside; revealed on hover (real pointers only). */
  peekLabel?: string;
  /** One-shot "breathe" on first visit to invite exploration. */
  wake?: boolean;
  /** Delay (ms) before this sticker's wake breathe fires; used to stagger the wave. */
  wakeDelay?: number;
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
  entranceDelay = 0,
  dragConstraints,
  disableSnap = false,
  peekLabel,
  wake = false,
  wakeDelay = 0,
}: StickerProps) {
  // Use refs instead of state to avoid re-renders during drag
  const hasMoved = useRef(false);
  const elementRef = useRef<HTMLDivElement>(null);
  const zIndexRef = useRef(zBase);

  // Motion values for magnetic snap
  const x = useMotionValue(initial.x);
  const y = useMotionValue(initial.y);

  const { playTapSound, triggerHaptic } = useAudio();

  const handleDragStart = () => {
    playTapSound();
    triggerHaptic(10);
    hasMoved.current = false;
    // Update z-index directly via DOM to avoid re-render
    if (elementRef.current) {
      elementRef.current.style.zIndex = '9999';
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
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{
        opacity: { delay: entranceDelay / 1000, duration: 0.3, ease: 'easeOut' },
        scale: {
          delay: entranceDelay / 1000,
          type: 'spring',
          stiffness: 300,
          damping: 25,
        },
      }}
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
        touchAction: 'none',
        ...style,
      }}
      drag
      dragConstraints={dragConstraints}
      dragMomentum={true}
      dragElastic={0.12}
      dragTransition={{
        power: 0.15,
        timeConstant: 250,
      }}
      whileHover={{ scale: 1.05, rotate: (initial.rot || 0) + 1.5 }}
      whileDrag={{ scale: 1.08, cursor: 'grabbing' }}
      whileTap={{ scale: 1.08 }}
      onPointerDown={handlePointerDown}
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
      {/* Inner layer runs the one-shot wake "breathe" as a CSS animation, on a
          transform separate from the outer drag/hover transform so it never
          fights the x/y motion values or whileHover. The animation plays once
          when the .wake class lands (delayed per-sticker to stagger the wave)
          and settles back to scale 1. No wake = plain static div. */}
      <div
        className={`${styles.inner} ${wake ? styles.wake : ''}`}
        style={wake ? { animationDelay: `${wakeDelay}ms` } : undefined}
      >
        {children}
        {peekLabel && (
          <span className={styles.peekLabel} aria-hidden="true">
            {peekLabel}
          </span>
        )}
      </div>
    </motion.div>
  );
}
