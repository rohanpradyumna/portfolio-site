// The Council: shared contract between the scene (client), the API route
// (server), the content files and the portraits. Import-safe on both sides:
// types and plain constants only, no server or browser APIs.
//
// FROZEN: this file is the seam every part of the feature builds against.
// Do not edit it from a feature branch of work; raise the change instead.

export const SEAT_IDS = ['stoic', 'pragmatist', 'existentialist', 'absurdist', 'advaita', 'marxist'] as const;
export type SeatId = (typeof SEAT_IDS)[number];

export function isSeatId(value: unknown): value is SeatId {
  return typeof value === 'string' && (SEAT_IDS as readonly string[]).includes(value);
}

export interface Reading {
  title: string;
  author: string;
  url: string;
  /** One line on why this is the place to start. */
  note: string;
}

export interface Seat {
  id: SeatId;
  /** "Stoicism" */
  school: string;
  /** "Stoic lens". Used wherever a reply is attributed. */
  lensLabel: string;
  /** The historical face of the seat: "Marcus Aurelius". */
  figure: string;
  /** "121-180 CE". Plain hyphens only. */
  figureDates: string;
  /** One plain-language line shown on hover/focus. About 90 characters. */
  intro: string;
  /** The question this lens always ends up asking. */
  coreQuestion: string;
  /** Selection marks, note tape, thinking scribble. Never the only signal. */
  accent: string;
  furtherReading: Reading[];
}

// Accents are fixed here so art, scene and content agree. Chosen from the
// site palette where possible. Yellow is a fill color only, never text.
export const SEAT_ACCENTS: Record<SeatId, string> = {
  stoic: '#8b7355',
  pragmatist: '#3d6fa8',
  existentialist: '#6b4a7a',
  absurdist: '#4a8b54',
  advaita: '#e6b32a',
  marxist: '#c4472a',
};

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

/**
 * open           first question of a thread (council routing or explicit seats)
 * push_back      visitor objects to one seat's reply (text required)
 * say_more       one seat expands its argument
 * differ         short synthesis of where the voices actually differ
 * debate         one seat objects to another seat's specific claim, which answers
 * hear_everyone  seats that have not spoken yet give their opening
 */
export type CouncilAction = 'open' | 'push_back' | 'say_more' | 'differ' | 'debate' | 'hear_everyone';
export type FollowUpAction = Exclude<CouncilAction, 'open'>;

export interface TranscriptTurn {
  id: string;
  role: 'visitor' | 'seat' | 'synthesis';
  seatId?: SeatId;
  /** The action that produced this turn. */
  action?: CouncilAction;
  /** For debate and push_back replies: the seat being answered. */
  replyToSeatId?: SeatId;
  text: string;
  /** True when the visitor pressed Stop or the stream died mid-turn. */
  partial?: boolean;
}

// ---------------------------------------------------------------------------
// Limits. The server is the only authority; the client mirrors for UX.
// ---------------------------------------------------------------------------

export const COUNCIL_LIMITS = {
  /** Characters per visitor message. */
  maxInputChars: 1500,
  /** Seats in a council-routed opening. */
  maxOpeningSeats: 3,
  /** Live generations per thread: the opening plus one follow-up. */
  exchangesPerThread: 2,
  /** Live generations per visitor per rolling 24 hours. */
  visitorDailyGenerations: 4,
  /** Transcript turns the client may send back. The client trims; the server rejects more. */
  maxTranscriptTurns: 12,
  /** Characters per transcript turn the client may send back. The server rejects more. */
  maxTurnChars: 2400,
  /** Client shows an actionable timeout at this point. */
  clientTimeoutMs: 20_000,
} as const;

// ---------------------------------------------------------------------------
// Request
// ---------------------------------------------------------------------------

export interface CouncilRequest {
  /**
   * Client-generated id matching [A-Za-z0-9_-]{16,64} (a UUID is fine). The
   * server dedupes on it, so every attempt, including a retry, needs a fresh one.
   */
  requestId: string;
  action: CouncilAction;
  /** The original dilemma. Sent on every request: the server keeps no transcript. */
  question: string;
  /** Visitor's own words for this follow-up. Required for push_back. */
  text?: string;
  /**
   * open: explicit recipients (empty or absent means the council picks up to three).
   * push_back / say_more: exactly one seat.
   * debate: [objector, addressed].
   */
  seatIds?: SeatId[];
  /** The seat turn a follow-up is about. Must exist in `transcript`. */
  targetTurnId?: string;
  /** Client-held history, oldest first, bounded by COUNCIL_LIMITS. */
  transcript: TranscriptTurn[];
  /** Issued by the server on `open`; required on every follow-up of that thread. */
  threadToken?: string;
  /** Set when the thread began from a curated starter (whose opening was free). */
  starterId?: string;
}

// ---------------------------------------------------------------------------
// Response: newline-delimited JSON, one CouncilEvent per line
// (content-type application/x-ndjson).
//
// Failures known before any text is generated use a real HTTP status
// (400, 429, 503) with a single `error` event as the JSON body. Failures
// mid-stream arrive as an `error` event; turns already ended stay valid.
// ---------------------------------------------------------------------------

