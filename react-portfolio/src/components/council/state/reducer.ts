import {
  COUNCIL_LIMITS,
  CouncilAction,
  CouncilErrorCode,
  CouncilEvent,
  CouncilStatus,
  SeatId,
  TranscriptTurn,
  isSeatId,
} from '@/lib/council/contract';

// The council's whole client state, driven by CouncilEvents. The reducer does
// not know whether a stream came from the model or from a fixture, which is
// what keeps the two behaving identically. No timers, no fetches, no copy.

export type TurnStatus = 'streaming' | 'done' | 'partial';
export type ExchangeSource = 'fixture' | 'live';
export type LiveAvailability = 'unknown' | 'available' | 'unavailable';

export interface UiTurn extends TranscriptTurn {
  exchangeId: string;
  status: TurnStatus;
}

export interface Exchange {
  id: string;
  action: CouncilAction;
  source: ExchangeSource;
  status: 'pending' | 'streaming' | 'done' | 'stopped' | 'failed';
  /** Seats expected to speak, in order where known. Empty for a council opening until routing arrives. */
  expectedSeatIds: SeatId[];
  expectsSynthesis: boolean;
  routing: { seatIds: SeatId[]; reason: string } | null;
  followUpQuestion: string | null;
}

/** Everything needed to send, or resend, one request. */
export interface RequestIntent {
  action: CouncilAction;
  source: ExchangeSource;
  question: string;
  starterId: string | null;
  text?: string;
  seatIds?: SeatId[];
  targetTurnId?: string;
}

/** Transient failures only. Limits are not errors here: they are read off the quota fields. */
export interface CouncilError {
  code: CouncilErrorCode;
  retryable: boolean;
  /** The request to resend when the visitor presses Try again. */
  intent: RequestIntent | null;
}

export interface PushBackDraft {
  turnId: string;
  seatId: SeatId;
  text: string;
}

/**
 * What the polite live region should say next. Kinds, not sentences: the
 * scene owns the words. `seq` changes once per announcement, so a finished
 * reply is spoken once and streamed tokens never are.
 */
export type Announcement = { seq: number } & (
  | { kind: 'seat'; seatId: SeatId }
  | { kind: 'council' }
  | { kind: 'routed'; seatIds: SeatId[] }
  | { kind: 'replied'; turnId: string }
  | { kind: 'done'; turnId: string | null; threadEnded: boolean }
  | { kind: 'stopped' }
  | { kind: 'newQuestion' }
);

type AnnouncementBody = Announcement extends infer A ? (A extends { seq: number } ? Omit<A, 'seq'> : never) : never;

function announce(state: CouncilState, body: AnnouncementBody): Announcement {
  return { ...body, seq: (state.announce?.seq ?? 0) + 1 } as Announcement;
}

export interface CouncilState {
  /** The thread's dilemma. Empty string means no thread yet. */
  question: string;
  starterId: string | null;
  /** The seat the opening was addressed to, or null for the whole council. */
  askedSeatId: SeatId | null;
  exchanges: Exchange[];
  turns: UiTurn[];
  /**
   * The one request in flight, if any. `sessionSeen`: the server has
   * acknowledged (and counted) it. `before`: the counts as they stood when it
   * was sent, to go back to if it fails with nothing shown.
   */
  request: {
    id: string;
    exchangeId: string;
    intent: RequestIntent;
    sessionSeen: boolean;
    before: { exchangesLeft: number; visitorLeft: number | null };
  } | null;
  selectedSeatId: SeatId | null;
  /** Composer text. Survives every error and every reset. */
  draft: string;
  pushBack: PushBackDraft | null;
  threadToken: string | null;
  /** Live generations left in this thread. Mirrors the server, which decides. */
  exchangesLeft: number;
  live: LiveAvailability;
  liveOffReason: 'budget_exhausted' | 'live_disabled' | null;
  /**
   * Who said live is off: a request the server refused, or a status call.
   * A refusal is stronger evidence than the status call that follows it.
   */
  liveOffBy: 'request' | 'status' | null;
  /** Live generations left today, or null while unknown. */
  visitorLeft: number | null;
  resetAt: string | null;
  error: CouncilError | null;
  announce: Announcement | null;
}

