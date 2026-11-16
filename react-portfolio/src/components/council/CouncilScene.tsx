'use client';

import React, { useCallback, useEffect, useId, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import { SeatId } from '@/lib/council/contract';
import { COUNCIL_COPY } from '@/data/council/copy';
import { SEATS } from '@/data/council/seats';
import { STARTERS } from '@/data/council/starters';
import { CouncilSeats } from './CouncilSeats';
import { StopIcon } from './doodles';
import { feedback } from './feedback';
import { useFeelMuted } from './feel';
import { formatResetAt, useEscape, useMediaQuery, usePrefersReducedMotion } from './hooks';
import { DURATIONS, FADE, FADE_OUT, SPRINGS, STAGGER } from './motion';
import { MoveTray } from './MoveTray';
import { Asked, Composer, NewQuestionButton } from './QuestionCard';
import { StancePager } from './StanceCard';
import { StarterQuestions } from './StarterQuestions';
import { Announcement, CouncilState } from './state/reducer';
import {
  LiveNotice,
  activeExchange,
  canAskLive,
  hasThread,
  isBusy,
  liveNotice,
  scenePhase,
  seatMoods,
  streamingTurn,
  unspokenSeatIds,
} from './state/selectors';
import { CouncilTransports, useCouncil } from './state/useCouncil';
import { Transcript } from './Transcript';
import styles from './council.module.css';

const COPY = COUNCIL_COPY.scene;

const subscribeOnline = (onChange: () => void) => {
  window.addEventListener('online', onChange);
  window.addEventListener('offline', onChange);
  return () => {
    window.removeEventListener('online', onChange);
    window.removeEventListener('offline', onChange);
  };
};

function noticeText(notice: LiveNotice, resetAt: string | null): string {
  const base =
    notice === 'visitor_limit'
      ? COUNCIL_COPY.limits.visitorDone
      : notice === 'budget_exhausted'
        ? COUNCIL_COPY.errors.budget_exhausted
        : COUNCIL_COPY.errors.live_disabled;
  const time = notice === 'live_disabled' ? null : formatResetAt(resetAt);
  return time ? `${base} ${COUNCIL_COPY.resetAt(time)}` : base;
}

/** The words for the polite live region. One sentence or two per finished event, never per token. */
function announcementText(announce: Announcement | null, state: CouncilState): string {
  if (!announce) return '';
  const copy = COUNCIL_COPY.announce;
  const replied = (turnId: string | null): string => {
    const turn = state.turns.find((candidate) => candidate.id === turnId);
    if (!turn) return '';
    if (turn.seatId) return copy.replied(SEATS[turn.seatId].lensLabel);
    // An unattributed reply is only a "summary of where they differ" when that was asked for.
    return turn.action === 'differ' ? copy.synthesisReady : '';
  };
  switch (announce.kind) {
    case 'seat':
      return copy.seatSelected(SEATS[announce.seatId].lensLabel);
    case 'council':
      return copy.councilSelected;
    case 'routed':
      return copy.routed(announce.seatIds.map((seatId) => SEATS[seatId].lensLabel).join(', '));
    case 'replied':
      return replied(announce.turnId);
    case 'done': {
      const asksBack = state.exchanges[state.exchanges.length - 1]?.followUpQuestion;
      return [replied(announce.turnId), asksBack ? copy.followUpQuestion : '', announce.threadEnded ? copy.threadEnded : copy.allReplied]
        .filter(Boolean)
        .join(' ');
    }
    case 'stopped':
      return copy.stopped;
    case 'newQuestion':
      return copy.newQuestion;
  }
}

export type CouncilIntroComponent = React.ComponentType<{ onDone: () => void; replay?: boolean }>;

export interface CouncilSceneProps {
  transports: CouncilTransports;
  forceFixtures: boolean;
  holdStatus: boolean;
  initialState: CouncilState | null;
  /**
   * Optional first-visit overlay. While it is on screen the seats are not
   * mounted, so the overlay can render its own stickers with
   * layoutId `council-seat-<seatId>` and hand them off into the arc by
   * calling onDone.
   */
  Intro?: CouncilIntroComponent;
  /** Whether the intro plays on load: true, false, or null while that is not known yet (before hydration). */
  introOnLoad: boolean | null;
  /** Called once when the intro ends, finished or skipped. */
  onIntroEnd?: () => void;
}

export function CouncilScene({
  transports,
  forceFixtures,
  holdStatus,
  initialState,
  Intro,
  introOnLoad,
  onIntroEnd,
}: CouncilSceneProps) {
  const council = useCouncil({ starters: STARTERS, transports, forceFixtures, holdStatus, initialState });
  const { state, options } = council;

  const thread = hasThread(state);
  const busy = isBusy(state);
  const phase = scenePhase(state);
  const notice = liveNotice(state);
  const exchange = activeExchange(state);
  const speaking = streamingTurn(state);
  const selectedSeat = state.selectedSeatId ? SEATS[state.selectedSeatId] : null;
  const hasReplies = state.turns.some((turn) => turn.role !== 'visitor' && turn.text.trim() !== '');

  // 'auto' defers to introOnLoad. Finishing or skipping moves to 'done', and
  // the replay control moves to 'replay'.
  const [introPhase, setIntroPhase] = useState<'auto' | 'done' | 'replay'>('auto');
  const introPlaying = !!Intro && (introPhase === 'replay' || (introPhase === 'auto' && introOnLoad === true));
  const introUndecided = !!Intro && introPhase === 'auto' && introOnLoad === null;
  const introDone = !introPlaying && !introUndecided;
  const [muted, setMuted] = useFeelMuted();
  const replayRef = useRef<HTMLButtonElement>(null);
  const [challenged, setChallenged] = useState<SeatId | null>(null);
  const [nudge, setNudge] = useState(0);
  const challengeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const scrollRef = useRef<HTMLDivElement>(null);
  const seatsRef = useRef<HTMLDivElement>(null);
  const stanceId = useId();

  const reduced = usePrefersReducedMotion();
  const compact = useMediaQuery('(max-width: 768px)');
  const narrow = useMediaQuery('(max-width: 359px)');
  const mid = useMediaQuery('(max-width: 1100px)');
  const online = useSyncExternalStore(
    subscribeOnline,
    () => navigator.onLine,
    () => true,
  );

  const seatSize = thread ? (compact ? 40 : 54) : compact ? (narrow ? 70 : 86) : mid ? 104 : 124;
  const notePortrait = compact ? 56 : 72;
  const moods = useMemo(() => seatMoods(state, challenged), [state, challenged]);

  useEffect(() => () => clearTimeout(challengeTimer.current), []);

  // Starting a thread brings the bench and the question into view. A follow-up
  // brings its own first note into view. After that the page is never moved
  // for the reader: notes only grow downward.
  const exchangeCount = state.exchanges.length;
  const seenExchanges = useRef(exchangeCount);
  useEffect(() => {
    // Only a new exchange moves the page. A thread that was already there on mount does not.
    if (seenExchanges.current === exchangeCount) return;
    seenExchanges.current = exchangeCount;
    const scroller = scrollRef.current;
    if (!scroller || exchangeCount === 0) return;
    const behavior: ScrollBehavior = reduced ? 'auto' : 'smooth';
    if (exchangeCount === 1) {
      scroller.scrollTo({ top: 0, behavior });
      return;
    }
    const sections = scroller.querySelectorAll<HTMLElement>('[data-exchange]');
    sections[sections.length - 1]?.scrollIntoView({ block: 'start', behavior });
  }, [exchangeCount, reduced]);

  // Sending unmounts whatever was focused (the composer, a tray button), which
  // would drop keyboard and screen-reader users at the top of the document.
  // Hand focus to Stop while the council replies, then to what it said. Focus
  // is only moved when it has nowhere to be, never taken from where the
  // visitor put it.
  const wasBusy = useRef(busy);
  useEffect(() => {
    if (wasBusy.current === busy) return;
    wasBusy.current = busy;
    const active = document.activeElement;
    if (active && active !== document.body && active.isConnected) return;
    const scroller = scrollRef.current;
    if (!scroller) return;
    const target = busy
      ? scroller.querySelector<HTMLElement>('[data-stop]')
      : (Array.from(scroller.querySelectorAll<HTMLElement>('[data-exchange]')).pop() ??
        scroller.querySelector<HTMLElement>('textarea'));
    target?.focus({ preventScroll: true });
  }, [busy]);

  // Sound and haptics follow the stream, on the event that caused them.
  const speakingId = speaking?.id ?? null;
  useEffect(() => {
    if (speakingId) feedback('turnStart');
  }, [speakingId]);
  const announceSeq = state.announce?.seq ?? 0;
  const announceKind = state.announce?.kind;
  useEffect(() => {
    if (announceKind === 'replied') feedback('turnEnd');
  }, [announceSeq, announceKind]);
  const errorCode = state.error?.code ?? null;
  useEffect(() => {
    if (errorCode) feedback('error');
  }, [errorCode]);
  useEffect(() => {
    if (notice) feedback('limit');
  }, [notice]);

  const { selectSeat } = council;
  const onSelectSeat = useCallback(
    (seatId: SeatId) => {
      feedback('select');
      selectSeat(state.selectedSeatId === seatId ? null : seatId);
    },
    [selectSeat, state.selectedSeatId],
  );

  const clearSeat = useCallback(() => {
    feedback('select');
    selectSeat(null);
  }, [selectSeat]);

  const closeStance = useCallback(() => {
    const seatId = state.selectedSeatId;
    selectSeat(null);
    if (seatId) seatsRef.current?.querySelector<HTMLButtonElement>(`button[data-seat="${seatId}"]`)?.focus();
  }, [selectSeat, state.selectedSeatId]);
  const stanceOpen = thread && selectedSeat !== null;
  useEscape(stanceOpen, closeStance);

  // In a thread the stance card hangs from the bench like a popover: a press anywhere else puts it away.
  useEffect(() => {
    if (!stanceOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!seatsRef.current?.contains(event.target as Node)) selectSeat(null);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [stanceOpen, selectSeat]);

  const onAsk = () => {
    if (council.ask() === 'sent') feedback('send');
    else onBlocked();
  };
  const onBlocked = () => {
    feedback('limit');
    setNudge((value) => value + 1);
  };
  const onStarter = (starterId: string) => {
    if (council.askStarter(starterId) === 'sent') feedback('send');
  };
  const onSendPushBack = () => {
    const seatId = state.pushBack?.seatId ?? null;
    const result = council.sendPushBack();
    if (result === 'sent' && seatId) {
      feedback('challenge');
      // One wobble, then the seat goes back to thinking about its answer.
      setChallenged(seatId);
      clearTimeout(challengeTimer.current);
      challengeTimer.current = setTimeout(() => setChallenged(null), DURATIONS.challengedMs);
    }
    return result;
  };
  const sent = <T extends unknown[]>(run: (...args: T) => 'sent' | 'blocked') => (...args: T) => {
    const result = run(...args);
    if (result === 'sent') feedback('send');
    return result;
  };
  const onStop = () => {
    feedback('stop');
    council.stop();
  };
  const onIntroDone = () => {
    const wasReplay = introPhase === 'replay';
    setIntroPhase('done');
    onIntroEnd?.();
    // The intro trapped focus and is gone. Put it somewhere sensible: back on
    // the control that opened a replay, or in the composer on a first visit
    // (not on a phone, where that would throw the keyboard up unasked).
    requestAnimationFrame(() => {
      if (wasReplay) replayRef.current?.focus({ preventScroll: true });
      else if (!compact) scrollRef.current?.querySelector<HTMLElement>('textarea')?.focus({ preventScroll: true });
    });
  };
  const onReplayIntro = () => {
    // The handoff flight is only exact with the scroller at the top: the intro
    // is a fixed overlay and the seats live in scrolled content.
    scrollRef.current?.scrollTo({ top: 0, behavior: 'auto' });
    setIntroPhase('replay');
  };
  const onReset = () => {
    council.reset();
    scrollRef.current?.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' });
    // Ready to type again. Not on a phone, where focus would throw the keyboard up unasked.
    if (!compact) requestAnimationFrame(() => scrollRef.current?.querySelector<HTMLElement>('textarea')?.focus({ preventScroll: true }));
  };

  // What the bench says under the seats.
  let statusText: string | null = null;
  if (busy) {
    // Only "Where do we differ?" is a comparison. Any other reply with no seat
    // is the council answering as one (an off-topic or a sensitive question),
    // and saying it is "working out where they differ" would be wrong.
    const asOne = exchange?.action === 'differ' ? COUNCIL_COPY.status.synthesizing : COUNCIL_COPY.status.council;
    if (phase === 'routing') statusText = COUNCIL_COPY.status.routing;
    else if (speaking) statusText = speaking.seatId ? COUNCIL_COPY.status.speaking(SEATS[speaking.seatId].figure) : asOne;
    else {
      const waiting = exchange?.expectedSeatIds.find(
        (seatId) => !state.turns.some((turn) => turn.exchangeId === exchange.id && turn.seatId === seatId),
      );
      statusText = waiting ? COUNCIL_COPY.status.thinking(SEATS[waiting].figure) : asOne;
    }
  } else if (thread && (options.live || state.exchangesLeft === 0)) {
    statusText = COPY.exchangesLeft(state.exchangesLeft);
  }

  // Asking again only needs a second thought when something would be lost.
  const confirmBody = state.pushBack?.text.trim()
    ? COUNCIL_COPY.confirmNew.bodyDraft
    : busy || options.any
      ? COUNCIL_COPY.confirmNew.body
      : null;

  const trayTitle = options.live
    ? COUNCIL_COPY.limits.oneLeft
    : state.exchangesLeft === 0
      ? COUNCIL_COPY.limits.threadEnded
      : notice
        ? noticeText(notice, state.resetAt)
        : COUNCIL_COPY.limits.explain;
  const trayNote = options.live ? COUNCIL_COPY.limits.explain : null;

  const errorNote = state.error && (
    <motion.div
      key="error"
      className={styles.slip}
      data-tone="error"
      role="alert"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, transition: FADE_OUT }}
      transition={SPRINGS.surface}
    >
      <p>{online ? COUNCIL_COPY.errors[state.error.code] : COUNCIL_COPY.offline}</p>
      <div className={styles.slipActions}>
        {state.error.retryable && state.error.intent && (
          <button type="button" className={styles.inkButton} onClick={sent(council.retry)}>
            {COUNCIL_COPY.retry}
          </button>
        )}
      </div>
    </motion.div>
  );

  return (
    <>
      <div className={styles.board} aria-hidden="true" />
      {Intro && introPlaying && <Intro replay={introPhase === 'replay'} onDone={onIntroDone} />}

      {/* layoutScroll: the seats' arc-to-bench move is measured inside this scroller. */}
      <motion.div className={styles.scroll} ref={scrollRef} layoutScroll data-council-scroll>
        <div className={styles.page} data-mode={thread ? 'thread' : 'empty'}>
          <Link className={styles.brand} href="/" aria-label={COPY.brandAria}>
            <span className={styles.brandName}>rohan</span>
            <span className={styles.brandDot} />
          </Link>

          <header className={styles.hero}>
            <Link className={styles.backLink} href="/">
              {COPY.backToBoard}
            </Link>
            <h1 className={styles.title}>{COPY.heading}</h1>
            <p className={styles.intro}>{COPY.intro}</p>
            {/* On a phone the footer is two screens down, so the disclosure also sits here (CSS shows one or the other). */}
            <p className={styles.heroDisclosure}>{COPY.disclosure}</p>
          </header>

          <main className={styles.table}>
            <div ref={seatsRef} className={styles.seatsAnchor} data-arrangement={thread ? 'bench' : 'arc'}>
              {!introDone && (
                <CouncilSeats key="ghost" ghost arrangement="arc" size={seatSize} selectedSeatId={null} moods={moods} onSelect={selectSeat} />
              )}
              {introDone && (
                <CouncilSeats
                  key="live"
                  arrangement={thread ? 'bench' : 'arc'}
                  size={seatSize}
                  selectedSeatId={state.selectedSeatId}
                  moods={moods}
                  onSelect={onSelectSeat}
                  controls={thread ? stanceId : undefined}
                  status={
                    statusText || busy ? (
                      <>
                        <span className={styles.statusText} data-busy={busy || undefined}>
                          {statusText}
                        </span>
                        {busy && (
                          <button type="button" className={styles.stop} onClick={onStop} data-stop>
                            <StopIcon />
                            {COPY.stop}
                          </button>
                        )}
                      </>
                    ) : null
                  }
                >
                  <AnimatePresence>
                    {stanceOpen && state.selectedSeatId && (
                      <motion.div
                        key="stance"
                        className={styles.stancePopover}
                        initial={{ opacity: 0, y: -8, scale: 0.97 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.98, transition: FADE_OUT }}
                        transition={SPRINGS.surface}
                      >
                        <StancePager
                          id={stanceId}
                          seatId={state.selectedSeatId}
                          variant="popover"
                          onChange={selectSeat}
                          onDismiss={closeStance}
                        />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </CouncilSeats>
              )}
            </div>

            <motion.div
              className={styles.card}
              data-mode={thread ? 'asked' : 'compose'}
              layout="position"
              layoutDependency={thread}
              transition={{ layout: SPRINGS.surface }}
            >
              {thread ? (
                <Asked
                  question={state.question}
                  seat={state.askedSeatId ? SEATS[state.askedSeatId] : null}
                  newQuestion={
                    <NewQuestionButton label={COPY.newQuestion} variant="ghost" confirmBody={confirmBody} onConfirm={onReset} />
                  }
                />
              ) : (
                <Composer
                  draft={state.draft}
                  seat={selectedSeat}
                  visitorLeft={state.live === 'available' ? state.visitorLeft : null}
                  canSend={canAskLive(state)}
                  onDraft={council.setDraft}
                  onClearSeat={clearSeat}
                  onSubmit={onAsk}
                  onBlocked={onBlocked}
                />
              )}
            </motion.div>

            {!thread && (
              <div className={styles.below}>
                <AnimatePresence initial={false}>
                  {errorNote}
                  {notice && !state.error && (
                    <motion.p
                      key="notice"
                      className={styles.slip}
                      role="status"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, transition: FADE_OUT }}
                      transition={SPRINGS.surface}
                    >
                      {noticeText(notice, state.resetAt)}
                    </motion.p>
                  )}
                </AnimatePresence>

                <AnimatePresence mode="popLayout" initial={false}>
                  {state.selectedSeatId ? (
                    <motion.div
                      key="stance"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, transition: FADE_OUT }}
                      transition={SPRINGS.surface}
                    >
                      <StancePager
                        id={stanceId}
                        seatId={state.selectedSeatId}
                        variant="tray"
                        onChange={selectSeat}
                        onDismiss={clearSeat}
                      />
                    </motion.div>
                  ) : (
                    <motion.div
                      key="starters"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, transition: FADE_OUT }}
                      transition={SPRINGS.surface}
                    >
                      <StarterQuestions starters={STARTERS} worksOffline={notice !== null} nudge={nudge} onPick={onStarter} />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            {thread && (
              <>
                <Transcript
                  exchanges={state.exchanges}
                  turns={state.turns}
                  activeExchangeId={exchange?.id ?? null}
                  moods={moods}
                  focusedSeatId={state.selectedSeatId}
                  portraitSize={notePortrait}
                />

                <AnimatePresence initial={false}>{errorNote}</AnimatePresence>

                {!busy && hasReplies && (
                  <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ ...FADE, delay: STAGGER.trayAfterNotes }}>
                    <MoveTray
                      options={options}
                      unspokenSeatIds={unspokenSeatIds(state)}
                      selectedSeatId={state.selectedSeatId}
                      pushBack={state.pushBack}
                      title={trayTitle}
                      note={trayNote}
                      onOpenPushBack={council.openPushBack}
                      onPushBackText={council.setPushBack}
                      onClosePushBack={council.closePushBack}
                      onSendPushBack={onSendPushBack}
                      onSayMore={sent(council.sayMore)}
                      onDebate={sent(council.debate)}
                      onDiffer={sent(council.differ)}
                      onHearEveryone={sent(council.hearEveryone)}
                      inline={compact}
                      ticketsLabel={options.live ? null : COPY.scripted}
                      lead={
                        options.live ? null : (
                          <div className={styles.trayLead}>
                            <NewQuestionButton
                              label={COUNCIL_COPY.limits.threadEndedAction}
                              variant="primary"
                              confirmBody={confirmBody}
                              onConfirm={onReset}
                            />
                          </div>
                        )
                      }
                    >
                      {!options.live && (
                        <div className={styles.trayEnd}>
                          <StarterQuestions
                            starters={STARTERS}
                            excludeId={state.starterId}
                            worksOffline={notice !== null}
                            onPick={onStarter}
                          />
                        </div>
                      )}
                    </MoveTray>
                  </motion.div>
                )}
              </>
            )}
          </main>

          <footer className={styles.footer}>
            <p className={styles.footerDisclosure}>{COPY.disclosure}</p>
            <p>{COUNCIL_COPY.support}</p>
            <p className={styles.footerLinks}>
              {/* A new tab, so reading it never costs the visitor a draft or a conversation. */}
              <a href="/council/privacy" target="_blank" rel="noopener noreferrer">
                {COPY.privacyLink}
                <span className="sr-only"> ({COUNCIL_COPY.opensInNewTab})</span>
              </a>
              {Intro && !thread && (
                <button type="button" ref={replayRef} className={styles.footerButton} onClick={onReplayIntro}>
                  {COUNCIL_COPY.intro.replay}
                </button>
              )}
              <button
                type="button"
                className={styles.footerButton}
                aria-pressed={!muted}
                onClick={() => setMuted(!muted)}
              >
                {muted ? COPY.soundOff : COPY.soundOn}
              </button>
            </p>
          </footer>
        </div>
      </motion.div>

      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {announcementText(state.announce, state)}
      </div>
    </>
  );
}
