import { afterEach, describe, expect, it, vi } from 'vitest';
import { COUNCIL_LIMITS, CouncilEvent, CouncilRequest, CouncilTransport, Starter } from '@/lib/council/contract';
import { INSTANT_PACE, chunkText, createFixtureTransport, createSimulatedLiveTransport } from './fixture';
import { fetchCouncilStatus, liveTransport } from './live';

const STARTER: Starter = {
  id: 'starter-a',
  question: 'Can I want more and still be content?',
  opening: {
    routing: { seatIds: ['stoic', 'marxist'], reason: 'Two weights.' },
    turns: [
      { role: 'seat', seatId: 'stoic', text: 'Sort what is yours from what is not, then act on the first.' },
      { role: 'seat', seatId: 'marxist', text: 'Ask who profits from your wanting.' },
    ],
    followUpQuestion: 'More of what?',
  },
  followUps: {
    differ: { turns: [{ role: 'synthesis', text: 'They differ on where the wanting comes from.' }] },
  },
};

const request = (overrides: Partial<CouncilRequest> = {}): CouncilRequest => ({
  requestId: 'req-1',
  action: 'open',
  question: STARTER.question,
  transcript: [],
  starterId: STARTER.id,
  ...overrides,
});

async function collect(transport: CouncilTransport, req: CouncilRequest, signal = new AbortController().signal) {
  const events: CouncilEvent[] = [];
  for await (const event of transport(req, signal)) events.push(event);
  return events;
}

const textOf = (events: CouncilEvent[], turnId: string) =>
  events.flatMap((event) => (event.type === 'delta' && event.turnId === turnId ? [event.text] : [])).join('');

describe('fixtureTransport', () => {
  const transport = createFixtureTransport([STARTER], INSTANT_PACE);

  it('replays a starter opening in protocol order', async () => {
    const events = await collect(transport, request());
    const order = events.map((event) => event.type).filter((type, index, all) => type !== 'delta' || all[index - 1] !== 'delta');
    expect(order).toEqual(['session', 'routing', 'turn_start', 'delta', 'turn_end', 'turn_start', 'delta', 'turn_end', 'follow_up', 'done']);
  });

  it('streams each reply in several pieces that add up to the exact text', async () => {
    const events = await collect(transport, request());
    const starts = events.filter((event) => event.type === 'turn_start');
    expect(starts).toHaveLength(2);
    const [first, second] = starts.map((event) => (event.type === 'turn_start' ? event.turnId : ''));
    expect(events.filter((event) => event.type === 'delta' && event.turnId === first).length).toBeGreaterThan(2);
    expect(textOf(events, first)).toBe(STARTER.opening.turns[0].text);
    expect(textOf(events, second)).toBe(STARTER.opening.turns[1].text);
  });

  it('plays a scripted follow-up for the same starter', async () => {
    const events = await collect(transport, request({ action: 'differ' }));
    expect(events.some((event) => event.type === 'turn_start' && event.role === 'synthesis')).toBe(true);
    expect(events[events.length - 1]).toEqual({ type: 'done' });
  });

  it('answers honestly when there is nothing curated for the request', async () => {
    const freeform = await collect(transport, request({ starterId: undefined, question: 'Something new?' }));
    expect(freeform).toEqual([expect.objectContaining({ type: 'error', code: 'live_disabled', retryable: false })]);
    const unscripted = await collect(transport, request({ action: 'say_more' }));
    expect(unscripted).toEqual([expect.objectContaining({ type: 'error', code: 'live_disabled' })]);
  });

  it('stops promptly when aborted mid-reply, without finishing the turn', async () => {
    const slow = createFixtureTransport([STARTER], { routingMs: 0, thinkMs: 0, chunkMs: 40 });
    const controller = new AbortController();
    const events: CouncilEvent[] = [];
    const started = Date.now();
    for await (const event of slow(request(), controller.signal)) {
      events.push(event);
      if (event.type === 'delta') controller.abort();
    }
    expect(Date.now() - started).toBeLessThan(1000);
    expect(events.filter((event) => event.type === 'delta')).toHaveLength(1);
    expect(events.some((event) => event.type === 'turn_end' || event.type === 'done')).toBe(false);
  });
});

describe('chunkText', () => {
  it('loses nothing, including spacing and punctuation', () => {
    const text = 'Admiring is a judgment.  Respecting, in the sense you mean, is closer to trusting a character.';
    expect(chunkText(text).join('')).toBe(text);
  });
});

describe('simulated live transport (?fixtures=1)', () => {
  it('keeps the books the way the server would', async () => {
    const transport = createSimulatedLiveTransport([STARTER], INSTANT_PACE);
    const opening = await collect(transport, request());
    expect(opening[0]).toMatchObject({ type: 'session', exchangesLeft: 1, visitorLeft: COUNCIL_LIMITS.visitorDailyGenerations - 1 });
    const followUp = await collect(transport, request({ action: 'differ' }));
    expect(followUp[0]).toMatchObject({ type: 'session', exchangesLeft: 0, visitorLeft: COUNCIL_LIMITS.visitorDailyGenerations - 2 });
  });

  it('never pretends to answer a question it has no script for', async () => {
    const transport = createSimulatedLiveTransport([STARTER], INSTANT_PACE);
    const events = await collect(transport, request({ starterId: undefined, question: 'Unscripted?' }));
    expect(events).toEqual([expect.objectContaining({ type: 'error', code: 'live_disabled' })]);
  });
});

