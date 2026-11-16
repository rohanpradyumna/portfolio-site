import { describe, expect, it } from 'vitest';
import { CouncilEvent, CouncilRequest, SEAT_IDS, SeatId } from '@/lib/council/contract';
import { STARTERS } from '@/data/council/starters';
import { validateCouncilRequest } from '@/lib/council/validate';
import { CouncilState, RequestIntent, councilReducer, initialCouncilState } from './reducer';
import { buildCouncilRequest } from './request';
import { ThreadOptions, threadOptions, unspokenSeatIds } from './selectors';

// The scene must never offer a move the server will refuse. These tests take
// a state, ask the selectors what is on offer, build each request exactly as
// the hook does, and put it through the server's own validation.

const STARTER_IDS = STARTERS.map((starter) => starter.id);
const REQUEST_ID = 'a'.repeat(24);
const live: CouncilState = { ...initialCouncilState, live: 'available', visitorLeft: 4 };

const seatTurn = (turnId: string, seatId: SeatId, text = 'A reply long enough to be a reply.'): CouncilEvent[] => [
  { type: 'turn_start', turnId, role: 'seat', seatId },
  { type: 'delta', turnId, text },
  { type: 'turn_end', turnId },
];

function play(state: CouncilState, id: string, intent: RequestIntent, events: CouncilEvent[]): CouncilState {
  const started = councilReducer(state, { type: 'request/start', requestId: id, exchangeId: `x-${id}`, intent, expectedSeatIds: intent.seatIds ?? [] });
  return councilReducer(started, { type: 'request/events', requestId: id, events });
}

const SESSION: CouncilEvent = { type: 'session', threadToken: 'v1.token.sig', exchangesLeft: 1, visitorLeft: 3, resetAt: null };

function liveOpening(seatIds: SeatId[], extra: CouncilEvent[] = []): CouncilState {
  return play(live, 'open', { action: 'open', source: 'live', question: 'Should I quit my job?', starterId: null }, [
    SESSION,
    ...seatIds.flatMap((seatId, index) => seatTurn(`t${index}`, seatId)),
    ...extra,
    { type: 'done' },
  ]);
}

/** Every live request the tray could send from this state, built the way the hook builds it. */
function offeredRequests(state: CouncilState, options: ThreadOptions): { label: string; request: CouncilRequest }[] {
  const base = { source: 'live' as const, question: state.question, starterId: state.starterId };
  const intents: { label: string; intent: RequestIntent }[] = [];
  for (const seatId of SEAT_IDS) {
    const moves = options.seats[seatId];
    if (!moves) continue;
    if (moves.pushBack === 'live') {
      intents.push({ label: `push_back ${seatId}`, intent: { ...base, action: 'push_back', text: 'That does not follow.', seatIds: [seatId], targetTurnId: moves.turnId } });
    }
    if (moves.sayMore === 'live') {
      intents.push({ label: `say_more ${seatId}`, intent: { ...base, action: 'say_more', seatIds: [seatId], targetTurnId: moves.turnId } });
    }
    if (moves.debate?.mode === 'live') {
      for (const objector of moves.debate.objectors) {
        intents.push({ label: `debate ${objector} vs ${seatId}`, intent: { ...base, action: 'debate', seatIds: [objector, seatId], targetTurnId: moves.turnId } });
      }
    }
  }
  if (options.differ === 'live') intents.push({ label: 'differ', intent: { ...base, action: 'differ' } });
  if (options.hearEveryone === 'live') intents.push({ label: 'hear_everyone', intent: { ...base, action: 'hear_everyone' } });
  return intents.map(({ label, intent }) => ({ label, request: buildCouncilRequest(state, intent, REQUEST_ID) }));
}

function expectAllOffersValid(state: CouncilState) {
  const options = threadOptions(state, STARTERS);
  const offers = offeredRequests(state, options);
  const refused = offers
    .map(({ label, request }) => ({ label, result: validateCouncilRequest(request, STARTER_IDS) }))
    .filter(({ result }) => !result.ok)
    .map(({ label, result }) => `${label}: ${result.ok ? '' : result.message}`);
  expect(refused).toEqual([]);
  return { options, offers };
}

