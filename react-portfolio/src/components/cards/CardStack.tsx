'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion, PanInfo } from 'framer-motion';
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

// Spring config for card animations
const cardSpring = {
  type: 'spring' as const,
  stiffness: 400,
  damping: 35,
};

export function CardStack() {
  const [idx, setIdx] = useState(0);
  const [shuffling, setShuffling] = useState<'next' | 'prev' | null>(null);

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

  const cardOrder: number[] = [];
  for (let i = 0; i < 3; i++) {
    const c = (idx + i) % CARDS.length;
    cardOrder.push(c);
  }

  const DRAG_THRESHOLD = 80;
  const SHUFFLE_MS = 350;

  const next = useCallback(() => {
    if (shuffling) return;
    playShuffleSound();
    if (isMobile) triggerHaptic(15);
    setShuffling('next');

    setTimeout(() => {
      setIdx((i) => (i + 1) % CARDS.length);
      setShuffling(null);
    }, SHUFFLE_MS);
  }, [shuffling, playShuffleSound, isMobile, triggerHaptic]);

  const prev = useCallback(() => {
    if (shuffling) return;
    playShuffleSound();
    if (isMobile) triggerHaptic(15);
    setShuffling('prev');

    setTimeout(() => {
      setIdx((i) => (i - 1 + CARDS.length) % CARDS.length);
      setShuffling(null);
    }, SHUFFLE_MS);
  }, [shuffling, playShuffleSound, isMobile, triggerHaptic]);

  const handleDragEnd = (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (shuffling) return;

    const velocity = info.velocity.x;
    const offset = info.offset.x;

    // Swipe detection based on velocity or distance
    if (offset < -DRAG_THRESHOLD || velocity < -500) {
      next();
    } else if (offset > DRAG_THRESHOLD || velocity > 500) {
      prev();
    }
    // Card snaps back automatically via dragConstraints
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

  // Calculate card transforms for non-dragging states
  const getCardTransform = (stackPos: number, isTop: boolean) => {
    // Both directions share the same quick "snap" feel: the top card gives a
    // subtle directional tilt (no travel) while the cards behind settle one notch
    // deeper, then the incoming card pops in on top. The rotate sign is the only
    // difference between next (right) and prev (left).
    if (shuffling && isTop) {
      return {
        scale: 1,
        rotate: shuffling === 'next' ? 2 : -2,
        opacity: 1,
        yOffset: 0,
      };
    }

    if (shuffling && !isTop) {
      const newStackPos = stackPos + 1;
      return {
        scale: 1 - newStackPos * 0.03,
        rotate: 0,
        opacity: 0.7,
        yOffset: newStackPos * stackOffset,
      };
    }

    // Default state
    return {
      scale: 1 - stackPos * 0.03,
      rotate: 0,
      opacity: isTop ? 1 : stackPos === 1 ? 0.95 : 0.6,
      yOffset: stackPos * stackOffset,
    };
  };

  const animateEntrance = isMobile && !reducedMotion;

  return (
    <motion.div
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

      {cardOrder.map((cardIdx, stackPos) => {
        const card = CARDS[cardIdx];
        const isTop = stackPos === 0;
        const transform = getCardTransform(stackPos, isTop);

        return (
          <motion.div
            key={`card-${cardIdx}-${stackPos}`}
            animate={{
              scale: transform.scale,
              rotate: transform.rotate,
              opacity: transform.opacity,
              y: transform.yOffset,
              x: 0,
            }}
            style={{
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
              boxShadow: isTop && !shuffling
                ? '0 25px 50px rgba(20,15,5,0.4), 0 12px 24px rgba(20,15,5,0.3), 0 0 0 1px rgba(255,255,255,0.05) inset'
                : '0 10px 20px rgba(20,15,5,0.25)',
              zIndex: 100 - stackPos,
              cursor: isTop && !shuffling ? 'grab' : 'default',
              touchAction: 'none',
              display: 'flex',
              flexDirection: 'column',
              pointerEvents: isTop && !shuffling ? 'auto' : 'none',
            }}
            transition={cardSpring}
            drag={isTop && !shuffling ? 'x' : false}
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.9}
            dragMomentum={false}
            onDragEnd={handleDragEnd}
            whileDrag={{ scale: 1.02, cursor: 'grabbing' }}
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
              <motion.button
                onClick={(e) => {
                  e.stopPropagation();
                  prev();
                }}
                style={getChevBtnStyle(isMobile)}
                whileHover={{ scale: 1.1, background: 'rgba(245,242,232,0.15)' }}
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
                  backdropFilter: 'blur(8px)',
                  WebkitBackdropFilter: 'blur(8px)',
                  letterSpacing: '0.04em',
                }}
                aria-live="polite"
              >
                <span style={{ color: '#f2c230', fontWeight: 600 }}>
                  {String(cardIdx + 1).padStart(2, '0')}
                </span>
                <span style={{ color: 'rgba(245,242,232,0.4)' }}>
                  &nbsp;/&nbsp;{String(CARDS.length).padStart(2, '0')}
                </span>
              </span>
              <motion.button
                onClick={(e) => {
                  e.stopPropagation();
                  next();
                }}
                style={getChevBtnStyle(isMobile)}
                whileHover={{ scale: 1.1, background: 'rgba(245,242,232,0.15)' }}
                whileTap={{ scale: 0.95 }}
                aria-label="Next card"
              >
                ›
              </motion.button>
            </div>

            <CardBody card={card} isMobile={isMobile} />
          </motion.div>
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
