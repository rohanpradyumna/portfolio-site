'use client';

import React, { CSSProperties, memo } from 'react';
import { motion } from 'framer-motion';
import { PortraitMood, Seat } from '@/lib/council/contract';
import { COUNCIL_COPY } from '@/data/council/copy';
import { SeatPortrait } from '@/components/council/portraits';
import { ForkDoodle } from './doodles';
import { SPRINGS, STAGGER } from './motion';
import { UiTurn } from './state/reducer';
import styles from './council.module.css';

/** How many trailing words are still fading in while a reply streams. */
const FRESH_WORDS = 14;

/**
 * Streamed text, shown the moment it arrives. The newest few words fade up
 * from a lighter ink so the reply lands softly, but nothing is ever held back
 * or replayed: there is no typewriter here, only the real stream.
 */
function StreamedText({ text, streaming }: { text: string; streaming: boolean }) {
  if (!streaming) return <>{text}</>;
  const words = text.match(/\s*\S+\s*/g) ?? [];
  const settled = Math.max(0, words.length - FRESH_WORDS);
  return (
    <>
      {words.slice(0, settled).join('')}
      {words.slice(settled).map((word, offset) => (
        // Keyed by position so a word keeps its span (and its fade) as later words arrive.
        <span key={settled + offset} className={styles.fresh}>
          {word}
        </span>
      ))}
      <span className={styles.caret} aria-hidden="true" />
    </>
  );
}

export interface ResponseNoteProps {
  /** The reply, or null while this seat is still waiting for its turn. */
  turn: UiTurn | null;
  /** The speaker, or null for a note from the council as a whole. */
  seat: Seat | null;
  /** The heading of a note with no seat. */
  title?: string;
  mood: PortraitMood;
  /** Position in its row: sets the resting tilt and the entrance stagger. */
  index: number;
  /** The line under the name: who this answers, or what the seat is doing. */
  meta: string | null;
  /** Shown under a reply that was cut off. */
  cutLabel: string | null;
  /** The visitor picked this seat on the bench. */
  focused: boolean;
  portraitSize: number;
}

const TILTS = [-0.7, 0.55, -0.35, 0.6, -0.5, 0.4];

export const ResponseNote = memo(function ResponseNote({
  turn,
  seat,
  title,
  mood,
  index,
  meta,
  cutLabel,
  focused,
  portraitSize,
}: ResponseNoteProps) {
  const streaming = turn?.status === 'streaming';
  const headingId = `council-note-${turn?.id ?? `${seat?.id ?? 'synthesis'}-pending`}`;
  const tilt = TILTS[index % TILTS.length];

  return (
    <motion.article
      className={styles.note}
      data-kind={seat ? 'seat' : title ? 'council' : 'synthesis'}
      data-state={turn ? turn.status : 'pending'}
      data-focused={focused || undefined}
      data-seat={seat?.id}
      style={{ '--seat-accent': seat?.accent ?? 'var(--accent-yellow)', '--note-tilt': `${tilt}deg` } as CSSProperties}
      aria-labelledby={headingId}
      aria-busy={streaming || !turn || undefined}
      initial={{ opacity: 0, y: 16, rotate: tilt * 3 }}
      animate={{ opacity: 1, y: 0, rotate: tilt }}
      transition={{ ...SPRINGS.noteIn, delay: index * STAGGER.notes }}
    >
      <span className={styles.tape} aria-hidden="true" />
      <header className={styles.noteHead}>
        {seat ? (
          <span className={styles.notePortrait}>
            <SeatPortrait seatId={seat.id} size={portraitSize} mood={mood} />
          </span>
        ) : (
          <span className={styles.noteGlyph}>
            <ForkDoodle />
          </span>
        )}
        <div className={styles.noteTitle}>
          <h3 id={headingId} className={styles.noteLens}>
            {seat ? seat.lensLabel : (title ?? COUNCIL_COPY.scene.synthesisLabel)}
          </h3>
          {meta && <p className={styles.noteMeta}>{meta}</p>}
        </div>
      </header>

      {turn ? (
        <p className={styles.noteBody}>
          <StreamedText text={turn.text} streaming={streaming} />
        </p>
      ) : (
        <div className={styles.notePending} aria-hidden="true">
          <span className={styles.pendingLine} />
          <span className={styles.pendingLine} />
          <span className={styles.pendingLine} />
        </div>
      )}

      {cutLabel && <p className={styles.noteCut}>{cutLabel}</p>}
    </motion.article>
  );
});
