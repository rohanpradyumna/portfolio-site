'use client';

import React, { CSSProperties } from 'react';
import { motion } from 'framer-motion';
import { COUNCIL_LIMITS, PortraitMood, SeatId } from '@/lib/council/contract';
import { COUNCIL_COPY } from '@/data/council/copy';
import { SEATS } from '@/data/council/seats';
import { PencilIcon, ScribbleDoodle } from './doodles';
import { FADE, SPRINGS, STAGGER } from './motion';
import { ResponseNote } from './ResponseNote';
import { Exchange, UiTurn } from './state/reducer';
import { isUndecided } from './state/selectors';
import styles from './council.module.css';

const COPY = COUNCIL_COPY.scene;

// Heading of a reply the council gives as a whole (off-topic or sensitive
// questions), with no seat attached.
const COUNCIL_NOTE_LABEL = COUNCIL_COPY.scene.councilNoteLabel;

interface ExchangeViewProps {
  exchange: Exchange;
  turns: UiTurn[];
  /** This exchange's request is still in flight. */
  active: boolean;
  first: boolean;
  moods: Record<SeatId, PortraitMood>;
  focusedSeatId: SeatId | null;
  portraitSize: number;
}

function ExchangeView({
  exchange,
  turns,
  active,
  first,
  moods,
  focusedSeatId,
  portraitSize,
}: ExchangeViewProps) {
  const visitor = turns.find((turn) => turn.role === 'visitor');
  const replies = turns.filter((turn) => turn.role !== 'visitor');
  const synthesis = replies.find((turn) => turn.role === 'synthesis') ?? null;
  const streaming = replies.some((turn) => turn.status === 'streaming');

  // Speakers in the order they were expected, then anyone who spoke unannounced.
  const seatOrder: SeatId[] = [...exchange.expectedSeatIds];
  for (const turn of replies) {
    if (turn.seatId && !seatOrder.includes(turn.seatId)) seatOrder.push(turn.seatId);
  }
  const rows = seatOrder
    .map((seatId) => ({ seatId, turn: replies.find((turn) => turn.seatId === seatId) ?? null }))
    // A seat that never got its turn only holds a place while the exchange is live.
    .filter((row) => row.turn || active);
  const nextUp = rows.find((row) => !row.turn)?.seatId ?? null;

  // A reply of any kind means the routing question is over, even when no seat
  // was named: the council can answer as one voice.
  const undecided = active && isUndecided(exchange, turns);
  const showSynthesis = synthesis !== null || (active && exchange.expectsSynthesis);
  const noteCount = rows.length + (showSynthesis ? 1 : 0);
  const cutLabel = exchange.status === 'stopped' ? COPY.stopped : COPY.partial;

  const metaFor = (seatId: SeatId, turn: UiTurn | null, position: number): string | null => {
    const seat = SEATS[seatId];
    if (!turn) {
      return seatId === nextUp && !streaming ? COUNCIL_COPY.status.thinking(seat.figure) : COUNCIL_COPY.status.waiting(seat.figure);
    }
    if (exchange.action === 'debate') {
      const other = turn.replyToSeatId ?? seatOrder[position === 0 ? 1 : 0];
      if (!other) return null;
      return position === 0 ? COPY.objectingTo(SEATS[other].lensLabel) : COPY.replyingTo(SEATS[other].lensLabel);
    }
    return null;
  };

  return (
    <section
      className={styles.exchange}
      data-exchange
      // Focusable by script only: where focus lands when a reply has finished.
      tabIndex={-1}
      data-action={exchange.action}
      aria-label={first ? COPY.transcriptLabel : COUNCIL_COPY.actions[exchange.action as Exclude<typeof exchange.action, 'open'>].label}
    >
      {!first && (
        <p className={styles.exchangeStamp}>
          <span>{COUNCIL_COPY.actions[exchange.action as Exclude<typeof exchange.action, 'open'>].label}</span>
        </p>
      )}

      {first && (undecided || exchange.routing) && (
        <motion.p className={styles.routing} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={FADE}>
          {undecided ? (
            <>
              <ScribbleDoodle className={styles.routingScribble} />
              <span>{COUNCIL_COPY.status.routing}</span>
            </>
          ) : (
            exchange.routing && (
              <>
                <span className={styles.routingIcon}>
                  <PencilIcon />
                </span>
                <span>
                  <strong>{COPY.routingLabel}:</strong>{' '}
                  {exchange.routing.seatIds.map((seatId) => SEATS[seatId].lensLabel).join(', ')}. {exchange.routing.reason}
                </span>
              </>
            )
          )}
        </motion.p>
      )}

      {/* Blank sheets hold the row while the council decides, so the replies arrive into place. */}
      {undecided && (
        <div className={styles.notes} data-count={COUNCIL_LIMITS.maxOpeningSeats} aria-hidden="true">
          {Array.from({ length: COUNCIL_LIMITS.maxOpeningSeats }, (_, position) => (
            <motion.div
              key={position}
              className={styles.blankNote}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...SPRINGS.noteIn, delay: (position + 1) * STAGGER.blanks }}
            >
              <span className={styles.pendingLine} />
              <span className={styles.pendingLine} />
              <span className={styles.pendingLine} />
            </motion.div>
          ))}
        </div>
      )}

      {visitor && (
        <motion.div
          className={styles.visitorSlip}
          style={
            visitor.replyToSeatId ? ({ '--seat-accent': SEATS[visitor.replyToSeatId].accent } as CSSProperties) : undefined
          }
          initial={{ opacity: 0, y: 12, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={SPRINGS.noteIn}
        >
          <p className={styles.visitorLabel}>
            <strong>{COPY.visitorLabel}</strong>
            {visitor.replyToSeatId && <span>{COUNCIL_COPY.pushBack.to(SEATS[visitor.replyToSeatId].lensLabel)}</span>}
          </p>
          <p className={styles.visitorText}>{visitor.text}</p>
        </motion.div>
      )}

      {noteCount > 0 && (
        <div className={styles.notes} data-count={Math.min(noteCount, 3)}>
          {rows.map((row, position) => (
            <ResponseNote
              key={row.seatId}
              turn={row.turn}
              seat={SEATS[row.seatId]}
              // Once the exchange is over the seat on the note rests, whatever the bench is doing.
              mood={active ? moods[row.seatId] : 'idle'}
              index={position}
              meta={metaFor(row.seatId, row.turn, position)}
              cutLabel={row.turn?.status === 'partial' ? cutLabel : null}
              focused={focusedSeatId === row.seatId}
              portraitSize={portraitSize}
            />
          ))}
          {showSynthesis && (
            <ResponseNote
              key="synthesis"
              turn={synthesis}
              seat={null}
              // Only "Where do we differ?" is a comparison. Any other unattributed
              // reply is the council answering as one, and says nothing about who differs.
              title={exchange.action === 'differ' ? undefined : COUNCIL_NOTE_LABEL}
              mood="idle"
              index={rows.length}
              meta={synthesis || exchange.action !== 'differ' ? null : COUNCIL_COPY.status.synthesizing}
              cutLabel={synthesis?.status === 'partial' ? cutLabel : null}
              focused={false}
              portraitSize={portraitSize}
            />
          )}
        </div>
      )}

      {exchange.followUpQuestion && (
        <motion.aside
          className={styles.questionBack}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={SPRINGS.noteIn}
        >
          <p className={styles.questionBackLabel}>{COPY.followUpQuestionLabel}</p>
          <p className={styles.questionBackText}>{exchange.followUpQuestion}</p>
        </motion.aside>
      )}

      {exchange.source === 'fixture' && !active && replies.length > 0 && (
        <p className={styles.scriptedMark}>{COPY.scripted}</p>
      )}
    </section>
  );
}

export interface TranscriptProps {
  exchanges: Exchange[];
  turns: UiTurn[];
  activeExchangeId: string | null;
  moods: Record<SeatId, PortraitMood>;
  focusedSeatId: SeatId | null;
  portraitSize: number;
}

export function Transcript({ exchanges, turns, activeExchangeId, moods, focusedSeatId, portraitSize }: TranscriptProps) {
  return (
    <div className={styles.transcript}>
      {exchanges.map((exchange, index) => (
        <ExchangeView
          key={exchange.id}
          exchange={exchange}
          turns={turns.filter((turn) => turn.exchangeId === exchange.id)}
          active={exchange.id === activeExchangeId}
          first={index === 0}
          moods={moods}
          focusedSeatId={focusedSeatId}
          portraitSize={portraitSize}
        />
      ))}
    </div>
  );
}
