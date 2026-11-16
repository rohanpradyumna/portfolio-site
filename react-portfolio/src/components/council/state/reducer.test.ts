import { describe, expect, it } from 'vitest';
import { COUNCIL_LIMITS, CouncilEvent } from '@/lib/council/contract';
import { CouncilMsg, CouncilState, RequestIntent, councilReducer, initialCouncilState } from './reducer';

const run = (state: CouncilState, ...msgs: CouncilMsg[]) => msgs.reduce(councilReducer, state);

const openIntent = (overrides: Partial<RequestIntent> = {}): RequestIntent => ({
  action: 'open',
  source: 'live',
  question: 'Is ambition a virtue?',
  starterId: null,
  ...overrides,
});

const start = (requestId: string, intent: RequestIntent, expectedSeatIds: RequestIntent['seatIds'] = []): CouncilMsg => ({
  type: 'request/start',
  requestId,
  exchangeId: `x-${requestId}`,
  intent,
  expectedSeatIds: expectedSeatIds ?? [],
});

const events = (requestId: string, ...list: CouncilEvent[]): CouncilMsg => ({ type: 'request/events', requestId, events: list });

const session = (exchangesLeft = 1, visitorLeft = 3): CouncilEvent => ({
  type: 'session',
  threadToken: 'token-1',
  exchangesLeft,
  visitorLeft,
  resetAt: null,
});

const OPENING: CouncilEvent[] = [
  session(),
  { type: 'routing', seatIds: ['stoic', 'marxist'], reason: 'Two angles.' },
  { type: 'turn_start', turnId: 't1', role: 'seat', seatId: 'stoic' },
  { type: 'delta', turnId: 't1', text: 'Start with ' },
  { type: 'delta', turnId: 't1', text: 'what is yours.' },
  { type: 'turn_end', turnId: 't1' },
  { type: 'turn_start', turnId: 't2', role: 'seat', seatId: 'marxist' },
  { type: 'delta', turnId: 't2', text: 'Ask who benefits.' },
  { type: 'turn_end', turnId: 't2' },
  { type: 'follow_up', question: 'Ambition for what?' },
  { type: 'done' },
];

const typed = (text: string): CouncilState => run(initialCouncilState, { type: 'draft/set', text });

/** A finished live opening with two replies. */
const opened = (): CouncilState => run(typed('Is ambition a virtue?'), start('r1', openIntent()), events('r1', ...OPENING));

describe('an opening', () => {
  it('builds the transcript from the event stream and then goes quiet', () => {
    const state = opened();
    expect(state.request).toBeNull();
    expect(state.question).toBe('Is ambition a virtue?');
    expect(state.turns.map((turn) => [turn.seatId, turn.text, turn.status])).toEqual([
      ['stoic', 'Start with what is yours.', 'done'],
      ['marxist', 'Ask who benefits.', 'done'],
    ]);
    expect(state.exchanges[0]).toMatchObject({
      status: 'done',
      expectedSeatIds: ['stoic', 'marxist'],
      routing: { seatIds: ['stoic', 'marxist'], reason: 'Two angles.' },
      followUpQuestion: 'Ambition for what?',
    });
    expect(state.error).toBeNull();
  });

  it('moves the typed question into the thread and takes the quota the server reports', () => {
    const state = opened();
    expect(state.draft).toBe('');
    expect(state.threadToken).toBe('token-1');
    expect(state.exchangesLeft).toBe(1);
    expect(state.visitorLeft).toBe(3);
  });

  it('shows a turn growing while it streams', () => {
    const mid = run(typed('q'), start('r1', openIntent()), events('r1', ...OPENING.slice(0, 4)));
    expect(mid.turns).toHaveLength(1);
    expect(mid.turns[0]).toMatchObject({ text: 'Start with ', status: 'streaming' });
    expect(mid.exchanges[0].status).toBe('streaming');
    expect(mid.request?.id).toBe('r1');
  });

  it('produces the same conversation from a fixture as from the live stream', () => {
    const fixture = run(
      initialCouncilState,
      start('f1', openIntent({ source: 'fixture', starterId: 'starter-a' })),
      events('f1', ...OPENING),
    );
    const live = opened();
    const shape = (state: CouncilState) => state.turns.map(({ id, role, seatId, text, status }) => ({ id, role, seatId, text, status }));
    expect(shape(fixture)).toEqual(shape(live));
    expect(fixture.exchanges[0].routing).toEqual(live.exchanges[0].routing);
  });

  it('lets a fixture decide nothing about quota: a curated opening leaves one live follow-up', () => {
    const before = { ...initialCouncilState, visitorLeft: 2 };
    const state = run(
      before,
      start('f1', openIntent({ source: 'fixture', starterId: 'starter-a' })),
      events('f1', { type: 'session', threadToken: 'fixture:starter-a', exchangesLeft: 0, visitorLeft: 0, resetAt: null }, ...OPENING.slice(1)),
    );
    expect(state.exchangesLeft).toBe(COUNCIL_LIMITS.exchangesPerThread - 1);
    expect(state.visitorLeft).toBe(2);
    expect(state.threadToken).toBeNull();
  });

  it('records who was asked and clears the selection, so no seat stays picked inside the thread', () => {
    const state = run(typed('q'), { type: 'seat/select', seatId: 'absurdist' }, start('r1', openIntent({ seatIds: ['absurdist'] }), ['absurdist']));
    expect(state.askedSeatId).toBe('absurdist');
    expect(state.selectedSeatId).toBeNull();
  });

  it('leaves a typed draft alone when a starter is picked instead', () => {
    const state = run(typed('half a thought'), start('f1', openIntent({ source: 'fixture', starterId: 'starter-a' })));
    expect(state.draft).toBe('half a thought');
  });
});

