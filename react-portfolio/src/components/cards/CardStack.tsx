'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion, PanInfo, AnimatePresence } from 'framer-motion';
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
  // Which way the last shuffle went; the exiting card reads it (via
  // AnimatePresence's custom) to leave in the direction it was swiped.
  const [dir, setDir] = useState<1 | -1>(1);

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

  // No input lock: cards are keyed by identity, so a rapid second click just
  // retargets the springs mid-flight instead of being swallowed.
  const next = useCallback(() => {
    playShuffleSound();
    if (isMobile) triggerHaptic(15);
    setDir(1);
    setIdx((i) => (i + 1) % CARDS.length);
  }, [playShuffleSound, isMobile, triggerHaptic]);

  const prev = useCallback(() => {
    playShuffleSound();
    if (isMobile) triggerHaptic(15);
    setDir(-1);
    setIdx((i) => (i - 1 + CARDS.length) % CARDS.length);
  }, [playShuffleSound, isMobile, triggerHaptic]);

  const handleDragEnd = (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
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
      // Don't shuffle the board behind an open dialog or while typing.
      if (document.querySelector('[aria-modal="true"]')) return;
      if ((e.target as HTMLElement | null)?.closest?.('input, textarea, [contenteditable]')) return;
      if (e.key === 'ArrowRight' || e.key === 'j') next();
      if (e.key === 'ArrowLeft' || e.key === 'k') prev();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [next, prev]);

  const stackOffset = isMobile ? 6 : 10;

  const getCardTransform = (stackPos: number) => ({
    scale: 1 - stackPos * 0.03,
    rotate: 0,
    opacity: stackPos === 0 ? 1 : stackPos === 1 ? 0.95 : 0.6,
    y: stackPos * stackOffset,
    x: 0,
  });

  // Where a card goes when it leaves the visible three. Next: the top card is
  // thrown off to the left (the way it was swiped), staying opaque while it
  // travels and fading only at the tail, so it never ghosts over the new top
  // card. Prev: the back card sinks one notch deeper and fades.
  const deepest = getCardTransform(3);
  const easeOut = [0.23, 1, 0.32, 1] as const;
  const thrown = { x: -cardW * 1.15, rotate: -8 };
  // Reduced motion: no travel, just a quick crossfade (MotionConfig's
  // reducedMotion doesn't reach AnimatePresence exits).
  const cardVariants = {
    exit: (d: 1 | -1) =>
      reducedMotion
        ? { opacity: 0, transition: { duration: 0.15 } }
        : d === 1
        ? {
            ...thrown,
            opacity: 0,
            zIndex: 101,
            transition: {
              x: { duration: 0.3, ease: easeOut },
              rotate: { duration: 0.3, ease: easeOut },
              opacity: { duration: 0.12, delay: 0.16 },
            },
          }
        : { ...deepest, opacity: 0, transition: { duration: 0.2, ease: easeOut } },
  };
  // Opacity settles faster than the spring so a returning card is solid by the
  // time it overlaps the one it covers.
  const cardTransition = { ...cardSpring, opacity: { duration: 0.12 } };

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

      <AnimatePresence initial={false} custom={dir}>
      {cardOrder.map((cardIdx, stackPos) => {
        const card = CARDS[cardIdx];
        const isTop = stackPos === 0;

        return (
          <motion.div
            key={`card-${cardIdx}`}
            custom={dir}
            variants={cardVariants}
            // Newcomers: on next one rises from deep in the pile; on prev the
            // returning card comes back from the left, where it was thrown.
            initial={
              reducedMotion
                ? { ...getCardTransform(stackPos), opacity: 0 }
                : isTop
                  ? { ...thrown, opacity: 0, scale: 1, y: 0 }
                  : { ...deepest, opacity: 0 }
            }
            animate={getCardTransform(stackPos)}
            exit="exit"
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
              boxShadow: isTop
                ? '0 25px 50px rgba(20,15,5,0.4), 0 12px 24px rgba(20,15,5,0.3), 0 0 0 1px rgba(255,255,255,0.05) inset'
                : '0 10px 20px rgba(20,15,5,0.25)',
              zIndex: 100 - stackPos,
              cursor: isTop ? 'grab' : 'default',
              touchAction: 'none',
              display: 'flex',
              flexDirection: 'column',
              pointerEvents: isTop ? 'auto' : 'none',
            }}
            transition={cardTransition}
            drag={isTop ? 'x' : false}
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.9}
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
                  prev();
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
                  next();
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
      })}
      </AnimatePresence>

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
