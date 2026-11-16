'use client';

import React, { useMemo, useSyncExternalStore } from 'react';
import { LayoutGroup, MotionConfig } from 'framer-motion';
import { COUNCIL_LIMITS } from '@/lib/council/contract';
import { STARTERS } from '@/data/council/starters';
import { CouncilIntroComponent, CouncilScene } from './CouncilScene';
import { buildDemoState, isDemoName } from './demo';
import { useLocationSearch } from './hooks';
import { CouncilIntro, hasSeenCouncilIntro } from './intro';
import { endFirstVisit, readFirstVisit } from './introLatch';
import { CouncilState, initialCouncilState } from './state/reducer';
import { CouncilTransports } from './state/useCouncil';
import { createFixtureTransport, createSimulatedLiveTransport } from './transport/fixture';
import { liveTransport } from './transport/live';

export interface CouncilExperienceProps {
  /**
   * Override for the intro overlay. Left out, the real intro plays once, on a
   * first visit. Passed in (the dev page does this), it plays on every load.
   * Either way it shares this LayoutGroup, so stickers it renders with
   * layoutId `council-seat-<seatId>` fly into their seats.
   */
  Intro?: CouncilIntroComponent;
}

// Latched for the page load and released when the intro ends: see introLatch.ts.
const readFirstVisitSnapshot = () => readFirstVisit(hasSeenCouncilIntro);
const subscribeNever = () => () => {};

/**
 * The /council page. Reads two URL switches:
 *   ?fixtures=1          no network at all: curated replies, simulated quota.
 *   ?fixtures=1&demo=X   start in a named state (see demo.ts). Ignored without fixtures=1.
 */
export function CouncilExperience({ Intro }: CouncilExperienceProps) {
  const search = useLocationSearch();
  const params = useMemo(() => new URLSearchParams(search ?? ''), [search]);
  const fixtures = params.get('fixtures') === '1';
  const demoParam = params.get('demo');
  const demo = fixtures && isDemoName(demoParam) ? demoParam : null;
  // null on the server and during hydration: storage is only readable on the client.
  const isFirstVisit = useSyncExternalStore(subscribeNever, readFirstVisitSnapshot, () => null);

  const transports = useMemo<CouncilTransports>(() => {
    const fixture = createFixtureTransport(STARTERS);
    return { fixture, live: fixtures ? createSimulatedLiveTransport(STARTERS) : liveTransport };
  }, [fixtures]);

  const initialState = useMemo<CouncilState | null>(() => {
    if (!fixtures) return null;
    return (
      (demo && buildDemoState(demo, STARTERS)) || {
        ...initialCouncilState,
        live: 'available',
        visitorLeft: COUNCIL_LIMITS.visitorDailyGenerations,
      }
    );
  }, [fixtures, demo]);

  return (
    // reducedMotion="user": with the OS setting on, framer drops transform and
    // layout animation and keeps opacity, so every state still cross-fades.
    <MotionConfig reducedMotion="user">
      <LayoutGroup id="council">
        <CouncilScene
          // Fixtures mode starts from a different state, so it gets its own instance.
          key={fixtures ? `fixtures-${demo ?? 'plain'}` : 'live'}
          transports={transports}
          forceFixtures={fixtures}
          holdStatus={search === null}
          initialState={initialState}
          // Fixtures mode is for deterministic screenshots and tests: no intro.
          Intro={fixtures ? undefined : (Intro ?? CouncilIntro)}
          introOnLoad={Intro ? true : isFirstVisit}
          onIntroEnd={endFirstVisit}
        />
      </LayoutGroup>
    </MotionConfig>
  );
}
