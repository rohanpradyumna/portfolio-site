# Council promo film

Films the real `/council` feature frame by frame and encodes `out/council-promo.mp4`
(1920x1080, 60 fps, H.264 + AAC, about 58 seconds), then lays a voiceover on it. The
same film is also cut for Reels: `out/council-promo-vertical.mp4` (1080x1920, 30 fps),
filmed on the product's phone layout. See "Two cuts" below.

Nothing here is a screen recording. A dev-only page, `/council-promo`, mounts the real
intro and the real scene on the scripted starter conversations and performs a visit:
typing, scrolling, clicking real buttons. This folder owns the clock that page runs on.
It advances 16 ms, waits for the page to finish reacting, takes a picture, and repeats.
Renders of the same source repeat frame for frame (in testing, full captures of the
first cut, one of them slowed at random on a loaded machine, agreed on every frame but
one in one run).

## Re-render

```bash
# 1. the site's dev server, from react-portfolio/
npm run dev

# 2. the film, from video/ (first time: npm install)
npm run render
npm run render -- --format vertical     # the 9:16 cut
```

About 10 minutes (the vertical cut about 6). It needs Google Chrome installed (Playwright drives the system
Chrome, `channel: 'chrome'`) and makes no network calls beyond `localhost:3000`. The
render fails, loudly, if the page errors, if anything asks for `/api/council`, or if
any check below does not pass.

| Command | What it does |
| --- | --- |
| `npm run render` | Film, sound, encode, contact sheets, checks, `out/beats.json` |
| `npm run voiceover -- --engine openrouter --voice marin` | Speak the script over the last render |
| `npm run stills` | The whole performance, keeping only review frames. No encode. About 5 minutes |
| `npm run verify` | Re-run the checks on the last render |
| `npm run spike` | Prove the capture method still works (run after upgrading Chrome, Playwright or framer-motion) |

The first four take `--format vertical` (after `--` with npm) and then work on the
vertical cut and its files. `npm run render:vertical` is short for the render.

Options for `render.mjs`: `--format vertical`, `--out <dir>`, `--base <url>`,
`--every <n>` (contact sheet spacing), `--until <seconds>` (with `--stills`: stop
early), `--jitter <ms>` and `--hashes <file>` (render twice, one with jitter, and
`diff` the two hash files to prove determinism).

## Two cuts

The format is a parameter of one film, not a second film. The story, the beats, the
captions and the voiceover script are shared, so the two cuts run to the same length
and the same recorded voice takes fit both.

| | landscape | vertical |
| --- | --- | --- |
| Frame | 1920x1080, 60 fps | 1080x1920, 30 fps |
| Page the product is laid out on | 1280x720 (desktop layout), drawn 1.5 times over | 432x768 (phone layout), drawn 2.5 times over |
| Files | `council-promo.mp4`, `beats.json`, `keyframes/` ... | the same names with `-vertical` |

- **Harness side** (`lib/clock.mjs`, `FORMATS`): the viewport, the device scale and
  which steps become frames. The page is always performed at 60 steps a second, so its
  springs move identically in both cuts. The vertical cut keeps every second step.
