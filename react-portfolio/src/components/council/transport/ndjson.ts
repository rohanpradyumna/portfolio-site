import { CouncilErrorCode, CouncilEvent, isSeatId } from '@/lib/council/contract';

// Newline-delimited JSON, one CouncilEvent per line. Network chunks cut lines
// (and multi-byte characters) anywhere, so the parser buffers until it has a
// whole line. A line it cannot use is skipped: one bad line must not take a
// reply down with it.

const ERROR_CODES: readonly CouncilErrorCode[] = [
  'invalid_request',
  'thread_limit',
  'visitor_limit',
  'budget_exhausted',
  'live_disabled',
  'busy',
  'provider_error',
  'timeout',
];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isString = (value: unknown): value is string => typeof value === 'string';
const isCount = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const isNullableString = (value: unknown): value is string | null => value === null || isString(value);

export function isCouncilErrorCode(value: unknown): value is CouncilErrorCode {
  return isString(value) && (ERROR_CODES as readonly string[]).includes(value);
}

/** Returns a well-formed event, or null for anything the scene should not act on. */
export function parseCouncilEvent(value: unknown): CouncilEvent | null {
  if (!isRecord(value)) return null;

  switch (value.type) {
    case 'session':
      if (!isString(value.threadToken) || !isCount(value.exchangesLeft) || !isCount(value.visitorLeft)) return null;
      return {
        type: 'session',
        threadToken: value.threadToken,
        exchangesLeft: value.exchangesLeft,
        visitorLeft: value.visitorLeft,
        resetAt: isString(value.resetAt) ? value.resetAt : null,
      };

    case 'routing':
      if (!Array.isArray(value.seatIds)) return null;
      return {
        type: 'routing',
        seatIds: value.seatIds.filter(isSeatId),
        reason: isString(value.reason) ? value.reason : '',
      };

    case 'turn_start': {
      if (!isString(value.turnId) || (value.role !== 'seat' && value.role !== 'synthesis')) return null;
      if (value.role === 'seat' && !isSeatId(value.seatId)) return null;
      const event: Extract<CouncilEvent, { type: 'turn_start' }> = {
        type: 'turn_start',
        turnId: value.turnId,
        role: value.role,
      };
      if (isSeatId(value.seatId)) event.seatId = value.seatId;
      if (isSeatId(value.replyToSeatId)) event.replyToSeatId = value.replyToSeatId;
      return event;
    }

    case 'delta':
      if (!isString(value.turnId) || !isString(value.text)) return null;
      return { type: 'delta', turnId: value.turnId, text: value.text };

    case 'turn_end':
      if (!isString(value.turnId)) return null;
      return { type: 'turn_end', turnId: value.turnId };

    case 'follow_up':
      if (!isString(value.question)) return null;
      return { type: 'follow_up', question: value.question };

    case 'done':
      return { type: 'done' };

    case 'error': {
      if (!isCouncilErrorCode(value.code)) return null;
      const event: Extract<CouncilEvent, { type: 'error' }> = {
        type: 'error',
        code: value.code,
        message: isString(value.message) ? value.message : '',
        resetAt: isNullableString(value.resetAt) ? value.resetAt : null,
        retryable: value.retryable === true,
      };
      // The counts after the server settled the failed exchange, when it knows them.
      if (isCount(value.exchangesLeft)) event.exchangesLeft = value.exchangesLeft;
      if (isCount(value.visitorLeft)) event.visitorLeft = value.visitorLeft;
      return event;
    }

    default:
      return null;
  }
}

function parseLine(line: string): CouncilEvent | null {
  const trimmed = line.trim();
  if (trimmed === '') return null;
  try {
    return parseCouncilEvent(JSON.parse(trimmed));
  } catch {
    return null;
  }
}

export interface NdjsonParser {
  /** Feed decoded text in whatever pieces it arrived. Returns the events completed by this piece. */
  push(text: string): CouncilEvent[];
  /** Call once at end of stream: a final line may arrive without its newline. */
  flush(): CouncilEvent[];
}

export function createNdjsonParser(): NdjsonParser {
  let buffer = '';

  const drain = (final: boolean): CouncilEvent[] => {
    const events: CouncilEvent[] = [];
    let newline = buffer.indexOf('\n');
    while (newline !== -1) {
      const event = parseLine(buffer.slice(0, newline));
      if (event) events.push(event);
      buffer = buffer.slice(newline + 1);
      newline = buffer.indexOf('\n');
    }
    if (final) {
      const event = parseLine(buffer);
      if (event) events.push(event);
      buffer = '';
    }
    return events;
  };

  return {
    push(text) {
      buffer += text;
      return drain(false);
    },
    flush() {
      return drain(true);
    },
  };
}

/** Reads a response body as events. Stops quietly as soon as the signal aborts. */
export async function* readNdjson(
  body: ReadableStream<Uint8Array>,
  signal: AbortSignal,
): AsyncGenerator<CouncilEvent, void, undefined> {
  const reader = body.getReader();
  // `stream: true` holds back a multi-byte character split across two chunks.
  const decoder = new TextDecoder();
  const parser = createNdjsonParser();
  const cancel = () => {
    reader.cancel().catch(() => {});
  };
  signal.addEventListener('abort', cancel, { once: true });

  try {
    while (!signal.aborted) {
      const { done, value } = await reader.read();
      if (done) break;
      for (const event of parser.push(decoder.decode(value, { stream: true }))) {
        if (signal.aborted) return;
        yield event;
      }
    }
    if (signal.aborted) return;
    for (const event of parser.push(decoder.decode())) yield event;
    for (const event of parser.flush()) yield event;
  } finally {
    signal.removeEventListener('abort', cancel);
    reader.releaseLock();
  }
}
