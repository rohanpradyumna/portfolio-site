import { COUNCIL_LIMITS, CouncilAction, SEAT_IDS, SeatId, isSeatId } from './contract';

// Turns an untrusted JSON body into a normalized plan. Only fields named here
// survive: anything else the client sends has no influence on the request.

const MAX_ID_CHARS = 64;
const ACTIONS: readonly CouncilAction[] = ['open', 'push_back', 'say_more', 'differ', 'debate', 'hear_everyone'];
const TURN_ROLES = ['visitor', 'seat', 'synthesis'] as const;

export interface CleanTurn {
  id: string;
  role: 'visitor' | 'seat' | 'synthesis';
  seatId?: SeatId;
  replyToSeatId?: SeatId;
  text: string;
  partial: boolean;
}

export interface CouncilPlan {
  requestId: string;
  action: CouncilAction;
  question: string;
  /** Visitor's words for this follow-up. Only push_back and say_more carry any. */
  text: string | null;
  transcript: CleanTurn[];
  /** True when the model chooses the seats (open with no explicit recipients). */
  routed: boolean;
  /** Seats that speak, in order. Empty when `routed` or for `differ`. */
  speakers: SeatId[];
  /** The seat turn this follow-up is about. */
  target: CleanTurn | null;
  threadToken: string | null;
  starterId: string | null;
}

export type Validation = { ok: true; plan: CouncilPlan } | { ok: false; message: string };

const fail = (message: string): Validation => ({ ok: false, message });

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// Control characters (other than newline and tab) have no place in a
// dilemma and are a classic way to smuggle invisible instructions.
function cleanText(value: string): string {
  return value
    .replace(/\r\n?/g, '\n')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F​-‏‪-‮⁠-⁤﻿]/g, '')
    .trim();
}

function parseSeatList(value: unknown): SeatId[] | null {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value) || value.length > SEAT_IDS.length) return null;
  const seen = new Set<SeatId>();
  for (const item of value) {
    if (!isSeatId(item) || seen.has(item)) return null;
    seen.add(item);
  }
  return [...seen];
}

function parseTranscript(value: unknown): CleanTurn[] | string {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) return 'transcript must be an array';
  if (value.length > COUNCIL_LIMITS.maxTranscriptTurns) return 'transcript is too long';
  const ids = new Set<string>();
  const turns: CleanTurn[] = [];
  for (const raw of value) {
    if (!isRecord(raw)) return 'transcript turn is malformed';
    const { id, role, seatId, replyToSeatId, text, partial } = raw;
    if (typeof id !== 'string' || id.length === 0 || id.length > MAX_ID_CHARS) return 'transcript turn id is invalid';
    if (ids.has(id)) return 'transcript turn ids must be unique';
    ids.add(id);
    if (typeof role !== 'string' || !(TURN_ROLES as readonly string[]).includes(role)) return 'transcript turn role is invalid';
    if (typeof text !== 'string') return 'transcript turn text is invalid';
    const cap = role === 'visitor' ? COUNCIL_LIMITS.maxInputChars : COUNCIL_LIMITS.maxTurnChars;
    if (text.length > cap) return 'transcript turn is too long';
    if (role === 'seat' && !isSeatId(seatId)) return 'transcript seat turn needs a valid seat';
    if (replyToSeatId !== undefined && replyToSeatId !== null && !isSeatId(replyToSeatId)) return 'transcript reply target is invalid';
    turns.push({
      id,
      role: role as CleanTurn['role'],
      seatId: role === 'seat' ? (seatId as SeatId) : undefined,
      replyToSeatId: role === 'seat' && isSeatId(replyToSeatId) ? replyToSeatId : undefined,
      text: cleanText(text),
      partial: partial === true,
    });
  }
  return turns;
}

function lastTurnBy(transcript: CleanTurn[], seatId: SeatId): CleanTurn | null {
  for (let i = transcript.length - 1; i >= 0; i--) {
    const turn = transcript[i];
    if (turn.role === 'seat' && turn.seatId === seatId && turn.text) return turn;
  }
  return null;
}

export function seatsThatSpoke(transcript: CleanTurn[]): SeatId[] {
  const spoke = new Set<SeatId>();
  for (const turn of transcript) if (turn.role === 'seat' && turn.seatId && turn.text) spoke.add(turn.seatId);
  return SEAT_IDS.filter((id) => spoke.has(id));
}

