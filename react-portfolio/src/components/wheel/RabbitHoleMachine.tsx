'use client';

import React, { useRef, useState } from 'react';
import { animate, MotionValue, useMotionValue } from 'framer-motion';
import { WheelTopicFlat } from '@/types';
import { WHEEL_CATEGORIES, WHEEL_TOPICS } from '@/data/wheelTopics';
import { RABBIT_HOLE_MODES } from '@/data/rabbitHoleModes';
import { useAudio } from '@/hooks/useAudio';
import { useMotion } from '@/hooks/useMotion';
import { Reel, rowAt, yFor } from './Reel';
import { LeverHandle } from './LeverHandle';
import { Ticket } from './Ticket';
import styles from './wheel.module.css';

type ReelKey = 'subject' | 'topic' | 'mode';
type Held = Record<ReelKey, boolean>;
type Pins = Map<number, WheelTopicFlat>;

export interface Combo {
  subject: number;
  topic: WheelTopicFlat;
  mode: number;
}

const SUBJECTS = WHEEL_CATEGORIES.length;
const MODES = RABBIT_HOLE_MODES.length;
const TOPICS_BY_SUBJECT = WHEEL_CATEGORIES.map((c) => WHEEL_TOPICS.filter((t) => t.categoryId === c.id));

// Reels stop left to right, like a real machine.
const SPIN = { subject: 1.4, topic: 2.1, mode: 2.8 };
const EASE = [0.16, 0.7, 0.24, 1] as const;
const TOPIC_TRAVEL = 30;

const mod = (n: number, m: number) => ((n % m) + m) % m;
const pickOther = (count: number, current: number) => mod(current + 1 + Math.floor(Math.random() * (count - 1)), count);
// While it spins, the topic reel shows a scatter of every topic, offset per pull
// so no two spins blur past the same rows.
const scatter = (i: number) => WHEEL_TOPICS[((i * 2654435761) >>> 0) % WHEEL_TOPICS.length];

/** The landed topic and the two rows around it, all from the landed subject, so the reel never contradicts itself. */
function pinAround(pins: Pins, row: number, topic: WheelTopicFlat, subject: number, salt: number) {
  const others = TOPICS_BY_SUBJECT[subject].filter((t) => t.id !== topic.id);
  pins.set(row - 1, others[mod(salt, others.length)]);
  pins.set(row, topic);
  pins.set(row + 1, others[mod(salt + 7, others.length)]);
  return pins;
}

/** First row at least `loops` turns ahead of `from` that shows item `want` on a reel of `count` items. */
function aheadTo(from: number, want: number, count: number, loops: number) {
  return from + mod(want - mod(from, count), count) + loops * count;
}

const LABELS: Record<ReelKey, string> = { subject: 'Subject', topic: 'Topic', mode: 'How to learn it' };

interface MachineProps {
  initial: Combo;
  /** A shared link arrives with its ticket already printed. */
  printed: boolean;
}

