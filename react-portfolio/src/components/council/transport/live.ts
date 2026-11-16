import { CouncilEvent, CouncilStatus, CouncilTransport } from '@/lib/council/contract';
import { parseCouncilEvent, readNdjson } from './ndjson';

export const COUNCIL_ENDPOINT = '/api/council';

const fallbackError = (status: number): CouncilEvent => {
  // The body should have carried an error event. When it does not, the status
  // is the only clue left, so map it to the closest thing the scene can explain.
  if (status === 503) return { type: 'error', code: 'live_disabled', message: `HTTP ${status}`, retryable: false };
  if (status === 400) return { type: 'error', code: 'invalid_request', message: `HTTP ${status}`, retryable: false };
  // 429 covers thread_limit, visitor_limit and busy. Without the body, busy is
  // the only one that is safe to assume: it promises nothing and can be retried.
  if (status === 429) return { type: 'error', code: 'busy', message: `HTTP ${status}`, retryable: true };
  return { type: 'error', code: 'provider_error', message: `HTTP ${status}`, retryable: true };
};

/**
 * POSTs one request and yields its events as they stream in. Never throws:
 * a network failure becomes a retryable error event, and an abort simply ends
 * the iteration.
 */
export const liveTransport: CouncilTransport = async function* (request, signal) {
  let response: Response;
  try {
    response = await fetch(COUNCIL_ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/x-ndjson' },
      body: JSON.stringify(request),
      signal,
      cache: 'no-store',
    });
  } catch {
    if (!signal.aborted) {
      yield { type: 'error', code: 'provider_error', message: 'Network request failed.', retryable: true };
    }
    return;
  }

  if (!response.ok) {
    // Failures known before any text exists arrive as one error event in a JSON body.
    let event: CouncilEvent | null = null;
    try {
      event = parseCouncilEvent(await response.json());
    } catch {
      event = null;
    }
    if (signal.aborted) return;
    yield event?.type === 'error' ? event : fallbackError(response.status);
    return;
  }

  if (!response.body) {
    yield { type: 'error', code: 'provider_error', message: 'Empty response.', retryable: true };
    return;
  }

  try {
    yield* readNdjson(response.body, signal);
  } catch {
    if (!signal.aborted) {
      yield { type: 'error', code: 'provider_error', message: 'The stream was cut off.', retryable: true };
    }
  }
};

/** GET /api/council. Null means the call failed, which the scene treats as live being unavailable. */
export async function fetchCouncilStatus(signal?: AbortSignal): Promise<CouncilStatus | null> {
  try {
    const response = await fetch(COUNCIL_ENDPOINT, { method: 'GET', signal, cache: 'no-store' });
    if (!response.ok) return null;
    const body: unknown = await response.json();
    if (typeof body !== 'object' || body === null) return null;
    const { live, visitorLeft, resetAt, offReason } = body as Record<string, unknown>;
    if (typeof live !== 'boolean' || typeof visitorLeft !== 'number' || !Number.isFinite(visitorLeft)) return null;
    const status: CouncilStatus = { live, visitorLeft, resetAt: typeof resetAt === 'string' ? resetAt : null };
    // Only meaningful while live is off. An older server leaves it out.
    if (!live && (offReason === 'budget_exhausted' || offReason === 'live_disabled')) status.offReason = offReason;
    return status;
  } catch {
    return null;
  }
}