describe('one request at a time', () => {
  it('drops a second request while one is in flight', () => {
    const first = run(typed('q'), start('r1', openIntent()));
    const second = councilReducer(first, start('r2', openIntent({ question: 'Another?' })));
    expect(second).toBe(first);
    expect(second.request?.id).toBe('r1');
  });

  it('ignores events from a request that is no longer the active one', () => {
    const state = run(typed('q'), start('r1', openIntent()), events('r1', ...OPENING.slice(0, 3)));
    const after = councilReducer(state, events('stale', { type: 'delta', turnId: 't1', text: 'intruder' }));
    expect(after).toBe(state);
  });

  it('ignores a follow-up when there is no thread to follow up on', () => {
    const state = councilReducer(initialCouncilState, start('r1', openIntent({ action: 'differ' })));
    expect(state).toBe(initialCouncilState);
  });

  it('stops applying a batch once the stream has ended', () => {
    const state = run(typed('q'), start('r1', openIntent()), events('r1', ...OPENING, { type: 'delta', turnId: 't2', text: ' late' }));
    expect(state.turns[1].text).toBe('Ask who benefits.');
  });
});

describe('malformed streams', () => {
  const streaming = () => run(typed('q'), start('r1', openIntent()), events('r1', ...OPENING.slice(0, 4)));

  it('ignores text for a turn that never started', () => {
    const state = streaming();
    expect(councilReducer(state, events('r1', { type: 'delta', turnId: 'ghost', text: 'boo' }))).toBe(state);
  });

  it('ignores text arriving after a turn has ended', () => {
    const ended = run(streaming(), events('r1', { type: 'turn_end', turnId: 't1' }));
    const after = councilReducer(ended, events('r1', { type: 'delta', turnId: 't1', text: ' more' }));
    expect(after.turns[0].text).toBe('Start with ');
  });

  it('does not show a seat reply that cannot be attributed to a seat', () => {
    const state = run(typed('q'), start('r1', openIntent()), events('r1', session(), { type: 'turn_start', turnId: 't1', role: 'seat' }));
    expect(state.turns).toHaveLength(0);
  });

  it('closes a turn the stream forgot to end when the next one starts', () => {
    const state = run(streaming(), events('r1', { type: 'turn_start', turnId: 't2', role: 'seat', seatId: 'marxist' }));
    expect(state.turns.map((turn) => turn.status)).toEqual(['done', 'streaming']);
  });

  it('treats a stream that ends cleanly with no reply as a retryable failure', () => {
    const state = run(typed('Why?'), start('r1', openIntent({ question: 'Why?' })), events('r1', session(), { type: 'done' }));
    expect(state.error).toMatchObject({ code: 'provider_error', retryable: true });
    expect(state.question).toBe('');
    expect(state.draft).toBe('Why?');
  });
});