export function RabbitHoleMachine({ initial, printed }: MachineProps) {
  const [combo, setCombo] = useState(initial);
  const [held, setHeld] = useState<Held>({ subject: false, topic: false, mode: false });
  const [spinning, setSpinning] = useState(false);
  const [printKey, setPrintKey] = useState(printed ? 1 : 0);
  const [note, setNote] = useState('');
  const [seed, setSeed] = useState(0);
  const [pins, setPins] = useState<Pins>(() => pinAround(new Map(), 0, initial.topic, initial.subject, 0));

  const at = useRef<Record<ReelKey, number>>({ subject: initial.subject, topic: 0, mode: initial.mode });
  const ys: Record<ReelKey, MotionValue<number>> = {
    subject: useMotionValue(yFor(initial.subject)),
    topic: useMotionValue(0),
    mode: useMotionValue(yFor(initial.mode)),
  };
  const lastTick = useRef(0);
  const trayRef = useRef<HTMLDivElement>(null);

  const { playSpinSound, playTickSound, playRevealChime, playTapSound, triggerHaptic } = useAudio();
  const { reducedMotion } = useMotion();

  const tick = () => {
    const now = performance.now();
    if (now - lastTick.current < 45) return;
    lastTick.current = now;
    playTickSound();
  };

  const roll = (key: ReelKey, target: number) =>
    new Promise<void>((resolve) => {
      at.current[key] = target;
      const y = ys[key];
      if (reducedMotion) {
        y.set(yFor(target));
        resolve();
        return;
      }
      let row = rowAt(y.get());
      animate(y, yFor(target), {
        duration: SPIN[key],
        ease: EASE,
        onUpdate: (v) => {
          const r = rowAt(v);
          if (r !== row) {
            row = r;
            tick();
          }
        },
        onComplete: () => {
          playTapSound();
          triggerHaptic(8);
          resolve();
        },
      });
    });

  const spin = () => {
    if (spinning) return;
    if (held.subject && held.topic && held.mode) {
      setNote('Everything is held. Let go of a reel to spin.');
      return;
    }
    setNote('');

    const subject = held.subject ? combo.subject : pickOther(SUBJECTS, combo.subject);
    const pool = TOPICS_BY_SUBJECT[subject];
    let topic = combo.topic;
    if (!held.topic) {
      const i = Math.floor(Math.random() * pool.length);
      topic = pool[i].id === combo.topic.id ? pool[(i + 1) % pool.length] : pool[i];
    }
    const mode = held.mode ? combo.mode : pickOther(MODES, combo.mode);

    const rolls: Promise<void>[] = [];
    if (!held.subject) rolls.push(roll('subject', aheadTo(at.current.subject, subject, SUBJECTS, 3)));
    if (!held.topic) {
      const from = at.current.topic;
      const to = from + TOPIC_TRAVEL;
      // Keep the rows in view as they are, pin the landing, scatter everything between.
      const next: Pins = new Map();
      for (let r = from - 2; r <= from + 2; r++) {
        const keep = pins.get(r);
        next.set(r, keep ?? scatter(r + seed));
      }
      setSeed(Math.floor(Math.random() * 100000));
      setPins(pinAround(next, to, topic, subject, Math.floor(Math.random() * 1000)));
      rolls.push(roll('topic', to));
    }
    if (!held.mode) rolls.push(roll('mode', aheadTo(at.current.mode, mode, MODES, 3)));

    setSpinning(true);
    if (!reducedMotion) playSpinSound(held.mode ? (held.topic ? SPIN.subject : SPIN.topic) : SPIN.mode);

    Promise.all(rolls).then(() => {
      setCombo({ subject, topic, mode });
      setSpinning(false);
      setPrintKey((k) => k + 1);
      playRevealChime();
      // Bring the ticket into view once it has printed; on short screens it lands below the fold.
      requestAnimationFrame(() =>
        requestAnimationFrame(() =>
          trayRef.current?.scrollIntoView({
            // Phones bring the ticket up under the pinned mark; desktops scroll only as far as needed.
            block: window.matchMedia('(max-width: 768px)').matches ? 'start' : 'nearest',
            behavior: reducedMotion ? 'auto' : 'smooth',
          })
        )
      );
    });
  };

  // Holding the topic holds its subject too: the topic only exists inside it.
  const toggle = (key: ReelKey) =>
    setHeld((h) => {
      const on = !h[key];
      if (key === 'topic') return { ...h, topic: on, subject: on ? true : h.subject };
      if (key === 'subject') return { ...h, subject: on, topic: on ? h.topic : false };
      return { ...h, mode: on };
    });

  const itemAt: Record<ReelKey, (i: number) => React.ReactNode> = {
    subject: (i) => {
      const c = WHEEL_CATEGORIES[mod(i, SUBJECTS)];
      return (
        <>
          <span className={styles.subjectDot} style={{ background: c.color }} />
          {c.label}
        </>
      );
    },
    topic: (i) => (pins.get(i) ?? scatter(i + seed)).text,
    mode: (i) => RABBIT_HOLE_MODES[mod(i, MODES)].label,
  };

  const reel = (key: ReelKey) => (
    <div className={styles.reelCol}>
      <span className={styles.reelLabel}>{LABELS[key]}</span>
      <Reel y={ys[key]} itemAt={itemAt[key]} />
      <button
        type="button"
        className={`${styles.hold} ${held[key] ? styles.holdOn : ''}`}
        aria-pressed={held[key]}
        aria-label={`Hold the ${LABELS[key].toLowerCase()}`}
        onClick={() => toggle(key)}
      >
        {held[key] ? 'Held' : 'Hold'}
      </button>
    </div>
  );

  const mode = RABBIT_HOLE_MODES[combo.mode];

  return (
    <div className={styles.machineWrap}>
      <section className={styles.machine} aria-label="The topic machine">
        <div className={styles.reels}>
          {reel('subject')}
          {reel('topic')}
          {reel('mode')}
        </div>
        <LeverHandle onPull={spin} disabled={spinning} />
        <div className={styles.slot} aria-hidden="true" />
      </section>

      <p className={styles.srOnly} aria-live="polite">
        {note || (printKey > 0 && !spinning ? `${combo.topic.categoryLabel}. ${combo.topic.text} ${mode.label}.` : '')}
      </p>
      {note && <p className={styles.note}>{note}</p>}

      <div ref={trayRef} className={styles.tray}>
        {printKey > 0 ? (
          <div key={printKey} className={styles.printed}>
            <Ticket topic={combo.topic} mode={mode} />
          </div>
        ) : (
          <p className={styles.trayHint}>Your ticket prints here.</p>
        )}
      </div>
    </div>
  );
}
