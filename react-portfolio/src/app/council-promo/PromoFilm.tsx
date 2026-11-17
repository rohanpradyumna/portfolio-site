'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { LayoutGroup, MotionConfig } from 'framer-motion';
import { COUNCIL_LIMITS } from '@/lib/council/contract';
import { STARTERS } from '@/data/council/starters';
import { CouncilScene } from '@/components/council/CouncilScene';
import { CouncilIntro } from '@/components/council/intro';
import { CouncilState, initialCouncilState } from '@/components/council/state/reducer';
import { CouncilTransports } from '@/components/council/state/useCouncil';
import { createFixtureTransport, createSimulatedLiveTransport } from '@/components/council/transport/fixture';
import { SoundCue, renderWavBase64, startCueLog } from './audio';
import { Captions } from './Captions';
import { Cursor } from './Cursor';
import { FilmChecks, PointerIntent, createDirector, installSmoothScroll } from './director';
import { EndCard } from './EndCard';
import { Opening } from './Opening';
import { FILM_PER_VIRTUAL, FormatId, SEL, filmFor } from './timeline';
import styles from './promo.module.css';

// The promo film's stage. It mounts the real council scene on scripted
// conversations (no network), with the real intro waiting behind a switch,
// and hands the director the surfaces it draws on. The capture harness in
// /video talks to this page through window.__promo.

export interface PromoReport {
  failures: string[];
  checks: FilmChecks;
  cues: SoundCue[];
  introEnded: boolean;
}

export interface PromoApi {
  /** Which cut this page is performing. */
  format: FormatId;
  /** The page size the cut is laid out for. The harness checks its viewport against it. */
  stage: { width: number; height: number };
  /** Resolves when the scene, its fonts and the composer are all there. */
  ready: Promise<void>;
  start: () => void;
  /** Virtual seconds since start(). */
  seconds: () => number;
  /** The script's landmarks in virtual milliseconds, so the harness knows which frames to keep. */
  timeline: {
    durationMs: number;
    filmPerVirtual: number;
    captions: Array<{ id: string; atMs: number }>;
    clicks: Array<{ id: string; atMs: number }>;
    beats: Record<string, number>;
    /** When the intro's scroll leaves for each step and arrives on it. Index 0 is step 1. */
    introLegs: Array<{ step: number; fromMs: number; toMs: number }>;
  };
  /** For a harness with a real mouse: see Director.useRealPointer. */
  useRealPointer: () => void;
  pointer: () => PointerIntent | null;
  report: () => PromoReport;
  /** The logged sound cues rendered offline: a base64 WAV of `filmSeconds` (default: the scripted length). */
  renderAudio: (filmSeconds?: number) => Promise<string>;
}

declare global {
  interface Window {
    __promo?: PromoApi;
  }
}

const START_STATE: CouncilState = {
  ...initialCouncilState,
  live: 'available',
  visitorLeft: COUNCIL_LIMITS.visitorDailyGenerations,
};

/** The real intro, opened as a replay so its paper fades in over the scene instead of cutting. */
function PromoIntro({ onDone }: { onDone: () => void }) {
  return <CouncilIntro replay onDone={onDone} />;
}

