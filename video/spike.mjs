// Feasibility check for filming under a virtual clock. Run it before trusting
// a render after a Chrome, Playwright or framer-motion upgrade.
//
//   node spike.mjs [--out <dir>] [--base http://localhost:3000]
//
// It proves, on the real pages:
//   1. framer-motion fades take intermediate values (they are not born finished)
//   2. CSS keyframes advance with the virtual clock
//   3. the scripted conversation finishes when the pacing says it should
//   4. the scroll-driven intro can be driven by setting scrollTop per frame
//   5. two runs give identical frames, even when one is slowed down at random
//   6. an H.264 encode keeps the paper colour

import { createHash } from 'node:crypto';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEVICE_SCALE, FPS, OUTPUT, STEP_MS, openStage } from './lib/clock.mjs';
import { encode, ffmpeg, patchColor } from './lib/encode.mjs';

const args = process.argv.slice(2);
const option = (name, fallback) => (args.includes(`--${name}`) ? args[args.indexOf(`--${name}`) + 1] : fallback);
const here = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(option('out', path.join(here, 'out', 'spike')));
const base = option('base', 'http://localhost:3000');

const sha = (buffer) => createHash('sha1').update(buffer).digest('hex');
const results = [];
const check = (name, pass, detail) => {
  results.push({ name, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
};

const frameName = (frame) => `${String(frame).padStart(5, '0')}.png`;

/**
 * Run 1 keeps every frame. Run 2 is given run 1's hashes and keeps only the
 * frames that came out different, so a mismatch can be measured in pixels.
 */
function keeper(saveTo, reference) {
  return async (png, frame) => {
    if (reference && reference.hashes[frame] === sha(png)) return;
    await writeFile(path.join(saveTo, frameName(frame)), png);
  };
}

async function rgb(file) {
  const { stdout } = await ffmpeg(['-i', file, '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-']);
  return stdout;
}

/** How far apart two runs are: the frames that differ, and for each how many pixels, by how much, and where (CSS px). */
async function compareRuns(first, second, firstDir, secondDir) {
  const frames = [];
  for (let i = 0; i < first.hashes.length; i++) {
    if (first.hashes[i] === second.hashes[i]) continue;
    const [a, b] = await Promise.all([rgb(path.join(firstDir, frameName(i))), rgb(path.join(secondDir, frameName(i)))]);
    const found = { frame: i, pixels: 0, delta: 0, left: Infinity, top: Infinity, right: -1, bottom: -1 };
    for (let offset = 0; offset < a.length; offset += 3) {
      const delta = Math.max(Math.abs(a[offset] - b[offset]), Math.abs(a[offset + 1] - b[offset + 1]), Math.abs(a[offset + 2] - b[offset + 2]));
      if (delta === 0) continue;
      const x = ((offset / 3) % OUTPUT.width) / DEVICE_SCALE;
      const y = Math.floor(offset / 3 / OUTPUT.width) / DEVICE_SCALE;
      found.pixels += 1;
      found.delta = Math.max(found.delta, delta);
      found.left = Math.min(found.left, Math.floor(x));
      found.right = Math.max(found.right, Math.ceil(x));
      found.top = Math.min(found.top, Math.floor(y));
      found.bottom = Math.max(found.bottom, Math.ceil(y));
    }
    frames.push(found);
  }
  return frames;
}

const describeRuns = (frames, total) =>
  frames.length === 0
    ? `${total} frames, byte for byte`
    : `${frames.length} of ${total} frames differ: ${frames
        .slice(0, 6)
        .map((f) => `#${f.frame} ${f.pixels}px by ${f.delta} at (${f.left},${f.top})-(${f.right},${f.bottom})`)
        .join('; ')}`;

/** The scripted conversation on /council?fixtures=1. */
async function runScene({ jitterMs, saveTo, reference }) {
  const keep = keeper(saveTo, reference);
  const stage = await openStage({ url: `${base}/council?fixtures=1` });
  const { page } = stage;
  await stage.freeze();
  for (let i = 0; i < 20; i++) await stage.step();

  await stage.act(() => {
    const starter = Array.from(document.querySelectorAll('button')).find((button) =>
      button.textContent.includes('Can I want more and still be content?'),
    );
    starter.click();
  });

  const hashes = [];
  const samples = [];
  const FRAMES = 500;
  for (let frame = 0; frame < FRAMES; frame++) {
    const liveCss = await stage.step({ jitterMs });
    const sample = await page.evaluate(() => {
      const notes = Array.from(document.querySelectorAll('article[data-seat]'));
      const fresh = Array.from(document.querySelectorAll('[class*="fresh"]')).pop();
      return {
        states: notes.map((note) => note.dataset.state),
        noteOpacity: notes.map((note) => Number(getComputedStyle(note).opacity)),
        freshOpacity: fresh ? Number(getComputedStyle(fresh).opacity) : null,
        waapi: document.getAnimations().filter((animation) => animation.constructor.name === 'Animation').length,
      };
    });
    samples.push({ ...sample, liveCss });
    const png = await stage.capture();
    hashes.push(sha(png));
    await keep(png, frame);
  }
  const problems = [...stage.problems];
  await stage.close();
  return { hashes, samples, problems };
}

/** The intro on /council-intro, scroll-driven, then the handoff. */
async function runIntro({ jitterMs, saveTo, reference }) {
  const keep = keeper(saveTo, reference);
  const stage = await openStage({ url: `${base}/council-intro` });
  const { page } = stage;
  // The first member arrives on their own. Let that play out in real time.
  await page.waitForTimeout(1500);
  await stage.freeze();
  for (let i = 0; i < 20; i++) await stage.step();

  const stops = await page.evaluate(() => {
    const root = document.querySelector('[data-council-intro]');
    // The same arithmetic as scrollStops() in intro/sequence.ts, read back from the track height.
    return { height: root.clientHeight, trackEnd: root.scrollHeight - root.clientHeight };
  });

  const hashes = [];
  const samples = [];
  let frame = 0;
  const shoot = async () => {
    await stage.step({ jitterMs });
    const sample = await page.evaluate(() => {
      const root = document.querySelector('[data-council-intro]');
      const seat = document.querySelector('main [class*="seats"] > *');
      return {
        step: root ? Number(root.dataset.step) : null,
        levels: Array.from(document.querySelectorAll('[data-level]')).map((bubble) => Number(bubble.dataset.level)),
        scrollTop: root ? root.scrollTop : null,
        seatX: seat ? seat.getBoundingClientRect().x : null,
        seatY: seat ? seat.getBoundingClientRect().y : null,
      };
    });
    samples.push(sample);
    const png = await stage.capture();
    hashes.push(sha(png));
    await keep(png, frame);
    frame += 1;
  };

  // scrollStops(720): six members at 540 px each, then two beats at 360 px.
  const member = Math.min(720, Math.max(420, stops.height * 0.75));
  const beat = Math.min(460, Math.max(300, stops.height * 0.5));
  const targets = [0];
  for (let step = 1; step <= 8; step++) targets.push(Math.round(targets[step - 1] + (step <= 6 ? member : beat)));

  const TRAVEL = 56;
  const HOLD = 40;
  for (let step = 1; step <= 8; step++) {
    for (let i = 1; i <= TRAVEL; i++) {
      const top = targets[step - 1] + ((targets[step] - targets[step - 1]) * i) / TRAVEL;
      await stage.act((value) => {
        document.querySelector('[data-council-intro]').scrollTop = value;
      }, top);
      await shoot();
    }
    for (let i = 0; i < HOLD; i++) await shoot();
  }
  const beforeClick = samples[samples.length - 1];
  await stage.act(() => document.querySelector('button[data-final]').click());
  for (let i = 0; i < 90; i++) await shoot();

  const problems = [...stage.problems];
  await stage.close();
  return { hashes, samples, problems, beforeClick, expectedEnd: targets[8], trackEnd: stops.trackEnd };
}

await rm(outDir, { recursive: true, force: true });
const sceneDir = path.join(outDir, 'scene');
const introDir = path.join(outDir, 'intro');
const sceneAgain = path.join(outDir, 'scene-run2-mismatches');
const introAgain = path.join(outDir, 'intro-run2-mismatches');
for (const dir of [sceneDir, introDir, sceneAgain, introAgain]) await mkdir(dir, { recursive: true });

console.log('scene, run 1');
const sceneA = await runScene({ jitterMs: 0, saveTo: sceneDir });
console.log('scene, run 2 (random real delay up to 60 ms per frame)');
const sceneB = await runScene({ jitterMs: 60, saveTo: sceneAgain, reference: sceneA });

const fades = sceneA.samples.flatMap((sample) => sample.noteOpacity).filter((value) => value > 0.02 && value < 0.98);
check('framer fades take intermediate values', fades.length >= 6, `${fades.length} in-between samples, e.g. ${fades.slice(0, 5).map((v) => v.toFixed(2)).join(', ')}`);
check('framer is not using WAAPI', sceneA.samples.every((sample) => sample.waapi === 0), `max WAAPI animations seen: ${Math.max(...sceneA.samples.map((sample) => sample.waapi))}`);
const cssFades = sceneA.samples.map((sample) => sample.freshOpacity).filter((value) => value !== null && value > 0.02 && value < 0.98);
check('CSS keyframes advance with the virtual clock', cssFades.length >= 20, `${cssFades.length} in-between samples of the streamed-word fade`);
const doneFrame = sceneA.samples.findIndex((sample) => sample.states.length === 3 && sample.states.every((state) => state === 'done'));
const doneSeconds = (doneFrame * STEP_MS) / 1000;
check('three notes complete near 7 virtual seconds', doneFrame > 0 && doneSeconds > 5.5 && doneSeconds < 8.5, `done at frame ${doneFrame}, ${doneSeconds.toFixed(2)} s`);
const sceneDiff = await compareRuns(sceneA, sceneB, sceneDir, sceneAgain);
check('scene: two runs give identical frames', sceneDiff.length === 0, describeRuns(sceneDiff, sceneA.hashes.length));
check('scene: no page errors or API calls', sceneA.problems.length === 0 && sceneB.problems.length === 0, [...sceneA.problems, ...sceneB.problems].join(' | '));

console.log('intro, run 1');
const introA = await runIntro({ jitterMs: 0, saveTo: introDir });
console.log('intro, run 2 (random real delay up to 60 ms per frame)');
const introB = await runIntro({ jitterMs: 60, saveTo: introAgain, reference: introA });

check('intro track matches scrollStops()', introA.expectedEnd === introA.trackEnd, `expected ${introA.expectedEnd}, track ${introA.trackEnd}`);
check('intro reaches its last step', introA.beforeClick.step === 8, `step ${introA.beforeClick.step}`);
check('every bubble revealed both lines', introA.beforeClick.levels.every((level) => level === 2), introA.beforeClick.levels.join(''));
const flight = introA.samples.filter((sample) => sample.seatX !== null).map((sample) => `${sample.seatX.toFixed(0)},${sample.seatY.toFixed(0)}`);
const distinct = new Set(flight).size;
check('handoff flies (seats pass through many positions)', distinct >= 8, `${distinct} distinct positions over ${flight.length} frames`);
const introDiff = await compareRuns(introA, introB, introDir, introAgain);
check('intro: two runs give identical frames', introDiff.length === 0, describeRuns(introDiff, introA.hashes.length));
check('intro: no page errors or API calls', introA.problems.length === 0 && introB.problems.length === 0, [...introA.problems, ...introB.problems].join(' | '));

console.log('encode check');
const clip = path.join(outDir, 'scene.mp4');
await encode({ framePattern: path.join(sceneDir, '%05d.png'), fps: FPS, outPath: clip, frames: 240 });
const spot = { x: 90, y: 900, size: 8 };
const source = await patchColor(path.join(sceneDir, '00120.png'), spot);
const encoded = await patchColor(clip, { ...spot, at: 120 / FPS, video: true });
const drift = Math.max(...source.map((value, i) => Math.abs(value - encoded[i])));
check('H.264 keeps the paper colour', drift <= 1.5, `source rgb(${source.map((v) => v.toFixed(1)).join(', ')}) encoded rgb(${encoded.map((v) => v.toFixed(1)).join(', ')})`);

await writeFile(path.join(outDir, 'spike.json'), JSON.stringify({ results, sceneSamples: sceneA.samples, introSamples: introA.samples }, null, 1));
const failed = results.filter((result) => !result.pass);
console.log(failed.length === 0 ? '\nSpike passed.' : `\nSpike FAILED: ${failed.map((result) => result.name).join('; ')}`);
process.exit(failed.length === 0 ? 0 : 1);
