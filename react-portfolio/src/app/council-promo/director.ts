import { LAST_STEP, scrollStops } from '@/components/council/intro/sequence';
import type { CueLog } from './audio';
import { paintCaptions } from './Captions';
import { CaretState, paintCaret, paintCursor } from './Cursor';
import { paintEndCard } from './EndCard';
import { paintOpening } from './Opening';
import { CAPTION_CUE, CURSOR_SETTLE, FEATURE, Film, Framing, LEFT_OUT, PRESS_HOLD, SEL, TYPING_CUE, clamp01, easeInOutCubic, mix } from './timeline';

// The director performs the visit. Once per animation frame it reads the
// clock and (1) presses whatever the script says is due, (2) puts every
// overlay where the script says it is at that instant.
//
// It keeps time with performance.now() and requestAnimationFrame only, so it
// runs the same in a real tab (a live preview) and under the capture
// harness's virtual clock, where a frame is 16 ms however long it took.

export interface FilmParts {
  /** Wraps the scene. The camera is a transform on this element. */
  camera: HTMLElement;
  /** The six on a clean board: the first shot. */
  opening: HTMLElement;
  captions: HTMLElement;
  /** The clean board that covers the cut into the intro. */
  dip: HTMLElement;
  pointer: HTMLElement;
  end: HTMLElement;
  /** A hidden block used to measure where a field's text ends. */
  mirror: HTMLElement;
  mountIntro: () => void;
  cues: CueLog;
}

export interface FilmChecks {
  introReachedLastStep: boolean;
  introBubblesRevealed: number;
  openingNotesDone: number;
  scriptedLabelShown: boolean;
  exchanges: number;
  replyDone: boolean;
  clicks: string[];
  /**
   * When things the product did on its own clock were first seen, in virtual
   * seconds: the intro's card turning to "Your turn", the first and last word
   * of the replies. The voiceover is hung on these.
   */
  marks: Record<string, number>;
  /**
   * Any text about the two-exchange limit (or the "rarely agree" line) that
   * was painted in the frame: when, and what it said. The film leaves these
   * out, so this must stay empty.
   */
  leftOutShown: Array<{ at: number; text: string }>;
  /**
   * Vertical only. Any line the film itself set (a caption, the end card's
   * title or address) that was found under what Instagram draws over a Reel:
   * when, what it said, and where it was. Must stay empty too.
   */
  outsideSafeArea: Array<{ at: number; text: string; box: string }>;
}

/** Where a real mouse should be right now, and whether its button is down. Null: off the stage. */
export interface PointerIntent {
  x: number;
  y: number;
  down: boolean;
}

export interface Director {
  start: () => void;
  stop: () => void;
  /** Virtual seconds since start(), or 0 before it. */
  seconds: () => number;
  /**
   * The capture harness owns a real mouse. Once it has called this, the
   * director stops clicking with element.click() and reports where the mouse
   * belongs instead, so hover, the pressed state and focus all behave as
   * they do under a hand.
   */
  useRealPointer: () => void;
  pointer: () => PointerIntent | null;
  failures: string[];
  checks: FilmChecks;
}

interface View {
  tx: number;
  ty: number;
  s: number;
}

interface Point {
  x: number;
  y: number;
}

const FULL: View = { tx: 0, ty: 0, s: 1 };
const find = <T extends Element = HTMLElement>(selector: string) => document.querySelector<T>(selector);

function setFieldValue(field: HTMLTextAreaElement, value: string): void {
  // React tracks the value it last set. Going through the native setter and a
  // real input event is what makes this indistinguishable from a keystroke.
  const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
  setter?.call(field, value);
  field.dispatchEvent(new Event('input', { bubbles: true }));
}

const MIRRORED = [
  'fontFamily',
  'fontSize',
  'fontWeight',
  'fontStyle',
  'fontVariantLigatures',
  'fontFeatureSettings',
  'letterSpacing',
  'lineHeight',
  'textTransform',
  'textIndent',
  'tabSize',
  'boxSizing',
  'paddingTop',
  'paddingRight',
  'paddingBottom',
  'paddingLeft',
  'borderTopWidth',
  'borderRightWidth',
  'borderBottomWidth',
  'borderLeftWidth',
] as const;

