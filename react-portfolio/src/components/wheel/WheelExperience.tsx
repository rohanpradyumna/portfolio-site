'use client';

import React, { useEffect, useState } from 'react';
import { MotionConfig } from 'framer-motion';
import { HomeMark } from '@/components/ui/HomeMark';
import { WHEEL_CATEGORIES, WHEEL_TOPICS, findTopicById } from '@/data/wheelTopics';
import { findModeById } from '@/data/rabbitHoleModes';
import { WIDE_QUERY } from '@/utils/breakpoints';
import { RabbitHoleMachine, Combo } from './RabbitHoleMachine';
import styles from './wheel.module.css';

// The page is composed at 1440 x 900 and grows or shrinks with the screen, the
// board's Stage idea: a 13" laptop and a 27" monitor see the same composition.
const DESIGN = { w: 1440, h: 900, min: 0.85, max: 1.6 };

/** How much to zoom the page on this screen. Phones keep 1: they get their own layout. */
function usePageZoom() {
  const [k, setK] = useState(1);
  useEffect(() => {
    const wide = window.matchMedia(WIDE_QUERY);
    const fit = () => {
      const raw = Math.min(window.innerWidth / DESIGN.w, window.innerHeight / DESIGN.h);
      const next = wide.matches ? Math.min(DESIGN.max, Math.max(DESIGN.min, raw)) : 1;
      setK(Math.round(next * 100) / 100);
    };
    fit();
    window.addEventListener('resize', fit);
    wide.addEventListener('change', fit);
    return () => {
      window.removeEventListener('resize', fit);
      wide.removeEventListener('change', fit);
    };
  }, []);
  return k;
}

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
  const k = usePageZoom();

  return (
    <>
      <div className={styles.board} />
      <main className={styles.scroll}>
        {/* CSS zoom scales the lever's drag too; dividing the pointer by k keeps the knob under the finger. */}
        <MotionConfig transformPagePoint={(p) => ({ x: p.x / k, y: p.y / k })}>
          <div className={styles.wrap} style={{ '--k': k } as React.CSSProperties}>
            <header className={styles.head}>
              <h1 className={styles.title}>Rabbit holes</h1>
              <p className={styles.sub}>A random topic, a way to learn it, and a prompt to take to your AI.</p>
            </header>
            <RabbitHoleMachine initial={initial} printed={Boolean(shared)} />
          </div>
        </MotionConfig>
      </main>
      <HomeMark href="/" pinned />
    </>
  );
}
