import { describe, expect, it } from 'vitest';
import { CouncilEvent } from '@/lib/council/contract';
import { createNdjsonParser, parseCouncilEvent, readNdjson } from './ndjson';

const line = (event: unknown) => `${JSON.stringify(event)}\n`;

const DELTA = { type: 'delta', turnId: 't1', text: 'hello' };
const DONE = { type: 'done' };

function streamOf(chunks: Uint8Array[]): ReadableStream<Uint8Array> {
  let index = 0;
  return new ReadableStream({
    pull(controller) {
      if (index < chunks.length) controller.enqueue(chunks[index++]);
      else controller.close();
    },
  });
}

async function collect(stream: ReadableStream<Uint8Array>, signal = new AbortController().signal): Promise<CouncilEvent[]> {
  const events: CouncilEvent[] = [];
  for await (const event of readNdjson(stream, signal)) events.push(event);
  return events;
}

describe('createNdjsonParser', () => {
  it('yields one event per complete line', () => {
    const parser = createNdjsonParser();
    expect(parser.push(line(DELTA) + line(DONE))).toEqual([DELTA, DONE]);
  });

  it('holds a line that arrives in pieces until its newline does', () => {
    const parser = createNdjsonParser();
    const text = line(DELTA);
    expect(parser.push(text.slice(0, 9))).toEqual([]);
    expect(parser.push(text.slice(9, 20))).toEqual([]);
    expect(parser.push(text.slice(20))).toEqual([DELTA]);
  });

  it('handles a chunk that ends one line and begins the next', () => {
    const parser = createNdjsonParser();
    const text = line(DELTA) + line(DONE);
    const cut = line(DELTA).length + 4;
    expect(parser.push(text.slice(0, cut))).toEqual([DELTA]);
    expect(parser.push(text.slice(cut))).toEqual([DONE]);
  });

  it('accepts CRLF line endings and skips blank lines', () => {
    const parser = createNdjsonParser();
    expect(parser.push(`${JSON.stringify(DELTA)}\r\n\r\n\n${JSON.stringify(DONE)}\r\n`)).toEqual([DELTA, DONE]);
  });

  it('gives up the last line on flush when the stream ends without a newline', () => {
    const parser = createNdjsonParser();
    expect(parser.push(JSON.stringify(DONE))).toEqual([]);
    expect(parser.flush()).toEqual([DONE]);
    expect(parser.flush()).toEqual([]);
  });

  it('skips a line that is not JSON and carries on with the next', () => {
    const parser = createNdjsonParser();
    expect(parser.push(`<html>502 Bad Gateway</html>\n${line(DELTA)}{"type":"delta","turnId":\n${line(DONE)}`)).toEqual([DELTA, DONE]);
  });

  it('keeps newlines that are inside a reply’s text', () => {
    const parser = createNdjsonParser();
    const event = { type: 'delta', turnId: 't1', text: 'first\nsecond' };
    expect(parser.push(line(event))).toEqual([event]);
  });
});

