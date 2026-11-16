'use client';

import { useCallback, useEffect, useLayoutEffect, useMemo, useReducer, useRef } from 'react';
import {
  COUNCIL_LIMITS,
  CouncilEvent,
  CouncilTransport,
  SeatId,
  Starter,
} from '@/lib/council/contract';
import { fetchCouncilStatus } from '../transport/live';
import { CouncilState, RequestIntent, councilReducer, initialCouncilState } from './reducer';
import { MIN_QUESTION_CHARS } from '../composerHints';
import { buildCouncilRequest } from './request';
import { ThreadOptions, canAskLive, isBusy, threadOptions, unspokenSeatIds } from './selectors';

export interface CouncilTransports {
  live: CouncilTransport;
  fixture: CouncilTransport;
}

export interface UseCouncilOptions {
  starters: Starter[];
  transports: CouncilTransports;
  /**
   * ?fixtures=1: nothing reaches the network. The caller passes a simulated
   * `live` transport and an `initialState` with a full allowance, and the hook
   * skips the status call, so every state can be reached deterministically.
   */
  forceFixtures: boolean;
  /** Set while the URL is still being read, so no status call goes out before fixtures mode is known. */
  holdStatus?: boolean;
  /** A state to start from (the ?demo= states). */
  initialState?: CouncilState | null;
}

export type SendResult = 'sent' | 'blocked';

export interface CouncilController {
  state: CouncilState;
  options: ThreadOptions;
  selectSeat: (seatId: SeatId | null) => void;
  setDraft: (text: string) => void;
  ask: () => SendResult;
  askStarter: (starterId: string) => SendResult;
  openPushBack: (seatId: SeatId, text?: string) => void;
  setPushBack: (text: string) => void;
  closePushBack: () => void;
  sendPushBack: () => SendResult;
  sayMore: (seatId: SeatId) => SendResult;
  debate: (objector: SeatId, addressed: SeatId) => SendResult;
  differ: () => SendResult;
  hearEveryone: () => SendResult;
  stop: () => void;
  reset: () => void;
  retry: () => SendResult;
  dismissError: () => void;
  hydrate: (state: CouncilState) => void;
}

interface Run {
  requestId: string;
  controller: AbortController;
  flush: () => void;
}

const DRAFT_KEY = 'council:draft';

/** sessionStorage can be missing or throw (private modes, blocked storage). The draft then simply is not kept. */
export function readSavedDraft(): string {
  try {
    return window.sessionStorage.getItem(DRAFT_KEY) ?? '';
  } catch {
    return '';
  }
}

export function writeSavedDraft(text: string): void {
  try {
    if (text === '') window.sessionStorage.removeItem(DRAFT_KEY);
    else window.sessionStorage.setItem(DRAFT_KEY, text);
  } catch {
    // Nowhere to keep it. Nothing else depends on it.
  }
}

function uuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  // randomUUID needs a secure context, which a phone on the LAN dev server is not.
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

