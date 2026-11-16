import {
  COUNCIL_LIMITS,
  FollowUpAction,
  PortraitMood,
  SEAT_IDS,
  SeatId,
  Starter,
  TranscriptTurn,
} from '@/lib/council/contract';
import { CouncilState, Exchange, UiTurn } from './reducer';

// Pure reads of CouncilState. The scene asks these what to show; nothing here
// decides anything the server would disagree with, it only mirrors for UX.

export type MoveMode = 'live' | 'scripted';

export interface SeatMoves {
  /** The reply these moves are about: the seat's most recent one. */
  turnId: string;
  pushBack: MoveMode | null;
  /** The curated objection for this seat, playable for free, if it has not been used. */
  canned: string | null;
  sayMore: MoveMode | null;
  /** This seat is the one objected to. `objectors` lists who may do the objecting. */
  debate: { mode: MoveMode; objectors: SeatId[] } | null;
}

export interface ThreadOptions {
  /** A live follow-up can be spent right now. */
  live: boolean;
  seats: Partial<Record<SeatId, SeatMoves>>;
  differ: MoveMode | null;
  hearEveryone: MoveMode | null;
  any: boolean;
}

export type LiveNotice = 'visitor_limit' | 'budget_exhausted' | 'live_disabled';

export type ScenePhase = 'empty' | 'routing' | 'thinking' | 'responding' | 'settled';

export const hasThread = (state: CouncilState): boolean => state.question !== '';
export const isBusy = (state: CouncilState): boolean => state.request !== null;

export function activeExchange(state: CouncilState): Exchange | null {
  const request = state.request;
  if (!request) return null;
  return state.exchanges.find((exchange) => exchange.id === request.exchangeId) ?? null;
}

export function streamingTurn(state: CouncilState): UiTurn | null {
  return state.turns.find((turn) => turn.status === 'streaming') ?? null;
}

/**
 * A council-routed opening that has not said who replies, and has not started
 * replying either. Once any reply exists the question is settled, even with
 * no seats named: the council can answer as one voice with no routing at all.
 */
export function isUndecided(exchange: Exchange, turns: UiTurn[]): boolean {
  return (
    exchange.action === 'open' &&
    exchange.expectedSeatIds.length === 0 &&
    !turns.some((turn) => turn.exchangeId === exchange.id && turn.role !== 'visitor')
  );
}

export function scenePhase(state: CouncilState): ScenePhase {
  if (!hasThread(state)) return 'empty';
  const exchange = activeExchange(state);
  if (!exchange) return 'settled';
  if (streamingTurn(state)) return 'responding';
  return isUndecided(exchange, state.turns) ? 'routing' : 'thinking';
}

/** Seats with at least one reply on the page, in council order. */
export function spokenSeatIds(state: CouncilState): SeatId[] {
  const spoken = new Set<SeatId>();
  for (const turn of state.turns) {
    if (turn.role === 'seat' && turn.seatId && turn.text.trim() !== '') spoken.add(turn.seatId);
  }
  return SEAT_IDS.filter((id) => spoken.has(id));
}

export function unspokenSeatIds(state: CouncilState): SeatId[] {
  const spoken = spokenSeatIds(state);
  return SEAT_IDS.filter((id) => !spoken.includes(id));
}

/** Why live replies are not on offer, if they are not. */
export function liveNotice(state: CouncilState): LiveNotice | null {
  if (state.live === 'unavailable') return state.liveOffReason ?? 'live_disabled';
  if (state.visitorLeft === 0) return 'visitor_limit';
  return null;
}

/**
 * Whether a freeform question may be sent. While the status call is still out
 * the answer is yes: the server is the authority and will say otherwise.
 */
export function canAskLive(state: CouncilState): boolean {
  return state.live !== 'unavailable' && state.visitorLeft !== 0;
}

export function seatMoods(state: CouncilState, challengedSeatId: SeatId | null = null): Record<SeatId, PortraitMood> {
  const moods = {} as Record<SeatId, PortraitMood>;
  const exchange = activeExchange(state);
  const speaking = streamingTurn(state)?.seatId ?? null;

  for (const id of SEAT_IDS) {
    if (!exchange) {
      moods[id] = 'idle';
    } else if (isUndecided(exchange, state.turns)) {
      // Nobody has been picked yet: the whole council is weighing the question.
      moods[id] = 'thinking';
    } else if (exchange.expectedSeatIds.length === 0 && exchange.action === 'open') {
      // The council is answering as one, with no seat taking it.
      moods[id] = 'idle';
    } else if (id === speaking) {
      moods[id] = 'speaking';
    } else if (exchange.expectedSeatIds.includes(id)) {
      const replied = state.turns.some(
        (turn) => turn.exchangeId === exchange.id && turn.seatId === id && turn.role === 'seat',
      );
      moods[id] = replied ? 'idle' : 'thinking';
    } else {
      moods[id] = 'dimmed';
    }
  }

  if (challengedSeatId) moods[challengedSeatId] = 'challenged';
  return moods;
}

function latestSeatTurns(state: CouncilState): Partial<Record<SeatId, UiTurn>> {
  const latest: Partial<Record<SeatId, UiTurn>> = {};
  for (const turn of state.turns) {
    if (turn.role === 'seat' && turn.seatId && turn.text.trim() !== '') latest[turn.seatId] = turn;
  }
  return latest;
}

