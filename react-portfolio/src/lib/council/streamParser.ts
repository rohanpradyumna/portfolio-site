import { CouncilEvent, COUNCIL_LIMITS, SEAT_IDS, SeatId } from './contract';

// The model writes a whole exchange as plain text with marker lines:
//
//   @@ROUTE stoic, marxist, advaita | one line on why these three
//   @@SEAT stoic
//   ...reply...
//   @@SEAT marxist
//   ...reply...
//   @@ASK one question back to the visitor
//   @@END
//
// (@@SYNTHESIS and @@COUNCIL open a section in the council's shared voice.)
//
// This parser turns that text, arriving in arbitrary chunks, into contract
// events. Its promises: a marker is never forwarded to the client, even when
// it is split across chunks; sections for unknown, unexpected or repeated
// seats are dropped whole; and text outside any section is dropped.

export interface ParsePlan {
  /** Council-routed opening: expect @@ROUTE, then at most `maxRoutedSeats` sections. */
  routing: boolean;
  /** Seats that may speak. For a routed opening this is every seat. */
  allowedSeats: readonly SeatId[];
  /** `differ`: the planned section is a synthesis, seat sections are dropped. */
  synthesis: boolean;
  /** Which seat each speaker is answering (debate, push_back). */
  replyTo: Partial<Record<SeatId, SeatId>>;
  allowAsk: boolean;
  /**
   * When exactly one section is expected and the model ignores the format,
   * its text is still a usable reply: show it as this turn.
   */
  fallback: { role: 'seat'; seatId: SeatId } | { role: 'synthesis' } | null;
}

export interface ParserOptions {
  newTurnId: () => string;
  maxTurnChars?: number;
  maxAskChars?: number;
  maxReasonChars?: number;
}

export const FALLBACK_ROUTING_REASON = 'These lenses pull in different directions on this one.';

// Longest marker line we will wait for before deciding it is not a marker.
const MAX_MARKER_LINE = 500;
// Shortest marker-less output worth showing as a reply at all.
const MIN_FALLBACK_CHARS = 20;

const SEAT_ALIASES: Record<string, SeatId> = {
  stoic: 'stoic',
  stoicism: 'stoic',
  stoics: 'stoic',
  pragmatist: 'pragmatist',
  pragmatism: 'pragmatist',
  pragmatic: 'pragmatist',
  existentialist: 'existentialist',
  existentialism: 'existentialist',
  absurdist: 'absurdist',
  absurdism: 'absurdist',
  advaita: 'advaita',
  vedanta: 'advaita',
  marxist: 'marxist',
  marxism: 'marxist',
};

function toSeat(word: string): SeatId | null {
  return SEAT_ALIASES[word.toLowerCase()] ?? null;
}

const MARKER_KEYWORDS = new Set(['END', 'SEAT', 'SYNTHESIS', 'COUNCIL', 'ROUTE', 'ASK']);

// Words a model may put after the seat id on a marker line as a label
// ("@@SEAT stoic (Stoic lens)", "@@SEAT marxist: Karl Marx"). Anything else
// on that line is the reply itself, started without a line break.
const LABEL_WORDS = new Set([
  ...Object.keys(SEAT_ALIASES),
  ...['lens', 'seat', 'the', 'id', 'of', 'and', 'speaking', 'says', 'reply', 'opening', 'answer', 'objection'],
  ...['marcus', 'aurelius', 'william', 'james', 'simone', 'de', 'beauvoir', 'albert', 'camus', 'adi', 'shankara', 'karl', 'marx'],
]);

/**
 * Looks at what follows the seat id on a "@@SEAT" line. Returns the index
 * where reply text starts, 'label' when the whole remainder is a label, or
 * 'wait' when the last word may still be growing. Decided token by token, so
 * the answer does not depend on where the stream happened to be cut.
 */