describe('Stop', () => {
  it('keeps finished replies and marks the one that was cut off', () => {
    const streaming = run(typed('q'), start('r1', openIntent()), events('r1', ...OPENING.slice(0, 8)));
    const stopped = councilReducer(streaming, { type: 'request/abort' });
    expect(stopped.request).toBeNull();
    expect(stopped.turns.map((turn) => [turn.id, turn.status, turn.partial])).toEqual([
      ['t1', 'done', undefined],
      ['t2', 'partial', true],
    ]);
    expect(stopped.exchanges[0].status).toBe('stopped');
  });

  it('drops a turn that was stopped before it said anything', () => {
    const streaming = run(typed('q'), start('r1', openIntent()), events('r1', ...OPENING.slice(0, 7)));
    const stopped = councilReducer(streaming, { type: 'request/abort' });
    expect(stopped.turns.map((turn) => turn.id)).toEqual(['t1']);
  });

  it('puts the question back in the composer when nothing had been said yet', () => {
    const waiting = run(typed('Is ambition a virtue?'), { type: 'seat/select', seatId: 'advaita' }, start('r1', openIntent({ seatIds: ['advaita'] }), ['advaita']));
    const stopped = councilReducer(waiting, { type: 'request/abort' });
    expect(stopped.question).toBe('');
    expect(stopped.draft).toBe('Is ambition a virtue?');
    expect(stopped.selectedSeatId).toBe('advaita');
    expect(stopped.exchanges).toHaveLength(0);
  });

  it('does nothing when no request is running', () => {
    const state = opened();
    expect(councilReducer(state, { type: 'request/abort' })).toBe(state);
  });
});

describe('errors never lose what the visitor typed', () => {
  const failed = (event: CouncilEvent, ...before: CouncilEvent[]) =>
    run(typed('Is ambition a virtue?'), start('r1', openIntent()), events('r1', ...before, event));

  it('returns a failed first question to the composer with a way to retry', () => {
    const state = failed({ type: 'error', code: 'provider_error', message: 'upstream', retryable: true });
    expect(state.question).toBe('');
    expect(state.draft).toBe('Is ambition a virtue?');
    expect(state.request).toBeNull();
    expect(state.error).toMatchObject({ code: 'provider_error', retryable: true });
    expect(state.error?.intent?.question).toBe('Is ambition a virtue?');
  });

  it('reports a timeout the same way, with the question intact', () => {
    const state = failed({ type: 'error', code: 'timeout', message: '', retryable: true });
    expect(state.error?.code).toBe('timeout');
    expect(state.draft).toBe('Is ambition a virtue?');
  });

  it('offers no retry for an error that is not retryable', () => {
    const state = failed({ type: 'error', code: 'invalid_request', message: '', retryable: false });
    expect(state.error).toMatchObject({ code: 'invalid_request', retryable: false, intent: null });
  });

  it('keeps replies that finished before a mid-stream failure and marks the partial one', () => {
    const state = failed({ type: 'error', code: 'provider_error', message: '', retryable: true }, ...OPENING.slice(0, 8));
    expect(state.question).toBe('Is ambition a virtue?');
    expect(state.turns.map((turn) => turn.status)).toEqual(['done', 'partial']);
    expect(state.exchanges[0].status).toBe('failed');
    expect(state.error?.retryable).toBe(true);
  });

  it('puts a failed objection back in its composer, on the same reply', () => {
    const pushBack: RequestIntent = {
      action: 'push_back',
      source: 'live',
      question: 'Is ambition a virtue?',
      starterId: null,
      text: 'That dodges the point.',
      seatIds: ['stoic'],
      targetTurnId: 't1',
    };
    const sending = run(opened(), start('r2', pushBack, ['stoic']));
    expect(sending.turns[sending.turns.length - 1]).toMatchObject({ role: 'visitor', text: 'That dodges the point.', replyToSeatId: 'stoic' });

    const state = run(sending, events('r2', { type: 'error', code: 'provider_error', message: '', retryable: true }));
    expect(state.pushBack).toEqual({ turnId: 't1', seatId: 'stoic', text: 'That dodges the point.' });
    expect(state.turns.map((turn) => turn.id)).toEqual(['t1', 't2']);
    expect(state.exchanges).toHaveLength(1);
  });

  it('does not truncate an over-long draft behind the visitor’s back', () => {
    const long = 'x'.repeat(COUNCIL_LIMITS.maxInputChars + 50);
    expect(typed(long).draft).toHaveLength(COUNCIL_LIMITS.maxInputChars + 50);
  });
});