export function validateCouncilRequest(body: unknown, knownStarterIds: readonly string[]): Validation {
  if (!isRecord(body)) return fail('Request body must be a JSON object.');

  const { requestId, action, question, text, seatIds, targetTurnId, transcript, threadToken, starterId } = body;

  if (typeof requestId !== 'string' || !/^[A-Za-z0-9_-]{16,64}$/.test(requestId)) return fail('requestId is missing or malformed.');
  if (typeof action !== 'string' || !(ACTIONS as readonly string[]).includes(action)) return fail('Unknown action.');
  const act = action as CouncilAction;

  if (typeof question !== 'string') return fail('question is required.');
  if (question.length > COUNCIL_LIMITS.maxInputChars) return fail('question is too long.');
  const cleanQuestion = cleanText(question);
  if (cleanQuestion.length < 2) return fail('question is required.');

  let cleanNote: string | null = null;
  if (text !== undefined && text !== null) {
    if (typeof text !== 'string') return fail('text must be a string.');
    if (text.length > COUNCIL_LIMITS.maxInputChars) return fail('text is too long.');
    cleanNote = cleanText(text) || null;
  }

  const seats = parseSeatList(seatIds);
  if (seats === null) return fail('seatIds must be a list of distinct known seats.');

  if (threadToken !== undefined && threadToken !== null && typeof threadToken !== 'string') return fail('threadToken is malformed.');
  if (starterId !== undefined && starterId !== null && (typeof starterId !== 'string' || !knownStarterIds.includes(starterId))) {
    return fail('Unknown starter.');
  }
  const token = typeof threadToken === 'string' && threadToken ? threadToken : null;
  const starter = typeof starterId === 'string' ? starterId : null;

  const base = { requestId, action: act, question: cleanQuestion };

  if (act === 'open') {
    // A thread starts here: the server ignores any history or token the
    // client sends along, so an opening cannot be steered by a forged past.
    return {
      ok: true,
      plan: { ...base, text: null, transcript: [], routed: seats.length === 0, speakers: seats, target: null, threadToken: null, starterId: null },
    };
  }

  if (!token && !starter) return fail('A follow-up needs the threadToken of its thread.');

  const turns = parseTranscript(transcript);
  if (typeof turns === 'string') return fail(turns);

  let target: CleanTurn | null = null;
  if (targetTurnId !== undefined && targetTurnId !== null) {
    if (typeof targetTurnId !== 'string') return fail('targetTurnId is malformed.');
    target = turns.find((turn) => turn.id === targetTurnId) ?? null;
    if (!target) return fail('targetTurnId is not in the transcript.');
    if (target.role !== 'seat' || !target.text) return fail('targetTurnId must point at a seat reply.');
  }

  const common = { ...base, transcript: turns, routed: false, threadToken: token, starterId: token ? null : starter };
  const spoke = seatsThatSpoke(turns);

  switch (act) {
    case 'push_back':
    case 'say_more': {
      if (seats.length !== 1) return fail('This action addresses exactly one seat.');
      if (act === 'push_back' && !cleanNote) return fail('Say what you disagree with.');
      if (target && target.seatId !== seats[0]) return fail('targetTurnId does not belong to that seat.');
      const about = target ?? lastTurnBy(turns, seats[0]);
      if (!about) return fail('That seat has not said anything yet.');
      return { ok: true, plan: { ...common, text: cleanNote, speakers: seats, target: about } };
    }
    case 'debate': {
      if (seats.length !== 2) return fail('A debate needs two different seats: objector, then addressed.');
      const [, addressed] = seats;
      if (target && target.seatId !== addressed) return fail('targetTurnId must be a reply from the addressed seat.');
      const about = target ?? lastTurnBy(turns, addressed);
      if (!about) return fail('The addressed seat has not said anything yet.');
      return { ok: true, plan: { ...common, text: null, speakers: seats, target: about } };
    }
    case 'differ': {
      if (spoke.length < 2) return fail('At least two seats need to have spoken first.');
      return { ok: true, plan: { ...common, text: null, speakers: [], target: null } };
    }
    case 'hear_everyone': {
      const missing = SEAT_IDS.filter((id) => !spoke.includes(id));
      // If the client names seats, only the ones that are truly missing count.
      const speakers = seats.length > 0 ? missing.filter((id) => seats.includes(id)) : missing;
      if (speakers.length === 0) return fail('Every seat has already spoken.');
      return { ok: true, plan: { ...common, text: null, speakers, target: null } };
    }
  }
}