- **Page side** (`timeline.ts`): `filmFor(format)` builds the film. A value is written
  `pick(landscape, vertical)` only where the layout forces a difference: the stage,
  where the six stand in the opening and how they part, the camera (vertical has none:
  a phone is already a close-up, so the page scrolls under a still frame), the scripted
  scrolling, and the hand (a mouse arrow on the desktop page, a fingertip that comes
  down for each tap on the phone's). Where captions sit and how big they are set is CSS,
  under `[data-format='vertical']` in `promo.module.css`.
- **Instagram's furniture.** A Reel is watched under a header (top 14%), a caption and
  buttons (bottom 20%) and a row of actions (right 130 px of the lower half). In the
  vertical cut every line the film itself sets (captions, the hook, the end card) is
  placed clear of all three, which is why its captions are at the top, under the bench.
  The page checks this while it is filmed (`SAFE` in `timeline.ts`) and the render
  fails if a line strays. The product's own interface is free to run underneath.
  `keyframes-vertical/safe-area/` has every key frame with the three zones drawn on it.
- **The cover.** Frame 0 is the poster in both cuts. In the vertical one the hook and all
  six faces are inside the middle 4:5 of the frame, which is what a profile grid shows:
  `keyframes-vertical/thumbnail-grid-crop.png`.
- To watch the vertical cut live, open `/council-promo?format=vertical` with the
  browser's device toolbar set to 432 by 768. The product lays itself out by the real
  width of the page, so a wide window would show the desktop layout.

## Voiceover

```bash
# a natural voice (needs an OpenRouter key, see below)
npm run voiceover -- --engine openrouter --voice marin --style lively    # or coral, cedar, ...
# an offline macOS voice, free, for trying wording
npm run voiceover -- --voice Daniel
```

It writes `out/council-promo-vo-<voice>.mp4` (`-<voice>-<style>` for any style but
`calm`): the same picture stream, copied, with the voice mixed over the film's own
effects (ducked). `--style` is `calm`, `lively` or `excited`. Add `--format vertical`
to voice the vertical cut instead (`out/council-promo-vertical-vo-<voice>.mp4`, placed
by `out/beats-vertical.json`). It reuses the takes already recorded: no new requests.

- **Words** are in one file, next to the captions they echo:
  `react-portfolio/src/app/council-promo/script.json`. `captions` is what the film
  shows (re-render after changing these), `voice` is what is spoken (only re-run the
  voiceover). Most people watch muted, so keep the two saying the same thing.
- **Times** are written nowhere. `render.mjs` writes `out/beats.json`: named moments of
  the finished film in film seconds (each hook line, each member's landing, the six
  assembled, the card turning to "Your turn", the clicks, the first and last word of
  the replies, the end card).
  `PLACEMENT` at the top of `voiceover.mjs` hangs each line on one of those, with an
  offset, and names the moment it must be finished by. Re-render, re-run, done.
- Each OpenRouter take is checked word for word against the model's own transcript,
  trimmed, and kept under `out/voiceover/takes/` by what was said. Moving a line never
  costs a new request. Only changed wording (or a new voice or style) does.
  `out/voiceover/requests.json` counts
  every request ever made, and `--max-requests` (default 80) stops a run before it
  passes that. Use `--takes-only` to record and print durations without mixing.
- A line that is too long for its slot is sped up, by at most 14%. Past that the run
  stops and names the line: give it room in `timeline.ts` (or shorten the wording), or
  try `--retakes 2` for a shorter reading.
- The key is read from `COUNCIL_VO_KEY`, else `react-portfolio/.env.local`
  (`OPENROUTER_API_KEY=`), else the environment. It is never printed. If your shell
  exports a different `OPENROUTER_API_KEY`, the file still wins.

## What the film leaves out

The product limits a question to two exchanges and says so in several places. The
film does not mention the limit. Those places are kept off screen by CSS scoped to the
promo page (`promo.module.css`, "What the film leaves out"): the intro's second card
and its counter, the cue's "next: the one rule", "4 live questions left today", the
bench's "1 exchange left", the tray's heading and note, and the hero's "They rarely
agree." The intro scroll goes from the assembly card straight to "Your turn". Nothing
in the product changes. While filming, the page reads its own painted frames for
those words (`LEFT_OUT` in `timeline.ts`) and the render fails if any appear, and
`verify` checks `script.json` for "agree", "exchange", "two turns" and "round".

## What comes out (`out/`, not committed)

- `council-promo.mp4`: the film, effects only
- `council-promo-vo-<voice>.mp4`: the film with a voiceover
- `beats.json`: the film's named moments, for anything laid over it
- `contact/sheet-NN.png`: a frame every half second, tiled
- `keyframes/`: the first frame, full frames at each caption, click and reply, and
  `thumbnail-from-mp4.png` (frame 0 pulled back out of the file)
- the vertical cut's versions of all of these, named `-vertical`, plus
  `keyframes-vertical/thumbnail-grid-crop.png` and `keyframes-vertical/safe-area/`
- `frames/`: every frame as PNG (about 4 GB, safe to delete once the film is encoded)
- `audio.wav`, `cues.json`: the effects track and the cue log it was rendered from
- `voiceover/<voice>/voiceover.json`: where each spoken line landed
- `run.json`, `facts.json`: what the page reported and what the file measures as

## Changing the film

Wording: `react-portfolio/src/app/council-promo/script.json`. Timing, camera, cursor
and typing: `timeline.ts` beside it. Times there are virtual seconds. The film runs
about 4% longer (16 ms steps are shown for 1/60 s each). The first frame is the
thumbnail, so the opening (`Opening.tsx`) is already complete at time zero. Open
`http://localhost:3000/council-promo` in a tab to watch the performance live, with
sound after a click. The page answers 404 in production.

## How it stays repeatable

- A virtual clock, installed before any page script, owns timers,
  `requestAnimationFrame`, `performance.now` and `Date`, so framer-motion springs,
  layout animation and the scripted reply pacing only move when stepped. Everything
  due in a 16 ms tick runs back to back, with nothing from the real event loop in
  between. (Playwright's own `page.clock` yields between timers, which let a busy
  machine reorder events inside a tick.)
- CSS animations and transitions run on the real document timeline. Each frame, every
  one is paused and set to the time the virtual clock says it is.
- framer-motion would hand opacity to the Web Animations API with a start time from
  its faked clock (born finished). An init script hides `Element.prototype.animate`
  from its feature check, so it runs the same curves in JS.
- React commits through a `MessageChannel` the clock does not own. The stage counts
  those messages and waits for a whole real frame with no traffic before each picture.
- Native smooth scrolling and focus scrolling are real-time, so the promo page
  replaces both with a glide on the virtual clock.
- The cursor in the film is drawn, but the clicks under it are real mouse input from
  the harness, placed every frame, so hover, pressed states and focus rings behave
  as they do under a hand.
- Chrome runs with `--disable-gpu`: on the GPU a few stray pixels differ between runs.
- Sound is not recorded. The page logs each sound the product asks for with its
  virtual time, and the product's own synthesis code renders that log offline.

Details are in the comments at the top of `lib/clock.mjs`.
