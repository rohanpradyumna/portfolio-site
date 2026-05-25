'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { CARDS } from '@/data/cards';
import { useResponsive, useCardDimensions } from '@/hooks/useDimensions';
import { useAudio } from '@/hooks/useAudio';
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
    transition: 'background 0.15s, transform 0.15s',
    minWidth: 44,
    minHeight: 44,
  };
}

export function CardStack() {
  const [idx, setIdx] = useState(0);
  const [drag, setDrag] = useState({ active: false, dx: 0, dy: 0 });
  const [shuffling, setShuffling] = useState<'next' | 'prev' | null>(null);
  const startRef = useRef<{ x: number; y: number; moved: boolean } | null>(null);

  const { isMobile } = useResponsive();
  const { cardW, cardMinH, cardPadding } = useCardDimensions();
  const { playShuffleSound } = useAudio();

  const cardOrder: number[] = [];
  for (let i = 0; i < 3; i++) {
    const c = (idx + i) % CARDS.length;
    cardOrder.push(c);
  }

  const DRAG_THRESHOLD = 60;
  const DRAG_MIN = 4;
  const SHUFFLE_MS = 450;

  const next = useCallback(() => {
    if (shuffling) return;
    playShuffleSound();
    setShuffling('next');
    setDrag({ active: false, dx: 0, dy: 0 });
    setTimeout(() => {
      setIdx((i) => (i + 1) % CARDS.length);
      setShuffling(null);
    }, SHUFFLE_MS);
  }, [shuffling, playShuffleSound]);

  const prev = useCallback(() => {
    if (shuffling) return;
    playShuffleSound();
    setIdx((i) => (i - 1 + CARDS.length) % CARDS.length);
    setShuffling('prev');
    setDrag({ active: false, dx: 0, dy: 0 });
    setTimeout(() => {
      setShuffling(null);
    }, SHUFFLE_MS);
  }, [shuffling, playShuffleSound]);

  const onDown = (e: React.PointerEvent) => {
    if (e.button && e.button !== 0) return;
    if ((e.target as HTMLElement).closest('[data-nodrag]')) return;
    if (shuffling) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    startRef.current = { x: e.clientX, y: e.clientY, moved: false };
  };

  const onMove = (e: React.PointerEvent) => {
    if (!startRef.current || shuffling) return;
    const dx = e.clientX - startRef.current.x;
    const dy = e.clientY - startRef.current.y;
    if (!startRef.current.moved && Math.hypot(dx, dy) < DRAG_MIN) return;
    startRef.current.moved = true;
    setDrag({ active: true, dx, dy });
  };

  const onUp = () => {
    if (!startRef.current || shuffling) return;
    const moved = startRef.current.moved;
    const { dx } = drag;
    const dist = Math.abs(dx);
    startRef.current = null;
    if (moved && dist > DRAG_THRESHOLD) {
      if (dx > 0) {
        prev();
      } else {
        next();
      }
    } else {
      setDrag({ active: false, dx: 0, dy: 0 });
    }
  };

  // Keyboard navigation
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'j') next();
      if (e.key === 'ArrowLeft' || e.key === 'k') prev();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [next, prev]);

  const stackOffset = isMobile ? 6 : 10;

  return (
    <div
      className={styles.container}
      style={{
        position: isMobile ? 'relative' : 'absolute',
        left: isMobile ? 'auto' : '50%',
        top: isMobile ? 'auto' : '50%',
        transform: isMobile ? 'none' : 'translate(-50%, -50%)',
        width: cardW,
        height: isMobile ? 'auto' : 320,
        minHeight: cardMinH,
        zIndex: 500,
        margin: isMobile ? '80px auto 0' : 0,
      }}
      role="region"
      aria-label="Card stack"
      aria-roledescription="carousel"
    >
      {/* Pile of cards behind */}
      {[5, 4, 3, 2, 1].map((n) => (
        <div
          key={'shadow' + n}
          style={{
            position: 'absolute',
            inset: 0,
            background: n <= 2 ? '#232323' : '#1a1a1a',
            borderRadius: isMobile ? 14 : 18,
            transform: `translateY(${n * (isMobile ? 6 : 10)}px) scale(${1 - n * 0.018}) rotate(${n * 0.3}deg)`,
            opacity: n <= 2 ? 0.95 : 0.4 - n * 0.06,
            boxShadow: n <= 2 ? '0 4px 12px rgba(0,0,0,0.15)' : 'none',
            zIndex: -n,
          }}
        />
      ))}

      {cardOrder.map((cardIdx, stackPos) => {
        const card = CARDS[cardIdx];
        const isTop = stackPos === 0;
        const isSecond = stackPos === 1;

        let transform: string;
        let opacity: number;
        let zIndex: number;

        if (shuffling === 'next' && isTop) {
          transform = `translate(-50%, calc(-50% + ${5 * stackOffset}px)) scale(0.88) rotate(4deg)`;
          opacity = 0.4;
          zIndex = 90;
        } else if (shuffling === 'next' && !isTop) {
          const newStackPos = Math.max(0, stackPos - 1);
          transform = `translate(-50%, calc(-50% + ${newStackPos * stackOffset}px)) scale(${1 - newStackPos * 0.03})`;
          opacity = newStackPos === 0 ? 1 : 0.95;
          zIndex = 100 - newStackPos;
        } else if (shuffling === 'prev' && isTop) {
          transform = `translate(-50%, -50%) scale(1) rotate(-2deg)`;
          opacity = 1;
          zIndex = 100;
        } else if (shuffling === 'prev' && !isTop) {
          const newStackPos = stackPos + 1;
          transform = `translate(-50%, calc(-50% + ${newStackPos * stackOffset}px)) scale(${1 - newStackPos * 0.03})`;
          opacity = 0.7;
          zIndex = 100 - newStackPos;
        } else if (isTop && drag.active) {
          transform = `translate(calc(-50% + ${drag.dx}px), calc(-50% + ${drag.dy}px)) rotate(${drag.dx * 0.04}deg)`;
          opacity = 1;
          zIndex = 100;
        } else {
          transform = `translate(-50%, calc(-50% + ${stackPos * stackOffset}px)) scale(${1 - stackPos * 0.03})`;
          opacity = isTop ? 1 : isSecond ? 0.95 : 0.6;
          zIndex = 100 - stackPos;
        }

        return (
          <div
            key={cardIdx + '-' + stackPos}
            onPointerDown={isTop ? onDown : undefined}
            onPointerMove={isTop ? onMove : undefined}
            onPointerUp={isTop ? onUp : undefined}
            onPointerCancel={isTop ? onUp : undefined}
            className={shuffling === 'prev' && isTop ? styles.cardFromBack : ''}
            style={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              width: cardW,
              minHeight: cardMinH,
              background: '#1a1a1a',
              color: '#f5f2e8',
              borderRadius: isMobile ? 14 : 18,
              padding: cardPadding,
              boxSizing: 'border-box',
              transform,
              opacity,
              transition:
                shuffling === 'prev' && isTop
                  ? 'none'
                  : shuffling
                    ? 'transform 0.45s cubic-bezier(0.34, 1.3, 0.64, 1), opacity 0.45s ease'
                    : drag.active && isTop
                      ? 'none'
                      : 'transform 0.5s cubic-bezier(0.34, 1.3, 0.64, 1), opacity 0.3s ease',
              boxShadow:
                isTop && !shuffling
                  ? '0 25px 50px rgba(20,15,5,0.4), 0 12px 24px rgba(20,15,5,0.3), 0 0 0 1px rgba(255,255,255,0.05) inset'
                  : '0 10px 20px rgba(20,15,5,0.25)',
              zIndex,
              cursor: isTop && !shuffling ? (drag.active ? 'grabbing' : 'grab') : 'default',
              touchAction: 'none',
              display: 'flex',
              flexDirection: 'column',
              pointerEvents: isTop && !shuffling ? 'auto' : 'none',
            }}
            role="group"
            aria-roledescription="slide"
            aria-label={`Card ${cardIdx + 1} of ${CARDS.length}`}
          >
            {/* Top chrome: prev / idx / next */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: isMobile ? 10 : 14,
                marginBottom: isMobile ? 12 : 16,
                fontFamily: "'Geist Mono', monospace",
                fontSize: isMobile ? 11 : 12,
                color: 'rgba(245,242,232,0.5)',
                whiteSpace: 'nowrap',
              }}
            >
              <button
                data-nodrag
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  prev();
                }}
                style={getChevBtnStyle(isMobile)}
                aria-label="Previous card"
              >
                ‹
              </button>
              <span
                style={{ whiteSpace: 'nowrap', minWidth: 56, textAlign: 'center', display: 'inline-block' }}
                aria-live="polite"
              >
                {String(cardIdx + 1).padStart(2, '0')}&nbsp;/&nbsp;{String(CARDS.length).padStart(2, '0')}
              </span>
              <button
                data-nodrag
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  next();
                }}
                style={getChevBtnStyle(isMobile)}
                aria-label="Next card"
              >
                ›
              </button>
            </div>

            <CardBody card={card} isMobile={isMobile} />
          </div>
        );
      })}
    </div>
  );
}
