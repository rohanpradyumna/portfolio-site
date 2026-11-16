import { describe, expect, it } from 'vitest';
import { COUNCIL_LIMITS, CouncilEvent, Starter } from '@/lib/council/contract';
import { CouncilState, RequestIntent, councilReducer, initialCouncilState } from './reducer';
import { canAskLive, isUndecided, liveNotice, scenePhase, seatMoods, threadOptions, toTranscript } from './selectors';

const STARTER: Starter = {
  id: 'starter-a',
  question: 'Can I want more and still be content?',
  opening: {
    routing: { seatIds: ['stoic', 'pragmatist', 'marxist'], reason: 'Three weights.' },
    turns: [
      { role: 'seat', seatId: 'stoic', text: 'S' },
      { role: 'seat', seatId: 'pragmatist', text: 'P' },
      { role: 'seat', seatId: 'marxist', text: 'M' },
    ],
  },
  followUps: {
    push_back: { seatIds: ['pragmatist'], visitorText: 'Always?', turns: [{ role: 'seat', seatId: 'pragmatist', text: 'Not always.' }] },
    say_more: { seatIds: ['stoic'], turns: [{ role: 'seat', seatId: 'stoic', text: 'More.' }] },
    debate: {
      seatIds: ['marxist', 'stoic'],
      turns: [
        { role: 'seat', seatId: 'marxist', replyToSeatId: 'stoic', text: 'Objection.' },
        { role: 'seat', seatId: 'stoic', replyToSeatId: 'marxist', text: 'Reply.' },
      ],
    },
    differ: { turns: [{ role: 'synthesis', text: 'They differ.' }] },
    hear_everyone: {
      seatIds: ['existentialist', 'absurdist', 'advaita'],
      turns: [
        { role: 'seat', seatId: 'existentialist', text: 'E' },
        { role: 'seat', seatId: 'absurdist', text: 'A' },
        { role: 'seat', seatId: 'advaita', text: 'V' },
      ],
    },
  },
};

const intent = (overrides: Partial<RequestIntent>): RequestIntent => ({
  action: 'open',
  source: 'fixture',
  question: STARTER.question,
  starterId: STARTER.id,
  ...overrides,
});

function play(state: CouncilState, requestId: string, request: RequestIntent, events: CouncilEvent[], expected: RequestIntent['seatIds'] = []) {
  const started = councilReducer(state, { type: 'request/start', requestId, exchangeId: `x-${requestId}`, intent: request, expectedSeatIds: expected ?? [] });
  return councilReducer(started, { type: 'request/events', requestId, events });
}

const reply = (turnId: string, seatId: 'stoic' | 'pragmatist' | 'marxist', text: string): CouncilEvent[] => [
  { type: 'turn_start', turnId, role: 'seat', seatId },
  { type: 'delta', turnId, text },
  { type: 'turn_end', turnId },
];

const OPENING: CouncilEvent[] = [
  { type: 'session', threadToken: 'fixture', exchangesLeft: 1, visitorLeft: 4, resetAt: null },
  { type: 'routing', seatIds: ['stoic', 'pragmatist', 'marxist'], reason: 'Three weights.' },
  ...reply('t1', 'stoic', 'S'),
  ...reply('t2', 'pragmatist', 'P'),
  ...reply('t3', 'marxist', 'M'),
  { type: 'done' },
];

const withLive = (live: CouncilState['live'], visitorLeft: number | null = 3): CouncilState => ({ ...initialCouncilState, live, visitorLeft });
const openedOn = (base: CouncilState) => play(base, 'r1', intent({}), OPENING);

