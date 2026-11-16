'use client';

import React from 'react';
import { Starter } from '@/lib/council/contract';
import { COUNCIL_COPY } from '@/data/council/copy';
import { ArrowIcon } from './doodles';
import styles from './council.module.css';

export interface StarterQuestionsProps {
  starters: Starter[];
  /** Skip the one already on the table. */
  excludeId?: string | null;
  /** Said when live replies are not on offer, so it is clear these still are. */
  worksOffline?: boolean;
  /** A brief pulse that points here after a question could not be sent. */
  nudge?: number;
  label?: string;
  onPick: (starterId: string) => void;
}

export function StarterQuestions({ starters, excludeId, worksOffline, nudge = 0, label, onPick }: StarterQuestionsProps) {
  const shown = starters.filter((starter) => starter.id !== excludeId);
  if (shown.length === 0) return null;

  return (
    <div className={styles.starters}>
      <p className={styles.startersLabel}>
        {label ?? COUNCIL_COPY.scene.startersLabel}
        {worksOffline && <span className={styles.startersNote}> {COUNCIL_COPY.scene.startersWorkOffline}</span>}
      </p>
      {/* Re-keying replays the nudge animation each time it is asked for. */}
      <ul className={styles.starterList} key={nudge} data-nudge={nudge > 0 || undefined}>
        {shown.map((starter) => (
          <li key={starter.id}>
            <button type="button" className={styles.starter} onClick={() => onPick(starter.id)}>
              <span>{starter.question}</span>
              <ArrowIcon />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
