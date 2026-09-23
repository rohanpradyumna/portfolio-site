'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { WheelTopicFlat } from '@/types';
import { WheelCanvas } from './WheelCanvas';
import { TopicReveal } from './TopicReveal';
import { ResponseForm } from './ResponseForm';
import { ResponseFeed } from './ResponseFeed';
import styles from './wheel.module.css';

type Stage = 'idle' | 'revealed' | 'writing' | 'submitted';

export function WheelExperience() {
  const [stage, setStage] = useState<Stage>('idle');
  const [topic, setTopic] = useState<WheelTopicFlat | null>(null);

  const handleLanded = (t: WheelTopicFlat) => {
    setTopic(t);
    setStage('revealed');
  };

  const handleSpinAgain = () => {
    setTopic(null);
    setStage('idle');
  };

  return (
    <>
      <div className={styles.board} />
      <Link className={styles.brand} href="/">
        <span className={styles.name}>rohan</span>
        <span className={styles.dot} />
      </Link>

      <div className={styles.scroll}>
        <div className={styles.wrap}>
          <Link className={styles.backLink} href="/">
            back to the board
          </Link>

          <div className={styles.title}>Pull the Lever</div>
          <div className={styles.intro}>
            Pull the lever for a random topic across philosophy, history, science, and more. Go research it, then
            come back and write your take. Sign it with your name, or post anonymously.
          </div>

          <WheelCanvas onLanded={handleLanded} />

          {topic && stage !== 'idle' && (
            <TopicReveal
              topic={topic}
              showWriteCta={stage === 'revealed'}
              onWrite={() => setStage('writing')}
              onSpinAgain={handleSpinAgain}
            />
          )}

          {topic && stage === 'writing' && (
            <ResponseForm topic={topic} onSubmitted={() => setStage('submitted')} />
          )}

          {stage === 'submitted' && (
            <div className={styles.confirmCard}>
              <p>
                Thanks for writing. Your response is saved and pending review. Once approved, it&apos;ll show up
                below for this topic.
              </p>
            </div>
          )}

          <ResponseFeed
            key={topic?.id ?? 'all'}
            topicId={topic?.id}
            heading={topic ? `Responses on this topic` : 'Recent responses'}
          />
        </div>
      </div>
    </>
  );
}