describe('threadOptions', () => {
  it('offers nothing before there are replies, and nothing while a request runs', () => {
    expect(threadOptions(initialCouncilState, [STARTER]).any).toBe(false);
    const running = councilReducer(withLive('available'), {
      type: 'request/start',
      requestId: 'r1',
      exchangeId: 'x1',
      intent: intent({}),
      expectedSeatIds: [],
    });
    expect(threadOptions(running, [STARTER]).any).toBe(false);
  });

  it('lets any seat that spoke be targeted when a live follow-up is available', () => {
    const options = threadOptions(openedOn(withLive('available')), [STARTER]);
    expect(options.live).toBe(true);
    expect(Object.keys(options.seats)).toEqual(['stoic', 'pragmatist', 'marxist']);
    expect(options.seats.marxist).toMatchObject({ turnId: 't3', pushBack: 'live', sayMore: 'live' });
    expect(options.seats.stoic?.debate?.objectors).toEqual(['pragmatist', 'marxist', 'existentialist', 'absurdist', 'advaita']);
    expect(options.seats.stoic?.debate?.objectors).not.toContain('stoic');
    expect(options.differ).toBe('live');
    expect(options.hearEveryone).toBe('live');
  });

  it('keeps the curated objection on offer beside a live push back, for its own seat only', () => {
    const options = threadOptions(openedOn(withLive('available')), [STARTER]);
    expect(options.seats.pragmatist?.canned).toBe('Always?');
    expect(options.seats.stoic?.canned).toBeNull();
  });

  it('narrows to the scripted seat and pair when live replies are off', () => {
    const options = threadOptions(openedOn(withLive('unavailable')), [STARTER]);
    expect(options.live).toBe(false);
    expect(options.seats.pragmatist).toMatchObject({ pushBack: 'scripted', sayMore: null, debate: null });
    expect(options.seats.stoic).toMatchObject({ pushBack: null, sayMore: 'scripted', debate: { mode: 'scripted', objectors: ['marxist'] } });
    expect(options.seats.marxist).toBeUndefined();
    expect(options.differ).toBe('scripted');
    expect(options.hearEveryone).toBe('scripted');
  });

  it('falls back to scripted follow-ups once the day’s live questions are gone', () => {
    const options = threadOptions(openedOn(withLive('available', 0)), [STARTER]);
    expect(options.live).toBe(false);
    expect(options.differ).toBe('scripted');
  });

  it('does not offer a move a second time once it has been made', () => {
    const opened = openedOn(withLive('unavailable'));
    const differed = play(opened, 'r2', intent({ action: 'differ' }), [
      { type: 'turn_start', turnId: 'd1', role: 'synthesis' },
      { type: 'delta', turnId: 'd1', text: 'They differ.' },
      { type: 'turn_end', turnId: 'd1' },
      { type: 'done' },
    ]);
    const options = threadOptions(differed, [STARTER]);
    expect(options.differ).toBeNull();
    expect(options.hearEveryone).toBe('scripted');
  });

  it('has nothing left for a live thread that has used both exchanges', () => {
    const live = play(withLive('available'), 'r1', intent({ source: 'live', starterId: null }), [
      { type: 'session', threadToken: 'tok', exchangesLeft: 0, visitorLeft: 2, resetAt: null },
      ...reply('t1', 'stoic', 'S'),
      { type: 'done' },
    ]);
    expect(threadOptions(live, [STARTER])).toMatchObject({ live: false, any: false });
  });

  it('only offers Hear everyone while someone has not spoken', () => {
    const everyone: CouncilEvent[] = [
      { type: 'session', threadToken: 'tok', exchangesLeft: 1, visitorLeft: 2, resetAt: null },
      ...(['stoic', 'pragmatist', 'existentialist', 'absurdist', 'advaita', 'marxist'] as const).flatMap((seatId, index): CouncilEvent[] => [
        { type: 'turn_start', turnId: `t${index}`, role: 'seat', seatId },
        { type: 'delta', turnId: `t${index}`, text: 'x' },
        { type: 'turn_end', turnId: `t${index}` },
      ]),
      { type: 'done' },
    ];
    const state = play(withLive('available'), 'r1', intent({ source: 'live', starterId: null }), everyone);
    expect(threadOptions(state, [STARTER]).hearEveryone).toBeNull();
  });
});