export type CouncilMsg =
  | { type: 'seat/select'; seatId: SeatId | null }
  | { type: 'draft/set'; text: string }
  | { type: 'pushBack/open'; turnId: string; seatId: SeatId; text?: string }
  | { type: 'pushBack/set'; text: string }
  | { type: 'pushBack/close' }
  | {
      type: 'request/start';
      requestId: string;
      exchangeId: string;
      intent: RequestIntent;
      expectedSeatIds: SeatId[];
    }
  | { type: 'request/events'; requestId: string; events: CouncilEvent[] }
  | { type: 'request/abort' }
  | { type: 'thread/reset' }
  /**
   * `afterRequest`: the hook's own correction right after a request failed or
   * was stopped. It may fix the counts, but it cannot overrule that request.
   */
  | { type: 'status/loaded'; status: CouncilStatus | null; origin?: 'check' | 'afterRequest' }
  | { type: 'error/dismiss' }
  | { type: 'hydrate'; state: CouncilState };

export const initialCouncilState: CouncilState = {
  question: '',
  starterId: null,
  askedSeatId: null,
  exchanges: [],
  turns: [],
  request: null,
  selectedSeatId: null,
  draft: '',
  pushBack: null,
  threadToken: null,
  exchangesLeft: COUNCIL_LIMITS.exchangesPerThread,
  live: 'unknown',
  liveOffReason: null,
  liveOffBy: null,
  visitorLeft: null,
  resetAt: null,
  error: null,
  announce: null,
};

