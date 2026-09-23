'use client';

import React, { useRef, useState } from 'react';
import { useMotionValue, animate } from 'framer-motion';
import { useAudio } from '@/hooks/useAudio';
import { useMotion } from '@/hooks/useMotion';
import { WHEEL_TOPICS } from '@/data/wheelTopics';
import { WheelTopicFlat } from '@/types';
import { SlotReel, ROW_HEIGHT, CENTER_OFFSET } from './SlotReel';
import { LeverHandle } from './LeverHandle';
import styles from './wheel.module.css';

const TOPIC_COUNT = WHEEL_TOPICS.length;
// Full passes the reel makes through the topic list per spin, mirroring the
// old wheel's EXTRA_SPINS (full 360s) but in row units instead of degrees.
const EXTRA_LOOPS = 6;
// 4.0s over the same travel distance as before (3.2s) is a 20% slower average
// speed (speed = distance/time, so 1/0.8 = 1.25x the duration for the same run).
const SPIN_DURATION = 4.0;
// Absolute row index the reel is recentered to after each landing (a multiple
// of TOPIC_COUNT so the visible row is unchanged) - keeps the running index
// bounded across many spins in one session instead of growing forever.
const RECENTER_BASE = TOPIC_COUNT;

function yForIndex(index: number) {
  return CENTER_OFFSET - index * ROW_HEIGHT;
}

interface WheelCanvasProps {
  onLanded: (topic: WheelTopicFlat) => void;
}

export function WheelCanvas({ onLanded }: WheelCanvasProps) {
  const [spinning, setSpinning] = useState(false);
  const [landedPulse, setLandedPulse] = useState(0);
  // Start already recentered (rather than at row 0) so there's headroom of
  // rows above the initial resting row too - otherwise the reel would show
  // blank space above it until the first spin ever runs.
  const y = useMotionValue(yForIndex(RECENTER_BASE));
  const currentIndex = useRef(RECENTER_BASE);
  const lastBoundary = useRef(0);
  const { playSpinSound, playTickSound, playRevealChime } = useAudio();
  const { reducedMotion } = useMotion();

  const spin = () => {
    if (spinning) return;
    setSpinning(true);

    const topicIndex = Math.floor(Math.random() * TOPIC_COUNT);
    const topic = WHEEL_TOPICS[topicIndex];

    const current = currentIndex.current;
    const currentTopicOffset = ((current % TOPIC_COUNT) + TOPIC_COUNT) % TOPIC_COUNT;
    const forwardSteps = ((topicIndex - currentTopicOffset) % TOPIC_COUNT + TOPIC_COUNT) % TOPIC_COUNT;
    const target = current + forwardSteps + EXTRA_LOOPS * TOPIC_COUNT;

    lastBoundary.current = current;

    const finish = () => {
      setSpinning(false);
      setLandedPulse((p) => p + 1);
      playRevealChime();
      onLanded(topic);

      // Silently recenter: RECENTER_BASE + topicIndex shows the identical row
      // (the strip repeats every TOPIC_COUNT rows) but keeps the index small
      // for the next spin.
      const resting = RECENTER_BASE + topicIndex;
      currentIndex.current = resting;
      y.set(yForIndex(resting));
    };

    if (reducedMotion) {
      y.set(yForIndex(target));
      finish();
      return;
    }

    playSpinSound(SPIN_DURATION);
    animate(y, yForIndex(target), {
      duration: SPIN_DURATION,
      ease: [0.12, 0.67, 0.28, 1],
      onUpdate: (v) => {
        const boundary = Math.floor((CENTER_OFFSET - v) / ROW_HEIGHT);
        if (boundary !== lastBoundary.current) {
          lastBoundary.current = boundary;
          playTickSound();
        }
      },
      onComplete: finish,
    });
  };

  return (
    <div className={styles.wheelStage}>
      <div className={`${styles.reelHousing} ${spinning ? styles.reelHousingActive : ''}`}>
        <SlotReel y={y} landedPulse={landedPulse} />
        <LeverHandle onPull={spin} disabled={spinning} />
      </div>
    </div>
  );
}
