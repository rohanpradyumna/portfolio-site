// Films the council promo and writes out/council-promo.mp4.
//
//   node render.mjs                     the whole film: frames, sound, encode, checks
//   node render.mjs --format vertical   the 9:16 cut for Reels: out/council-promo-vertical.mp4
//   node render.mjs --stills            the performance, keeping only review frames (no encode)
//
//   --base http://localhost:3000    where the dev server is
//   --out <dir>                     output folder (default: ./out)
//   --every 30                      contact sheets and stills take every nth step
//   --until 12                      with --stills: stop after this many virtual seconds
//   --jitter 40                     wait a random 0 to n real ms per frame (a determinism test)
//   --hashes <file>                 also write one SHA-1 per frame, to compare two runs
//
// The page at /council-promo performs the visit on its own clock. This script
// owns that clock: it advances 16 ms, waits for the page to finish reacting,
// and takes a picture. See lib/clock.mjs for why that is repeatable, and for
// what a format is. Every file a cut writes carries its suffix, so the two
// cuts sit side by side in the output folder.

import { createHash } from 'node:crypto';
import { copyFile, mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { FPS, STEP_MS, formatFrom, openStage } from './lib/clock.mjs';
import { contactSheets, encode } from './lib/encode.mjs';
import { verify } from './lib/verify.mjs';

const args = process.argv.slice(2);
const option = (name, fallback) => (args.includes(`--${name}`) ? args[args.indexOf(`--${name}`) + 1] : fallback);
const here = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(option('out', path.join(here, 'out')));
const base = option('base', 'http://localhost:3000');
const format = formatFrom(args);
const stillsOnly = args.includes('--stills');
const every = Number(option('every', 30));
const until = stillsOnly ? Number(option('until', Infinity)) : Infinity;
const jitterMs = Number(option('jitter', 0));
const hashFile = option('hashes', null);
const { keepEvery, fps, suffix } = format;
const FILE = `council-promo${suffix}.mp4`;
const named = (name) => path.join(outDir, name.replace(/(\.\w+)?$/, `${suffix}$1`));

// A step is 16 ms of the performance. A frame is a step the cut keeps.
const frameName = (index) => `${String(index).padStart(5, '0')}.png`;
const stepOf = (virtualMs) => Math.round(virtualMs / STEP_MS);
/** The nearest step at or before `step` that becomes a frame. */
const kept = (step) => (stillsOnly ? step : step - (step % keepEvery));
const started = Date.now();
const elapsed = () => `${((Date.now() - started) / 1000).toFixed(0)}s`;

const framesDir = named(stillsOnly ? 'stills' : 'frames');
const keyDir = named('keyframes');
const contactDir = named('contact');
for (const dir of [framesDir, keyDir, contactDir]) await rm(dir, { recursive: true, force: true });
for (const dir of [framesDir, keyDir, contactDir]) await mkdir(dir, { recursive: true });

// --- Set the stage -----------------------------------------------------------

const stage = await openStage({ url: `${base}/council-promo?hold=1&format=${format.id}`, format });
const { page } = stage;
await page.evaluate(() => window.__promo.ready);
const timeline = await page.evaluate(() => window.__promo.timeline);
const performing = await page.evaluate(() => ({ format: window.__promo.format, stage: window.__promo.stage }));
if (performing.format !== format.id || performing.stage.width !== format.viewport.width || performing.stage.height !== format.viewport.height) {
  throw new Error(`the page is performing ${performing.format} at ${performing.stage.width}x${performing.stage.height}, not ${format.id} at ${format.viewport.width}x${format.viewport.height}`);
}
await stage.freeze();
// A few ticks with nothing happening, so whatever the page was doing while it
// loaded in real time has finished before the film's first frame.
for (let i = 0; i < 12; i++) await stage.step();

const scriptedSteps = Math.floor(timeline.durationMs / STEP_MS) + 1;
const totalSteps = Math.min(scriptedSteps, stepOf(until * 1000) + 1);
const totalFrames = Math.ceil(totalSteps / keepEvery);
const filmSeconds = totalFrames / fps;
console.log(`${format.id}: ${totalFrames} frames at ${fps} fps, ${filmSeconds.toFixed(2)} s of film (${(timeline.durationMs / 1000).toFixed(2)} virtual seconds)`);

// Frames worth a close look: the first one (the thumbnail), the opening, the
// moment each caption has fully arrived, each click, and the frames just after
// a click when things start to move.
const keyframes = new Map();
const key = (step, name) => {
  const at = kept(Math.max(0, step));
  keyframes.set(at, [...(keyframes.get(at) ?? []), name]);
};
key(0, 'first-frame');
key(stepOf(1300), 'opening-ripple');
key(stepOf(timeline.beats.cardScene - 250), 'opening-parting');
key(stepOf(timeline.beats.cardScene + 150), 'opening-card-found');
for (const caption of timeline.captions) key(stepOf(caption.atMs + 1100), `caption-${caption.id}`);
// Where the product would mention its two-exchange limit, to confirm by eye that the film does not.
const turnLeg = timeline.introLegs[timeline.introLegs.length - 1];
key(stepOf(turnLeg.fromMs - 1500), 'limit-check-assembly-card');
key(stepOf((turnLeg.fromMs + turnLeg.toMs) / 2), 'limit-check-card-turning');
key(stepOf(turnLeg.toMs + 250), 'limit-check-your-turn');
key(stepOf(timeline.beats.openingDone + 850), 'limit-check-bench-after-replies');
key(stepOf(timeline.beats.pushClick - 1300), 'limit-check-tickets');
key(stepOf(timeline.beats.replyDone + 1300), 'limit-check-bench-after-push-back');
for (const click of timeline.clicks) {
  key(stepOf(click.atMs) - 1, `click-${click.id}-before`);
  key(stepOf(click.atMs) + 12, `click-${click.id}-after`);
}
// Each of the three replies a moment after it starts, and the objection typed.
for (const [index, seconds] of [1.9, 3.9, 6.1].entries()) key(stepOf(timeline.beats.askClick + seconds * 1000), `reply-${index + 1}`);
key(stepOf(timeline.beats.sendClick - 300), 'objection-typed');
key(stepOf(timeline.beats.endCard + 3200), 'end-card');
key(totalSteps - 1, 'last-frame');

// The two shared-layout flights. A repeated frame inside either would be a stall.
const motionWindows = [
  { name: 'intro handoff', from: stepOf(timeline.beats.beginClick + 200), to: stepOf(timeline.beats.beginClick + 560) },
  { name: 'arc to bench', from: stepOf(timeline.beats.askClick + 60), to: stepOf(timeline.beats.askClick + 380) },
].map((window) => ({ ...window, frames: 0, duplicates: [], last: null }));

// --- A real mouse ------------------------------------------------------------
// The film draws its own cursor, but the clicks under it are real input: the
// page says where the mouse belongs and whether the button is down, and this
// puts it there. That is what gives hover, the pressed state and focus rings
// the behaviour they have under a hand. While the cursor is on screen the
// mouse is re-placed on every frame, even when it has not moved, so hover is
// recomputed against the frame's layout and never by a real-time timer.

const PARKED = { x: format.viewport.width - 4, y: format.viewport.height - 4, down: false };
let mouse = { ...PARKED };
await page.mouse.move(PARKED.x, PARKED.y);

async function placeMouse() {
  const intent = await page.evaluate(() => window.__promo.pointer());
  const want = intent ?? PARKED;
  if (!intent && mouse.x === PARKED.x && mouse.y === PARKED.y && !mouse.down) return;
  await page.mouse.move(want.x, want.y);
  if (want.down && !mouse.down) await page.mouse.down();
  if (!want.down && mouse.down) await page.mouse.up();
  mouse = { ...want };
  await stage.settle();
}

// --- Film --------------------------------------------------------------------

const hashes = [];
await stage.act(() => {
  window.__promo.useRealPointer();
  window.__promo.start();
});
for (let step = 0; step < totalSteps; step++) {
  if (step > 0) await stage.step({ jitterMs });
  await placeMouse();
  const isFrame = step % keepEvery === 0;
  const keep = stillsOnly ? step % every === 0 || keyframes.has(step) : isFrame;
  const watched = isFrame ? motionWindows.filter((window) => step >= window.from && step <= window.to) : [];
  const needHash = isFrame && (hashFile !== null || watched.length > 0);
  if (keep || needHash) {
    const png = await stage.capture();
    if (needHash) {
      const hash = createHash('sha1').update(png).digest('hex');
      hashes[step / keepEvery] = hash;
      for (const window of watched) {
        window.frames += 1;
        if (window.last === hash) window.duplicates.push(step);
        window.last = hash;
      }
    }
    if (keep) await writeFile(path.join(framesDir, frameName(stillsOnly ? step : step / keepEvery)), png);
    for (const name of keyframes.get(step) ?? []) await writeFile(path.join(keyDir, `${frameName(step).slice(0, 5)}-${name}.png`), png);
  }
  if (step % 300 === 0) console.log(`  step ${step} of ${totalSteps}  (${elapsed()})`);
}

const report = await page.evaluate(() => window.__promo.report());
// The last frame sits on the 16 ms grid, so it can fall a few milliseconds short of the scripted end.
const reached = (await page.evaluate(() => window.__promo.seconds())) * 1000;
if (totalSteps === scriptedSteps && reached < timeline.durationMs - STEP_MS) stage.problems.push(`the film stopped at ${reached.toFixed(0)} ms of ${timeline.durationMs}`);
if (hashFile) await writeFile(path.resolve(hashFile), hashes.join('\n'));

if (totalSteps < scriptedSteps) {
  // A partial look at the performance. Nothing downstream is written from it.
  await stage.close();
  for (const failure of [...stage.problems, ...report.failures]) console.log(`PROBLEM  ${failure}`);
  for (const entry of [...report.checks.leftOutShown, ...report.checks.outsideSafeArea]) console.log(`SHOWN    ${JSON.stringify(entry)}`);
  console.log(`stopped at ${until} s. stills in ${framesDir}\nkey frames in ${keyDir}`);
  process.exit(0);
}

// --- Sound -------------------------------------------------------------------

await writeFile(named('cues.json'), JSON.stringify(report.cues, null, 1));
// The palette draws noise from Math.random. Back to the seed, so the soundtrack is the same bytes every time.
await stage.reseed();
const wav = Buffer.from(await page.evaluate((seconds) => window.__promo.renderAudio(seconds), filmSeconds), 'base64');
await writeFile(named('audio.wav'), wav);
const problems = [...stage.problems];
const blocked = [...stage.blocked];
await stage.close();
console.log(`filmed in ${elapsed()}: ${report.cues.length} sound cues, ${problems.length} problems`);

// --- Anchors -----------------------------------------------------------------
// Named moments of the finished film, in film seconds. Anything laid over the
// film afterwards (the voiceover) is hung on these, so nothing downstream holds
// a time of its own. They come from the script's timeline, from the sounds the
// product actually made (a sticker landing is its slap), and from what the
// director saw the product do (a rules card turning, a reply starting).

const filmAt = (virtualMs) => Number(((virtualMs / 1000) * timeline.filmPerVirtual).toFixed(3));
const captionAt = (id) => Math.max(0, timeline.captions.find((caption) => caption.id === id)?.atMs ?? NaN);
const markAt = (name) => (report.checks.marks[name] ?? NaN) * 1000;
const { beats } = timeline;
const landings = report.cues.filter((cue) => cue.name === 'slap' && cue.tVirtualMs > beats.intro && cue.tVirtualMs < beats.beginClick);
if (landings.length !== 7) problems.push(`expected 7 landings in the intro (six members and the assembly), heard ${landings.length}`);
const anchors = {
  openingStart: 0,
  hookOne: filmAt(captionAt('conflicted')),
  hookTwo: filmAt(captionAt('six')),
  cardStart: filmAt(beats.cardScene),
  cardCaption: filmAt(captionAt('bring')),
  typingStart: filmAt(beats.hookType),
  introStart: filmAt(beats.intro),
  ...Object.fromEntries(landings.slice(0, 6).map((cue, index) => [`member${index + 1}`, filmAt(cue.tVirtualMs)])),
  assembled: filmAt(landings[6]?.tVirtualMs ?? NaN),
  yourTurn: filmAt(markAt('yourTurn')),
  beginClick: filmAt(beats.beginClick),
  arcSettled: filmAt(beats.arcSettled),
  askClick: filmAt(beats.askClick),
  captionThree: filmAt(captionAt('three')),
  firstNoteStart: filmAt(markAt('firstNoteStart')),
  captionWorldview: filmAt(captionAt('worldview')),
  lastNoteEnd: filmAt(markAt('lastNoteEnd')),
  pushCaption: filmAt(captionAt('push')),
  pushClick: filmAt(beats.pushClick),
  seatClick: filmAt(beats.seatClick),
  objectionStart: filmAt(beats.objectionType),
  sendClick: filmAt(beats.sendClick),
  answerCaption: filmAt(captionAt('answer')),
  replyStart: filmAt(markAt('replyStart')),
  replyEnd: filmAt(markAt('replyEnd')),
  endCardStart: filmAt(beats.endCard),
  endCardTitle: filmAt(beats.endCardTitle),
  filmEnd: Number(filmSeconds.toFixed(3)),
};
for (const [name, seconds] of Object.entries(anchors)) {
  if (!Number.isFinite(seconds)) problems.push(`anchor "${name}" has no time`);
}
await writeFile(named('beats.json'), JSON.stringify({ file: FILE, format: format.id, filmSeconds, filmPerVirtual: timeline.filmPerVirtual, anchors }, null, 1));

// Source frames to compare the encode's paper colour against. Copies are kept
// with the key frames, so the checks still run after the frames are deleted.
const colourFrames = [stepOf(timeline.beats.intro + 3000), stepOf(timeline.beats.askClick - 300), totalSteps - 30].map((step) => ({
  index: kept(step) / keepEvery,
  file: path.join(path.basename(keyDir), `${frameName(kept(step)).slice(0, 5)}-colour-reference.png`),
}));
const run = {
  file: FILE,
  format: format.id,
  output: format.output,
  fps,
  frames: totalFrames,
  filmSeconds,
  filmPerVirtual: timeline.filmPerVirtual,
  keyframes: path.basename(keyDir),
  timeline,
  report,
  problems,
  blocked,
  motionWindows: motionWindows.map(({ name, frames, duplicates }) => ({ name, frames, duplicates })),
  colourFrames,
};
await writeFile(named('run.json'), JSON.stringify(run, null, 1));

if (stillsOnly) {
  for (const failure of [...problems, ...report.failures]) console.log(`PROBLEM  ${failure}`);
  for (const entry of [...report.checks.leftOutShown, ...report.checks.outsideSafeArea]) console.log(`SHOWN    ${JSON.stringify(entry)}`);
  console.log(`stills in ${framesDir}\nkey frames in ${keyDir}`);
  process.exit(problems.length + report.failures.length === 0 ? 0 : 1);
}

// --- Encode and check --------------------------------------------------------

for (const frame of colourFrames) await copyFile(path.join(framesDir, frameName(frame.index)), path.join(outDir, frame.file));

const framePattern = path.join(framesDir, '%05d.png');
await encode({ framePattern, fps, audioPath: named('audio.wav'), outPath: path.join(outDir, FILE) });
console.log(`encoded in ${elapsed()}`);
// One tile per half second of film, small enough that a sheet of tall frames is still one screen.
const tall = format.output.height > format.output.width;
await contactSheets({ framePattern, every: every / keepEvery, outPattern: path.join(contactDir, 'sheet-%02d.png'), ...(tall ? { columns: 8, rows: 3, tileWidth: 270 } : {}) });

const { failed, facts } = await verify(outDir, format);
await writeFile(named('facts.json'), JSON.stringify(facts, null, 1));
if (failed.length > 0) {
  console.log(`\nRENDER FAILED: ${failed.map((result) => result.name).join('; ')}`);
  process.exit(1);
}
console.log(`\n${path.join(outDir, FILE)}\n${facts.durationSeconds.toFixed(2)} s, ${facts.video.width}x${facts.video.height}, ${facts.video.fps} fps, ${facts.video.codec} + ${facts.audio.codec}. Done in ${elapsed()}.`);