describe('limits', () => {
  const differ: RequestIntent = { action: 'differ', source: 'live', question: 'Is ambition a virtue?', starterId: null };

  it('closes the thread when the server says its exchanges are used, and says so', () => {
    const state = run(opened(), start('r2', differ), events('r2', { type: 'error', code: 'thread_limit', message: '', retryable: false }));
    expect(state.exchangesLeft).toBe(0);
    // Not a silent rollback: the visitor is told, and is not offered a retry that cannot work.
    expect(state.error).toEqual({ code: 'thread_limit', retryable: false, intent: null });
    expect(state.exchanges).toHaveLength(1);
    expect(state.turns).toHaveLength(2);
  });

  it('records the visitor limit and when it resets, keeping the question', () => {
    const state = run(
      typed('Is ambition a virtue?'),
      start('r1', openIntent()),
      events('r1', { type: 'error', code: 'visitor_limit', message: '', retryable: false, resetAt: '2030-01-01T00:00:00.000Z' }),
    );
    expect(state.visitorLeft).toBe(0);
    expect(state.resetAt).toBe('2030-01-01T00:00:00.000Z');
    expect(state.draft).toBe('Is ambition a virtue?');
    expect(state.error).toBeNull();
  });

  it.each(['budget_exhausted', 'live_disabled'] as const)('turns live off on %s', (code) => {
    const state = run(typed('q'), start('r1', openIntent()), events('r1', { type: 'error', code, message: '', retryable: false }));
    expect(state.live).toBe('unavailable');
    expect(state.liveOffReason).toBe(code);
  });

  it('follows the server down to zero exchanges after a follow-up', () => {
    const state = run(
      opened(),
      start('r2', differ),
      events('r2', session(0, 2), { type: 'turn_start', turnId: 's1', role: 'synthesis' }, { type: 'delta', turnId: 's1', text: 'They differ on scope.' }, { type: 'turn_end', turnId: 's1' }, { type: 'done' }),
    );
    expect(state.exchangesLeft).toBe(0);
    expect(state.visitorLeft).toBe(2);
    expect(state.turns[state.turns.length - 1]).toMatchObject({ role: 'synthesis', action: 'differ', status: 'done' });
    expect(state.announce).toMatchObject({ kind: 'done', threadEnded: true });
  });

  it('treats a failed status call as live being unavailable', () => {
    const state = councilReducer(initialCouncilState, { type: 'status/loaded', status: null });
    expect(state.live).toBe('unavailable');
  });

  it('takes availability and allowance from a successful status call', () => {
    const state = councilReducer(initialCouncilState, { type: 'status/loaded', status: { live: true, visitorLeft: 4, resetAt: null } });
    expect(state).toMatchObject({ live: 'available', visitorLeft: 4, liveOffReason: null });
  });
});

describe('announcements', () => {
  it('announces a reply once when it finishes, never while it streams', () => {
    let state = run(typed('q'), start('r1', openIntent()), events('r1', session()));
    const seqs: number[] = [];
    for (const event of OPENING.slice(1)) {
      state = councilReducer(state, events('r1', event));
      seqs.push(state.announce?.seq ?? 0);
    }
    const kinds = OPENING.slice(1).map((event) => event.type);
    // The sequence only moves on routing, each turn_end and done.
    const bumps = kinds.filter((_, index) => seqs[index] !== (index === 0 ? 0 : seqs[index - 1]));
    expect(bumps).toEqual(['routing', 'turn_end', 'turn_end', 'done']);
  });

  it('names the reply that just finished', () => {
    const state = run(typed('q'), start('r1', openIntent()), events('r1', ...OPENING.slice(0, 6)));
    expect(state.announce).toMatchObject({ kind: 'replied', turnId: 't1' });
  });
});

describe('New question', () => {
  it('clears the thread but keeps the draft and what is known about quota', () => {
    const state = run(opened(), { type: 'draft/set', text: 'next thought' }, { type: 'thread/reset' });
    expect(state.question).toBe('');
    expect(state.turns).toHaveLength(0);
    expect(state.exchangesLeft).toBe(COUNCIL_LIMITS.exchangesPerThread);
    expect(state.draft).toBe('next thought');
    expect(state.visitorLeft).toBe(3);
  });
});

