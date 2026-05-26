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

// Simple hover animation - no jumping or complex movements
const simpleHoverAnimation = { scale: 1.05 };

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

      // Check for magnetic snap after momentum settles
      setTimeout(() => {
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
      dragMomentum={true}
      dragElastic={0.12}
      dragTransition={{
        power: 0.15,
        timeConstant: 250,
      }}
      whileHover={simpleHoverAnimation}
      whileDrag={{ scale: 1.08, cursor: 'grabbing' }}
      whileTap={{ scale: 1.08 }}
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
      <div className={styles.inner}>
        {children}
      </div>
    </motion.div>
  );
}
