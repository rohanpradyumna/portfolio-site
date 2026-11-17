import { COUNCIL_COPY } from '@/data/council/copy';
import { STARTERS } from '@/data/council/starters';
import SCRIPT from './script.json';
import { INTRO_UI } from '@/components/council/intro/constants';
import { LAST_STEP, MEMBER_COUNT } from '@/components/council/intro/sequence';
import type { SoundName } from '@/components/council/feel';

// The promo film's timing. The WORDS (captions, and the voiceover that echoes
// them) are in script.json beside this file. Every time is in VIRTUAL seconds from the start of
// the performance: the capture harness advances 16 ms per frame and encodes at
// 60 fps, so the finished film runs FILM_PER_VIRTUAL times longer than this
// says. Everything a viewer sees that is not the product itself (captions,
// camera, cursor, typed text, scripted scrolling, the end card) is a pure
// function of these numbers. The product is not: it is performed, by real
// clicks at the times listed here, and plays out on its own clock.
//
// The film is cut in two shapes from this one timeline: 'landscape' (16:9, the
// product's desktop layout) and 'vertical' (9:16, its phone layout, for Reels).
// The story, the beats and the words are shared. A value is given per format,
// as `pick(landscape, vertical)`, only where the two layouts force it: the
// stage, where the six stand in the opening, what the camera does, how far
// the page is scrolled. Where a caption sits and how big it is set is CSS
// (promo.module.css, under [data-format]).

/** Film seconds per virtual second (16 ms steps shown for 1/60 s each). */
export const FILM_PER_VIRTUAL = 1000 / 60 / 16;

export type FormatId = 'landscape' | 'vertical';
export const isFormat = (value: unknown): value is FormatId => value === 'landscape' || value === 'vertical';

// --- The conversation being filmed -------------------------------------------

const starter = STARTERS.find((candidate) => candidate.question === 'Can I want more and still be content?');
const pushBack = starter?.followUps.push_back;
if (!starter || !pushBack?.visitorText || !pushBack.seatIds?.[0] || !starter.opening.routing) {
  throw new Error('council-promo: the featured starter or its scripted push-back is missing from STARTERS.');
}

export const FEATURE = {
  question: starter.question,
  openingSeatIds: starter.opening.routing.seatIds,
  objection: pushBack.visitorText,
  objectionSeatId: pushBack.seatIds[0],
} as const;

// --- Selectors ---------------------------------------------------------------
// Real controls, found the way a test would find them. CSS-module class names
// are hashed, so everything here is an attribute or a structure the product
// already has. The tray is the one section labelled by its own heading.

const SCENE = '[data-council-scroll]';
const TRAY = `${SCENE} section[aria-labelledby]`;

export const SEL = {
  sceneScroller: SCENE,
  /** The first thing on the page. Its top is the top of the page. */
  pageHead: `${SCENE} header`,
  /** The dark question card, while it holds the composer. */
  composerCard: `${SCENE} main > div:has(> form)`,
  composerField: `${SCENE} main > div > form textarea`,
  composerSubmit: `${SCENE} main > div > form button[type="submit"]`,
  intro: '[data-council-intro]',
  introBegin: '[data-council-intro] button[data-final]',
  /** The same control before it becomes the invitation, so the cursor can already be on its way. */
  introCue: '[data-council-intro] button[style*="--seat-accent"]',
  introBubbles: '[data-council-intro] [data-level]',
  noteOf: (seatId: string) => `${SCENE} article[data-seat="${seatId}"]`,
  exchanges: `${SCENE} [data-exchange]`,
  /** "Taking this one: ..." at the head of the opening. */
  routingLine: `${SCENE} [data-exchange][data-action="open"] > p:first-child`,
  pushBackExchange: `${SCENE} [data-exchange][data-action="push_back"]`,
  /** The reply inside it (the visitor's own words come first, on a card of their own). */
  pushBackNote: `${SCENE} [data-exchange][data-action="push_back"] article[data-seat]`,
  tray: TRAY,
  trayTickets: `${TRAY} ul`,
  pushBackTicket: `${TRAY} button[data-ticket="push_back"]`,
  seatPick: (seatId: string) => `${TRAY} [role="group"] button:has(svg[data-seat="${seatId}"])`,
  objectionField: `${TRAY} form textarea`,
  objectionSubmit: `${TRAY} form button[type="submit"]`,
} as const;