export type CouncilErrorCode =
  | 'invalid_request'
  | 'thread_limit' // this thread has used its exchanges
  | 'visitor_limit' // this visitor has used today's generations
  | 'budget_exhausted' // the site-wide daily ceiling is reached
  | 'live_disabled' // no provider key or kill switch on
  | 'busy' // another request for this thread is in flight
  | 'provider_error'
  | 'timeout';

export type CouncilEvent =
  /**
   * First event of every successful stream. The counts already include the
   * request in flight. `resetAt` is when the visitor's next slot frees, not a
   * full reset.
   */
  | { type: 'session'; threadToken: string; exchangesLeft: number; visitorLeft: number; resetAt: string | null }
  /** Only for council-routed openings: who is replying and why, in one line. */
  | { type: 'routing'; seatIds: SeatId[]; reason: string }
  /**
   * A `synthesis` turn with no seat can answer ANY action, including `open`:
   * it is how the council declines an off-topic request or answers a message
   * in distress, as one voice, with no `routing` and no `follow_up`.
   */
  | { type: 'turn_start'; turnId: string; role: 'seat' | 'synthesis'; seatId?: SeatId; replyToSeatId?: SeatId }
  | { type: 'delta'; turnId: string; text: string }
  | { type: 'turn_end'; turnId: string }
  /** At most one per exchange: a question back to the visitor. */
  | { type: 'follow_up'; question: string }
  | { type: 'done' }
  /**
   * `retryable` is false whenever this exchange was charged (some reply text
   * reached the visitor, or the visitor stopped it). When the server knows the
   * counts after settling, it sends them, and they replace whatever `session`
   * said. A failure the provider billed gives the thread its exchange back but
   * still uses one of the visitor's daily generations.
   */
  | {
      type: 'error';
      code: CouncilErrorCode;
      message: string;
      resetAt?: string | null;
      retryable: boolean;
      exchangesLeft?: number;
      visitorLeft?: number;
    };

/**
 * GET /api/council. Lets the scene show limits before the visitor types.
 * It must agree with what a POST would do right now: when the site-wide
 * ceiling would refuse a new reservation, `live` is false with
 * `offReason: 'budget_exhausted'` and `resetAt` set to when it lifts, and
 * `visitorLeft` still reports this visitor's own allowance.
 */
export interface CouncilStatus {
  live: boolean;
  /** Why live replies are off for everyone. Absent when `live` is true. */
  offReason?: 'budget_exhausted' | 'live_disabled';
  visitorLeft: number;
  resetAt: string | null;
}

/**
 * The one seam the scene talks through. `liveTransport` wraps fetch + NDJSON
 * parsing; `fixtureTransport` replays curated conversations with simulated
 * streaming. Both must honor the abort signal promptly.
 */
export type CouncilTransport = (request: CouncilRequest, signal: AbortSignal) => AsyncIterable<CouncilEvent>;

// ---------------------------------------------------------------------------
// Curated starters. Their openings never hit the model, so they stay usable
// when quota, budget or the provider is unavailable.
// ---------------------------------------------------------------------------

export interface FixtureTurn {
  role: 'seat' | 'synthesis';
  seatId?: SeatId;
  replyToSeatId?: SeatId;
  text: string;
}

export interface FixtureExchange {
  routing?: { seatIds: SeatId[]; reason: string };
  turns: FixtureTurn[];
  followUpQuestion?: string;
}

export interface FixtureFollowUp extends FixtureExchange {
  /** Seats this scripted follow-up is about, same rules as CouncilRequest.seatIds. */
  seatIds?: SeatId[];
  /** push_back only: the canned objection, offered as a suggestion chip. */
  visitorText?: string;
}

export interface Starter {
  id: string;
  question: string;
  opening: FixtureExchange;
  /** Scripted follow-ups, so a starter is fully explorable with live AI off. */
  followUps: Partial<Record<FollowUpAction, FixtureFollowUp>>;
}

// ---------------------------------------------------------------------------
// Seat briefs: the seat-specific layer of the prompt. Content owns the words,
// the server owns how they are assembled into a prompt.
// ---------------------------------------------------------------------------

export interface SeatBrief {
  id: SeatId;
  /** How this lens sounds: register, rhythm, what it never does. 2-3 sentences. */
  voice: string;
  /** The handful of ideas this lens actually reasons with, each in plain words. */
  concepts: string[];
  /** Characteristic argumentative moves ("asks what changes in practice"). */
  moves: string[];
  /** Where this lens is weak or silent, and should say so. */
  limits: string[];
  /** Popular distortions the reply must not fall into. */
  misconceptions: string[];
  /** What separates this seat from its nearest neighbors on the council. */
  contrast: string;
}

// ---------------------------------------------------------------------------
// Portraits
// ---------------------------------------------------------------------------

/**
 * idle        resting on the board
 * thinking    waiting for its turn in the current exchange
 * speaking    its reply is streaming right now
 * challenged  one-shot reaction when the visitor pushes back, then settles
 * dimmed      not part of the current exchange (still legible)
 */
export type PortraitMood = 'idle' | 'thinking' | 'speaking' | 'challenged' | 'dimmed';

export interface SeatPortraitProps {
  seatId: SeatId;
  /** Rendered width in px. Height follows the portrait's own aspect ratio. */
  size: number;
  mood?: PortraitMood;
  className?: string;
}