describe('what the server does that the contract leaves open', () => {
  const differ: RequestIntent = { action: 'differ', source: 'live', question: 'Is ambition a virtue?', starterId: null };

  it('shows a reply the council gives as one, with no seat and no routing, on an opening', () => {
    const state = run(
      typed('q'),
      start('r1', openIntent()),
      events(
        'r1',
        session(),
        { type: 'turn_start', turnId: 'c1', role: 'synthesis' },
        { type: 'delta', turnId: 'c1', text: 'This is not something the council can weigh in on.' },
        { type: 'turn_end', turnId: 'c1' },
        { type: 'done' },
      ),
    );
    expect(state.turns).toHaveLength(1);
    expect(state.turns[0]).toMatchObject({ role: 'synthesis', action: 'open', status: 'done' });
    expect(state.turns[0].seatId).toBeUndefined();
    expect(state.exchanges[0]).toMatchObject({ status: 'done', routing: null, followUpQuestion: null });
    expect(state.question).toBe('Is ambition a virtue?');
  });

  it('marks a turn partial when an error arrives with no turn_end before it', () => {
    const state = run(
      typed('q'),
      start('r1', openIntent()),
      events('r1', ...OPENING.slice(0, 5), { type: 'error', code: 'provider_error', message: '', retryable: true }),
    );
    expect(state.turns).toHaveLength(1);
    expect(state.turns[0]).toMatchObject({ id: 't1', status: 'partial', partial: true, text: 'Start with what is yours.' });
  });

  it('handles live_disabled arriving mid-stream: keeps what was said and turns live off', () => {
    const state = run(
      typed('q'),
      start('r1', openIntent()),
      events('r1', ...OPENING.slice(0, 8), { type: 'error', code: 'live_disabled', message: '', retryable: false }),
    );
    expect(state.live).toBe('unavailable');
    expect(state.request).toBeNull();
    expect(state.turns.map((turn) => turn.status)).toEqual(['done', 'partial']);
    expect(state.error).toBeNull();
  });

  it.each(['thread_limit', 'visitor_limit', 'budget_exhausted', 'busy', 'invalid_request', 'timeout'] as const)(
    'ends the request cleanly when %s arrives after the session event',
    (code) => {
      const state = run(opened(), start('r2', differ), events('r2', session(0, 2), { type: 'error', code, message: '', retryable: false }));
      expect(state.request).toBeNull();
      expect(state.turns).toHaveLength(2);
      expect(state.exchanges).toHaveLength(1);
    },
  );

  it('takes a corrected allowance from a status call after a request that failed', () => {
    // The session event counted the request; the server then refunded it.
    const failed = run(
      typed('q'),
      start('r1', openIntent({ question: 'q' })),
      events('r1', session(1, 2), { type: 'error', code: 'provider_error', message: '', retryable: true }),
    );
    // Nothing was shown, so the count is already back where it was before the request.
    expect(failed.visitorLeft).toBeNull();
    const corrected = councilReducer(failed, {
      type: 'status/loaded',
      origin: 'afterRequest',
      status: { live: true, visitorLeft: 3, resetAt: null },
    });
    expect(corrected.visitorLeft).toBe(3);
    expect(corrected.draft).toBe('q');
    expect(corrected.error?.code).toBe('provider_error');
  });

  it('keeps the whole council thinking through a long silence, then accepts everything at once', () => {
    const waiting = run(typed('q'), start('r1', openIntent()), events('r1', session()));
    expect(waiting.exchanges[0]).toMatchObject({ status: 'pending', expectedSeatIds: [] });
    const state = run(waiting, events('r1', ...OPENING.slice(1)));
    expect(state.turns.map((turn) => turn.status)).toEqual(['done', 'done']);
    expect(state.exchanges[0].routing?.seatIds).toEqual(['stoic', 'marxist']);
  });
});

describe('Stop is not a free retry', () => {
  const differ: RequestIntent = { action: 'differ', source: 'live', question: 'Is ambition a virtue?', starterId: null };

  it('spends the thread’s follow-up even when Stop beats the server’s first event', () => {
    const state = run(opened(), start('r2', differ), { type: 'request/abort' });
    expect(state.exchangesLeft).toBe(0);
    expect(state.visitorLeft).toBe(2);
    expect(state.exchanges).toHaveLength(1);
  });

  it('does not count the same exchange twice once the server has reported it', () => {
    const state = run(opened(), start('r2', differ), events('r2', session(0, 2)), { type: 'request/abort' });
    expect(state.exchangesLeft).toBe(0);
    expect(state.visitorLeft).toBe(2);
  });

  it('counts a stopped first question against the day, and gives the words back', () => {
    const state = run({ ...typed('q'), visitorLeft: 4 }, start('r1', openIntent({ question: 'q' })), { type: 'request/abort' });
    expect(state.visitorLeft).toBe(3);
    expect(state.draft).toBe('q');
    expect(state.question).toBe('');
  });

  it('costs nothing to stop a curated reply', () => {
    const state = run(
      { ...initialCouncilState, visitorLeft: 4 },
      start('f1', openIntent({ source: 'fixture', starterId: 'starter-a' })),
      { type: 'request/abort' },
    );
    expect(state.visitorLeft).toBe(4);
    expect(state.exchangesLeft).toBe(COUNCIL_LIMITS.exchangesPerThread);
  });
});

