// The virtual clock stage: one headless Chrome page whose time only moves when
// this file says so, so a frame can take as long as it likes to capture.
//
// The clock is installed by the init script below, before any page script
// runs. It owns timers, requestAnimationFrame, performance.now and Date, so
// framer-motion springs, layout projection, the scripted reply pacing and
// every debounce in the scene only move when stepped. Until freeze() it keeps
// pace with real time, so the page loads normally.
//
// One step is one tick: every timer and animation frame callback due in the
// next 16 ms runs back to back, with nothing from the real event loop in
// between. Then the real world is allowed to catch up (settle), and only then
// is the picture taken. Playwright's own page.clock is not used: it yields to
// the event loop between timers, so on a busy machine a scroll event could
// land in the middle of a tick on one run and after it on the next.
//
// What the clock cannot own, and how each is handled:
//   - CSS animations and transitions run on the real document timeline. seek()
//     pauses every one it finds and sets its currentTime from the virtual clock.
//   - framer-motion hands opacity to the Web Animations API with a start time
//     from its own (faked) clock, so those would be born finished. The init
//     script hides Element.prototype.animate from framer's feature check, which
//     makes it run the same curves in JS. Direct el.animate() calls still work.
//   - React commits through a MessageChannel, and scroll events and
//     ResizeObserver callbacks are delivered on real frames. settle() waits
//     for a whole real frame with none of that going on.
//   - native smooth scrolling is real-time. The page under test has to replace
//     it (the promo page does, see director.ts).

import { chromium } from 'playwright-core';

/** requestAnimationFrame fires on a 16 ms grid, so one step is one frame of the page. */
export const STEP_MS = 16;
/** Steps per second of film. A cut may keep every one of them or every second one. */
export const FPS = 60;
/** Film seconds per virtual second: 16 ms of virtual time is shown for 1/60 s. */
export const FILM_PER_VIRTUAL = 1000 / FPS / STEP_MS;

// The two cuts of the film. `viewport` is the page the product lays itself out
// on, and the frame is that times `deviceScale`. `keepEvery` is which steps
// become frames: the page is always performed at 60 steps a second (its
// springs are integrated per animation frame, so the motion is the same in
// both cuts), and the vertical cut keeps every second one, for the 30 fps
// that Reels are delivered at. `suffix` goes on every file the cut writes.
const cut = (id, width, height, deviceScale, keepEvery, more = {}) => ({
  id,
  viewport: { width, height },
  deviceScale,
  output: { width: width * deviceScale, height: height * deviceScale },
  keepEvery,
  fps: FPS / keepEvery,
  suffix: id === 'landscape' ? '' : `-${id}`,
  ...more,
});
export const FORMATS = {
  landscape: cut('landscape', 1280, 720, 1.5, 1),
  vertical: cut('vertical', 432, 768, 2.5, 2, {
    // What Instagram draws over a Reel, as [x, y, width, height] in frame
    // pixels: its header (top 14%), the caption and buttons (bottom 20%) and
    // the row of actions (right 130 px of the lower half). The page keeps the
    // film's own lines out of these (SAFE in timeline.ts, the same boxes in
    // page pixels). Here they are only drawn over the key frames, to look at.
    covered: [
      [0, 0, 1080, 269],
      [0, 1536, 1080, 384],
      [950, 960, 130, 576],
    ],
    // The middle 4:5 of the frame: what a profile grid shows of the cover.
    gridCrop: [0, 285, 1080, 1350],
  }),
};

/** The cut named on the command line by `--format`, or landscape. */
export function formatFrom(args) {
  const name = args.includes('--format') ? args[args.indexOf('--format') + 1] : 'landscape';
  if (!FORMATS[name]) throw new Error(`unknown --format "${name}" (use ${Object.keys(FORMATS).join(' or ')})`);
  return FORMATS[name];
}

export const VIEWPORT = FORMATS.landscape.viewport;
export const DEVICE_SCALE = FORMATS.landscape.deviceScale;
export const OUTPUT = FORMATS.landscape.output;
/** What the page's Date says at the moment the clock is frozen. */
export const FROZEN_AT = new Date('2026-01-05T15:00:00Z');