describe('liveTransport', () => {
  afterEach(() => vi.unstubAllGlobals());

  const ndjson = (...events: unknown[]) => events.map((event) => `${JSON.stringify(event)}\n`).join('');

  it('POSTs the request as JSON and yields the streamed events', async () => {
    const fetchMock = vi.fn(async () => new Response(ndjson({ type: 'delta', turnId: 't1', text: 'hi' }, { type: 'done' }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const events = await collect(liveTransport, request());
    expect(events).toEqual([{ type: 'delta', turnId: 't1', text: 'hi' }, { type: 'done' }]);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/council');
    expect(init.method).toBe('POST');
    expect(JSON.parse(String(init.body))).toEqual(request());
  });

  it('turns a non-200 response whose body is an error event into that event', async () => {
    const body = { type: 'error', code: 'visitor_limit', message: 'Daily limit.', resetAt: '2030-01-01T00:00:00Z', retryable: false };
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(body), { status: 429 })));
    expect(await collect(liveTransport, request())).toEqual([body]);
  });

  it.each([
    [400, 'invalid_request'],
    [429, 'thread_limit'],
    [429, 'visitor_limit'],
    [429, 'busy'],
    [503, 'budget_exhausted'],
    [503, 'live_disabled'],
  ] as const)('passes through the error event in a %i body (%s)', async (status, code) => {
    const body = { type: 'error', code, message: 'no', resetAt: null, retryable: code === 'busy' };
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(body), { status })));
    expect(await collect(liveTransport, request())).toEqual([body]);
  });

  it('assumes busy, the one retryable reading, for a 429 it cannot parse', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 429 })));
    expect(await collect(liveTransport, request())).toEqual([expect.objectContaining({ type: 'error', code: 'busy', retryable: true })]);
  });

  it('yields the events that arrived before a stream was cut off, then ends', async () => {
    const encoder = new TextEncoder();
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode(ndjson({ type: 'turn_start', turnId: 't1', role: 'seat', seatId: 'stoic' }, { type: 'delta', turnId: 't1', text: 'Half a' })));
        controller.error(new Error('socket hang up'));
      },
    });
    vi.stubGlobal('fetch', vi.fn(async () => new Response(body, { status: 200 })));
    const events = await collect(liveTransport, request());
    expect(events[events.length - 1]).toMatchObject({ type: 'error', code: 'provider_error', retryable: true });
    expect(events.some((event) => event.type === 'turn_end')).toBe(false);
  });

  it('maps a non-200 response with an unusable body to the closest contract error', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('<html>Service Unavailable</html>', { status: 503 })));
    expect(await collect(liveTransport, request())).toEqual([expect.objectContaining({ type: 'error', code: 'live_disabled', retryable: false })]);
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{"oops":true}', { status: 500 })));
    expect(await collect(liveTransport, request())).toEqual([expect.objectContaining({ type: 'error', code: 'provider_error', retryable: true })]);
  });

  it('reports a network failure as a retryable error instead of throwing', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new TypeError('Failed to fetch');
    }));
    expect(await collect(liveTransport, request())).toEqual([expect.objectContaining({ type: 'error', code: 'provider_error', retryable: true })]);
  });

  it('ends silently when the visitor aborts before the response arrives', async () => {
    const controller = new AbortController();
    vi.stubGlobal('fetch', vi.fn(async () => {
      controller.abort();
      throw new DOMException('Aborted', 'AbortError');
    }));
    expect(await collect(liveTransport, request(), controller.signal)).toEqual([]);
  });
});

describe('fetchCouncilStatus', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('returns the status the server reports', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ live: true, visitorLeft: 3, resetAt: null }), { status: 200 })));
    expect(await fetchCouncilStatus()).toEqual({ live: true, visitorLeft: 3, resetAt: null });
  });

  it('passes on why live is off', async () => {
    const body = { live: false, offReason: 'budget_exhausted', visitorLeft: 3, resetAt: '2030-01-02T00:00:00.000Z' };
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(body), { status: 200 })));
    expect(await fetchCouncilStatus()).toEqual(body);
  });

  it('accepts an older server that gives no reason, and ignores a reason it does not know', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ live: false, visitorLeft: 4, resetAt: null }), { status: 200 })));
    expect(await fetchCouncilStatus()).toEqual({ live: false, visitorLeft: 4, resetAt: null });
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ live: false, offReason: 'gremlins', visitorLeft: 4, resetAt: null }), { status: 200 })));
    expect(await fetchCouncilStatus()).toEqual({ live: false, visitorLeft: 4, resetAt: null });
  });

  it('returns null for a failed call, a bad status code or a malformed body', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new TypeError('offline');
    }));
    expect(await fetchCouncilStatus()).toBeNull();
    vi.stubGlobal('fetch', vi.fn(async () => new Response('nope', { status: 404 })));
    expect(await fetchCouncilStatus()).toBeNull();
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ live: 'yes' }), { status: 200 })));
    expect(await fetchCouncilStatus()).toBeNull();
  });
});