// ---------------------------------------------------------------------------
// Regressions from the independent review
// ---------------------------------------------------------------------------

const available: CouncilState = { ...initialCouncilState, live: 'available', visitorLeft: 4 };
const openedLive = (): CouncilState => run({ ...available, draft: 'Is ambition a virtue?' }, start('r1', openIntent()), events('r1', ...OPENING));

const objection: RequestIntent = {
  action: 'push_back',
  source: 'live',
  question: 'Is ambition a virtue?',
  starterId: null,
  text: 'My carefully typed objection.',
  seatIds: ['stoic'],
  targetTurnId: 't1',
};

describe('review: status and POST must tell the same story about the site budget', () => {
  const refused = (code: 'budget_exhausted' | 'live_disabled') =>
    run(
      { ...available, draft: 'Should I quit?' },
      start('r1', openIntent({ question: 'Should I quit?' })),
      events('r1', { type: 'error', code, message: 'x', resetAt: '2030-01-02T00:00:00.000Z', retryable: false }),
    );

  it('reads budget exhaustion off the status call, with the visitor’s own allowance intact', () => {
    const state = councilReducer(initialCouncilState, {
      type: 'status/loaded',
      status: { live: false, offReason: 'budget_exhausted', visitorLeft: 3, resetAt: '2030-01-02T00:00:00.000Z' },
    });
    expect(state).toMatchObject({ live: 'unavailable', liveOffReason: 'budget_exhausted', visitorLeft: 3, resetAt: '2030-01-02T00:00:00.000Z' });
  });

  it('reads the kill switch off the status call as its own reason', () => {
    const state = councilReducer(initialCouncilState, {
      type: 'status/loaded',
      status: { live: false, offReason: 'live_disabled', visitorLeft: 4, resetAt: null },
    });
    expect(state).toMatchObject({ live: 'unavailable', liveOffReason: 'live_disabled' });
  });

  it('handles an older server that says live is off without saying why', () => {
    const unknown = councilReducer(initialCouncilState, { type: 'status/loaded', status: { live: false, visitorLeft: 4, resetAt: null } });
    expect(unknown.liveOffReason).toBe('live_disabled');
    // A reason already learned from a refused request is not thrown away for a vaguer one.
    const known = councilReducer(refused('budget_exhausted'), {
      type: 'status/loaded',
      origin: 'afterRequest',
      status: { live: false, visitorLeft: 4, resetAt: null },
    });
    expect(known).toMatchObject({ live: 'unavailable', liveOffReason: 'budget_exhausted', resetAt: '2030-01-02T00:00:00.000Z' });
  });

  it.each([
    ['at the generation cap', { live: true, visitorLeft: 0, resetAt: '2030-01-02T00:00:00.000Z' }],
    ['one reservation short of the dollar cap', { live: true, visitorLeft: 4, resetAt: null }],
  ])('does not let the follow-up status call undo a budget refusal (%s)', (_label, status) => {
    const state = councilReducer(refused('budget_exhausted'), { type: 'status/loaded', origin: 'afterRequest', status });
    expect(state.live).toBe('unavailable');
    expect(state.liveOffReason).toBe('budget_exhausted');
    expect(state.resetAt).toBe('2030-01-02T00:00:00.000Z');
    expect(state.visitorLeft).toBe(status.visitorLeft);
    expect(state.draft).toBe('Should I quit?');
  });

  it('does not let the follow-up status call undo a kill-switch refusal either', () => {
    const state = councilReducer(refused('live_disabled'), {
      type: 'status/loaded',
      origin: 'afterRequest',
      status: { live: true, visitorLeft: 4, resetAt: null },
    });
    expect(state).toMatchObject({ live: 'unavailable', liveOffReason: 'live_disabled' });
  });

  it('turns live back on when a later check positively reports it', () => {
    const sticky = councilReducer(refused('budget_exhausted'), {
      type: 'status/loaded',
      origin: 'afterRequest',
      status: { live: true, visitorLeft: 4, resetAt: null },
    });
    const later = councilReducer(sticky, { type: 'status/loaded', origin: 'check', status: { live: true, visitorLeft: 4, resetAt: null } });
    expect(later).toMatchObject({ live: 'available', liveOffReason: null, liveOffBy: null });
  });

  it('still lets the follow-up status call correct things when no request was refused for being off', () => {
    const failed = run(available, start('r1', openIntent()), events('r1', { type: 'error', code: 'provider_error', message: '', retryable: true }));
    const state = councilReducer(failed, { type: 'status/loaded', origin: 'afterRequest', status: { live: true, visitorLeft: 4, resetAt: null } });
    expect(state).toMatchObject({ live: 'available', visitorLeft: 4 });
  });

  it('accepts a follow-up status call that agrees live is off', () => {
    const state = councilReducer(refused('budget_exhausted'), {
      type: 'status/loaded',
      origin: 'afterRequest',
      status: { live: false, offReason: 'budget_exhausted', visitorLeft: 2, resetAt: '2030-01-03T00:00:00.000Z' },
    });
    expect(state).toMatchObject({ live: 'unavailable', liveOffReason: 'budget_exhausted', visitorLeft: 2, resetAt: '2030-01-03T00:00:00.000Z' });
  });
});

