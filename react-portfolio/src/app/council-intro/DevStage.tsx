'use client';

import React, { createContext, useContext, useState } from 'react';
import dynamic from 'next/dynamic';
import { LayoutGroup, motion } from 'framer-motion';
import { SEAT_LIST } from '@/data/council/seats';
import { SeatPortrait } from '@/components/council/portraits';
import { CouncilIntro, CouncilIntroProps, hasSeenCouncilIntro } from '@/components/council/intro';
import { sceneSeatSize } from '@/components/council/intro/layout';
import styles from './dev.module.css';

interface DevOptions {
  startStep: number;
  exit: 'handoff' | 'fade';
  replay: boolean;
}

const DevOptionsContext = createContext<DevOptions>({ startStep: 0, exit: 'handoff', replay: false });

/** The intro as the scene mounts it: only onDone comes from the scene, the rest from the URL. */
function SceneIntro({ onDone }: Pick<CouncilIntroProps, 'onDone'>) {
  const options = useContext(DevOptionsContext);
  return <CouncilIntro onDone={onDone} {...options} />;
}

// Loaded only for ?scene=1, so the stand-in keeps working while the scene is mid-edit.
const RealScene = dynamic(
  () =>
    import('@/components/council/CouncilExperience').then(({ CouncilExperience }) => {
      return function WithIntro() {
        return <CouncilExperience Intro={SceneIntro} />;
      };
    }),
  { ssr: false },
);

const SPRING = { type: 'spring', stiffness: 380, damping: 36, mass: 1 } as const;

/** A stand-in for the scene: six seats with the scene's layoutIds, so the handoff can be watched without it. */
function StandIn({ how, onReplay }: { how: string | null; onReplay: () => void }) {
  const [size] = useState(() => (typeof window === 'undefined' ? 124 : sceneSeatSize(window.innerWidth)));
  return (
    <div className={styles.scroll}>
      <main className={styles.page}>
        <p className={styles.note}>
          stand-in scene · ended: {how ?? 'not yet'} · seen flag: {String(how !== null && hasSeenCouncilIntro())}
        </p>
        <h1 className={styles.heading}>A few ways to see it.</h1>
        <div className={styles.seats}>
          {how !== null &&
            SEAT_LIST.map((seat, i) => (
              <motion.div
                key={seat.id}
                className={styles.seat}
                layout
                layoutId={`council-seat-${seat.id}`}
                transition={{ layout: { ...SPRING, delay: i * 0.018 } }}
              >
                <span className={styles.portrait}>
                  <SeatPortrait seatId={seat.id} size={size} mood="idle" />
                </span>
                <span className={styles.tag}>{seat.lensLabel}</span>
              </motion.div>
            ))}
        </div>
        <div className={styles.card}>What are you trying to make sense of?</div>
        <button type="button" className={styles.replay} onClick={onReplay}>
          Meet the council again
        </button>
      </main>
    </div>
  );
}

export function DevStage({ scene, ...options }: DevOptions & { scene: boolean }) {
  const [run, setRun] = useState(0);
  const [how, setHow] = useState<string | null>(null);
  const open = how === null;

  if (scene) {
    return (
      <DevOptionsContext.Provider value={options}>
        <RealScene />
      </DevOptionsContext.Provider>
    );
  }

  return (
    <LayoutGroup id="council">
      <div className={styles.board} aria-hidden="true" />
      <StandIn
        how={how}
        onReplay={() => {
          setHow(null);
          setRun((count) => count + 1);
        }}
      />
      {open && <CouncilIntro key={run} onDone={setHow} {...options} replay={options.replay || run > 0} />}
    </LayoutGroup>
  );
}