/** Runs in the page before any of its scripts. */
function initScript({ seed, frozenAtMs, stepMs }) {
  const real = {
    raf: window.requestAnimationFrame.bind(window),
    setTimeout: window.setTimeout.bind(window),
    clearTimeout: window.clearTimeout.bind(window),
    setInterval: window.setInterval.bind(window),
    now: performance.now.bind(performance),
    Date: window.Date,
  };

  // --- The clock ---------------------------------------------------------------

  /** Virtual milliseconds: what performance.now() returns. */
  let now = 0;
  /** Date.now() is `wallBase + now`. Set at freeze so the frozen instant is always the same date. */
  let wallBase = real.Date.now() - real.now();
  let frozen = false;
  let firing = Promise.resolve();
  let nextId = 1;
  const timers = new Map();

  const addTimer = (kind, fn, delay, args, every = 0) => {
    const id = nextId++;
    timers.set(id, { id, kind, fn, args, at: now + Math.max(0, Number(delay) || 0), every });
    return id;
  };
  const dropTimer = (id) => {
    timers.delete(Number(id));
  };

  window.setTimeout = (fn, delay, ...args) => addTimer('timeout', fn, delay, args);
  window.setInterval = (fn, delay, ...args) => addTimer('timeout', fn, delay, args, Math.max(1, Number(delay) || 0));
  window.clearTimeout = dropTimer;
  window.clearInterval = dropTimer;
  // Always the next point on the grid, never the current one.
  window.requestAnimationFrame = (fn) => addTimer('frame', fn, stepMs - (now % stepMs), []);
  window.cancelAnimationFrame = dropTimer;
  window.requestIdleCallback = (fn) => addTimer('idle', fn, 1, []);
  window.cancelIdleCallback = dropTimer;
  performance.now = () => now;

  function VirtualDate(...args) {
    if (!new.target) return new real.Date(wallBase + now).toString();
    return args.length === 0 ? new real.Date(wallBase + now) : new real.Date(...args);
  }
  VirtualDate.prototype = real.Date.prototype;
  VirtualDate.now = () => Math.round(wallBase + now);
  VirtualDate.parse = real.Date.parse;
  VirtualDate.UTC = real.Date.UTC;
  window.Date = VirtualDate;

  /** Runs every timer due up to `until`, in order, then leaves the clock there. */
  const fire = async (until) => {
    for (;;) {
      let next = null;
      for (const timer of timers.values()) {
        if (timer.at <= until && (!next || timer.at < next.at || (timer.at === next.at && timer.id < next.id))) next = timer;
      }
      if (!next) break;
      now = Math.max(now, next.at);
      if (next.every) next.at = now + next.every;
      else timers.delete(next.id);
      try {
        if (next.kind === 'frame') next.fn(now);
        else if (next.kind === 'idle') next.fn({ didTimeout: false, timeRemaining: () => 0 });
        else if (typeof next.fn === 'function') next.fn(...next.args);
        else (0, eval)(String(next.fn));
      } catch (error) {
        // Reported the way an uncaught error in a real timer is, without stopping the clock.
        real.setTimeout(() => {
          throw error;
        }, 0);
      }
      // Between two timers a browser empties the microtask queue. Awaiting
      // does the same without letting a real task (a render, a scroll event) in.
      for (let turn = 0; turn < 64; turn++) await null;
    }
    now = Math.max(now, until);
  };

  const advance = (until) => {
    firing = firing.then(() => fire(until));
    return firing;
  };

  // Until the film starts, virtual time follows real time, so the page loads as usual.
  real.setInterval(() => {
    if (!frozen) void advance(real.now());
  }, 4);

  // --- Everything else that must repeat ------------------------------------------

  // framer-motion decides whether to use WAAPI with
  // Object.hasOwnProperty.call(Element.prototype, 'animate'). Moving the
  // method one prototype up answers no without breaking el.animate().
  const animate = Object.getOwnPropertyDescriptor(Element.prototype, 'animate');
  if (animate) {
    Object.defineProperty(Node.prototype, 'animate', animate);
    delete Element.prototype.animate;
  }

  // mulberry32: the noise in the sound palette and any other Math.random in
  // the page repeats exactly from run to run.
  let randomState = seed >>> 0;
  Math.random = () => {
    randomState = (randomState + 0x6d2b79f5) >>> 0;
    let t = randomState;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  /** virtual start time of every animation already taken over */
  const adopted = new WeakMap();
  const finished = new WeakSet();
  const realFrame = () => new Promise((resolve) => real.raf(() => resolve()));
  const realTask = () => new Promise((resolve) => real.setTimeout(resolve, 0));

  /** Puts every CSS animation and transition at the time the virtual clock says it is. */
  const seek = () => {
    let live = 0;
    for (const animation of document.getAnimations()) {
      if (animation.timeline !== document.timeline || finished.has(animation)) continue;
      let start = adopted.get(animation);
      if (start === undefined) {
        start = now;
        adopted.set(animation, start);
        animation.pause();
      }
      const end = animation.effect ? animation.effect.getComputedTiming().endTime : 0;
      const at = now - start;
      if (Number.isFinite(end) && at >= end) {
        finished.add(animation);
        // finish() dispatches animationend and transitionend, as a real run would.
        try {
          animation.finish();
        } catch {
          animation.cancel();
        }
        continue;
      }
      animation.currentTime = at;
      live += 1;
    }
    return live;
  };

  // React schedules its renders through a MessageChannel. Counting messages
  // in and out tells settle() when the page has finished reacting to a tick.
  let traffic = 0;
  let inFlight = 0;
  const NativeChannel = window.MessageChannel;
  window.MessageChannel = class extends NativeChannel {
    constructor() {
      super();
      const wire = (sender, receiver) => {
        const post = sender.postMessage.bind(sender);
        sender.postMessage = (...args) => {
          traffic += 1;
          inFlight += 1;
          return post(...args);
        };
        receiver.addEventListener('message', () => {
          traffic += 1;
          inFlight -= 1;
        });
      };
      wire(this.port1, this.port2);
      wire(this.port2, this.port1);
    }
  };

  /**
   * After a tick. Real frames deliver scroll events and ResizeObserver
   * callbacks, and give React room to commit. It returns once a whole real
   * frame has passed with no render traffic, with every CSS animation seeked
   * and one more frame painted.
   */
  const settle = async () => {
    let spins = 0;
    for (let calm = 0; calm < 1 || spins < 2; spins++) {
      const before = traffic;
      await realFrame();
      await realTask();
      calm = traffic === before && inFlight <= 0 ? calm + 1 : 0;
      if (spins > 120) break;
    }
    const live = seek();
    await realFrame();
    return { live, spins };
  };

  window.__stage = {
    settle,
    /** Stops following real time. From here only tick() moves the clock. */
    freeze: async () => {
      frozen = true;
      await firing;
      // Onto the frame grid, at an instant that is the same on every run.
      now = Math.ceil(now / stepMs) * stepMs;
      wallBase = frozenAtMs - now;
      // Whatever drew random numbers while the page loaded, the film starts from the seed.
      randomState = seed >>> 0;
      return settle();
    },
    tick: async (ms) => {
      await advance(now + ms);
    },
    step: async (ms) => {
      await advance(now + ms);
      return settle();
    },
    now: () => now,
    /** Puts Math.random back at its seed, so what follows does not depend on how much noise was drawn before. */
    reseed: () => {
      randomState = seed >>> 0;
    },
  };
}

// The Next dev badge, the text caret (it blinks on the real clock) and scrollbars have no place in a frame.
const STAGE_CSS = [
  'nextjs-portal { display: none !important; }',
  '* { caret-color: transparent !important; }',
  '::-webkit-scrollbar { display: none !important; }',
].join('\n');

/**
 * Opens `url` with the clock installed and following real time. Call
 * `freeze()` once the page is ready, then `step()` once per frame.
 */
export async function openStage({ url, format = FORMATS.landscape, seed = 20260105, onApiCall, headless = true }) {
  const { viewport, deviceScale, output } = format;
  const browser = await chromium.launch({
    channel: 'chrome',
    headless,
    args: [
      '--force-color-profile=srgb',
      '--hide-scrollbars',
      '--disable-lcd-text',
      '--font-render-hinting=none',
      // On the GPU a few stray pixels differ from run to run. Software rendering repeats exactly.
      '--disable-gpu',
      ...(process.env.STAGE_ARGS ? process.env.STAGE_ARGS.split(' ') : []),
    ],
  });
  const context = await browser.newContext({
    viewport,
    deviceScaleFactor: deviceScale,
    reducedMotion: 'no-preference',
    colorScheme: 'light',
    locale: 'en-US',
    timezoneId: 'UTC',
  });

  const problems = [];
  const blocked = new Set();
  const origin = new URL(url).origin;
  await context.route('**/*', (route) => {
    const target = new URL(route.request().url());
    if (target.origin !== origin) {
      // Nothing leaves the machine. A third-party script (the analytics tag)
      // gets an empty body so its absence is not reported as a page failure.
      blocked.add(target.origin + target.pathname);
      if (route.request().resourceType() === 'script') return route.fulfill({ status: 200, contentType: 'application/javascript', body: '' });
      return route.abort();
    }
    if (target.pathname.startsWith('/api/council')) {
      problems.push(`request to ${target.pathname} (the film must make no council API call)`);
      onApiCall?.(target.pathname);
      return route.abort();
    }
    return route.continue();
  });

  await context.addInitScript(initScript, { seed, frozenAtMs: FROZEN_AT.getTime(), stepMs: STEP_MS });
  const page = await context.newPage();
  page.on('pageerror', (error) => problems.push(`page error: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') problems.push(`console error: ${message.text()}`);
  });
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.addStyleTag({ content: STAGE_CSS });
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(Array.from(document.fonts, (face) => face.load().catch(() => null)));
  });

  const cdp = await context.newCDPSession(page);
  // A CDP session of our own does not inherit Playwright's device scale for
  // screenshots: without this the capture comes back at the size of the page, not of the frame.
  await cdp.send('Emulation.setDeviceMetricsOverride', { ...viewport, deviceScaleFactor: deviceScale, mobile: false });
  let steps = 0;
  const noteSpins = ({ spins }) => {
    if (spins > 120) problems.push(`frame ${steps}: the page never went quiet (render traffic for 120 real frames)`);
  };

  return {
    browser,
    context,
    page,
    problems,
    /** Off-machine URLs the page asked for and did not get. */
    blocked,
    get steps() {
      return steps;
    },
    /** Virtual milliseconds since freeze(). */
    get virtualMs() {
      return steps * STEP_MS;
    },
    /** Stops the clock. From here on only step() moves time. */
    async freeze() {
      await page.evaluate(() => window.__stage.freeze());
    },
    /**
     * One film frame: 16 ms of virtual time, then everything real catches up.
     * Returns the count of live CSS animations. `jitterMs` wastes a random
     * amount of real time between the two halves, to prove it makes no difference.
     */
    async step({ jitterMs = 0 } = {}) {
      steps += 1;
      if (jitterMs <= 0) {
        const result = await page.evaluate((ms) => window.__stage.step(ms), STEP_MS);
        noteSpins(result);
        return result.live;
      }
      await page.evaluate((ms) => window.__stage.tick(ms), STEP_MS);
      await new Promise((resolve) => setTimeout(resolve, Math.random() * jitterMs));
      const result = await page.evaluate(() => window.__stage.settle());
      noteSpins(result);
      return result.live;
    },
    /**
     * Runs `action` in the page between ticks and waits for the page to
     * finish reacting, so the next tick always sees the same state.
     */
    async act(action, arg) {
      await page.evaluate(action, arg);
      await page.evaluate(() => window.__stage.settle());
    },
    /** Waits for the page to finish reacting to something done from outside it (real mouse input). */
    async settle() {
      await page.evaluate(() => window.__stage.settle());
    },
    /** Math.random back to its seed. Call before asking the page for anything that draws noise. */
    async reseed() {
      await page.evaluate(() => window.__stage.reseed());
    },
    /** PNG bytes of the viewport at the output resolution. */
    async capture() {
      const { data } = await cdp.send('Page.captureScreenshot', { format: 'png', optimizeForSpeed: true });
      const png = Buffer.from(data, 'base64');
      // Width and height sit at fixed offsets in the PNG header.
      const width = png.readUInt32BE(16);
      const height = png.readUInt32BE(20);
      if (width !== output.width || height !== output.height) {
        throw new Error(`captured ${width}x${height}, expected ${output.width}x${output.height}`);
      }
      return png;
    },
    async close() {
      await browser.close();
    },
  };
}