const sameQuestion = (a: string, b: string) =>
  a.trim().toLowerCase().replace(/[’']/g, "'") === b.trim().toLowerCase().replace(/[’']/g, "'");

export function useCouncil({
  starters,
  transports,
  forceFixtures,
  holdStatus = false,
  initialState = null,
}: UseCouncilOptions): CouncilController {
  const [state, dispatch] = useReducer(councilReducer, initialState ?? initialCouncilState);
  const options = useMemo(() => threadOptions(state, starters), [state, starters]);

  // Callbacks read the latest state through a ref so they stay referentially
  // stable while a reply streams (thirty state changes a second).
  const live = useRef({ state, options, starters, transports });
  useLayoutEffect(() => {
    live.current = { state, options, starters, transports };
  });

  const runRef = useRef<Run | null>(null);

  /**
   * Asks the server again. `afterRequest` is the correction made right after a
   * request failed or was stopped: it fixes the counts but cannot overrule that
   * request's own verdict. A failed call changes nothing.
   */
  const refreshStatus = useCallback((origin: 'check' | 'afterRequest') => {
    fetchCouncilStatus().then((status) => {
      if (status) dispatch({ type: 'status/loaded', status, origin });
    });
  }, []);

  const send = useCallback((intent: RequestIntent, expectedSeatIds: SeatId[]): SendResult => {
    if (runRef.current) return 'blocked';
    const current = live.current;
    const requestId = uuid();
    const controller = new AbortController();

    const request = buildCouncilRequest(current.state, intent, requestId);

    // Deltas can land many times per frame. They are applied once per frame so
    // React renders at most sixty times a second however fast the model talks.
    let queue: CouncilEvent[] = [];
    let frame = 0;
    const flush = () => {
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
      if (queue.length === 0) return;
      const events = queue;
      queue = [];
      dispatch({ type: 'request/events', requestId, events });
    };
    const run: Run = { requestId, controller, flush };
    runRef.current = run;

    dispatch({ type: 'request/start', requestId, exchangeId: `x-${requestId}`, intent, expectedSeatIds });

    const transport = intent.source === 'fixture' ? current.transports.fixture : current.transports.live;

    void (async () => {
      let terminal = false;
      let timedOut = false;
      let queueEndedInError = false;
      // An inactivity watchdog, re-armed by every event: a slow but flowing
      // reply is fine, twenty seconds of silence is not.
      let watchdog: ReturnType<typeof setTimeout> | undefined;
      const arm = () => {
        clearTimeout(watchdog);
        watchdog = setTimeout(() => {
          timedOut = true;
          controller.abort();
        }, COUNCIL_LIMITS.clientTimeoutMs);
      };
      arm();

      try {
        for await (const event of transport(request, controller.signal)) {
          if (controller.signal.aborted) break;
          arm();
          queue.push(event);
          if (event.type === 'done' || event.type === 'error') {
            terminal = true;
            queueEndedInError = event.type === 'error';
            break;
          }
          if (!frame) {
            frame = requestAnimationFrame(() => {
              frame = 0;
              flush();
            });
          }
        }
      } catch {
        // Transports are meant not to throw. If one does, it ends like a dropped stream.
      }
      clearTimeout(watchdog);
      flush();

      // A live request that did not finish cleanly may or may not have been
      // counted against the day. Ask the server rather than guess.
      const failed = !terminal || queueEndedInError;
      if (intent.source === 'live' && (failed || runRef.current !== run)) refreshStatus('afterRequest');

      // Stop already settled this run and cleared the ref.
      if (runRef.current !== run) return;
      runRef.current = null;
      if (terminal) return;

      const error: CouncilEvent = timedOut
        ? { type: 'error', code: 'timeout', message: 'No reply in time.', retryable: true }
        : { type: 'error', code: 'provider_error', message: 'The stream ended early.', retryable: true };
      dispatch({ type: 'request/events', requestId, events: [error] });
    })();

    return 'sent';
  }, [refreshStatus]);

  const stop = useCallback(() => {
    const run = runRef.current;
    runRef.current = null;
    // Keep every word that already arrived, then cut the stream.
    run?.flush();
    run?.controller.abort();
    dispatch({ type: 'request/abort' });
  }, []);

  useEffect(
    () => () => {
      runRef.current?.controller.abort();
      runRef.current = null;
    },
    [],
  );

  // Ask the server what is possible before the visitor types. A failed call
  // counts as live being unavailable.
  useEffect(() => {
    if (holdStatus || forceFixtures) return;
    const controller = new AbortController();
    fetchCouncilStatus(controller.signal).then((status) => {
      if (!controller.signal.aborted) dispatch({ type: 'status/loaded', status });
    });
    return () => controller.abort();
  }, [holdStatus, forceFixtures]);

  // When the day's allowance is spent, or the site's budget is, check again
  // once it is due back. This later check is the one that can turn live on again.
  const { visitorLeft, resetAt } = state;
  const liveOff = state.live === 'unavailable';
  useEffect(() => {
    if (forceFixtures || !resetAt || (visitorLeft !== 0 && !liveOff)) return;
    const due = new Date(resetAt).getTime() - Date.now();
    if (!Number.isFinite(due) || due > 24 * 60 * 60 * 1000) return;
    const timer = setTimeout(() => refreshStatus('check'), Math.max(1000, due + 1500));
    return () => clearTimeout(timer);
  }, [forceFixtures, visitorLeft, liveOff, resetAt, refreshStatus]);

  // The draft outlives a reload or a trip to another page. It mirrors the
  // composer exactly, so it is gone the moment the question is sent. Not in
  // fixtures mode, where states must not depend on what an earlier run typed.
  const draft = state.draft;
  const draftRestored = useRef(false);
  useEffect(() => {
    if (forceFixtures || holdStatus || draftRestored.current) return;
    draftRestored.current = true;
    const saved = readSavedDraft();
    if (saved && live.current.state.draft === '') dispatch({ type: 'draft/set', text: saved });
  }, [forceFixtures, holdStatus]);
  useEffect(() => {
    if (forceFixtures || !draftRestored.current) return;
    writeSavedDraft(draft);
  }, [forceFixtures, draft]);

  const selectSeat = useCallback((seatId: SeatId | null) => dispatch({ type: 'seat/select', seatId }), []);
  const setDraft = useCallback((text: string) => dispatch({ type: 'draft/set', text }), []);

  const askStarter = useCallback(
    (starterId: string): SendResult => {
      const starter = live.current.starters.find((candidate) => candidate.id === starterId);
      if (!starter) return 'blocked';
      // A curated opening is council-routed, whoever happened to be selected.
      dispatch({ type: 'seat/select', seatId: null });
      return send({ action: 'open', source: 'fixture', question: starter.question, starterId }, []);
    },
    [send],
  );

  const ask = useCallback((): SendResult => {
    const current = live.current;
    const question = current.state.draft.trim();
    // The server asks for at least two characters and at most maxInputChars.
    if (question.length < MIN_QUESTION_CHARS || question.length > COUNCIL_LIMITS.maxInputChars) return 'blocked';
    if (isBusy(current.state)) return 'blocked';
    const seatId = current.state.selectedSeatId;

    // Typing out a starter word for word gets the curated (free) reply.
    const starter = seatId ? undefined : current.starters.find((candidate) => sameQuestion(candidate.question, question));
    if (starter) {
      const result = askStarter(starter.id);
      if (result === 'sent') dispatch({ type: 'draft/set', text: '' });
      return result;
    }

    if (!canAskLive(current.state)) return 'blocked';
    return send(
      { action: 'open', source: 'live', question, starterId: null, seatIds: seatId ? [seatId] : undefined },
      seatId ? [seatId] : [],
    );
  }, [askStarter, send]);

  const base = (current: typeof live.current) => ({
    question: current.state.question,
    starterId: current.state.starterId,
  });

  const sayMore = useCallback(
    (seatId: SeatId): SendResult => {
      const current = live.current;
      const moves = current.options.seats[seatId];
      if (!moves?.sayMore) return 'blocked';
      return send(
        {
          ...base(current),
          action: 'say_more',
          source: moves.sayMore === 'live' ? 'live' : 'fixture',
          seatIds: [seatId],
          targetTurnId: moves.turnId,
        },
        [seatId],
      );
    },
    [send],
  );

  const debate = useCallback(
    (objector: SeatId, addressed: SeatId): SendResult => {
      const current = live.current;
      const moves = current.options.seats[addressed];
      if (!moves?.debate || !moves.debate.objectors.includes(objector)) return 'blocked';
      return send(
        {
          ...base(current),
          action: 'debate',
          source: moves.debate.mode === 'live' ? 'live' : 'fixture',
          seatIds: [objector, addressed],
          targetTurnId: moves.turnId,
        },
        [objector, addressed],
      );
    },
    [send],
  );

  const differ = useCallback((): SendResult => {
    const current = live.current;
    if (!current.options.differ) return 'blocked';
    return send({ ...base(current), action: 'differ', source: current.options.differ === 'live' ? 'live' : 'fixture' }, []);
  }, [send]);

  const hearEveryone = useCallback((): SendResult => {
    const current = live.current;
    if (!current.options.hearEveryone) return 'blocked';
    return send(
      {
        ...base(current),
        action: 'hear_everyone',
        source: current.options.hearEveryone === 'live' ? 'live' : 'fixture',
      },
      unspokenSeatIds(current.state),
    );
  }, [send]);

  const openPushBack = useCallback((seatId: SeatId, text?: string) => {
    const moves = live.current.options.seats[seatId];
    if (!moves?.pushBack) return;
    dispatch({ type: 'pushBack/open', turnId: moves.turnId, seatId, text });
  }, []);
  const setPushBack = useCallback((text: string) => dispatch({ type: 'pushBack/set', text }), []);
  const closePushBack = useCallback(() => dispatch({ type: 'pushBack/close' }), []);

  const sendPushBack = useCallback((): SendResult => {
    const current = live.current;
    const draft = current.state.pushBack;
    if (!draft) return 'blocked';
    const text = draft.text.trim();
    const moves = current.options.seats[draft.seatId];
    if (text === '' || !moves?.pushBack) return 'blocked';
    // The curated objection has a curated answer. Anything else needs the live council.
    const canned = moves.canned !== null && sameQuestion(moves.canned, text);
    if (!canned && moves.pushBack !== 'live') return 'blocked';
    return send(
      {
        ...base(current),
        action: 'push_back',
        source: canned ? 'fixture' : 'live',
        text,
        seatIds: [draft.seatId],
        targetTurnId: moves.turnId,
      },
      [draft.seatId],
    );
  }, [send]);

  const retry = useCallback((): SendResult => {
    const current = live.current;
    const intent = current.state.error?.intent;
    if (!intent) return 'blocked';
    const expected =
      intent.action === 'hear_everyone'
        ? unspokenSeatIds(current.state)
        : intent.action === 'differ'
          ? []
          : (intent.seatIds ?? []);
    return send(intent, expected);
  }, [send]);

  const reset = useCallback(() => {
    stop();
    dispatch({ type: 'thread/reset' });
  }, [stop]);

  const dismissError = useCallback(() => dispatch({ type: 'error/dismiss' }), []);
  const hydrate = useCallback((next: CouncilState) => dispatch({ type: 'hydrate', state: next }), []);

  return {
    state,
    options,
    selectSeat,
    setDraft,
    ask,
    askStarter,
    openPushBack,
    setPushBack,
    closePushBack,
    sendPushBack,
    sayMore,
    debate,
    differ,
    hearEveryone,
    stop,
    reset,
    retry,
    dismissError,
    hydrate,
  };
}