// --- The shapes of things ------------------------------------------------------

export interface IntroLeg {
  /** The stop the scroll leaves. */
  fromStep: number;
  /** The stop it arrives on and stays. */
  step: number;
  from: number;
  to: number;
  /** Eased, for a leg that passes through a stop without resting on it. */
  eased: boolean;
}

/** One of the six in the opening shot. */
export interface OpeningSeat {
  /** Centre of the portrait, in stage pixels. */
  x: number;
  y: number;
  /** Hand-placed unevenness, as on the board. */
  lift: number;
  /** Where it goes when the group parts: how far, how much it turns, and how long it waits first. */
  exit: { x: number; y: number; turn: number; wait: number };
}

export interface Caption {
  id: string;
  from: number;
  to: number;
  /** The big serif line. Left out for a caption that is small print only. */
  line?: string;
  small?: string;
  /**
   * 'poster': the hook, set large over the six in the opening.
   * 'head': straight onto the board near the top, for a shot that leaves bare paper there.
   * 'over': over the interface, on a wash of paper that fades it out beneath the line
   *         (the foot of the frame in landscape, under the bench in vertical).
   * 'aside': small print alone, in a clear strip of the intro.
   */
  place: 'poster' | 'head' | 'over' | 'aside';
}

export interface Typing {
  id: 'question' | 'objection';
  selector: string;
  text: string;
  from: number;
  to: number;
  /** A soft tick on every nth character. */
  tickEvery: number;
}

/**
 * When the stand-in text caret is drawn, and in which field. The colours are
 * the product's own caret colours for those fields (the real caret is hidden:
 * it blinks on the real clock).
 */
export interface CaretSpan {
  selector: string;
  from: number;
  to: number;
  color: string;
}

/** What the camera frames. Resolved against the live layout at the moment the move starts. */
export type Framing =
  | { kind: 'full' }
  | {
      kind: 'element';
      selector: string;
      scale: number;
      /** The point of the element to hold, as a share of its box. */
      anchor: [number, number];
      /** Where on the frame that point sits, as a share of the frame. */
      screen: [number, number];
    };

export interface Shot {
  at: number;
  /** Seconds the move takes. 0 is a cut. */
  over: number;
  framing: Framing;
}

export interface SceneScroll {
  at: number;
  /** Seconds the move takes. 0 is a cut. */
  over: number;
  /** Bring this element's top to `top` pixels below the top of the frame. */
  selector: string;
  top: number;
  /** Keep aiming while the move is under way: for a page still growing under a reply as it streams in. */
  follow?: boolean;
  /**
   * And for this many seconds after it. A reply at the very end of the page
   * can only be brought as high as the page is long, so the move gets it as
   * far as it will go and the page then follows the reply up as it grows.
   */
  hold?: number;
}

/**
 * A clean board fades up over everything, the shot changes underneath, and it
 * fades away again. Used once, between the close-up on the question and the
 * intro.
 */
export interface Dip {
  /** Starts to rise. */
  from: number;
  /** Fully covering from here. */
  solid: number;
  /** Starts to clear. */
  clear: number;
  /** Gone. */
  to: number;
}

export interface Click {
  id: string;
  at: number;
  /** Seconds the cursor takes to get there. It arrives a moment before the press. */
  travel: number;
  selector: string;
  /** What the cursor steers by, when the control to press is not there yet as it sets off. */
  steerBy?: string;
  /** Where on the control, as a share of its box. */
  anchor: [number, number];
}

/** A span of the film with the cursor on screen. */
export interface CursorSpan {
  from: number;
  to: number;
  /** Where it comes in from, as a share of the frame. */
  home: [number, number];
  /** Or: comes in this many pixels from where one of the clicks will land. */
  beside?: { click: number; dx: number; dy: number };
}