describe('a reply from the council as a whole', () => {
  const unrouted = (events: CouncilEvent[]) => {
    const started = councilReducer(withLive('available'), {
      type: 'request/start',
      requestId: 'r1',
      exchangeId: 'x1',
      intent: intent({ source: 'live', starterId: null }),
      expectedSeatIds: [],
    });
    return councilReducer(started, { type: 'request/events', requestId: 'r1', events });
  };
  const SESSION: CouncilEvent = { type: 'session', threadToken: 'tok', exchangesLeft: 1, visitorLeft: 3, resetAt: null };
  const NOTE: CouncilEvent[] = [
    { type: 'turn_start', turnId: 'c1', role: 'synthesis' },
    { type: 'delta', turnId: 'c1', text: 'Not one for the council.' },
  ];

  it('stops the seats looking like they are deliberating once the council starts answering', () => {
    expect(new Set(Object.values(seatMoods(unrouted([SESSION]))))).toEqual(new Set(['thinking']));
    expect(new Set(Object.values(seatMoods(unrouted([SESSION, ...NOTE]))))).toEqual(new Set(['idle']));
  });

  it('counts as decided the moment it starts, and stays decided between its last word and the end of the stream', () => {
    const streaming = unrouted([SESSION, ...NOTE]);
    expect(isUndecided(streaming.exchanges[0], streaming.turns)).toBe(false);
    expect(scenePhase(streaming)).toBe('responding');
    const ended = unrouted([SESSION, ...NOTE, { type: 'turn_end', turnId: 'c1' }]);
    expect(isUndecided(ended.exchanges[0], ended.turns)).toBe(false);
    expect(scenePhase(ended)).not.toBe('routing');
    expect(new Set(Object.values(seatMoods(ended)))).toEqual(new Set(['idle']));
    // Before anything arrives it is still an open question who replies.
    const waiting = unrouted([SESSION]);
    expect(isUndecided(waiting.exchanges[0], waiting.turns)).toBe(true);
    expect(scenePhase(waiting)).toBe('routing');
  });

  it('still leaves a follow-up, but has nothing to compare and nobody to push back on', () => {
    const state = unrouted([SESSION, ...NOTE, { type: 'turn_end', turnId: 'c1' }, { type: 'done' }]);
    const options = threadOptions(state, [STARTER]);
    expect(options).toMatchObject({ live: true, differ: null, hearEveryone: 'live', seats: {} });
  });
});

describe('seatMoods and scenePhase', () => {
  const started = () =>
    councilReducer(withLive('available'), { type: 'request/start', requestId: 'r1', exchangeId: 'x1', intent: intent({}), expectedSeatIds: [] });
  const feed = (state: CouncilState, events: CouncilEvent[]) => councilReducer(state, { type: 'request/events', requestId: 'r1', events });

  it('has the whole council thinking until it is known who replies', () => {
    const state = started();
    expect(scenePhase(state)).toBe('routing');
    expect(new Set(Object.values(seatMoods(state)))).toEqual(new Set(['thinking']));
  });

  it('shows one seat speaking, the next ones thinking, and the rest stepped back', () => {
    const state = feed(started(), OPENING.slice(0, 6));
    expect(scenePhase(state)).toBe('responding');
    expect(seatMoods(state)).toEqual({
      stoic: 'idle',
      pragmatist: 'speaking',
      marxist: 'thinking',
      existentialist: 'dimmed',
      absurdist: 'dimmed',
      advaita: 'dimmed',
    });
  });

  it('is between turns once a reply ends and before the next begins', () => {
    const state = feed(started(), OPENING.slice(0, 5));
    expect(scenePhase(state)).toBe('thinking');
  });

  it('rests everyone when the exchange is over, except a seat that was just challenged', () => {
    const state = feed(started(), OPENING);
    expect(scenePhase(state)).toBe('settled');
    expect(seatMoods(state).marxist).toBe('idle');
    expect(seatMoods(state, 'stoic').stoic).toBe('challenged');
  });
});

describe('review: "Where do we differ?" needs two seats', () => {
  const single = () =>
    play(withLive('available'), 'r1', intent({ source: 'live', starterId: null, seatIds: ['stoic'] }), [
      { type: 'session', threadToken: 'tok', exchangesLeft: 1, visitorLeft: 3, resetAt: null },
      ...reply('t1', 'stoic', 'S'),
      { type: 'done' },
    ], ['stoic']);

  it('is not offered after a single-seat opening, live or scripted', () => {
    expect(threadOptions(single(), [STARTER]).differ).toBeNull();
    expect(threadOptions({ ...single(), starterId: STARTER.id, live: 'unavailable' }, [STARTER]).differ).toBeNull();
  });

  it('is offered as soon as a second seat has spoken', () => {
    const two = play(single(), 'r2', intent({ action: 'hear_everyone', source: 'live', starterId: null }), [
      { type: 'session', threadToken: 'tok', exchangesLeft: 1, visitorLeft: 2, resetAt: null },
      ...reply('t2', 'marxist', 'M'),
      { type: 'done' },
    ]);
    expect(threadOptions(two, [STARTER]).differ).toBe('live');
  });

  it('still offers the single seat its own moves', () => {
    const options = threadOptions(single(), [STARTER]);
    expect(options.seats.stoic).toMatchObject({ pushBack: 'live', sayMore: 'live' });
    expect(options.hearEveryone).toBe('live');
  });
});