/** Where the text in `field` ends, in frame pixels: the top of the caret, and its height. */
function caretPoint(field: HTMLTextAreaElement, mirror: HTMLElement): { x: number; y: number; height: number } | null {
  const style = getComputedStyle(field);
  for (const property of MIRRORED) mirror.style[property] = style[property];
  mirror.style.borderStyle = 'solid';
  mirror.style.width = `${field.offsetWidth}px`;
  mirror.textContent = field.value;
  const mark = document.createElement('span');
  mark.textContent = '​';
  mirror.appendChild(mark);
  const rect = field.getBoundingClientRect();
  if (field.offsetWidth === 0) return null;
  // The field is drawn through the camera. Its box says by how much.
  const scale = rect.width / field.offsetWidth;
  return {
    x: rect.left + (mark.offsetLeft - field.scrollLeft) * scale,
    y: rect.top + (mark.offsetTop - field.scrollTop) * scale,
    height: mark.offsetHeight * scale,
  };
}

/**
 * Chrome's own smooth scrolling runs on the real clock, which the capture
 * harness does not control. While the film is mounted, `behavior: 'smooth'`
 * is carried out here instead: the same glide, timed with performance.now().
 * Returns the function that puts the native methods back.
 */
export function installSmoothScroll(): () => void {
  const proto = Element.prototype;
  const nativeScrollTo = proto.scrollTo;
  const nativeScrollIntoView = proto.scrollIntoView;
  const gliding = new Map<Element, number>();

  const glide = (scroller: Element, to: number) => {
    const from = scroller.scrollTop;
    const target = Math.max(0, Math.min(scroller.scrollHeight - scroller.clientHeight, to));
    const pending = gliding.get(scroller);
    if (pending) cancelAnimationFrame(pending);
    if (Math.abs(target - from) < 1) return;
    const startedAt = performance.now();
    const duration = Math.min(720, Math.max(320, Math.abs(target - from) * 1.1));
    const tick = () => {
      const u = (performance.now() - startedAt) / duration;
      scroller.scrollTop = Math.round(mix(from, target, easeInOutCubic(u)));
      if (u < 1) gliding.set(scroller, requestAnimationFrame(tick));
      else gliding.delete(scroller);
    };
    gliding.set(scroller, requestAnimationFrame(tick));
  };

  const scrollerOf = (element: Element): Element | null => {
    for (let node = element.parentElement; node; node = node.parentElement) {
      const overflow = getComputedStyle(node).overflowY;
      if ((overflow === 'auto' || overflow === 'scroll') && node.scrollHeight > node.clientHeight) return node;
    }
    return null;
  };

  proto.scrollTo = function scrollTo(this: Element, ...args: unknown[]) {
    const options = args[0];
    if (options && typeof options === 'object' && (options as ScrollToOptions).behavior === 'smooth') {
      glide(this, (options as ScrollToOptions).top ?? this.scrollTop);
      return;
    }
    (nativeScrollTo as (...rest: unknown[]) => void).apply(this, args);
  } as typeof proto.scrollTo;

  proto.scrollIntoView = function scrollIntoView(this: Element, arg?: boolean | ScrollIntoViewOptions) {
    const scroller = typeof arg === 'object' && arg.behavior === 'smooth' ? scrollerOf(this) : null;
    if (!scroller || typeof arg !== 'object') {
      nativeScrollIntoView.call(this, arg);
      return;
    }
    const box = scroller.getBoundingClientRect();
    const scale = box.height / scroller.clientHeight || 1;
    const offset = (this.getBoundingClientRect().top - box.top) / scale;
    const margin = parseFloat(getComputedStyle(this).scrollMarginTop) || 0;
    // The scene only ever asks for block: 'start'.
    glide(scroller, scroller.scrollTop + offset - margin);
  };

  // Focusing a field that is out of view makes Chrome jump the page to it in
  // one frame. On film that reads as a dropped shot, so the same move (bring
  // the element to the middle if any of it is hidden) is glided here.
  const nativeFocus = HTMLElement.prototype.focus;
  HTMLElement.prototype.focus = function focus(this: HTMLElement, options?: FocusOptions) {
    nativeFocus.call(this, { ...options, preventScroll: true });
    const scroller = options?.preventScroll ? null : scrollerOf(this);
    if (!scroller) return;
    const box = scroller.getBoundingClientRect();
    const scale = box.height / scroller.clientHeight || 1;
    const rect = this.getBoundingClientRect();
    const top = (rect.top - box.top) / scale;
    const bottom = (rect.bottom - box.top) / scale;
    const style = getComputedStyle(this);
    const hiddenAbove = top - (parseFloat(style.scrollMarginTop) || 0) < 0;
    const hiddenBelow = bottom + (parseFloat(style.scrollMarginBottom) || 0) > scroller.clientHeight;
    if (hiddenAbove || hiddenBelow) glide(scroller, scroller.scrollTop + (top + bottom) / 2 - scroller.clientHeight / 2);
  };

  return () => {
    gliding.forEach((frame) => cancelAnimationFrame(frame));
    proto.scrollTo = nativeScrollTo;
    proto.scrollIntoView = nativeScrollIntoView;
    HTMLElement.prototype.focus = nativeFocus;
  };
}