describe('review: a failed follow-up must leave client and server agreeing about the last exchange', () => {
  const sent = () => run(openedLive(), { type: 'pushBack/open', turnId: 't1', seatId: 'stoic', text: objection.text }, start('r2', objection, ['stoic']));

  it('gives the exchange back when the follow-up fails before any text, and returns the objection', () => {
    const state = run(sent(), events('r2', session(0, 2), { type: 'error', code: 'timeout', message: 'x', retryable: true }));
    expect(state.exchangesLeft).toBe(1);
    expect(state.visitorLeft).toBe(3);
    expect(state.pushBack).toEqual({ turnId: 't1', seatId: 'stoic', text: 'My carefully typed objection.' });
    expect(state.exchanges).toHaveLength(1);
    // The restored composer is the retry: a second "Try again" would resend stale words.
    expect(state.error).toEqual({ code: 'timeout', retryable: false, intent: null });
  });

  it('survives the status refresh that follows, unlike before', () => {
    const state = run(
      sent(),
      events('r2', session(0, 2), { type: 'error', code: 'timeout', message: 'x', retryable: true }),
      { type: 'status/loaded', origin: 'afterRequest', status: { live: true, visitorLeft: 3, resetAt: null } },
    );
    expect(state).toMatchObject({ exchangesLeft: 1, visitorLeft: 3, live: 'available' });
    expect(state.pushBack?.text).toBe('My carefully typed objection.');
  });

  it('prefers the counts the server reports with the error over its own bookkeeping', () => {
    const released = run(sent(), events('r2', session(0, 2), { type: 'error', code: 'provider_error', message: 'x', retryable: true, exchangesLeft: 1, visitorLeft: 3 }));
    expect(released).toMatchObject({ exchangesLeft: 1, visitorLeft: 3 });
    // The server may also say the exchange is gone even though nothing was shown. It decides.
    const charged = run(sent(), events('r2', session(0, 2), { type: 'error', code: 'provider_error', message: 'x', retryable: false, exchangesLeft: 0, visitorLeft: 2 }));
    expect(charged).toMatchObject({ exchangesLeft: 0, visitorLeft: 2 });
    expect(charged.pushBack?.text).toBe('My carefully typed objection.');
    expect(charged.error).toMatchObject({ retryable: false, intent: null });
  });

  it('keeps the typed objection recoverable when the failure cannot be retried', () => {
    const state = run(
      sent(),
      events('r2', session(0, 2), { type: 'error', code: 'live_disabled', message: 'x', retryable: false }),
      { type: 'status/loaded', origin: 'afterRequest', status: { live: true, visitorLeft: 3, resetAt: null } },
    );
    expect(state.pushBack?.text).toBe('My carefully typed objection.');
    expect(state.exchangesLeft).toBe(1);
    expect(state).toMatchObject({ live: 'unavailable', liveOffReason: 'live_disabled' });
  });

  it.each(['invalid_request', 'busy', 'provider_error', 'timeout', 'thread_limit', 'visitor_limit', 'budget_exhausted', 'live_disabled'] as const)(
    'never loses the objection, whatever the failure (%s)',
    (code) => {
      const before = run(sent(), events('r2', { type: 'error', code, message: 'x', retryable: false }));
      const after = run(sent(), events('r2', session(0, 2), { type: 'error', code, message: 'x', retryable: false }));
      expect(before.pushBack?.text).toBe('My carefully typed objection.');
      expect(after.pushBack?.text).toBe('My carefully typed objection.');
    },
  );

  it('offers Try again for a move with no words of its own, when the server allows it', () => {
    const sayMore: RequestIntent = { action: 'say_more', source: 'live', question: 'Is ambition a virtue?', starterId: null, seatIds: ['stoic'], targetTurnId: 't1' };
    const state = run(openedLive(), start('r2', sayMore, ['stoic']), events('r2', session(0, 2), { type: 'error', code: 'provider_error', message: '', retryable: true }));
    expect(state.exchangesLeft).toBe(1);
    expect(state.error).toMatchObject({ code: 'provider_error', retryable: true });
    expect(state.error?.intent?.action).toBe('say_more');
  });

  it('obeys retryable: false and offers nothing to retry', () => {
    const state = run(openedLive(), start('r2', { ...objection, action: 'say_more', text: undefined }, ['stoic']), events('r2', { type: 'error', code: 'provider_error', message: '', retryable: false }));
    expect(state.error).toEqual({ code: 'provider_error', retryable: false, intent: null });
  });
});