describe('review: the notice names the right wall', () => {
  it('says the site budget is spent, not that the visitor has used their questions', () => {
    const state = councilReducer(withLive('unknown', null), {
      type: 'status/loaded',
      status: { live: false, offReason: 'budget_exhausted', visitorLeft: 3, resetAt: '2030-01-02T00:00:00.000Z' },
    });
    expect(liveNotice(state)).toBe('budget_exhausted');
    expect(canAskLive(state)).toBe(false);
  });

  it('keeps saying so after a refused request and the status refresh that follows it', () => {
    const refused = play(withLive('available', 4), 'r1', intent({ source: 'live', starterId: null }), [
      { type: 'error', code: 'budget_exhausted', message: 'x', resetAt: '2030-01-02T00:00:00.000Z', retryable: false },
    ]);
    const refreshed = councilReducer(refused, { type: 'status/loaded', origin: 'afterRequest', status: { live: true, visitorLeft: 4, resetAt: null } });
    expect(liveNotice(refreshed)).toBe('budget_exhausted');
    expect(canAskLive(refreshed)).toBe(false);
  });
});

describe('live availability', () => {
  it('lets a question go out while the status call is still pending', () => {
    expect(canAskLive(withLive('unknown', null))).toBe(true);
    expect(liveNotice(withLive('unknown', null))).toBeNull();
  });

  it('explains why when live is off or the day is spent', () => {
    expect(canAskLive(withLive('unavailable'))).toBe(false);
    expect(liveNotice({ ...withLive('unavailable'), liveOffReason: 'budget_exhausted' })).toBe('budget_exhausted');
    expect(canAskLive(withLive('available', 0))).toBe(false);
    expect(liveNotice(withLive('available', 0))).toBe('visitor_limit');
  });
});

describe('toTranscript', () => {
  const turns = Array.from({ length: COUNCIL_LIMITS.maxTranscriptTurns + 3 }, (_, index) => ({
    id: `t${index}`,
    role: 'seat' as const,
    seatId: 'stoic' as const,
    text: `reply ${index}`,
    exchangeId: 'x',
    status: 'done' as const,
  }));

  it('sends at most the allowed number of turns, newest kept', () => {
    const sent = toTranscript(turns);
    expect(sent).toHaveLength(COUNCIL_LIMITS.maxTranscriptTurns);
    expect(sent[sent.length - 1].id).toBe(`t${turns.length - 1}`);
  });

  it('always includes the turn being answered, even an old one', () => {
    const sent = toTranscript(turns, 't0');
    expect(sent).toHaveLength(COUNCIL_LIMITS.maxTranscriptTurns);
    expect(sent[0].id).toBe('t0');
  });

  it('never drops the opening round, which the server needs to know who has spoken', () => {
    const long = turns.map((turn, index) => ({ ...turn, exchangeId: index < 3 ? 'opening' : `later-${index}` }));
    const sent = toTranscript(long, 't5');
    expect(sent).toHaveLength(COUNCIL_LIMITS.maxTranscriptTurns);
    expect(sent.slice(0, 4).map((turn) => turn.id)).toEqual(['t0', 't1', 't2', 't5']);
    expect(sent[sent.length - 1].id).toBe(`t${long.length - 1}`);
    // Still oldest first.
    const order = sent.map((turn) => Number(turn.id.slice(1)));
    expect(order).toEqual([...order].sort((a, b) => a - b));
  });

  it('cuts an over-long reply down to what the server accepts', () => {
    const sent = toTranscript([{ ...turns[0], text: 'x'.repeat(COUNCIL_LIMITS.maxTurnChars + 500) }]);
    expect(sent[0].text).toHaveLength(COUNCIL_LIMITS.maxTurnChars);
  });

  it('leaves out empty and still-streaming turns, flags partial ones, and strips client-only fields', () => {
    const sent = toTranscript([
      { ...turns[0], text: '  ' },
      { ...turns[1], status: 'streaming' },
      { ...turns[2], status: 'partial', partial: true },
    ]);
    expect(sent).toEqual([{ id: 't2', role: 'seat', seatId: 'stoic', text: 'reply 2', partial: true }]);
  });
});
