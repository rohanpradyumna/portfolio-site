'use client';

import React from 'react';
import { HomeMark } from '@/components/ui/HomeMark';
import { WHEEL_CATEGORIES, WHEEL_TOPICS, findTopicById } from '@/data/wheelTopics';
import { findModeById } from '@/data/rabbitHoleModes';
import { RabbitHoleMachine, Combo } from './RabbitHoleMachine';
import styles from './wheel.module.css';

interface WheelExperienceProps {
  /** From a shared link: /wheel?t=<topic>&m=<mode>. */
  topicId?: string;
  modeId?: string;
}

export function WheelExperience({ topicId, modeId }: WheelExperienceProps) {
  const shared = topicId ? findTopicById(topicId) : null;
  const topic = shared ?? WHEEL_TOPICS[0];
  const initial: Combo = {
    subject: Math.max(0, WHEEL_CATEGORIES.findIndex((c) => c.id === topic.categoryId)),
    topic,
    mode: findModeById(modeId),
  };

  return (
    <>
      <div className={styles.board} />
      <main className={styles.scroll}>
        <div className={styles.wrap}>
          <header className={styles.head}>
            <h1 className={styles.title}>Rabbit holes</h1>
            <p className={styles.sub}>A random topic, a way to learn it, and a prompt to take to your AI.</p>
          </header>
          <RabbitHoleMachine initial={initial} printed={Boolean(shared)} />
        </div>
      </main>
      <HomeMark href="/" pinned />
    </>
  );
}