describe('every move on offer passes the server’s validation', () => {
  it('after a routed opening with three seats', () => {
    const { options, offers } = expectAllOffersValid(liveOpening(['stoic', 'pragmatist', 'marxist']));
    expect(options.differ).toBe('live');
    // 3 push backs, 3 say mores, 3 x 5 debates, differ, hear everyone.
    expect(offers).toHaveLength(23);
  });

  it('after a single-seat opening: no "Where do we differ?", which the server would refuse', () => {
    const state = liveOpening(['stoic']);
    const { options, offers } = expectAllOffersValid(state);
    expect(options.differ).toBeNull();
    expect(offers.map((offer) => offer.label)).not.toContain('differ');
    // The refusal this guards against is real: the server wants two seats.
    const forced = buildCouncilRequest(state, { action: 'differ', source: 'live', question: state.question, starterId: null }, REQUEST_ID);
    expect(validateCouncilRequest(forced, STARTER_IDS).ok).toBe(false);
  });

  it('after a two-seat opening: differ is back, and a debate always names two different seats', () => {
    const { options, offers } = expectAllOffersValid(liveOpening(['absurdist', 'advaita']));
    expect(options.differ).toBe('live');
    for (const { request } of offers.filter((offer) => offer.request.action === 'debate')) {
      expect(new Set(request.seatIds).size).toBe(2);
    }
  });

  it('once all six have spoken: no "Hear everyone", which the server would refuse', () => {
    const state = liveOpening([...SEAT_IDS]);
    const { options } = expectAllOffersValid(state);
    expect(options.hearEveryone).toBeNull();
    const forced = buildCouncilRequest(state, { action: 'hear_everyone', source: 'live', question: state.question, starterId: null }, REQUEST_ID);
    expect(validateCouncilRequest(forced, STARTER_IDS).ok).toBe(false);
  });

  it('when the council answered as one and no seat has spoken: only "Hear everyone"', () => {
    const state = play(live, 'open', { action: 'open', source: 'live', question: 'What should I have for dinner?', starterId: null }, [
      SESSION,
      { type: 'turn_start', turnId: 'c1', role: 'synthesis' },
      { type: 'delta', turnId: 'c1', text: 'Not one for the council.' },
      { type: 'turn_end', turnId: 'c1' },
      { type: 'done' },
    ]);
    const { offers } = expectAllOffersValid(state);
    expect(offers.map((offer) => offer.label)).toEqual(['hear_everyone']);
  });

  it('after an opening that was cut off mid-reply', () => {
    const started = play(live, 'open', { action: 'open', source: 'live', question: 'Should I quit my job?', starterId: null }, [
      SESSION,
      ...seatTurn('t0', 'stoic'),
      { type: 'turn_start', turnId: 't1', role: 'seat', seatId: 'marxist' },
      { type: 'delta', turnId: 't1', text: 'Half a thought about' },
    ]);
    const { offers } = expectAllOffersValid(councilReducer(started, { type: 'request/abort' }));
    expect(offers.some((offer) => offer.label === 'push_back marxist')).toBe(true);
  });

  it('on a starter thread, where the first live follow-up carries the starter id instead of a token', () => {
    const starter = STARTERS[0];
    const state = play(live, 'open', { action: 'open', source: 'fixture', question: starter.question, starterId: starter.id }, [
      { type: 'session', threadToken: `fixture:${starter.id}`, exchangesLeft: 1, visitorLeft: 4, resetAt: null },
      ...starter.opening.turns.flatMap((turn, index) => (turn.seatId ? seatTurn(`fx${index}`, turn.seatId, turn.text) : [])),
      { type: 'done' },
    ]);
    const { offers } = expectAllOffersValid(state);
    expect(offers.length).toBeGreaterThan(0);
    for (const { request } of offers) {
      expect(request.starterId).toBe(starter.id);
      expect(request.threadToken).toBeUndefined();
    }
  });

  it('with replies longer than the server accepts, which are trimmed on the way out', () => {
    const long = 'x'.repeat(4000);
    const state = play(live, 'open', { action: 'open', source: 'live', question: 'Should I quit my job?', starterId: null }, [
      SESSION,
      ...seatTurn('t0', 'stoic', long),
      ...seatTurn('t1', 'marxist', long),
      { type: 'done' },
    ]);
    expectAllOffersValid(state);
  });

  it('names exactly the seats the server would bring in for "Hear everyone"', () => {
    const state = liveOpening(['stoic', 'pragmatist', 'marxist']);
    const request = buildCouncilRequest(state, { action: 'hear_everyone', source: 'live', question: state.question, starterId: null }, REQUEST_ID);
    const result = validateCouncilRequest(request, STARTER_IDS);
    expect(result.ok && result.plan.speakers).toEqual(unspokenSeatIds(state));
  });
});