export function PromoFilm({ format }: { format: FormatId }) {
  const film = filmFor(format);
  // null keeps the seats as invisible placeholders and the composer usable:
  // the hook types the question before anyone has been introduced.
  const [introOnLoad, setIntroOnLoad] = useState<true | null>(null);
  const transports = useMemo<CouncilTransports>(
    () => ({ fixture: createFixtureTransport(STARTERS), live: createSimulatedLiveTransport(STARTERS) }),
    [],
  );

  const cameraRef = useRef<HTMLDivElement>(null);
  const openingRef = useRef<HTMLDivElement>(null);
  const captionsRef = useRef<HTMLDivElement>(null);
  const dipRef = useRef<HTMLDivElement>(null);
  const pointerRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const mirrorRef = useRef<HTMLDivElement>(null);
  const introEnded = useRef(false);

  useEffect(() => {
    const camera = cameraRef.current;
    const opening = openingRef.current;
    const captions = captionsRef.current;
    const dip = dipRef.current;
    const pointer = pointerRef.current;
    const end = endRef.current;
    const mirror = mirrorRef.current;
    if (!camera || !opening || !captions || !dip || !pointer || !end || !mirror) return;

    const restoreScroll = installSmoothScroll();
    let director: ReturnType<typeof createDirector> | null = null;
    const cues = startCueLog(() => (director ? director.seconds() * 1000 : 0));
    director = createDirector({ camera, opening, captions, dip, pointer, end, mirror, cues, mountIntro: () => setIntroOnLoad(true) }, film);
    const acting = director;
    const { BEATS, CAPTIONS, CLICKS, DURATION, END_CARD, INTRO_LEGS } = film;

    let cancelled = false;
    const ready = (async () => {
      await document.fonts.ready;
      while (!cancelled && !document.querySelector(SEL.composerField)) {
        await new Promise((resolve) => requestAnimationFrame(resolve));
      }
    })();

    window.__promo = {
      format,
      stage: film.STAGE,
      ready,
      start: acting.start,
      seconds: acting.seconds,
      timeline: {
        durationMs: Math.round(DURATION * 1000),
        filmPerVirtual: FILM_PER_VIRTUAL,
        captions: CAPTIONS.map((caption) => ({ id: caption.id, atMs: Math.round(caption.from * 1000) })),
        clicks: CLICKS.map((click) => ({ id: click.id, atMs: Math.round(click.at * 1000) })),
        beats: {
          ...Object.fromEntries(
            Object.entries(BEATS).map(([name, value]) => [name, Math.round((typeof value === 'number' ? value : value.from) * 1000)]),
          ),
          endCardTitle: Math.round((END_CARD.at + END_CARD.titleAt) * 1000),
        },
        introLegs: INTRO_LEGS.map((leg) => ({ step: leg.step, fromMs: Math.round(leg.from * 1000), toMs: Math.round(leg.to * 1000) })),
      },
      useRealPointer: acting.useRealPointer,
      pointer: acting.pointer,
      report: () => ({ failures: acting.failures, checks: acting.checks, cues: cues.cues, introEnded: introEnded.current }),
      renderAudio: (filmSeconds = DURATION * FILM_PER_VIRTUAL) => renderWavBase64(cues.cues, filmSeconds),
    };

    // In an ordinary tab the film simply plays. The harness asks it to wait
    // (?hold=1) so it can stop the clock first.
    let autoplay: ReturnType<typeof setTimeout> | undefined;
    if (!new URLSearchParams(window.location.search).has('hold')) {
      void ready.then(() => {
        if (!cancelled) autoplay = setTimeout(acting.start, 500);
      });
    }

    return () => {
      cancelled = true;
      clearTimeout(autoplay);
      acting.stop();
      cues.stop();
      restoreScroll();
      delete window.__promo;
    };
  }, [film, format]);

  return (
    <div className={styles.film} data-format={format}>
      <div className={styles.camera} ref={cameraRef}>
        <MotionConfig reducedMotion="user">
          <LayoutGroup id="council">
            <CouncilScene
              transports={transports}
              forceFixtures
              holdStatus={false}
              initialState={START_STATE}
              Intro={PromoIntro}
              introOnLoad={introOnLoad}
              onIntroEnd={() => {
                introEnded.current = true;
              }}
            />
          </LayoutGroup>
        </MotionConfig>
      </div>
      <Opening film={film} ref={openingRef} />
      <div className={styles.dip} ref={dipRef} aria-hidden="true" />
      <Captions film={film} ref={captionsRef} />
      <Cursor pointer={film.POINTER} ref={pointerRef} />
      <EndCard film={film} ref={endRef} />
      <div className={styles.mirror} ref={mirrorRef} aria-hidden="true" />
    </div>
  );
}