export interface PromoCue {
  at: number;
  name: SoundName;
  level: number;
}

/** A box of the frame, in stage pixels. */
export interface Box {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

// --- The same in every format ----------------------------------------------------

/** The cursor stops this long before the press, the way a hand does. Seconds. */
export const CURSOR_SETTLE = 0.14;
/** The button is held down this long. The click itself is the release, at `Click.at`. */
export const PRESS_HOLD = 0.085;

// The product is silent while you type, and it has no captions. These few cues
// come from the product's own palette, mixed well under its real sounds.
export const CAPTION_CUE: { name: SoundName; level: number } = { name: 'pop', level: 0.32 };
export const TYPING_CUE: { name: SoundName; level: number } = { name: 'tick', level: 0.2 };

/**
 * Product copy the film keeps off screen: every statement of the two-exchange
 * limit, and the hero's "They rarely agree". The hiding is CSS, scoped to this
 * page (promo.module.css). The director reads the frame for these words while
 * it films, so a change in the product that slips past the CSS fails the render.
 */
export const LEFT_OUT = /\bexchanges?\b|follow-up left|live questions? left|that’s the round|the one rule|rarely agree/i;

export const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
export const easeOutCubic = (u: number) => 1 - Math.pow(1 - clamp01(u), 3);
export const easeOutQuint = (u: number) => 1 - Math.pow(1 - clamp01(u), 5);
export const easeInOutCubic = (u: number) => {
  const x = clamp01(u);
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
};
export const mix = (from: number, to: number, amount: number) => from + (to - from) * amount;

/** 0 to 1 pseudo-random from an integer, the same on every run. */
function noise(index: number): number {
  const x = Math.sin(index * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

/**
 * When each character lands, as a share of the typing window. People do not
 * type evenly: a breath after a space, a longer one after punctuation.
 */
function keyTimes(text: string): number[] {
  const weights = Array.from(text, (_, index) => {
    const previous = text[index - 1] ?? '';
    const base = /[.,?!]/.test(previous) ? 2.6 : previous === ' ' ? 1.35 : 1;
    return base * (0.7 + noise(index) * 0.6);
  });
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  let run = 0;
  return weights.map((weight) => (run += weight) / total);
}

// --- The film, in one format ---------------------------------------------------

function createFilm(format: FormatId) {
  const pick = <T>(landscape: T, vertical: T): T => (format === 'vertical' ? vertical : landscape);

  /** The page the product is laid out on. The vertical frame is its stage 2.5 times over: 1080 by 1920. */
  const STAGE = pick({ width: 1280, height: 720 }, { width: 432, height: 768 });

  /**
   * What Instagram draws over a Reel: its header over the top 14%, the caption
   * and buttons over the bottom 20%, the row of actions down the right of the
   * lower half. Every line the film itself sets is kept inside `box` and out
   * of `rail`, and the director checks that on every run. The product is free
   * to run underneath. Landscape has no such furniture.
   */
  const SAFE: { box: Box; rail: Box } | null = pick(null, {
    box: { left: 0, top: 108, right: 432, bottom: 614 },
    rail: { left: 380, top: 384, right: 432, bottom: 768 },
  });

  // --- Beats -------------------------------------------------------------------

  /** How the intro is scrolled: seconds of travel into each step, then seconds held on it. */
  const INTRO_PACE = {
    /** The first member arrives unscrolled. Held from the mount until the first scroll. */
    firstHold: 2.35,
    memberTravel: 0.9,
    memberHold: 1.32,
    assemblyTravel: 0.9,
    // The assembled six and their card are held for as long as the voiceover takes to describe them.
    assemblyHold: 3.6,
    /**
     * From the assembly card to "Your turn", in one move. The card between them
     * states the product's two-exchange limit, which the film leaves out (see
     * promo.module.css), so the scroll goes straight through it: slow out, fast
     * across the middle, slow in.
     */
    turnTravel: 0.8,
  } as const;

  // --- The opening: the six, before any interface --------------------------------

  // Landscape: one row across the frame. The curtain opens edges first, each
  // half to its own side.
  const row: OpeningSeat[] = [14, -10, 6, -14, 8, -6].map((lift, index, all) => {
    const fromEdge = Math.min(index, all.length - 1 - index);
    const side = index < all.length / 2 ? -1 : 1;
    return {
      x: 140 + index * 200,
      y: 426,
      lift,
      exit: { x: side * (820 - fromEdge * 70), y: -70, turn: side * 16, wait: fromEdge * 0.07 },
    };
  });
  // Vertical: two rows of three under the hook, the arrangement the product's
  // own phone layout seats them in. All of it is inside the middle 4:5 of the
  // frame, which is what a profile grid crops the cover to. The outer columns
  // leave sideways, the middle pair up and down.
  const grid: OpeningSeat[] = [8, -5, 4, -6, 3, -3].map((lift, index) => {
    const upper = index < 3;
    const side = (index % 3) - 1;
    return {
      x: 216 + side * 136,
      y: upper ? 342 : 516,
      lift,
      // The middle pair have the furthest to go to be out of the frame, so they leave first and go fastest.
      exit: side === 0 ? { x: 0, y: upper ? -1050 : 900, turn: upper ? -5 : 5, wait: 0 } : { x: side * 360, y: upper ? -110 : 60, turn: side * 14, wait: 0.05 },
    };
  });

  const OPENING = {
    /** Small caps over the hook line. */
    overline: INTRO_UI.cardName,
    /** Portrait width. */
    size: pick(196, 112),
    seats: pick(row, grid),
    /** "Stoic lens" in full, or "Stoic" alone where three tags share the width of a phone (as the product's phone layout has it). */
    shortTags: pick(false, true),
    /** They notice the camera one after another, left to right. */
    rippleAt: 0.7,
    rippleGap: 0.14,
    /** With the second line they all start talking, not quite together. */
    talkAt: 3.7,
    talkStagger: [0, 0.22, 0.08, 0.3, 0.15, 0.38],
    /** The group parts and the camera goes through to the question card. */
    partAt: 6.0,
    partOver: 0.75,
  } as const;

  const CARD_TYPE = { from: OPENING.partAt + 0.8, to: OPENING.partAt + 2.4 };
  const INTRO_AT = CARD_TYPE.to + 0.45;

  const INTRO_LEGS: IntroLeg[] = [];
  {
    let at = INTRO_AT + INTRO_PACE.firstHold;
    for (let step = 1; step <= MEMBER_COUNT; step++) {
      const member = step < MEMBER_COUNT;
      const travel = member ? INTRO_PACE.memberTravel : INTRO_PACE.assemblyTravel;
      INTRO_LEGS.push({ fromStep: step - 1, step, from: at, to: at + travel, eased: false });
      at += travel + (member ? INTRO_PACE.memberHold : INTRO_PACE.assemblyHold);
    }
    INTRO_LEGS.push({ fromStep: MEMBER_COUNT, step: LAST_STEP, from: at, to: at + INTRO_PACE.turnTravel, eased: true });
  }
  const introLastArrives = INTRO_LEGS[INTRO_LEGS.length - 1].to;

  /** The scripted scrollTop of the intro at `t`, given its stops. Travel, then exactly on the stop. */
  function introScrollTop(t: number, stops: number[]): number {
    let top = 0;
    for (const leg of INTRO_LEGS) {
      if (t <= leg.from) break;
      const u = Math.min(1, (t - leg.from) / (leg.to - leg.from));
      top = mix(stops[leg.fromStep], stops[leg.step], leg.eased ? easeInOutCubic(u) : u);
    }
    return Math.round(top);
  }

  // The beats in order. Each later time is derived from the ones before it, so a
  // change of pace upstream moves everything after it.
  const BEGIN_CLICK = introLastArrives + 0.46;
  const ARC_SETTLED = BEGIN_CLICK + 0.95;
  const ASK_CLICK = ARC_SETTLED + 1.0;
  /** The scripted opening, from the click to its last word. Measured, and checked on every run. */
  const OPENING_SECONDS = 7.45;
  const OPENING_DONE = ASK_CLICK + OPENING_SECONDS;
  // A beat on the three finished replies before moving on.
  const TRAY_SCROLL = OPENING_DONE + 1.0;
  // The tickets are held in plain view while the voiceover names two of them.
  const PUSH_CLICK = TRAY_SCROLL + 2.9;
  const SEAT_CLICK = PUSH_CLICK + 0.95;
  const OBJECTION_TYPE = SEAT_CLICK + 0.55;
  const OBJECTION_TYPED = OBJECTION_TYPE + 2.1;
  const SEND_CLICK = OBJECTION_TYPED + 0.55;
  /** The scripted reply to the objection, click to last word (about 3.0), and a moment to take it in. */
  const REPLY_SECONDS = 3.4;
  const REPLY_DONE = SEND_CLICK + REPLY_SECONDS;
  const END_AT = REPLY_DONE + 1.8;
  const END = END_AT + 5.6;

  const BEATS = {
    opening: 0,
    cardScene: OPENING.partAt + 0.5,
    hookType: CARD_TYPE,
    intro: INTRO_AT,
    beginClick: BEGIN_CLICK,
    arcSettled: ARC_SETTLED,
    askClick: ASK_CLICK,
    openingDone: OPENING_DONE,
    trayScroll: TRAY_SCROLL,
    pushClick: PUSH_CLICK,
    seatClick: SEAT_CLICK,
    objectionType: { from: OBJECTION_TYPE, to: OBJECTION_TYPED },
    sendClick: SEND_CLICK,
    replyDone: REPLY_DONE,
    endCard: END_AT,
    end: END,
  } as const;

  // --- Captions ----------------------------------------------------------------

  const CAPTION = SCRIPT.captions;

  const CAPTIONS: Caption[] = [
    // Already there on the first frame: that frame is the thumbnail.
    { id: 'conflicted', from: -2, to: OPENING.talkAt - 0.3, line: CAPTION.conflicted, place: 'poster' },
    { id: 'six', from: OPENING.talkAt, to: OPENING.partAt + 0.05, line: CAPTION.six, place: 'poster' },
    { id: 'bring', from: OPENING.partAt + 0.7, to: INTRO_AT - 0.05, line: CAPTION.bring, place: 'head' },
    // Through the six introductions, until the product's own card says the same thing.
    { id: 'smallPrint', from: INTRO_AT + 0.9, to: INTRO_LEGS[MEMBER_COUNT - 1].from + 0.2, small: CAPTION.smallPrint, place: 'aside' },
    { id: 'three', from: ASK_CLICK + 0.95, to: ASK_CLICK + 3.5, line: CAPTION.three, place: 'over' },
    { id: 'worldview', from: ASK_CLICK + 4.0, to: OPENING_DONE + 0.35, line: CAPTION.worldview, place: 'over' },
    { id: 'push', from: TRAY_SCROLL + 0.25, to: PUSH_CLICK + 0.3, line: CAPTION.push, place: 'over' },
    { id: 'answer', from: SEND_CLICK + 0.75, to: REPLY_DONE - 0.55, line: CAPTION.answer, place: 'over' },
  ];

  /**
   * The paper under an 'over' caption comes up this long before the line and
   * takes this long to do it. Later in vertical: the first of these captions
   * arrives while the bench is still on its way to the top of the page, and
   * the band should not catch it.
   */
  const WASH = pick({ lead: 0.3, rise: 0.45 }, { lead: 0.1, rise: 0.35 });

  // --- Typing ------------------------------------------------------------------

  const TYPING: Typing[] = [
    { id: 'question', selector: SEL.composerField, text: FEATURE.question, ...BEATS.hookType, tickEvery: 1 },
    { id: 'objection', selector: SEL.objectionField, text: FEATURE.objection, ...BEATS.objectionType, tickEvery: 2 },
  ];

  const CARETS: CaretSpan[] = [
    { selector: SEL.composerField, from: OPENING.partAt + 0.45, to: INTRO_AT - 0.15, color: 'var(--accent-yellow)' },
    { selector: SEL.composerField, from: ARC_SETTLED - 0.2, to: ASK_CLICK, color: 'var(--accent-yellow)' },
    { selector: SEL.objectionField, from: SEAT_CLICK + 0.25, to: SEND_CLICK, color: 'var(--accent-orange)' },
  ];

  const KEY_TIMES = new Map(TYPING.map((typing) => [typing.id, keyTimes(typing.text)]));

  /** How many characters of a typing job are on screen at `t`. */
  function typedLength(typing: Typing, t: number): number {
    if (t <= typing.from) return 0;
    if (t >= typing.to) return typing.text.length;
    const u = (t - typing.from) / (typing.to - typing.from);
    const times = KEY_TIMES.get(typing.id) ?? [];
    let count = 0;
    while (count < times.length && times[count] <= u) count++;
    return count;
  }

  // --- Camera ------------------------------------------------------------------

  // Close enough to read a reply at phone size, wide enough that the line
  // saying who took the question never leaves the frame as the camera follows
  // the speaker along the row.
  const NOTE_SCALE = 1.3;
  const noteShot = (seatId: string, at: number, over: number): Shot => ({
    at,
    over,
    framing: { kind: 'element', selector: SEL.noteOf(seatId), scale: NOTE_SCALE, anchor: [0.5, 0], screen: [0.5, 0.23] },
  });

  // The camera is at 'full' (no transform at all) for the intro's handoff and
  // for the arc-to-bench move: framer measures layout in screen space, and a
  // scaled ancestor would bend both flights.
  const SHOTS: Shot[] = pick(
    [
      // Under the opening, the camera is already on the question card: a little too
      // close and a little low, so nothing else on the page is in the frame.
      { at: 0, over: 0, framing: { kind: 'element', selector: SEL.composerCard, scale: 1.72, anchor: [0.5, 1], screen: [0.5, 1.03] } },
      // As the six part, it settles: the card alone, low in the frame, bare board above it for the line.
      { at: OPENING.partAt, over: 0.95, framing: { kind: 'element', selector: SEL.composerCard, scale: 1.6, anchor: [0.5, 1], screen: [0.5, 0.95] } },
      // A cut, hidden under the dip to paper.
      { at: INTRO_AT, over: 0, framing: { kind: 'full' } },
      noteShot(FEATURE.openingSeatIds[0], ASK_CLICK + 1.3, 0.9),
      noteShot(FEATURE.openingSeatIds[1], ASK_CLICK + 3.2, 0.85),
      noteShot(FEATURE.openingSeatIds[2], ASK_CLICK + 5.35, 0.85),
      { at: OPENING_DONE - 0.1, over: 0.9, framing: { kind: 'full' } },
    ],
    // A phone is already a close-up and its page is one column, so the frame
    // holds still and the page moves under it (SCENE_SCROLLS).
    [],
  );

  // --- Scripted scrolling of the scene -----------------------------------------

  // Vertical: where the page sits to show the whole question card with its
  // "Ask" button clear of Instagram's caption, and where a reply's top edge
  // goes so the film's own caption has room above it.
  const COMPOSER_VIEW = { selector: SEL.composerSubmit, top: 532 };
  const NOTE_TOP = 258;

  const SCENE_SCROLLS: SceneScroll[] = pick(
    [
      // During the push-in on the notes. The camera cannot look below the stage,
      // so the page comes up instead, until the line naming the three is at the
      // top of the shot. Not before the first reply has made the page long enough to move.
      { at: ASK_CLICK + 2.3, over: 0.85, selector: SEL.routingLine, top: 172 },
      // Down to the follow-up tickets (as far as the page goes: it ends just under them).
      { at: TRAY_SCROLL, over: 1.0, selector: SEL.trayTickets, top: 330 },
      // The page is at its very end while the objection is typed, and it gets
      // shorter when the last character lands (the "borrow this" suggestion goes).
      // Easing back first means the browser has nothing to snap.
      { at: OBJECTION_TYPED - 1.05, over: 0.8, selector: SEL.objectionField, top: 408 },
      // The reply is in. Up, until the label under it is in the frame too.
      { at: REPLY_DONE + 0.3, over: 0.75, selector: SEL.pushBackExchange, top: 50 },
    ],
    [
      // Under the opening the page is already on the question card.
      { at: 0, over: 0, ...COMPOSER_VIEW },
      // Back to the top under the dip to paper: the six can only be handed from
      // the intro to their seats with the page unscrolled.
      { at: INTRO_AT, over: 0, selector: SEL.pageHead, top: 0 },
      // Seated. Down to the card again for the press. (The product takes the page back up when it is asked.)
      { at: ARC_SETTLED - 0.05, over: 0.7, ...COMPOSER_VIEW },
      // One column: each reply is brought up under the caption as it starts.
      // The first as soon as its note is on the page, a moment after the product has taken the page to the top.
      { at: ASK_CLICK + 0.5, over: 0.85, selector: SEL.noteOf(FEATURE.openingSeatIds[0]), top: NOTE_TOP, follow: true },
      { at: ASK_CLICK + 3.2, over: 0.85, selector: SEL.noteOf(FEATURE.openingSeatIds[1]), top: NOTE_TOP, follow: true },
      // The last reply is the end of the page: it comes the rest of the way up as it grows.
      { at: ASK_CLICK + 5.35, over: 0.85, selector: SEL.noteOf(FEATURE.openingSeatIds[2]), top: NOTE_TOP, follow: true, hold: 1.5 },
      // Down to the follow-up tickets.
      { at: TRAY_SCROLL, over: 1.0, selector: SEL.trayTickets, top: NOTE_TOP },
      // The seat is picked and the field opens under it. Up, as far as keeps
      // the "Written in advance. No AI call." label of the replies in view
      // under the bench while the objection is typed, with the "Send it"
      // button clear of Instagram's caption by the time it is pressed.
      { at: SEAT_CLICK + 0.2, over: 0.7, selector: SEL.objectionField, top: 445 },
      // The product brings the new exchange to the top itself. Its reply is the
      // end of the page too, and comes up under the caption as it grows.
      { at: SEND_CLICK + 1.0, over: 0.7, selector: SEL.pushBackNote, top: NOTE_TOP, follow: true, hold: 1.15 },
      // As the caption lifts, down a touch: the objection's card comes out from under the bench, whole.
      { at: REPLY_DONE - 0.5, over: 0.7, selector: SEL.pushBackNote, top: NOTE_TOP + 20 },
    ],
  );

  // --- Dip to paper ------------------------------------------------------------

  const DIPS: Dip[] = [{ from: INTRO_AT - 0.32, solid: INTRO_AT - 0.02, clear: INTRO_AT + 0.1, to: INTRO_AT + 0.5 }];

  function dipAt(t: number): number {
    return DIPS.reduce((most, dip) => {
      if (t <= dip.from || t >= dip.to) return most;
      const amount = t < dip.solid ? easeInOutCubic((t - dip.from) / (dip.solid - dip.from)) : t <= dip.clear ? 1 : 1 - easeInOutCubic((t - dip.clear) / (dip.to - dip.clear));
      return Math.max(most, amount);
    }, 0);
  }

  // --- Cursor and clicks -------------------------------------------------------

  /** What stands in for the hand: a mouse arrow on the desktop page, a fingertip on the phone's. */
  const POINTER: 'arrow' | 'touch' = pick('arrow', 'touch');
  // A mouse crosses the page to its target. A finger comes down next to it.
  const reach = (mouse: number) => pick(mouse, 0.42);

  const CLICKS: Click[] = [
    { id: 'begin', at: BEGIN_CLICK, travel: reach(0.8), selector: SEL.introBegin, steerBy: SEL.introCue, anchor: [0.62, 0.55] },
    { id: 'ask', at: ASK_CLICK, travel: reach(0.75), selector: SEL.composerSubmit, anchor: [0.55, 0.55] },
    { id: 'push', at: PUSH_CLICK, travel: reach(0.85), selector: SEL.pushBackTicket, anchor: [0.5, 0.55] },
    { id: 'seat', at: SEAT_CLICK, travel: reach(0.6), selector: SEL.seatPick(FEATURE.objectionSeatId), anchor: [0.5, 0.55] },
    { id: 'send', at: SEND_CLICK, travel: reach(0.55), selector: SEL.objectionSubmit, anchor: [0.5, 0.55] },
  ];

  /** A fingertip's visit for one tap: in beside the control, a little below and to the right, and away again. */
  const tap = (index: number, last = index): CursorSpan => ({
    from: CLICKS[index].at - CURSOR_SETTLE - CLICKS[index].travel - 0.15,
    to: CLICKS[last].at + 0.15,
    home: [0.72, 0.7],
    beside: { click: index, dx: 44, dy: 62 },
  });

  const CURSOR_SPANS: CursorSpan[] = pick(
    // The arrow stays on screen from the first click of a passage to the last.
    [
      { from: BEGIN_CLICK - 1.1, to: ASK_CLICK + 0.9, home: [0.78, 0.8] },
      { from: PUSH_CLICK - 1.15, to: SEND_CLICK + 0.9, home: [0.8, 0.78] },
    ],
    // The fingertip is only there to tap. Picking the ticket and then the seat is one visit.
    [tap(0), tap(1), tap(2, 3), tap(4)],
  );

  // --- End card ----------------------------------------------------------------

  const END_CARD = {
    at: END_AT,
    title: INTRO_UI.cardName,
    /** The promise, a sentence at a time. */
    promise: COUNCIL_COPY.promise.match(/[^.]+\./g)?.map((sentence) => sentence.trim()) ?? [COUNCIL_COPY.promise],
    host: 'rohanpradyumna.vercel.app',
    path: '/council',
    small: COUNCIL_COPY.scene.disclosure,
    /** Width of the entry sticker. */
    artSize: pick(188, 132),
    // Seconds after `at`.
    paperIn: 0.45,
    artAt: 0.35,
    artFall: 0.2,
    titleAt: 0.7,
    promiseAt: 1.15,
    promiseGap: 0.28,
    urlAt: 1.8,
    smallAt: 2.2,
  } as const;

  // --- Sound added by the film ---------------------------------------------------

  /** One for each of the six as they notice the camera, and the group parting. */
  const OPENING_CUES: PromoCue[] = [
    ...OPENING.seats.map((_, index) => ({ at: OPENING.rippleAt + index * OPENING.rippleGap, name: 'pop' as const, level: 0.26 })),
    { at: OPENING.partAt + 0.1, name: 'flick', level: 0.45 },
  ];
  const END_CARD_CUES: PromoCue[] = [
    // The sticker touching the board, on the frame it does.
    { at: END_AT + END_CARD.artAt + END_CARD.artFall, name: 'slap', level: 0.8 },
    { at: END_AT + END_CARD.urlAt, name: 'pop', level: 0.4 },
  ];

  // --- What the run must show ----------------------------------------------------

  const EXPECT = {
    /** Checked just before the click on "Ask something". */
    introAt: BEGIN_CLICK - 0.05,
    /** Checked a moment after the opening should have finished. */
    openingAt: OPENING_DONE + 0.3,
    replyAt: REPLY_DONE + 0.3,
    scriptedLabel: COUNCIL_COPY.scene.scripted,
  } as const;

  return {
    format,
    STAGE,
    SAFE,
    OPENING,
    INTRO_LEGS,
    introScrollTop,
    BEATS,
    DURATION: END,
    CAPTIONS,
    WASH,
    TYPING,
    CARETS,
    typedLength,
    SHOTS,
    SCENE_SCROLLS,
    dipAt,
    CLICKS,
    CURSOR_SPANS,
    POINTER,
    END_CARD,
    OPENING_CUES,
    END_CARD_CUES,
    EXPECT,
  };
}

export type Film = ReturnType<typeof createFilm>;

const films = new Map<FormatId, Film>();

/** The film in one of its two shapes. Built once per format. */
export function filmFor(format: FormatId): Film {
  let film = films.get(format);
  if (!film) {
    film = createFilm(format);
    films.set(format, film);
  }
  return film;
}
