'use client';

import React, { PointerEvent, useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { animate, motion, useMotionValue } from 'framer-motion';
import type { AnimationPlaybackControls } from 'framer-motion';
import { SEAT_IDS, Seat, SeatId } from '@/lib/council/contract';
import { COUNCIL_COPY } from '@/data/council/copy';
import { SEAT_LIST } from '@/data/council/seats';
import { SeatPortrait } from '@/components/council/portraits';
import { CloseIcon } from './doodles';
import { feedback } from './feedback';
import { usePrefersReducedMotion } from './hooks';
import { GESTURE, SPRINGS, projectMomentum, rubberBand } from './motion';
import styles from './council.module.css';

const GAP = 16;

interface StanceIntroProps {
  seat: Seat;
  active: boolean;
  readingOpen: boolean;
  onToggleReading: () => void;
  /** tray: sits under the composer and offers the way back to the whole council. popover: hangs from the bench. */
  variant: 'tray' | 'popover';
  onDismiss: () => void;
}

function StanceIntro({ seat, active, readingOpen, onToggleReading, variant, onDismiss }: StanceIntroProps) {
  const headingId = useId();
  const readingId = useId();
  const copy = COUNCIL_COPY.stance;

  return (
    // Neighbouring cards are only there to be swiped to. They stay out of the
    // tab order and the accessibility tree until they are the current one.
    <article className={styles.stance} aria-labelledby={headingId} inert={!active} aria-hidden={!active}>
      <header className={styles.stanceHead}>
        <span className={styles.stancePortrait}>
          <SeatPortrait seatId={seat.id} size={58} mood="idle" />
        </span>
        <div className={styles.stanceTitle}>
          <h2 id={headingId} className={styles.stanceSchool}>
            {seat.school}
          </h2>
          <p className={styles.stanceFace}>
            <span className={styles.stanceFaceLabel}>{copy.faceLabel}</span>
            {seat.figure} · {seat.figureDates}
          </p>
        </div>
        {variant === 'popover' && (
          <button type="button" className={styles.iconButton} onClick={onDismiss} aria-label={COUNCIL_COPY.scene.closeStance(seat.school)}>
            <CloseIcon />
          </button>
        )}
      </header>

      <p className={styles.stanceIntro}>{seat.intro}</p>

      <p className={styles.stanceLabel}>{copy.coreQuestionLabel}</p>
      <p className={styles.stanceQuestion}>{seat.coreQuestion}</p>

      {seat.furtherReading.length > 0 && (
        <div className={styles.reading}>
          <button
            type="button"
            className={styles.readingToggle}
            aria-expanded={readingOpen}
            aria-controls={readingId}
            onClick={onToggleReading}
          >
            <span className={styles.readingChevron} aria-hidden="true" />
            {copy.readingToggle}
          </button>
          <div id={readingId} hidden={!readingOpen}>
            <p className={styles.readingNote}>{COUNCIL_COPY.furtherReadingNote}</p>
            <ul className={styles.readingList} aria-label={COUNCIL_COPY.furtherReadingLabel}>
              {seat.furtherReading.map((reading) => (
                <li key={reading.url}>
                  <a href={reading.url} target="_blank" rel="noopener noreferrer">
                    {reading.title}
                    <span className="sr-only"> ({COUNCIL_COPY.opensInNewTab})</span>
                  </a>
                  <span className={styles.readingAuthor}>{reading.author}</span>
                  <span className={styles.readingWhy}>{reading.note}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <footer className={styles.stanceFoot}>
        <p>{copy.interpretation(seat.figure)}</p>
        {variant === 'tray' && (
          <button type="button" className={styles.textButton} onClick={onDismiss}>
            {copy.deselect}
          </button>
        )}
      </footer>
    </article>
  );
}

export interface StancePagerProps {
  id: string;
  seatId: SeatId;
  variant: 'tray' | 'popover';
  onChange: (seatId: SeatId) => void;
  onDismiss: () => void;
}

interface Drag {
  pointerId: number;
  startX: number;
  startY: number;
  originX: number;
  /** Where the finger was when the swipe committed, so the card does not jump by the hysteresis. */
  grabX: number;
  axis: 'x' | null;
  samples: { time: number; x: number }[];
}

/**
 * The six stance cards as one strip that can be swiped between seats.
 *
 * The strip follows the finger 1:1, resists past the first and last card, and
 * on release keeps the finger's velocity: the landing card is chosen from
 * where the flick is heading, not from where it was let go. A spring settles
 * it, so it can be caught and thrown the other way at any moment.
 */
export function StancePager({ id, seatId, variant, onChange, onDismiss }: StancePagerProps) {
  const reduced = usePrefersReducedMotion();
  const viewportRef = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const stride = useRef(0);
  const drag = useRef<Drag | null>(null);
  const settling = useRef<AnimationPlaybackControls | null>(null);
  const settledIndex = useRef(-1);
  const [readingOpen, setReadingOpen] = useState(false);

  const index = SEAT_IDS.indexOf(seatId);
  const last = SEAT_IDS.length - 1;

  const settle = useCallback(
    (toIndex: number, velocity: number) => {
      settling.current?.stop();
      settledIndex.current = toIndex;
      const target = -toIndex * stride.current;
      if (reduced) {
        x.set(target);
        return;
      }
      settling.current = animate(x, target, { ...SPRINGS.pager, velocity });
    },
    [reduced, x],
  );

  // Keep the strip on its card when the box changes width (rotation, resize).
  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const measure = () => {
      stride.current = viewport.clientWidth + GAP;
      if (!drag.current) {
        settling.current?.stop();
        x.set(-Math.max(0, settledIndex.current) * stride.current);
      }
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [x]);

  // A seat chosen elsewhere (a tap on the board, an arrow key) pages the strip
  // there, carrying whatever velocity it already had.
  useLayoutEffect(() => {
    if (settledIndex.current === index) return;
    if (settledIndex.current === -1) {
      settledIndex.current = index;
      x.set(-index * stride.current);
      return;
    }
    settle(index, x.getVelocity());
  }, [index, settle, x]);

  useEffect(() => () => settling.current?.stop(), []);

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    // A mouse keeps text selection and uses the seats themselves to move.
    if (event.pointerType === 'mouse' || drag.current) return;
    drag.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: x.get(),
      grabX: event.clientX,
      axis: null,
      samples: [{ time: event.timeStamp, x: event.clientX }],
    };
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const current = drag.current;
    if (!current || current.pointerId !== event.pointerId) return;
    const dx = event.clientX - current.startX;
    const dy = event.clientY - current.startY;

    if (current.axis === null) {
      if (Math.abs(dy) > GESTURE.hysteresisPx && Math.abs(dy) >= Math.abs(dx)) {
        // A vertical scroll. Let the page have it.
        drag.current = null;
        return;
      }
      if (Math.abs(dx) < GESTURE.hysteresisPx) return;
      current.axis = 'x';
      current.grabX = event.clientX;
      // Catch the strip wherever it is, mid-flight included.
      settling.current?.stop();
      current.originX = x.get();
      event.currentTarget.setPointerCapture(event.pointerId);
    }

    const min = -last * stride.current;
    const raw = current.originX + (event.clientX - current.grabX);
    const bounded = raw > 0 ? rubberBand(raw, stride.current) : raw < min ? min + rubberBand(raw - min, stride.current) : raw;
    x.set(bounded);

    current.samples.push({ time: event.timeStamp, x: event.clientX });
    if (current.samples.length > 8) current.samples.shift();
  };

  const onPointerEnd = (event: PointerEvent<HTMLDivElement>) => {
    const current = drag.current;
    if (!current || current.pointerId !== event.pointerId) return;
    drag.current = null;
    if (current.axis !== 'x' || stride.current === 0) return;

    const recent = current.samples.filter((sample) => event.timeStamp - sample.time <= GESTURE.velocityWindowMs);
    const first = recent[0];
    const latest = recent[recent.length - 1];
    const velocity =
      first && latest && latest.time > first.time ? ((latest.x - first.x) / (latest.time - first.time)) * 1000 : 0;

    const from = Math.max(0, settledIndex.current);
    const projected = x.get() + projectMomentum(velocity);
    // One card per swipe, however hard the flick: this is a pager, not a list.
    const toIndex = Math.min(last, Math.max(0, Math.min(from + 1, Math.max(from - 1, Math.round(-projected / stride.current)))));

    settle(toIndex, velocity);
    if (toIndex !== from) {
      feedback('page');
      onChange(SEAT_IDS[toIndex]);
    }
  };

  return (
    <div
      id={id}
      ref={viewportRef}
      className={styles.pager}
      data-variant={variant}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
    >
      <motion.div className={styles.pagerTrack} style={{ x, gap: GAP }}>
        {SEAT_LIST.map((seat) => (
          <StanceIntro
            key={seat.id}
            seat={seat}
            active={seat.id === seatId}
            readingOpen={readingOpen}
            onToggleReading={() => setReadingOpen((open) => !open)}
            variant={variant}
            onDismiss={onDismiss}
          />
        ))}
      </motion.div>
    </div>
  );
}