const count = (value: unknown, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : fallback;

function patchExchange(state: CouncilState, id: string, patch: Partial<Exchange>): Exchange[] {
  return state.exchanges.map((exchange) => (exchange.id === id ? { ...exchange, ...patch } : exchange));
}

/** Closes any turn still streaming in an exchange. A partial turn with no text is dropped. */
function settleTurns(turns: UiTurn[], exchangeId: string, as: 'done' | 'partial'): UiTurn[] {
  const next: UiTurn[] = [];
  for (const turn of turns) {
    if (turn.exchangeId !== exchangeId || turn.status !== 'streaming') {
      next.push(turn);
    } else if (turn.text.trim() !== '') {
      next.push(as === 'partial' ? { ...turn, status: 'partial', partial: true } : { ...turn, status: 'done' });
    }
  }
  return next;
}

function hasReply(turns: UiTurn[], exchangeId: string): boolean {
  return turns.some((turn) => turn.exchangeId === exchangeId && turn.role !== 'visitor' && turn.text.trim() !== '');
}

/**
 * An exchange that produced nothing is removed as if it never started, and the
 * visitor's words go back where they typed them.
 */
function rollBack(state: CouncilState, exchangeId: string, intent: RequestIntent): CouncilState {
  if (intent.action === 'open') {
    return {
      ...state,
      question: '',
      starterId: null,
      askedSeatId: null,
      exchanges: [],
      turns: [],
      threadToken: null,
      exchangesLeft: COUNCIL_LIMITS.exchangesPerThread,
      selectedSeatId: intent.seatIds?.[0] ?? state.selectedSeatId,
      draft: intent.starterId || state.draft.trim() !== '' ? state.draft : intent.question,
    };
  }
  const restored: PushBackDraft | null =
    intent.action === 'push_back' && intent.seatIds?.[0] && intent.targetTurnId
      ? { turnId: intent.targetTurnId, seatId: intent.seatIds[0], text: intent.text ?? '' }
      : state.pushBack;
  return {
    ...state,
    exchanges: state.exchanges.filter((exchange) => exchange.id !== exchangeId),
    turns: state.turns.filter((turn) => turn.exchangeId !== exchangeId),
    pushBack: restored,
  };
}

type ErrorEvent = Extract<CouncilEvent, { type: 'error' }>;

function fail(state: CouncilState, event: ErrorEvent): CouncilState {
  const request = state.request;
  if (!request) return state;
  const { intent, exchangeId, before } = request;
  const opening = intent.action === 'open';

  let next: CouncilState = {
    ...state,
    request: null,
    turns: settleTurns(state.turns, exchangeId, 'partial'),
    exchanges: patchExchange(state, exchangeId, { status: 'failed' }),
  };

  // Nothing reached the visitor, so the server did not charge for it: the
  // exchange never happened, the counts go back to what they were, and the
  // visitor's words go back where they were typed.
  const shown = hasReply(next.turns, exchangeId);
  if (!shown) {
    next = rollBack(next, exchangeId, intent);
    next = {
      ...next,
      exchangesLeft: opening ? COUNCIL_LIMITS.exchangesPerThread : before.exchangesLeft,
      visitorLeft: before.visitorLeft,
    };
  }

  // Limits change what is possible from here on, so they land in the quota
  // fields and the scene reads its standing notices from there.
  let standing = false;
  switch (event.code) {
    case 'thread_limit':
      next = { ...next, exchangesLeft: 0 };
      break;
    case 'visitor_limit':
      standing = true;
      next = { ...next, visitorLeft: 0, resetAt: event.resetAt ?? next.resetAt };
      break;
    case 'budget_exhausted':
      standing = true;
      next = {
        ...next,
        live: 'unavailable',
        liveOffReason: 'budget_exhausted',
        liveOffBy: 'request',
        resetAt: event.resetAt ?? next.resetAt,
      };
      break;
    case 'live_disabled':
      standing = true;
      next = { ...next, live: 'unavailable', liveOffReason: 'live_disabled', liveOffBy: 'request' };
      break;
  }

  // When the server reports the counts after settling, they are the truth and
  // replace both the session's numbers and the guesses above. (Not for an
  // opening that left no thread behind: its exchange count describes nothing.)
  if (intent.source === 'live') {
    const threadGone = opening && !shown;
    if (!threadGone && typeof event.exchangesLeft === 'number') {
      next = { ...next, exchangesLeft: count(event.exchangesLeft, next.exchangesLeft) };
    }
    if (typeof event.visitorLeft === 'number') next = { ...next, visitorLeft: count(event.visitorLeft, 0) };
  }

  // Try again is only offered when trying again can work: the server allows it,
  // the thread still has the exchange to spend, and there is no composer
  // already holding the visitor's words (a restored objection is its own retry).
  const spent = !opening && intent.source === 'live' && next.exchangesLeft === 0;
  const restoredObjection = !shown && intent.action === 'push_back';
  const canRetry = event.retryable && event.code !== 'thread_limit' && !spent && !restoredObjection;

  return {
    ...next,
    error: standing ? null : { code: event.code, retryable: canRetry, intent: canRetry ? intent : null },
  };
}

function applyEvent(state: CouncilState, event: CouncilEvent): CouncilState {
  const request = state.request;
  if (!request) return state;
  const { exchangeId, intent } = request;
  const exchange = state.exchanges.find((candidate) => candidate.id === exchangeId);
  if (!exchange) return state;

  switch (event.type) {
    case 'session': {
      // A fixture has no say over quota. Its curated opening is free and
      // leaves the thread exactly one live follow-up; its follow-ups cost nothing.
      if (intent.source === 'fixture') {
        return intent.action === 'open' ? { ...state, exchangesLeft: COUNCIL_LIMITS.exchangesPerThread - 1 } : state;
      }
      // These counts already include the request that is now streaming.
      return {
        ...state,
        request: { ...request, sessionSeen: true },
        threadToken: typeof event.threadToken === 'string' ? event.threadToken : state.threadToken,
        exchangesLeft: count(event.exchangesLeft, state.exchangesLeft),
        visitorLeft: count(event.visitorLeft, state.visitorLeft ?? 0),
        resetAt: event.resetAt ?? null,
      };
    }

    case 'routing': {
      const seatIds = Array.isArray(event.seatIds) ? event.seatIds.filter(isSeatId) : [];
      return {
        ...state,
        exchanges: patchExchange(state, exchangeId, {
          routing: { seatIds, reason: typeof event.reason === 'string' ? event.reason : '' },
          expectedSeatIds: seatIds,
        }),
        announce: announce(state, { kind: 'routed', seatIds }),
      };
    }

    case 'turn_start': {
      if (state.turns.some((turn) => turn.id === event.turnId)) return state;
      const seatId = isSeatId(event.seatId) ? event.seatId : undefined;
      // A seat turn with no valid seat cannot be attributed, so it is not shown.
      if (event.role === 'seat' && !seatId) return state;
      const turn: UiTurn = {
        id: event.turnId,
        role: event.role === 'synthesis' ? 'synthesis' : 'seat',
        seatId,
        replyToSeatId: isSeatId(event.replyToSeatId) ? event.replyToSeatId : undefined,
        action: exchange.action,
        text: '',
        exchangeId,
        status: 'streaming',
      };
      const expectedSeatIds =
        seatId && !exchange.expectedSeatIds.includes(seatId)
          ? [...exchange.expectedSeatIds, seatId]
          : exchange.expectedSeatIds;
      return {
        ...state,
        // A new turn starting means the previous one is over, announced or not.
        turns: [...settleTurns(state.turns, exchangeId, 'done'), turn],
        exchanges: patchExchange(state, exchangeId, { status: 'streaming', expectedSeatIds }),
      };
    }

    case 'delta': {
      if (typeof event.text !== 'string' || event.text === '') return state;
      let touched = false;
      const turns = state.turns.map((turn) => {
        if (turn.id !== event.turnId || turn.status !== 'streaming') return turn;
        touched = true;
        return { ...turn, text: turn.text + event.text };
      });
      return touched ? { ...state, turns } : state;
    }

    case 'turn_end': {
      const ending = state.turns.find((turn) => turn.id === event.turnId && turn.status === 'streaming');
      if (!ending) return state;
      return {
        ...state,
        turns: state.turns.map((turn) => (turn === ending ? { ...turn, status: 'done' } : turn)),
        announce: announce(state, { kind: 'replied', turnId: ending.id }),
      };
    }

    case 'follow_up': {
      if (typeof event.question !== 'string' || event.question.trim() === '') return state;
      return { ...state, exchanges: patchExchange(state, exchangeId, { followUpQuestion: event.question }) };
    }

    case 'done': {
      const turns = settleTurns(state.turns, exchangeId, 'done');
      // A stream that ends cleanly with nothing in it is a failure the visitor can retry.
      if (!hasReply(turns, exchangeId)) {
        return fail(state, { type: 'error', code: 'provider_error', message: 'Empty reply.', retryable: true });
      }
      const last = [...turns].reverse().find((turn) => turn.exchangeId === exchangeId && turn.role !== 'visitor');
      return {
        ...state,
        request: null,
        turns,
        exchanges: patchExchange(state, exchangeId, { status: 'done' }),
        error: null,
        announce: announce(state, {
          kind: 'done',
          turnId: last?.id ?? null,
          threadEnded: intent.source === 'live' && state.exchangesLeft === 0,
        }),
      };
    }

    case 'error':
      return fail(state, event);

    default:
      return state;
  }
}

export function councilReducer(state: CouncilState, msg: CouncilMsg): CouncilState {
  switch (msg.type) {
    case 'seat/select':
      if (state.selectedSeatId === msg.seatId) return state;
      return {
        ...state,
        selectedSeatId: msg.seatId,
        announce: announce(state, msg.seatId ? { kind: 'seat', seatId: msg.seatId } : { kind: 'council' }),
      };

    case 'draft/set':
      // Never trimmed here: an over-long paste is flagged by the composer, not silently cut.
      return { ...state, draft: msg.text };

    case 'pushBack/open':
      // Reopening the same note keeps what was typed there.
      if (state.pushBack?.turnId === msg.turnId && msg.text === undefined) return state;
      return { ...state, pushBack: { turnId: msg.turnId, seatId: msg.seatId, text: msg.text ?? '' } };

    case 'pushBack/set':
      if (!state.pushBack) return state;
      return { ...state, pushBack: { ...state.pushBack, text: msg.text } };

    case 'pushBack/close':
      return state.pushBack ? { ...state, pushBack: null } : state;

    case 'request/start': {
      // One request in flight at a time. A second start is dropped, not queued.
      if (state.request) return state;
      const { intent } = msg;
      const exchange: Exchange = {
        id: msg.exchangeId,
        action: intent.action,
        source: intent.source,
        status: 'pending',
        expectedSeatIds: msg.expectedSeatIds,
        expectsSynthesis: intent.action === 'differ',
        routing: null,
        followUpQuestion: null,
      };
      const request = {
        id: msg.requestId,
        exchangeId: msg.exchangeId,
        intent,
        sessionSeen: false,
        before: { exchangesLeft: state.exchangesLeft, visitorLeft: state.visitorLeft },
      };

      if (intent.action === 'open') {
        return {
          ...state,
          question: intent.question,
          starterId: intent.starterId,
          askedSeatId: intent.seatIds?.[0] ?? null,
          // The recipient is now part of the thread. In a thread, picking a seat means something else.
          selectedSeatId: null,
          exchanges: [exchange],
          turns: [],
          request,
          threadToken: null,
          exchangesLeft: COUNCIL_LIMITS.exchangesPerThread,
          pushBack: null,
          error: null,
          // A typed question moves into the thread. A starter leaves the draft alone.
          draft: intent.starterId ? state.draft : '',
        };
      }

      if (state.question === '') return state;
      const visitorTurn: UiTurn[] =
        intent.action === 'push_back' && intent.text
          ? [
              {
                id: `visitor-${msg.requestId}`,
                role: 'visitor',
                action: 'push_back',
                replyToSeatId: intent.seatIds?.[0],
                text: intent.text,
                exchangeId: msg.exchangeId,
                status: 'done',
              },
            ]
          : [];
      return {
        ...state,
        exchanges: [...state.exchanges, exchange],
        turns: [...state.turns, ...visitorTurn],
        request,
        pushBack: null,
        error: null,
      };
    }

    case 'request/events': {
      let next = state;
      for (const event of msg.events) {
        // Events from a request that was stopped or replaced are ignored.
        if (!next.request || next.request.id !== msg.requestId) break;
        next = applyEvent(next, event);
      }
      return next;
    }

    case 'request/abort': {
      const request = state.request;
      if (!request) return state;
      // Stopping does not hand the exchange back: the server has already counted
      // it. If Stop beat the session event here, count it locally the same way.
      const uncounted = request.intent.source === 'live' && !request.sessionSeen;
      const stopped: CouncilState = {
        ...state,
        request: null,
        exchangesLeft:
          uncounted && request.intent.action !== 'open' ? Math.max(0, state.exchangesLeft - 1) : state.exchangesLeft,
        visitorLeft: uncounted && state.visitorLeft !== null ? Math.max(0, state.visitorLeft - 1) : state.visitorLeft,
        announce: announce(state, { kind: 'stopped' }),
        turns: settleTurns(state.turns, request.exchangeId, 'partial'),
        exchanges: patchExchange(state, request.exchangeId, { status: 'stopped' }),
      };
      return hasReply(stopped.turns, request.exchangeId)
        ? stopped
        : rollBack(stopped, request.exchangeId, request.intent);
    }

    case 'thread/reset':
      return {
        ...initialCouncilState,
        draft: state.draft,
        live: state.live,
        liveOffReason: state.liveOffReason,
        liveOffBy: state.liveOffBy,
        visitorLeft: state.visitorLeft,
        resetAt: state.resetAt,
        announce: announce(state, { kind: 'newQuestion' }),
      };

    case 'status/loaded': {
      const { status } = msg;
      // A status call that failed is treated as live being unavailable.
      if (!status) return { ...state, live: 'unavailable', liveOffReason: 'live_disabled', liveOffBy: 'status' };
      const visitorLeft = count(status.visitorLeft, 0);

      if (!status.live) {
        return {
          ...state,
          live: 'unavailable',
          // An older server leaves the reason out. Keep the one already known, if any.
          liveOffReason: status.offReason ?? state.liveOffReason ?? 'live_disabled',
          liveOffBy: status.offReason || !state.liveOffBy ? 'status' : state.liveOffBy,
          visitorLeft,
          resetAt: status.resetAt ?? state.resetAt,
        };
      }

      // The server just refused a request because live is off. The status call
      // made straight afterwards can correct the counts, but it does not get to
      // say otherwise: the visitor would only retry into the same refusal with
      // the explanation gone. A later check that reports live clears it.
      if (msg.origin === 'afterRequest' && state.live === 'unavailable' && state.liveOffBy === 'request') {
        return { ...state, visitorLeft, resetAt: status.resetAt ?? state.resetAt };
      }

      return { ...state, live: 'available', liveOffReason: null, liveOffBy: null, visitorLeft, resetAt: status.resetAt ?? null };
    }

    case 'error/dismiss':
      return state.error ? { ...state, error: null } : state;

    case 'hydrate':
      return msg.state;

    default:
      return state;
  }
}
