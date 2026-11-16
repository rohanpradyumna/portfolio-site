import {
  COUNCIL_LIMITS,
  CouncilEvent,
  CouncilRequest,
  CouncilTransport,
  FixtureExchange,
  Starter,
} from '@/lib/council/contract';

// Replays a curated conversation as the same event stream the server sends,
// with believable pacing, so the scene cannot tell the two apart.

export interface FixturePace {
  /** Before the council says who is replying. */
  routingMs: number;
  /** A seat's pause before its first word. */
  thinkMs: number;
  /** Between chunks of a reply. */
  chunkMs: number;
}

export const REALISTIC_PACE: FixturePace = { routingMs: 520, thinkMs: 460, chunkMs: 36 };
export const INSTANT_PACE: FixturePace = { routingMs: 0, thinkMs: 0, chunkMs: 0 };

export function findFixture(starters: Starter[], request: Pick<CouncilRequest, 'starterId' | 'action'>): FixtureExchange | null {
  const starter = starters.find((candidate) => candidate.id === request.starterId);
  if (!starter) return null;
  return (request.action === 'open' ? starter.opening : starter.followUps[request.action]) ?? null;
}

export const fixtureTurnId = (starterId: string, action: string, index: number) => `fx-${starterId}-${action}-${index}`;

/** Splits a reply into chunks of one to three words, the way a model's tokens tend to land. */
export function chunkText(text: string): string[] {
  const words = text.match(/\S+\s*/g) ?? [];
  const chunks: string[] = [];
  let index = 0;
  while (index < words.length) {
    // A fixed rhythm, not Math.random: the same fixture always streams the same way.
    const size = 1 + ((index * 7 + words[index].length) % 3);
    chunks.push(words.slice(index, index + size).join(''));
    index += size;
  }
  return chunks;
}

/**
 * The events of one exchange, in order, with each reply's text split by
 * `split`. Also used to build the ?demo= states without any timing at all.
 */
export function fixtureEvents(
  starterId: string,
  action: CouncilRequest['action'],
  exchange: FixtureExchange,
  split: (text: string) => string[] = (text) => [text],
): CouncilEvent[] {
  const events: CouncilEvent[] = [
    {
      type: 'session',
      threadToken: `fixture:${starterId}`,
      exchangesLeft: COUNCIL_LIMITS.exchangesPerThread - 1,
      visitorLeft: COUNCIL_LIMITS.visitorDailyGenerations,
      resetAt: null,
    },
  ];
  if (exchange.routing) events.push({ type: 'routing', seatIds: exchange.routing.seatIds, reason: exchange.routing.reason });
  exchange.turns.forEach((turn, index) => {
    const turnId = fixtureTurnId(starterId, action, index);
    events.push({ type: 'turn_start', turnId, role: turn.role, seatId: turn.seatId, replyToSeatId: turn.replyToSeatId });
    for (const text of split(turn.text)) events.push({ type: 'delta', turnId, text });
    events.push({ type: 'turn_end', turnId });
  });
  if (exchange.followUpQuestion) events.push({ type: 'follow_up', question: exchange.followUpQuestion });
  events.push({ type: 'done' });
  return events;
}

/** Resolves after `ms`, or at once when the signal aborts. Never rejects. */
function pause(ms: number, signal: AbortSignal): Promise<void> {
  if (ms <= 0 || signal.aborted) return Promise.resolve();
  return new Promise((resolve) => {
    const finish = () => {
      clearTimeout(timer);
      signal.removeEventListener('abort', finish);
      resolve();
    };
    const timer = setTimeout(finish, ms);
    signal.addEventListener('abort', finish, { once: true });
  });
}

export function createFixtureTransport(starters: Starter[], pace: FixturePace = REALISTIC_PACE): CouncilTransport {
  return async function* fixtureTransport(request, signal) {
    const exchange = findFixture(starters, request);
    if (!exchange || !request.starterId) {
      // Only curated questions have fixtures. Anything else needs the live council.
      yield { type: 'error', code: 'live_disabled', message: 'No curated reply for this request.', retryable: false };
      return;
    }

    let chunkIndex = 0;
    for (const event of fixtureEvents(request.starterId, request.action, exchange, chunkText)) {
      if (event.type === 'routing') await pause(pace.routingMs, signal);
      else if (event.type === 'turn_start') await pause(pace.thinkMs, signal);
      else if (event.type === 'delta') {
        // Uneven gaps read as thought. An even drip reads as a typewriter effect.
        chunkIndex += 1;
        await pause(pace.chunkMs * (0.6 + ((chunkIndex * 5) % 7) / 6), signal);
      }
      if (signal.aborted) return;
      yield event;
    }
  };
}

/**
 * Stands in for the server under ?fixtures=1. It answers only what a starter
 * has scripted, but it keeps the books the way the server would: a follow-up
 * spends the thread's last exchange and one of the day's generations.
 */
export function createSimulatedLiveTransport(starters: Starter[], pace: FixturePace = REALISTIC_PACE): CouncilTransport {
  const scripted = createFixtureTransport(starters, pace);
  let visitorLeft: number = COUNCIL_LIMITS.visitorDailyGenerations;

  return async function* simulatedLiveTransport(request, signal) {
    if (!findFixture(starters, request)) {
      yield { type: 'error', code: 'live_disabled', message: 'Fixtures only: no live council here.', retryable: false };
      return;
    }
    visitorLeft = Math.max(0, visitorLeft - 1);
    for await (const event of scripted(request, signal)) {
      yield event.type === 'session'
        ? { ...event, exchangesLeft: request.action === 'open' ? COUNCIL_LIMITS.exchangesPerThread - 1 : 0, visitorLeft }
        : event;
    }
  };
}
