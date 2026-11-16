import { CouncilRequest } from '@/lib/council/contract';
import { CouncilState, RequestIntent } from './reducer';
import { toTranscript } from './selectors';

/**
 * The body of one POST, built from what the visitor chose and the thread as
 * it stands. Kept pure and apart from the hook so tests can check that every
 * move the scene offers produces a request the server accepts.
 */
export function buildCouncilRequest(state: CouncilState, intent: RequestIntent, requestId: string): CouncilRequest {
  const request: CouncilRequest = {
    requestId,
    action: intent.action,
    question: intent.question,
    // An opening starts a thread: the server ignores any history sent with it.
    transcript: intent.action === 'open' ? [] : toTranscript(state.turns, intent.targetTurnId),
  };
  if (intent.text) request.text = intent.text;
  if (intent.seatIds?.length) request.seatIds = intent.seatIds;
  if (intent.targetTurnId) request.targetTurnId = intent.targetTurnId;
  if (intent.starterId) request.starterId = intent.starterId;
  // The token comes from a live session event. A starter thread has none until
  // its first live follow-up, and is recognised by its starterId instead.
  if (intent.action !== 'open' && intent.source === 'live' && state.threadToken) request.threadToken = state.threadToken;
  return request;
}