function replyStartOnMarkerLine(rest: string, lineComplete: boolean): number | 'label' | 'wait' {
  const token = /[A-Za-z]+|[^A-Za-z]/g;
  for (let m = token.exec(rest); m; m = token.exec(rest)) {
    const text = m[0];
    const isWord = /^[A-Za-z]/.test(text);
    if (isWord) {
      if (m.index + text.length === rest.length && !lineComplete) return 'wait';
      if (LABEL_WORDS.has(text.toLowerCase())) continue;
    } else if (/[\s\p{P}\p{S}]/u.test(text)) {
      continue;
    }
    // Keep an opening quote or bracket that belongs to the first word.
    const before = rest[m.index - 1];
    return before && /["'(\[\u2018\u201C]/.test(before) ? m.index - 1 : m.index;
  }
  return lineComplete ? 'label' : 'wait';
}

/**
 * The site never shows em or en dashes, and small models reach for them no
 * matter what the prompt says, so they are rewritten here: a hyphen inside a
 * number range, a comma everywhere else. `before` is the character already
 * sent just ahead of `text`, so a range split across chunks still reads as one.
 */
export function plainDashes(text: string, before = ''): string {
  if (!/[\u2012-\u2015]/.test(text)) return text;
  const joined = (before + text)
    .replace(/(\d)\s*[\u2012-\u2015]\s*(?=\d)/g, '$1-')
    .replace(/\s*[\u2012-\u2015]+\s*/g, ', ');
  return joined.slice(before.length);
}

type Mode = 'outside' | 'turn' | 'skip' | 'ended';

// Markdown decoration and whitespace a model may wrap around a marker
// ("**@@SEAT stoic**"). Held back at the tail of a turn until we know
// whether a marker follows, and trimmed from the head of a section.
const TAIL_DECORATION = /[\s*#`\u2012-\u2015]+$/;
const HEAD_DECORATION = /^[\s*#`:.\-\])]+/;
// A line holding only these has not started saying anything yet.
const NOT_DECORATION = /[^\s*#`>_:\-]/;

export class CouncilStreamParser {
  private buf = '';
  private mode: Mode = 'outside';
  private held = '';
  private turnId: string | null = null;
  private turnChars = 0;
  private lastChar = '';
  private routeReason = '';
  private pendingStart: CouncilEvent | null = null;
  private atSectionHead = false;
  private seen = new Set<SeatId>();
  private routed: SeatId[] | null = null;
  private routingSent = false;
  private pendingRouting: CouncilEvent | null = null;
  private lineDirty = false;
  private deferred: CouncilEvent[] | null = null;
  private deferredSeats: SeatId[] = [];
  private sectionsOpened = 0;
  private councilVoice = false;
  private askSent = false;
  private stray = '';
  private turns = 0;

  private readonly maxTurnChars: number;
  private readonly maxAskChars: number;
  private readonly maxReasonChars: number;

  constructor(
    private readonly plan: ParsePlan,
    private readonly options: ParserOptions,
  ) {
    this.maxTurnChars = options.maxTurnChars ?? 1600;
    this.maxAskChars = options.maxAskChars ?? 300;
    this.maxReasonChars = options.maxReasonChars ?? 240;
  }

  /** True once @@END has been seen: anything the model writes after it is waste. */
  get finished(): boolean {
    return this.mode === 'ended';
  }

  /** Turns with at least one character of text, so far. */
  get turnCount(): number {
    return this.turns;
  }

  push(chunk: string): CouncilEvent[] {
    if (this.mode === 'ended' || !chunk) return [];
    this.buf += chunk;
    const out: CouncilEvent[] = [];
    this.drain(out, false);
    return this.release(out);
  }

  end(): CouncilEvent[] {
    const out: CouncilEvent[] = [];
    if (this.mode !== 'ended') {
      this.drain(out, true);
      this.closeTurn(out);
      this.mode = 'ended';
    }
    if (this.turns === 0 && this.plan.fallback) this.emitFallback(out);
    if (this.deferred) {
      const buffered = [...this.deferred, ...out];
      this.deferred = null;
      if (this.deferredSeats.length === 0) return buffered;
      return [{ type: 'routing', seatIds: this.deferredSeats, reason: this.routeReason || FALLBACK_ROUTING_REASON }, ...buffered];
    }
    return out;
  }

  // While a routed opening has produced sections without a usable @@ROUTE
  // line, events are buffered so that `routing` can still come first.
  private release(out: CouncilEvent[]): CouncilEvent[] {
    if (!this.deferred) return out;
    this.deferred.push(...out);
    return [];
  }

  private drain(out: CouncilEvent[], final: boolean): void {
    while (this.mode !== 'ended' && this.buf.length > 0) {
      const at = this.buf.indexOf('@@');
      if (at === -1) {
        // A lone trailing "@" may be the first half of a marker.
        const keep = !final && this.buf.endsWith('@') ? 1 : 0;
        this.text(this.buf.slice(0, this.buf.length - keep), out);
        this.buf = this.buf.slice(this.buf.length - keep);
        return;
      }
      if (at > 0) {
        this.text(this.buf.slice(0, at), out);
        this.buf = this.buf.slice(at);
      }
      if (!this.marker(out, final)) return;
    }
  }

  /** Non-marker text: remembers whether the current line has begun, then routes it. */
  private text(text: string, out: CouncilEvent[]): void {
    if (!text) return;
    const newline = text.lastIndexOf('\n');
    if (newline !== -1) this.lineDirty = false;
    if (NOT_DECORATION.test(newline === -1 ? text : text.slice(newline + 1))) this.lineDirty = true;
    this.body(text, out);
  }

  /** Consumes one "@@" from the head of the buffer. False means: need more input. */
  private marker(out: CouncilEvent[], final: boolean): boolean {
    const newline = this.buf.indexOf('\n');
    const lineComplete = newline !== -1 || final || this.buf.length > MAX_MARKER_LINE;
    const line = newline === -1 ? this.buf : this.buf.slice(0, newline);
    // "@@SEAT" or, for our own keywords only, "@@ SEAT".
    const tight = /^@@([A-Za-z_]*)/.exec(line)!;
    let head = tight;
    const gap = tight[1] === '' ? /^@@[ \t]+/.exec(line) : null;
    if (gap) {
      const spaced = /^@@[ \t]+([A-Za-z_]+)/.exec(line);
      const settled = lineComplete || line.length > (spaced ?? gap)[0].length;
      if (!settled) return false;
      if (spaced && MARKER_KEYWORDS.has(spaced[1])) head = spaced;
    }
    const word = head[1];
    const keyword = word.toUpperCase();
    const headLength = head[0].length;
    const afterKeyword = line.slice(headLength);
    // The keyword is only known once something that cannot extend it arrives.
    if (!lineComplete && afterKeyword.length === 0) return false;

    // A run of "@" is not a marker until it is down to two.
    if (afterKeyword.startsWith('@') && word === '') {
      this.buf = this.buf.slice(1);
      return true;
    }

    const consumeLine = () => {
      this.buf = newline === -1 ? '' : this.buf.slice(newline + 1);
      this.lineDirty = false;
    };

    const ours = MARKER_KEYWORDS.has(keyword) || toSeat(keyword) !== null;
    // In the middle of a line only an exact, upper-case keyword is a marker
    // (a model that forgot the line break). Anything else there, and a bare
    // "@@" anywhere, is just text: it is passed on as a single "@", so the
    // client never sees the marker prefix and the reply is not cut short.
    if (word === '' || (this.lineDirty && !(ours && word === keyword))) {
      this.buf = this.buf.slice(2);
      this.text('@', out);
      return true;
    }

    switch (keyword) {
      case 'END':
        this.closeTurn(out);
        this.mode = 'ended';
        this.buf = '';
        return true;

      case 'SEAT': {
        const m = /^[\s:=\[(*"'`]*([A-Za-z]+)/.exec(afterKeyword);
        const wordEnd = m ? m[0].length : 0;
        const rest = afterKeyword.slice(wordEnd);
        // The rest of the marker line is either a label, dropped with the
        // marker, or the reply itself started without a line break.
        const start = m || lineComplete ? replyStartOnMarkerLine(rest, lineComplete) : 'wait';
        if (start === 'wait' || (!m && !lineComplete)) return false;
        this.closeTurn(out);
        this.openSeat(m ? toSeat(m[1]) : null);
        if (start === 'label') {
          consumeLine();
        } else {
          this.buf = this.buf.slice(headLength + wordEnd + start);
          this.lineDirty = true;
        }
        return true;
      }

      case 'SYNTHESIS':
      case 'COUNCIL':
        this.closeTurn(out);
        this.openSynthesis(keyword === 'COUNCIL');
        this.buf = this.buf.slice(headLength);
        return true;

      case 'ROUTE':
        if (!lineComplete) return false;
        this.route(afterKeyword);
        consumeLine();
        return true;

      case 'ASK':
        if (!lineComplete) return false;
        this.closeTurn(out);
        this.ask(afterKeyword, out);
        this.mode = 'skip';
        consumeLine();
        return true;

      default: {
        if (!lineComplete) return false;
        const seat = toSeat(keyword);
        // "@@STOIC" is close enough to "@@SEAT stoic" to honor.
        if (seat) {
          this.closeTurn(out);
          this.openSeat(seat);
        } else if (this.mode !== 'outside') {
          // A line that starts with "@@" but is not one of ours is still a
          // boundary: stop attributing text to the previous speaker.
          this.closeTurn(out);
          this.mode = 'skip';
        }
        consumeLine();
        return true;
      }
    }
  }

  private route(rest: string): void {
    if (!this.plan.routing || this.routingSent || this.sectionsOpened > 0) return;
    const bar = rest.indexOf('|');
    const names = bar === -1 ? rest : rest.slice(0, bar);
    const seats: SeatId[] = [];
    for (const word of names.split(/[^A-Za-z]+/)) {
      const seat = toSeat(word);
      if (seat && this.plan.allowedSeats.includes(seat) && !seats.includes(seat) && seats.length < COUNCIL_LIMITS.maxOpeningSeats) {
        seats.push(seat);
      }
    }
    const reason = plainDashes((bar === -1 ? '' : rest.slice(bar + 1)).replace(/@@/g, '').replace(/[*#`]/g, '').replace(/\s+/g, ' ').trim());
    // Kept even if the seat list is unusable (a model that copies the
    // template's placeholder names): the sections then decide who speaks.
    this.routeReason = reason.slice(0, this.maxReasonChars);
    if (seats.length === 0) return;
    this.routed = seats;
    this.routingSent = true;
    // Sent with the first reply text, not now: a route line that no section
    // follows must not reach the client as free output.
    this.pendingRouting = { type: 'routing', seatIds: seats, reason: this.routeReason || FALLBACK_ROUTING_REASON };
  }

  private openSeat(seat: SeatId | null): void {
    this.sectionsOpened += 1;
    this.mode = 'skip';
    if (!seat || this.plan.synthesis || this.councilVoice || this.seen.has(seat) || !this.plan.allowedSeats.includes(seat)) return;
    if (this.plan.routing) {
      if (this.routed) {
        if (!this.routed.includes(seat)) return;
      } else {
        if (this.deferredSeats.length >= COUNCIL_LIMITS.maxOpeningSeats) return;
        this.deferred ??= [];
        this.deferredSeats.push(seat);
      }
    }
    this.seen.add(seat);
    this.beginTurn({ type: 'turn_start', turnId: this.options.newTurnId(), role: 'seat', seatId: seat, replyToSeatId: this.plan.replyTo[seat] });
  }

  private openSynthesis(councilVoice: boolean): void {
    this.sectionsOpened += 1;
    this.mode = 'skip';
    // One shared-voice section per exchange, and only on its own: a council
    // note (care, or declining an off-topic request) replaces the seats.
    if (this.councilVoice || this.seen.size > 0) return;
    if (!councilVoice && !this.plan.synthesis) return;
    this.councilVoice = true;
    this.pendingRouting = null;
    this.beginTurn({ type: 'turn_start', turnId: this.options.newTurnId(), role: 'synthesis' });
  }

  private beginTurn(start: Extract<CouncilEvent, { type: 'turn_start' }>): void {
    this.mode = 'turn';
    this.turnId = start.turnId;
    this.turnChars = 0;
    this.lastChar = '';
    this.held = '';
    // turn_start is sent with the first real character, so an empty section
    // never produces an empty note on the client.
    this.pendingStart = start;
    this.atSectionHead = true;
  }

  private body(text: string, out: CouncilEvent[]): void {
    if (!text) return;
    if (this.mode === 'outside') {
      if (this.stray.length < this.maxTurnChars) this.stray += text;
      return;
    }
    if (this.mode !== 'turn' || !this.turnId) return;

    let chunk = this.held + text;
    this.held = '';
    if (this.atSectionHead) {
      chunk = chunk.replace(HEAD_DECORATION, '');
      if (!chunk) return;
      this.atSectionHead = false;
    }
    const tail = TAIL_DECORATION.exec(chunk);
    if (tail) {
      this.held = tail[0];
      chunk = chunk.slice(0, tail.index);
    }
    chunk = plainDashes(chunk, this.lastChar);
    if (!chunk) return;

    const room = this.maxTurnChars - this.turnChars;
    if (room <= 0) return;
    if (chunk.length > room) chunk = chunk.slice(0, room);
    if (this.pendingStart) {
      if (this.pendingRouting) out.push(this.pendingRouting);
      this.pendingRouting = null;
      out.push(this.pendingStart);
      this.pendingStart = null;
      this.turns += 1;
    }
    this.turnChars += chunk.length;
    this.lastChar = chunk[chunk.length - 1];
    out.push({ type: 'delta', turnId: this.turnId, text: chunk });
  }

  private closeTurn(out: CouncilEvent[]): void {
    if (this.turnId && !this.pendingStart) out.push({ type: 'turn_end', turnId: this.turnId });
    this.turnId = null;
    this.pendingStart = null;
    this.held = '';
    if (this.mode === 'turn') this.mode = 'skip';
  }

  private ask(rest: string, out: CouncilEvent[]): void {
    if (!this.plan.allowAsk || this.askSent || this.turns === 0 || this.councilVoice) return;
    const question = plainDashes(rest.replace(/@@/g, '').replace(/^[\s:*#`\-]+/, '').replace(/[\s*#`]+$/, '').replace(/\s+/g, ' '));
    if (question.length < 3) return;
    this.askSent = true;
    out.push({ type: 'follow_up', question: question.slice(0, this.maxAskChars) });
  }

  private emitFallback(out: CouncilEvent[]): void {
    const text = plainDashes(this.stray.replace(/@+/g, '').replace(HEAD_DECORATION, '').replace(TAIL_DECORATION, ''));
    // Too short to be a reply: treat the output as unusable instead.
    if (text.length < MIN_FALLBACK_CHARS || !this.plan.fallback) return;
    const turnId = this.options.newTurnId();
    const fallback = this.plan.fallback;
    out.push(
      fallback.role === 'seat'
        ? { type: 'turn_start', turnId, role: 'seat', seatId: fallback.seatId, replyToSeatId: this.plan.replyTo[fallback.seatId] }
        : { type: 'turn_start', turnId, role: 'synthesis' },
      { type: 'delta', turnId, text },
      { type: 'turn_end', turnId },
    );
    this.turns += 1;
  }
}

export const ALL_SEATS: readonly SeatId[] = SEAT_IDS;