const NO_OPTIONS: ThreadOptions = { live: false, seats: {}, differ: null, hearEveryone: null, any: false };

/**
 * What the visitor can still do with this thread.
 *
 * A live move is offered while the thread and the day both have one left.
 * Without one, an action falls back to the starter's scripted follow-up, each
 * of which is free and plays once. The canned objection is always scripted.
 */
export function threadOptions(state: CouncilState, starters: Starter[]): ThreadOptions {
  if (!hasThread(state) || isBusy(state)) return NO_OPTIONS;
  const latest = latestSeatTurns(state);
  const spoken = SEAT_IDS.filter((id) => latest[id]);
  // The council can answer as one, with no seat attached. That still counts as a reply.
  const anyReply = state.turns.some((turn) => turn.role !== 'visitor' && turn.text.trim() !== '');
  if (!anyReply) return NO_OPTIONS;

  const live = state.live === 'available' && state.exchangesLeft > 0 && state.visitorLeft !== 0;

  const starter = state.starterId ? starters.find((candidate) => candidate.id === state.starterId) : undefined;
  const played = new Set<FollowUpAction>();
  // Once a move has been made, live or scripted, its scripted version is off the table.
  for (const exchange of state.exchanges) {
    if (exchange.action !== 'open') played.add(exchange.action);
  }
  const scripted = (action: FollowUpAction) => (played.has(action) ? undefined : starter?.followUps[action]);

  const pushBack = scripted('push_back');
  const sayMore = scripted('say_more');
  const debate = scripted('debate');
  const everyone = scripted('hear_everyone');
  const unspoken = SEAT_IDS.filter((id) => !latest[id]);

  const seats: Partial<Record<SeatId, SeatMoves>> = {};
  let any = false;
  for (const id of spoken) {
    const turn = latest[id];
    if (!turn) continue;
    const canned = pushBack?.seatIds?.[0] === id && pushBack.visitorText ? pushBack.visitorText : null;
    const scriptedDebate = debate?.seatIds?.[1] === id && debate.seatIds[0] !== id ? debate.seatIds[0] : null;
    const moves: SeatMoves = {
      turnId: turn.id,
      pushBack: live ? 'live' : canned ? 'scripted' : null,
      canned,
      sayMore: live ? 'live' : sayMore?.seatIds?.[0] === id ? 'scripted' : null,
      debate: live
        ? { mode: 'live', objectors: [...spoken.filter((other) => other !== id), ...unspoken] }
        : scriptedDebate
          ? { mode: 'scripted', objectors: [scriptedDebate] }
          : null,
    };
    if (moves.pushBack || moves.sayMore || moves.debate) {
      seats[id] = moves;
      any = true;
    }
  }

  // A comparison needs two seats. The server refuses it with fewer.
  const differ: MoveMode | null = spoken.length < 2 ? null : live ? 'live' : scripted('differ') ? 'scripted' : null;
  const everyoneFits = everyone?.turns.every((turn) => turn.seatId && unspoken.includes(turn.seatId)) ?? false;
  const hearEveryone: MoveMode | null =
    unspoken.length === 0 ? null : live ? 'live' : everyone && everyoneFits ? 'scripted' : null;

  return { live, seats, differ, hearEveryone, any: any || differ !== null || hearEveryone !== null };
}

/**
 * The history sent with a request, oldest first. The server rejects anything
 * over its bounds, so it is trimmed here. When turns must go, the ones kept
 * are the reply being answered and the opening round (the server works out
 * who has not spoken from it), then the most recent.
 */
export function toTranscript(turns: UiTurn[], targetTurnId?: string): TranscriptTurn[] {
  const usable = turns.filter((turn) => turn.text.trim() !== '' && turn.status !== 'streaming');
  let kept = usable;
  if (usable.length > COUNCIL_LIMITS.maxTranscriptTurns) {
    const openingId = usable[0]?.exchangeId;
    let pinned = usable.filter((turn) => turn.id === targetTurnId || turn.exchangeId === openingId);
    // An opening too large to keep whole cannot be pinned: fall back to the target and the newest.
    if (pinned.length > COUNCIL_LIMITS.maxTranscriptTurns) pinned = usable.filter((turn) => turn.id === targetTurnId);
    const rest = usable.filter((turn) => !pinned.includes(turn));
    const room = COUNCIL_LIMITS.maxTranscriptTurns - pinned.length;
    const chosen = new Set([...pinned, ...(room > 0 ? rest.slice(-room) : [])]);
    kept = usable.filter((turn) => chosen.has(turn));
  }
  return kept.map((turn) => {
    // The server rejects a turn longer than this rather than trimming it.
    const limit = turn.role === 'visitor' ? COUNCIL_LIMITS.maxInputChars : COUNCIL_LIMITS.maxTurnChars;
    const sent: TranscriptTurn = { id: turn.id, role: turn.role, text: turn.text.slice(0, limit) };
    if (turn.seatId) sent.seatId = turn.seatId;
    if (turn.action) sent.action = turn.action;
    if (turn.replyToSeatId) sent.replyToSeatId = turn.replyToSeatId;
    if (turn.status === 'partial') sent.partial = true;
    return sent;
  });
}