interface Cue {
  at: number;
  run: () => void;
}

export function createDirector(parts: FilmParts, film: Film): Director {
  const { STAGE, SAFE, BEATS, DURATION, CAPTIONS, TYPING, CARETS, SHOTS, SCENE_SCROLLS, CLICKS, CURSOR_SPANS, EXPECT } = film;
  const failures: string[] = [];
  const checks: FilmChecks = {
    introReachedLastStep: false,
    introBubblesRevealed: 0,
    openingNotesDone: 0,
    scriptedLabelShown: false,
    exchanges: 0,
    replyDone: false,
    clicks: [],
    marks: {},
    leftOutShown: [],
    outsideSafeArea: [],
  };

  let startedAt: number | null = null;
  let frameId = 0;
  let realPointer = false;
  const seconds = () => (startedAt === null ? 0 : (performance.now() - startedAt) / 1000);

  // --- Camera ----------------------------------------------------------------

  /** A zoomed frame never shows past the edge of the stage. */
  const clampView = (view: View): View => {
    if (view.s <= 1) return FULL;
    return {
      s: view.s,
      tx: Math.min(0, Math.max(STAGE.width * (1 - view.s), view.tx)),
      ty: Math.min(0, Math.max(STAGE.height * (1 - view.s), view.ty)),
    };
  };

  /** Zoom is felt in ratios, so scale moves geometrically while the point being looked at moves in a line. */
  const mixView = (from: View, to: View, amount: number): View => {
    const s = from.s * Math.pow(to.s / from.s, amount);
    const centre = (view: View, size: number, offset: number) => (size / 2 - offset) / view.s;
    const cx = mix(centre(from, STAGE.width, from.tx), centre(to, STAGE.width, to.tx), amount);
    const cy = mix(centre(from, STAGE.height, from.ty), centre(to, STAGE.height, to.ty), amount);
    return clampView({ s, tx: STAGE.width / 2 - cx * s, ty: STAGE.height / 2 - cy * s });
  };

  let applied: View = FULL;
  const shotViews: Array<{ from: View; to: View } | null> = SHOTS.map(() => null);

  /** Stage coordinates of a point given in frame coordinates, under the camera as it stands. */
  const toStage = (x: number, y: number): Point => ({ x: (x - applied.tx) / applied.s, y: (y - applied.ty) / applied.s });

  const frameView = (framing: Framing): View | null => {
    if (framing.kind === 'full') return FULL;
    const element = find(framing.selector);
    if (!element) return null;
    const rect = element.getBoundingClientRect();
    const anchor = toStage(rect.left + rect.width * framing.anchor[0], rect.top + rect.height * framing.anchor[1]);
    return clampView({
      s: framing.scale,
      tx: STAGE.width * framing.screen[0] - anchor.x * framing.scale,
      ty: STAGE.height * framing.screen[1] - anchor.y * framing.scale,
    });
  };

  const cameraAt = (t: number): View => {
    let view = applied;
    SHOTS.forEach((shot, index) => {
      if (t < shot.at) return;
      if (!shotViews[index]) {
        const to = frameView(shot.framing);
        if (!to) {
          failures.push(`camera: nothing matches the shot at ${shot.at.toFixed(2)}s`);
          shotViews[index] = { from: applied, to: applied };
        } else {
          shotViews[index] = { from: applied, to };
        }
      }
      const resolved = shotViews[index];
      if (!resolved) return;
      const u = shot.over > 0 ? (t - shot.at) / shot.over : 1;
      view = u >= 1 ? resolved.to : mixView(resolved.from, resolved.to, easeInOutCubic(u));
    });
    return view;
  };

  const applyCamera = (view: View) => {
    applied = view;
    const identity = Math.abs(view.s - 1) < 1e-5 && Math.abs(view.tx) < 0.01 && Math.abs(view.ty) < 0.01;
    // No transform at all at rest: a transformed ancestor would change what
    // framer measures during the two layout flights.
    parts.camera.style.transform = identity ? '' : `translate(${view.tx.toFixed(3)}px, ${view.ty.toFixed(3)}px) scale(${view.s.toFixed(5)})`;
  };

  // --- Scripted scrolling ----------------------------------------------------

  const sceneGlides: Array<{ from: number; to: number; now: number } | null> = SCENE_SCROLLS.map(() => null);

  const scrollScene = (t: number) => {
    const scroller = find(SEL.sceneScroller);
    if (!scroller) return;
    SCENE_SCROLLS.forEach((job, index) => {
      const moving = t <= job.at + job.over + 0.05;
      if (t < job.at || (!moving && t > job.at + job.over + (job.hold ?? 0))) return;
      /** The scrollTop that puts the job's element where it wants it, as the page stands. */
      const aim = (): number | null => {
        const target = find(job.selector);
        if (!target) return null;
        const top = toStage(0, target.getBoundingClientRect().top).y;
        const max = scroller.scrollHeight - scroller.clientHeight;
        return Math.max(0, Math.min(max, scroller.scrollTop + top - job.top));
      };
      let glide = sceneGlides[index];
      if (!glide) {
        const to = aim();
        if (to === null) {
          // Not on the page yet (a reply's note appears a moment after the question is asked).
          // Keep looking until the move was due to be over.
          if (t < job.at + job.over) return;
          failures.push(`scroll: nothing matches ${job.selector}`);
        }
        glide = sceneGlides[index] = { from: scroller.scrollTop, to: to ?? scroller.scrollTop, now: scroller.scrollTop };
      } else if (job.follow) {
        glide.to = aim() ?? glide.to;
      }
      // The move itself, then (for a job that holds on) closing a share of
      // whatever gap the growing page opens, frame by frame, so a new line of
      // a reply lifts the page instead of jolting it.
      if (moving) glide.now = job.over > 0 ? mix(glide.from, glide.to, easeInOutCubic((t - job.at) / job.over)) : glide.to;
      else glide.now += (glide.to - glide.now) * 0.16;
      const next = Math.round(glide.now);
      if (scroller.scrollTop !== next) scroller.scrollTop = next;
    });
  };

  const scrollIntro = (t: number) => {
    if (t >= BEATS.beginClick) return;
    const intro = find(SEL.intro);
    if (!intro || intro.clientHeight === 0) return;
    const top = film.introScrollTop(t, scrollStops(intro.clientHeight));
    if (intro.scrollTop !== top) intro.scrollTop = top;
  };

  // --- Typing ----------------------------------------------------------------

  const typed = new Map<string, number>(TYPING.map((job) => [job.id, 0]));
  const focused = new Set<string>();
  /** When a field's text last changed, for the caret: steady while typing, blinking at rest. */
  let lastKeyAt = 0;

  const type = (t: number) => {
    for (const job of TYPING) {
      if (t < job.from - 0.45 || t > job.to + 0.5) continue;
      const field = find<HTMLTextAreaElement>(job.selector);
      if (!field) continue;
      if (!focused.has(job.id)) {
        focused.add(job.id);
        field.focus({ preventScroll: true });
      }
      const length = film.typedLength(job, t);
      const before = typed.get(job.id) ?? 0;
      if (length === before) continue;
      typed.set(job.id, length);
      lastKeyAt = t;
      setFieldValue(field, job.text.slice(0, length));
      for (let index = before; index < length; index++) {
        if (job.text[index] !== ' ' && index % job.tickEvery === 0) {
          // A little unevenness, so a run of keys is not one repeated sample.
          parts.cues.add(TYPING_CUE.name, TYPING_CUE.level * (0.75 + 0.5 * Math.abs(Math.sin(index * 12.9898))));
        }
      }
    }
  };

  const caretAt = (t: number): CaretState => {
    const hidden: CaretState = { visible: false, x: 0, y: 0, height: 0, width: 0, color: '' };
    const span = CARETS.find((candidate) => t >= candidate.from && t < candidate.to);
    const field = span ? find<HTMLTextAreaElement>(span.selector) : null;
    if (!span || !field || document.activeElement !== field) return hidden;
    const point = caretPoint(field, parts.mirror);
    if (!point) return hidden;
    const rest = t - Math.max(lastKeyAt, span.from);
    const lit = rest < 0.5 || (rest - 0.5) % 1.06 > 0.53;
    return { visible: lit, x: point.x, y: point.y, height: point.height, width: Math.max(2, 2 * applied.s), color: span.color };
  };

  // --- Cursor ----------------------------------------------------------------

  let cursor: Point = { x: STAGE.width * CURSOR_SPANS[0].home[0], y: STAGE.height * CURSOR_SPANS[0].home[1] };
  const moveStarts: Array<Point | null> = CLICKS.map(() => null);
  const lastTargets: Array<Point | null> = CLICKS.map(() => null);
  const spanEntered = CURSOR_SPANS.map(() => false);
  let press: { at: number; x: number; y: number } | null = null;

  const targetOf = (index: number): Point | null => {
    const click = CLICKS[index];
    const element = find(click.selector) ?? (click.steerBy ? find(click.steerBy) : null);
    if (element) {
      const rect = element.getBoundingClientRect();
      lastTargets[index] = { x: rect.left + rect.width * click.anchor[0], y: rect.top + rect.height * click.anchor[1] };
    }
    return lastTargets[index];
  };

  const moveCursor = (t: number) => {
    CURSOR_SPANS.forEach((span, index) => {
      if (t >= span.from && !spanEntered[index]) {
        spanEntered[index] = true;
        const near = span.beside ? targetOf(span.beside.click) : null;
        cursor = near && span.beside ? { x: near.x + span.beside.dx, y: near.y + span.beside.dy } : { x: STAGE.width * span.home[0], y: STAGE.height * span.home[1] };
      }
    });
    CLICKS.forEach((click, index) => {
      const arrive = click.at - CURSOR_SETTLE;
      const leave = arrive - click.travel;
      if (t < leave || t > click.at) return;
      const target = targetOf(index);
      if (!target) return;
      if (!moveStarts[index]) moveStarts[index] = { ...cursor };
      const from = moveStarts[index] ?? cursor;
      const u = easeInOutCubic((t - leave) / click.travel);
      // A hand moves in a shallow arc, not along a ruler.
      const bow = Math.sin(Math.PI * u) * 0.07;
      cursor = {
        x: mix(from.x, target.x, u) - (target.y - from.y) * bow,
        y: mix(from.y, target.y, u) + (target.x - from.x) * bow,
      };
    });
  };

  const cursorOpacity = (t: number): number =>
    CURSOR_SPANS.reduce((most, span) => Math.max(most, Math.min(clamp01((t - span.from) / 0.25), 1 - clamp01((t - span.to) / 0.3))), 0);

  // --- The script ------------------------------------------------------------

  const count = (selector: string) => document.querySelectorAll(selector).length;

  const script: Cue[] = [
    { at: BEATS.intro, run: parts.mountIntro },
    ...CLICKS.map((click, index) => ({
      at: click.at,
      run: () => {
        const element = find(click.selector);
        if (!element) {
          failures.push(`click "${click.id}": nothing matches ${click.selector}`);
          return;
        }
        const point = targetOf(index) ?? cursor;
        press = { at: click.at, x: point.x, y: point.y };
        checks.clicks.push(click.id);
        // With a real mouse on the stage, its release at this moment is the click.
        if (!realPointer) element.click();
      },
    })),
    // A line arriving gets a soft pop. Not the one already on the first frame, and not the small print.
    ...CAPTIONS.filter((caption) => caption.from > 0 && caption.line).map((caption) => ({
      at: caption.from,
      run: () => parts.cues.add(CAPTION_CUE.name, CAPTION_CUE.level),
    })),
    ...[...film.OPENING_CUES, ...film.END_CARD_CUES].map((cue) => ({ at: cue.at, run: () => parts.cues.add(cue.name, cue.level) })),
    {
      at: EXPECT.introAt,
      run: () => {
        const intro = find(SEL.intro);
        checks.introReachedLastStep = intro?.dataset.step === String(LAST_STEP);
        checks.introBubblesRevealed = count(`${SEL.introBubbles}[data-level="2"]`);
        if (!checks.introReachedLastStep) failures.push(`intro: on step ${intro?.dataset.step ?? 'none'}, not ${LAST_STEP}, when "Ask something" is due`);
      },
    },
    {
      at: EXPECT.openingAt,
      run: () => {
        checks.openingNotesDone = FEATURE.openingSeatIds.filter((seatId) => find(`${SEL.noteOf(seatId)}[data-state="done"]`)).length;
        checks.scriptedLabelShown = find(SEL.sceneScroller)?.textContent?.includes(EXPECT.scriptedLabel) ?? false;
        if (checks.openingNotesDone !== FEATURE.openingSeatIds.length) {
          failures.push(`opening: ${checks.openingNotesDone} of ${FEATURE.openingSeatIds.length} notes finished in time`);
        }
        if (!checks.scriptedLabelShown) failures.push('opening: the "written in advance" label is not on the page');
      },
    },
    {
      at: EXPECT.replyAt,
      run: () => {
        const exchanges = document.querySelectorAll(SEL.exchanges);
        checks.exchanges = exchanges.length;
        const reply = exchanges[exchanges.length - 1]?.querySelector(`article[data-seat="${FEATURE.objectionSeatId}"]`);
        checks.replyDone = exchanges.length === 2 && reply?.getAttribute('data-state') === 'done';
        if (!checks.replyDone) failures.push('push back: the reply had not finished in time');
      },
    },
  ].sort((a, b) => a.at - b.at);
  let nextCue = 0;

  // --- Watching the product ----------------------------------------------------

  const openingNote = (state: string) => `${SEL.exchanges}[data-action="open"] article[data-state="${state}"]`;
  const replyNote = (state: string) => `${SEL.pushBackExchange} article[data-state="${state}"]`;
  const watching: Array<{ mark: string; seen: () => boolean }> = [
    { mark: 'yourTurn', seen: () => find(SEL.intro)?.dataset.step === String(LAST_STEP) },
    { mark: 'firstNoteStart', seen: () => find(openingNote('streaming')) !== null },
    { mark: 'lastNoteEnd', seen: () => count(openingNote('done')) === FEATURE.openingSeatIds.length },
    { mark: 'replyStart', seen: () => find(replyNote('streaming')) !== null },
    { mark: 'replyEnd', seen: () => find(replyNote('done')) !== null },
  ];
  const watch = (t: number) => {
    for (const { mark, seen } of watching) {
      if (checks.marks[mark] === undefined && seen()) checks.marks[mark] = t;
    }
  };

  // The film leaves the product's limit copy out with CSS (promo.module.css).
  // This is the proof that the CSS still matches the product: every few frames
  // it reads the text actually painted inside the frame and looks for it.
  let framesSeen = 0;
  const lookForLeftOut = (t: number) => {
    framesSeen += 1;
    if (framesSeen % 6 !== 1) return;
    const walker = document.createTreeWalker(parts.camera, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const text = node.nodeValue ?? '';
      const holder = node.parentElement;
      if (!holder || !LEFT_OUT.test(text)) continue;
      if (!holder.checkVisibility({ visibilityProperty: true, opacityProperty: true })) continue;
      const box = holder.getBoundingClientRect();
      // Screen-reader-only text is a clipped 1 px box: there, but not painted.
      const painted = box.width > 4 && box.height > 4 && box.right > 0 && box.bottom > 0 && box.left < STAGE.width && box.top < STAGE.height;
      const known = checks.leftOutShown.some((entry) => entry.text === text.trim());
      if (painted && !known) checks.leftOutShown.push({ at: t, text: text.trim() });
    }
  };

  // In vertical, the film's own lines have to stay clear of what Instagram
  // draws over a Reel. Looked at while a line is at rest: on its way in or out
  // it is faint and still moving.
  const atRest = (node: HTMLElement): boolean => {
    for (let at: HTMLElement | null = node; at && at !== document.body; at = at.parentElement) {
      if (at.style.opacity !== '' && Number(at.style.opacity) < 0.99) return false;
    }
    return node.checkVisibility({ visibilityProperty: true });
  };
  const lookForCovered = (t: number) => {
    if (!SAFE || framesSeen % 6 !== 1) return;
    for (const layer of [parts.opening, parts.captions, parts.end]) {
      layer.querySelectorAll<HTMLElement>('[data-keep-clear]').forEach((line) => {
        // A line set word by word is where its words are. Anything else is where its text is.
        const words = Array.from(line.querySelectorAll<HTMLElement>(':scope > span'));
        const range = document.createRange();
        range.selectNodeContents(line);
        const boxes = words.length > 0 ? words.filter(atRest).map((word) => word.getBoundingClientRect()) : atRest(line) ? [range.getBoundingClientRect()] : [];
        const text = (line.textContent ?? '').trim().slice(0, 48);
        for (const box of boxes) {
          if (box.width === 0) continue;
          const outside = box.top < SAFE.box.top - 0.5 || box.bottom > SAFE.box.bottom + 0.5 || box.left < SAFE.box.left - 0.5 || box.right > SAFE.box.right + 0.5;
          const underRail = box.right > SAFE.rail.left + 0.5 && box.bottom > SAFE.rail.top + 0.5;
          if ((outside || underRail) && !checks.outsideSafeArea.some((entry) => entry.text === text)) {
            checks.outsideSafeArea.push({ at: t, text, box: [box.left, box.top, box.right, box.bottom].map((value) => value.toFixed(0)).join(' ') });
          }
        }
      });
    }
  };

  // --- One frame ---------------------------------------------------------------

  const frame = (t: number) => {
    while (nextCue < script.length && script[nextCue].at <= t) {
      script[nextCue].run();
      nextCue += 1;
    }
    watch(t);
    lookForLeftOut(t);
    type(t);
    scrollIntro(t);
    scrollScene(t);
    applyCamera(cameraAt(t));
    moveCursor(t);

    paintOpening(parts.opening, t, film);
    parts.dip.style.opacity = String(film.dipAt(t));
    paintCaptions(parts.captions, t, film);
    paintCaret(parts.pointer, caretAt(t));
    paintCursor(parts.pointer, {
      x: cursor.x,
      y: cursor.y,
      opacity: cursorOpacity(t),
      sincePress: press ? t - press.at : null,
      pressX: press?.x ?? 0,
      pressY: press?.y ?? 0,
    });
    paintEndCard(parts.end, t, film);
    lookForCovered(t);
  };

  const loop = () => {
    const t = seconds();
    frame(Math.min(t, DURATION));
    if (t < DURATION) frameId = requestAnimationFrame(loop);
  };

  return {
    start: () => {
      if (startedAt !== null) return;
      startedAt = performance.now();
      frame(0);
      frameId = requestAnimationFrame(loop);
    },
    stop: () => {
      cancelAnimationFrame(frameId);
      parts.camera.style.transform = '';
    },
    seconds,
    useRealPointer: () => {
      realPointer = true;
    },
    pointer: () => {
      const t = seconds();
      if (startedAt === null || cursorOpacity(t) <= 0) return null;
      // A finger does not hover. The mouse is only brought in once the fingertip is on its target.
      if (film.POINTER === 'touch' && !CLICKS.some((click) => t >= click.at - CURSOR_SETTLE && t < click.at + 0.05)) return null;
      const down = CLICKS.some((click) => t >= click.at - PRESS_HOLD && t < click.at);
      return { x: Math.round(cursor.x), y: Math.round(cursor.y), down };
    },
    failures,
    checks,
  };
}
