'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAudio } from '@/hooks/useAudio';
import { Position, DragRef } from '@/types';
import styles from './Sticker.module.css';

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
  const [pos, setPos] = useState<Position>({ x: initial.x, y: initial.y, rot: initial.rot || 0 });
  const [dragging, setDragging] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [z, setZ] = useState(zBase);
  const [hasDragged, setHasDragged] = useState(false);
  const [hasEntered, setHasEntered] = useState(false);

  const dragRef = useRef<DragRef>({
    active: false,
    moved: false,
    startX: 0,
    startY: 0,
    origX: 0,
    origY: 0,
    pointerId: null,
  });
  const elRef = useRef<HTMLDivElement>(null);

  const { playTapSound, triggerHaptic } = useAudio();

  // Entrance animation trigger - wait for delay + animation duration (500ms)
  useEffect(() => {
    const timer = setTimeout(() => setHasEntered(true), entranceDelay + 550);
    return () => clearTimeout(timer);
  }, [entranceDelay]);

  // Update position when initial changes (window resize) - but only if user hasn't dragged
  useEffect(() => {
    if (!hasDragged) {
      setPos({ x: initial.x, y: initial.y, rot: initial.rot || 0 });
    }
  }, [initial.x, initial.y, initial.rot, hasDragged]);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.button && e.button !== 0) return;
      playTapSound();
      triggerHaptic(10);

      elRef.current?.setPointerCapture(e.pointerId);
      dragRef.current = {
        active: true,
        moved: false,
        startX: e.clientX,
        startY: e.clientY,
        origX: pos.x,
        origY: pos.y,
        pointerId: e.pointerId,
      };
      setDragging(true);
      setZ(9999);
      onDragStart?.(id);
      e.stopPropagation();
    },
    [id, onDragStart, playTapSound, triggerHaptic, pos.x, pos.y]
  );

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragRef.current.active) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    if (Math.abs(dx) + Math.abs(dy) > 3) dragRef.current.moved = true;
    setPos((p) => ({ ...p, x: dragRef.current.origX + dx, y: dragRef.current.origY + dy }));
  }, []);

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (!dragRef.current.active) return;
      const wasMove = dragRef.current.moved;
      dragRef.current.active = false;
      setDragging(false);
      setZ(zBase + (wasMove ? 10 : 0));
      if (wasMove) setHasDragged(true);

      try {
        elRef.current?.releasePointerCapture(e.pointerId);
      } catch {
        // Ignore errors from releasing capture
      }

      onDragEnd?.(id);
      if (!wasMove && onClick) {
        onClick(e);
      }
    },
    [id, onClick, onDragEnd, zBase]
  );

  const peelLift = hovered && !dragging;
  const scale = dragging ? 1.08 : hovered ? 1.05 : 1;

  const filterStyle = dragging
    ? 'drop-shadow(0 24px 32px rgba(40,30,10,0.35)) drop-shadow(0 8px 12px rgba(40,30,10,0.25))'
    : hovered
      ? 'drop-shadow(0 16px 24px rgba(40,30,10,0.30)) drop-shadow(0 6px 10px rgba(40,30,10,0.22))'
      : 'drop-shadow(0 6px 10px rgba(40,30,10,0.20)) drop-shadow(0 2px 4px rgba(40,30,10,0.16))';

  return (
    <div
      ref={elRef}
      className={`${styles.sticker} ${className}`}
      style={{
        position: 'absolute',
        left: pos.x,
        top: pos.y,
        transform: `scale(${scale})`,
        zIndex: z,
        cursor: dragging ? 'grabbing' : 'grab',
        transition: dragging ? 'none' : 'transform 0.28s cubic-bezier(0.34, 1.56, 0.64, 1)',
        touchAction: 'none',
        opacity: hasEntered ? 1 : 0,
        animation: hasEntered
          ? 'none'
          : `stickerPop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) ${entranceDelay}ms forwards`,
        ...style,
      }}
      title={title}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
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
      <div
        className={styles.inner}
        style={{
          filter: filterStyle,
          transition: 'filter 0.28s, transform 0.28s',
          transform: peelLift ? 'translateY(-4px)' : 'none',
        }}
      >
        {children}
      </div>
    </div>
  );
}