describe('parseCouncilEvent', () => {
  it('drops event types it does not know', () => {
    expect(parseCouncilEvent({ type: 'usage', tokens: 12 })).toBeNull();
    expect(parseCouncilEvent('done')).toBeNull();
    expect(parseCouncilEvent(null)).toBeNull();
    expect(parseCouncilEvent([{ type: 'done' }])).toBeNull();
  });

  it('rejects a seat turn with no usable seat, but allows a synthesis without one', () => {
    expect(parseCouncilEvent({ type: 'turn_start', turnId: 't1', role: 'seat' })).toBeNull();
    expect(parseCouncilEvent({ type: 'turn_start', turnId: 't1', role: 'seat', seatId: 'nietzsche' })).toBeNull();
    expect(parseCouncilEvent({ type: 'turn_start', turnId: 't1', role: 'synthesis' })).toEqual({ type: 'turn_start', turnId: 't1', role: 'synthesis' });
  });

  it('keeps who a turn is replying to only when that seat exists', () => {
    expect(parseCouncilEvent({ type: 'turn_start', turnId: 't1', role: 'seat', seatId: 'stoic', replyToSeatId: 'marxist' })).toEqual({
      type: 'turn_start',
      turnId: 't1',
      role: 'seat',
      seatId: 'stoic',
      replyToSeatId: 'marxist',
    });
    expect(parseCouncilEvent({ type: 'turn_start', turnId: 't1', role: 'seat', seatId: 'stoic', replyToSeatId: 'plato' })).toEqual({
      type: 'turn_start',
      turnId: 't1',
      role: 'seat',
      seatId: 'stoic',
    });
  });

  it('filters unknown seats out of a routing event', () => {
    expect(parseCouncilEvent({ type: 'routing', seatIds: ['stoic', 'plato', 'advaita'], reason: 'r' })).toEqual({
      type: 'routing',
      seatIds: ['stoic', 'advaita'],
      reason: 'r',
    });
  });

  it('rejects a session without its counters, and a delta without text', () => {
    expect(parseCouncilEvent({ type: 'session', threadToken: 't' })).toBeNull();
    expect(parseCouncilEvent({ type: 'delta', turnId: 't1' })).toBeNull();
  });

  it('only passes error codes from the contract, and defaults retryable to false', () => {
    expect(parseCouncilEvent({ type: 'error', code: 'out_of_coffee', message: 'x', retryable: true })).toBeNull();
    expect(parseCouncilEvent({ type: 'error', code: 'visitor_limit', message: 'x', resetAt: '2030-01-01T00:00:00Z' })).toEqual({
      type: 'error',
      code: 'visitor_limit',
      message: 'x',
      resetAt: '2030-01-01T00:00:00Z',
      retryable: false,
    });
  });
});

describe('parseCouncilEvent: settled counts on an error', () => {
  it('carries the counts the server reports after settling a failed exchange', () => {
    expect(parseCouncilEvent({ type: 'error', code: 'timeout', message: 'x', retryable: true, exchangesLeft: 1, visitorLeft: 3 })).toEqual({
      type: 'error',
      code: 'timeout',
      message: 'x',
      resetAt: null,
      retryable: true,
      exchangesLeft: 1,
      visitorLeft: 3,
    });
  });

  it('leaves them out when the server does not send usable numbers', () => {
    const event = parseCouncilEvent({ type: 'error', code: 'timeout', message: 'x', retryable: true, exchangesLeft: '1', visitorLeft: null });
    expect(event).not.toHaveProperty('exchangesLeft');
    expect(event).not.toHaveProperty('visitorLeft');
  });
});

describe('readNdjson', () => {
  const encode = (text: string) => new TextEncoder().encode(text);

  it('reads events across arbitrary network chunk boundaries', async () => {
    const bytes = encode(line(DELTA) + line({ type: 'turn_end', turnId: 't1' }) + line(DONE));
    const chunks = [bytes.slice(0, 7), bytes.slice(7, 8), bytes.slice(8, 50), bytes.slice(50)];
    expect(await collect(streamOf(chunks))).toEqual([DELTA, { type: 'turn_end', turnId: 't1' }, DONE]);
  });

  it('survives a multi-byte character split across two chunks', async () => {
    const event = { type: 'delta', turnId: 't1', text: 'doesn’t naïve 思' };
    const bytes = encode(line(event));
    const cut = bytes.indexOf(0xe2) + 1; // inside the curly apostrophe
    expect(await collect(streamOf([bytes.slice(0, cut), bytes.slice(cut)]))).toEqual([event]);
  });

  it('emits a final event that has no trailing newline', async () => {
    expect(await collect(streamOf([encode(line(DELTA) + JSON.stringify(DONE))]))).toEqual([DELTA, DONE]);
  });

  it('stops yielding as soon as the signal aborts', async () => {
    const controller = new AbortController();
    const chunks = [encode(line(DELTA)), encode(line(DELTA)), encode(line(DONE))];
    const seen: CouncilEvent[] = [];
    for await (const event of readNdjson(streamOf(chunks), controller.signal)) {
      seen.push(event);
      controller.abort();
    }
    expect(seen).toEqual([DELTA]);
  });

  it('yields nothing when it was aborted before it began', async () => {
    const controller = new AbortController();
    controller.abort();
    expect(await collect(streamOf([encode(line(DONE))]), controller.signal)).toEqual([]);
  });
});
