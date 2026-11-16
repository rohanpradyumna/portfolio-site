'use client';

import React, { CSSProperties, KeyboardEvent, ReactNode, memo, useCallback, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { PortraitMood, SEAT_IDS, Seat, SeatId } from '@/lib/council/contract';
import { COUNCIL_COPY } from '@/data/council/copy';
import { SEAT_LIST } from '@/data/council/seats';
import { SeatPortrait } from '@/components/council/portraits';
import { RingDoodle, TickIcon } from './doodles';
import { DURATIONS, FADE, FADE_OUT, SEAT_TILTS, SPRINGS, STAGGER, WOBBLE_KEYFRAMES } from './motion';
import styles from './council.module.css';

export type SeatArrangement = 'arc' | 'bench';

interface SeatButtonProps {
  seat: Seat;
  index: number;
  size: number;
  arrangement: SeatArrangement;
  selected: boolean;
  mood: PortraitMood;
  tabbable: boolean;
  /** The id of the stance card this seat opens, when it works as a disclosure. */
  controls?: string;
  /** Layout placeholder: no shared-layout identity, so the intro's stickers own the ids. */
  ghost?: boolean;
  onSelect: (seatId: SeatId) => void;
}

const SeatButton = memo(function SeatButton({
  seat,
  index,
  size,
  arrangement,
  selected,
  mood,
  tabbable,
  controls,
  ghost = false,
  onSelect,
}: SeatButtonProps) {
  const speaking = mood === 'speaking';
  const tilt = SEAT_TILTS[index] * (arrangement === 'bench' ? 0.6 : 1);
  const rest = {
    rotate: selected || speaking ? 0 : tilt,
    y: speaking ? -5 : selected ? -3 : 0,
    scale: speaking ? 1.1 : selected ? 1.05 : 1,
  };
  const peekId = `council-peek-${seat.id}`;
  // "Stoic lens" becomes "Stoic" where a phone column cannot fit the whole tag.
  const [lensName, ...lensRest] = seat.lensLabel.split(' ');
  const lensSuffix = lensRest.join(' ');

  return (
    <motion.button
      type="button"
      layout={!ghost}
      layoutId={ghost ? undefined : `council-seat-${seat.id}`}
      // Only a change of arrangement or size is a real move. Without this,
      // every mood change would re-measure a sticky bench mid-scroll.
      layoutDependency={`${arrangement}-${size}`}
      transition={{ layout: { ...SPRINGS.seatLayout, delay: index * STAGGER.seats } }}
      className={styles.seat}
      data-seat={seat.id}
      data-mood={mood}
      data-selected={selected || undefined}
      style={
        {
          '--seat-accent': seat.accent,
          '--seat-size': `${size}px`,
        } as CSSProperties
      }
      aria-pressed={controls ? undefined : selected}
      aria-expanded={controls ? selected : undefined}
      aria-controls={controls && selected ? controls : undefined}
      aria-label={COUNCIL_COPY.scene.seatAria(seat.figure, seat.lensLabel)}
      aria-describedby={arrangement === 'arc' ? peekId : undefined}
      tabIndex={tabbable ? 0 : -1}
      onClick={() => onSelect(seat.id)}
    >
      <span className={styles.seatFigure}>
      <motion.span
        className={styles.seatLift}
        initial={false}
        animate={
          mood === 'challenged' ? { ...rest, rotate: WOBBLE_KEYFRAMES.map((degrees) => rest.rotate + degrees) } : rest
        }
        // Press feedback is CSS :active on the portrait. framer's whileTap would
        // make this span a second tab stop inside the button.
        whileHover={{ y: rest.y - 5, rotate: rest.rotate * 0.35, scale: rest.scale * 1.04 }}
        transition={
          mood === 'challenged'
            ? { ...SPRINGS.seatLift, rotate: { duration: DURATIONS.wobble, ease: 'easeOut' } }
            : SPRINGS.seatLift
        }
      >
        <span className={styles.seatPortrait}>
          <SeatPortrait seatId={seat.id} size={size} mood={mood} />
        </span>

      </motion.span>

      {/* Outside the lift so its shared-layout glide is measured on an untransformed box. */}
      {selected && (
        <motion.span
          className={styles.seatRing}
          layoutId="council-selection-ring"
          layoutDependency={`${seat.id}-${arrangement}-${size}`}
          transition={{ layout: SPRINGS.selection }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <RingDoodle />
        </motion.span>
      )}
      </span>

      <span className={styles.seatTag}>
        {selected && (
          <span className={styles.seatTick}>
            <TickIcon />
          </span>
        )}
        {lensName}
        {lensSuffix && <span className={styles.seatTagSuffix}> {lensSuffix}</span>}
      </span>

      <span className={styles.peek} id={peekId} role="tooltip">
        <span className={styles.peekName}>
          {seat.figure} <span className={styles.peekDates}>{seat.figureDates}</span>
        </span>
        <span className={styles.peekIntro}>{seat.intro}</span>
      </span>
    </motion.button>
  );
});

export interface CouncilSeatsProps {
  arrangement: SeatArrangement;
  /** Portrait width in px for the current arrangement and viewport. */
  size: number;
  selectedSeatId: SeatId | null;
  moods: Record<SeatId, PortraitMood>;
  onSelect: (seatId: SeatId) => void;
  /** Set when a seat opens a stance card instead of choosing a recipient. */
  controls?: string;
  /** The bench's status line: who is thinking or replying, and Stop. */
  status?: ReactNode;
  /** Anything that should hang from the bench (the stance card, in a thread). */
  children?: ReactNode;
  /**
   * Invisible and inert, but laid out. Rendered while the intro is up so the
   * page below does not slide into the seats' space and jump back at handoff.
   */
  ghost?: boolean;
}

export function CouncilSeats({
  arrangement,
  size,
  selectedSeatId,
  moods,
  onSelect,
  controls,
  status,
  children,
  ghost = false,
}: CouncilSeatsProps) {
  const rowRef = useRef<HTMLDivElement>(null);
  const tabStop = selectedSeatId ?? SEAT_IDS[0];

  // One tab stop for the group; arrows move between seats, as in a toolbar.
  const onKeyDown = useCallback((event: KeyboardEvent<HTMLDivElement>) => {
    const buttons = Array.from(rowRef.current?.querySelectorAll<HTMLButtonElement>('button[data-seat]') ?? []);
    const current = buttons.indexOf(document.activeElement as HTMLButtonElement);
    if (current === -1) return;
    let next = current;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = (current + 1) % buttons.length;
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = (current - 1 + buttons.length) % buttons.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = buttons.length - 1;
    else return;
    event.preventDefault();
    buttons[next]?.focus();
  }, []);

  return (
    <section
      className={styles.seats}
      data-arrangement={arrangement}
      aria-label={COUNCIL_COPY.scene.seatsLabel}
      aria-hidden={ghost || undefined}
      inert={ghost || undefined}
      style={ghost ? { visibility: 'hidden' } : undefined}
    >
      <div className={styles.seatRow} ref={rowRef} role="toolbar" aria-orientation="horizontal" onKeyDown={onKeyDown}>
        {SEAT_LIST.map((seat, index) => (
          <SeatButton
            key={seat.id}
            seat={seat}
            index={index}
            size={size}
            arrangement={arrangement}
            selected={selectedSeatId === seat.id}
            mood={moods[seat.id]}
            tabbable={tabStop === seat.id}
            controls={controls}
            ghost={ghost}
            onSelect={onSelect}
          />
        ))}
      </div>
      <AnimatePresence initial={false}>
        {arrangement === 'bench' && status && (
          <motion.div
            key="status"
            className={styles.benchStatus}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: FADE_OUT }}
            transition={FADE}
          >
            {status}
          </motion.div>
        )}
      </AnimatePresence>
      {children}
    </section>
  );
}