describe('review: a follow-up that fails after text was shown has been charged', () => {
  const sayMore: RequestIntent = { action: 'say_more', source: 'live', question: 'Is ambition a virtue?', starterId: null, seatIds: ['stoic'], targetTurnId: 't1' };
  const partial = (retryable: boolean) =>
    run(
      openedLive(),
      start('r2', sayMore, ['stoic']),
      events(
        'r2',
        session(0, 2),
        { type: 'turn_start', turnId: 'f1', role: 'seat', seatId: 'stoic' },
        { type: 'delta', turnId: 'f1', text: 'Going one level deeper, the' },
        { type: 'error', code: 'provider_error', message: '', retryable },
      ),
    );

  it('keeps the partial reply, stays at zero exchanges, and offers no retry when the server says so', () => {
    const state = partial(false);
    expect(state.exchangesLeft).toBe(0);
    expect(state.turns[state.turns.length - 1]).toMatchObject({ id: 'f1', status: 'partial' });
    expect(state.error).toEqual({ code: 'provider_error', retryable: false, intent: null });
  });

  it('does not offer a retry that can only hit the thread limit, even if an older server calls it retryable', () => {
    expect(partial(true).error).toEqual({ code: 'provider_error', retryable: false, intent: null });
  });

  it('shows the thread as ended, with a message, if a retry is refused with thread_limit anyway', () => {
    const state = run(partial(false), start('r3', sayMore, ['stoic']), events('r3', { type: 'error', code: 'thread_limit', message: '', retryable: false }));
    expect(state.exchangesLeft).toBe(0);
    expect(state.error).toEqual({ code: 'thread_limit', retryable: false, intent: null });
    // The partial reply from the charged attempt is still on the page.
    expect(state.turns.some((turn) => turn.id === 'f1')).toBe(true);
    expect(state.exchanges).toHaveLength(2);
  });

  it('obeys retryable: false on an opening that died mid-reply, keeping what was said', () => {
    const state = run(available, start('r1', openIntent()), events('r1', ...OPENING.slice(0, 8), { type: 'error', code: 'provider_error', message: '', retryable: false }));
    expect(state.error).toEqual({ code: 'provider_error', retryable: false, intent: null });
    expect(state.turns.map((turn) => turn.status)).toEqual(['done', 'partial']);
    expect(state.exchangesLeft).toBe(1);
  });

  it('puts the day’s count back when an opening fails after the session event with nothing shown', () => {
    const state = run(available, start('r1', openIntent()), events('r1', session(1, 3), { type: 'error', code: 'provider_error', message: '', retryable: true }));
    expect(state.visitorLeft).toBe(4);
    expect(state.exchangesLeft).toBe(COUNCIL_LIMITS.exchangesPerThread);
    expect(state.error).toMatchObject({ retryable: true });
    expect(state.error?.intent?.action).toBe('open');
  });
});
