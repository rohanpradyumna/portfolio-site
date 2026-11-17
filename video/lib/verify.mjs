// Checks on a finished render. Run on its own to re-check the last one:
//
//   node lib/verify.mjs [--format vertical] [--out <dir>]
//
// It reads <out>/run.json (run-vertical.json for the vertical cut), written by
// render.mjs, and the MP4 beside it.

import { mkdir, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { FORMATS, FPS, formatFrom } from './clock.mjs';
import { audioSamples, countFrames, ffmpeg, mp4Boxes, patchColor, probe } from './encode.mjs';

const SAMPLE_RATE = 48000;
/** One step of the performance, in seconds: the tolerance for sound against picture. */
const STEP = 1 / FPS;

/**
 * Where sound starts near each expected time. Only cues with quiet before
 * them are measured: a tick inside the tail of a slap has no clean onset.
 */
export function measureOnsets(samples, cueTimes, { quietBefore = 0.3 } = {}) {
  const sorted = [...cueTimes].sort((a, b) => a - b);
  const results = [];
  sorted.forEach((expected, index) => {
    if (index > 0 && expected - sorted[index - 1] < quietBefore) return;
    const from = Math.max(0, Math.floor((expected - 0.06) * SAMPLE_RATE));
    const to = Math.min(samples.length, Math.ceil((expected + 0.1) * SAMPLE_RATE));
    // The level just before the cue is the noise floor a real onset must clear.
    let floor = 1e-4;
    for (let i = from; i < Math.floor((expected - 0.03) * SAMPLE_RATE); i++) floor = Math.max(floor, Math.abs(samples[i]));
    let peak = 0;
    for (let i = from; i < to; i++) peak = Math.max(peak, Math.abs(samples[i]));
    const threshold = Math.max(floor * 4, peak * 0.12);
    let onset = -1;
    for (let i = Math.floor((expected - 0.03) * SAMPLE_RATE); i < to; i++) {
      if (Math.abs(samples[i]) >= threshold) {
        onset = i;
        break;
      }
    }
    results.push({ expected, onset: onset < 0 ? null : onset / SAMPLE_RATE, peak });
  });
  return results;
}

export async function verify(outDir, format = FORMATS.landscape) {
  const run = JSON.parse(await readFile(path.join(outDir, `run${format.suffix}.json`), 'utf8'));
  const video = path.join(outDir, run.file);
  const keyDir = path.join(outDir, run.keyframes ?? `keyframes${format.suffix}`);
  const { output, fps } = format;
  const results = [];
  const check = (name, pass, detail) => {
    results.push({ name, pass, detail });
    console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
  };

  // --- The performance, as the page reported it --------------------------------
  const { report } = run;
  check('no page errors and no council API calls', run.problems.length === 0, run.problems.join(' | '));
  check('the director hit every mark', report.failures.length === 0, report.failures.join(' | '));
  check('intro reached its last step, every bubble revealed', report.checks.introReachedLastStep && report.checks.introBubblesRevealed === 6, `bubbles ${report.checks.introBubblesRevealed}/6`);
  check('intro ended by its own button', report.introEnded && report.checks.clicks.includes('begin'));
  check('three opening notes completed', report.checks.openingNotesDone === 3, `${report.checks.openingNotesDone}/3`);
  check('"Written in advance. No AI call." was on the page', report.checks.scriptedLabelShown);
  check('push-back reply completed', report.checks.replyDone && report.checks.exchanges === 2, `${report.checks.exchanges} exchanges`);

  const cueCount = (name) => report.cues.filter((cue) => cue.name === name).length;
  const cueSummary = ['slap', 'pop', 'chime', 'flick', 'tick'].map((name) => `${name} ${cueCount(name)}`).join(', ');
  // Six landings, the assembly, the challenge and the end card. One chime
  // ("Ask something"). Two flicks (the six parting, the question leaving).
  // Pops for the opening, bubbles and replies. Ticks for typing.
  check(
    'expected sound cues were logged',
    cueCount('slap') >= 9 && cueCount('chime') === 1 && cueCount('flick') === 2 && cueCount('pop') >= 16 && cueCount('tick') >= 30,
    cueSummary,
  );
  const marks = Object.keys(report.checks.marks ?? {});
  check('the director saw the intro reach "Your turn" and both replies start and end', marks.length === 5, marks.join(', '));

  // The film leaves the product's two-exchange limit out. The page read its own frames for it while filming.
  const shown = report.checks.leftOutShown ?? [];
  check('no limit copy was painted in any sampled frame', shown.length === 0, shown.map((entry) => `${entry.at.toFixed(1)}s "${entry.text}"`).join(' | '));

  // And the film's own words must not bring it back, or call the six unable to agree.
  const script = JSON.parse(await readFile(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'react-portfolio', 'src', 'app', 'council-promo', 'script.json'), 'utf8'));
  const banned = /agree|exchange|two turns|\bround\b/i;
  const offending = Object.entries({ ...script.captions, ...Object.fromEntries(Object.entries(script.voice).map(([id, text]) => [`voice.${id}`, text])) })
    .filter(([, text]) => banned.test(text))
    .map(([id, text]) => `${id}: "${text}"`);
  check('script.json says nothing about agreeing, exchanges, turns or rounds', offending.length === 0, offending.join(' | '));

  // The vertical cut is made to be watched under Instagram's own header, caption and buttons.
  if (format.covered) {
    const covered = report.checks.outsideSafeArea ?? [];
    check('every line the film sets is clear of what Instagram draws over a Reel', covered.length === 0, covered.map((entry) => `${entry.at.toFixed(1)}s "${entry.text}" at ${entry.box}`).join(' | '));
  }

  // --- Frames ----------------------------------------------------------------
  const frozen = run.motionWindows.flatMap((window) => window.duplicates.map((frame) => `${window.name} #${frame}`));
  check('no repeated frames during the layout flights', frozen.length === 0, frozen.length ? frozen.join(', ') : run.motionWindows.map((window) => `${window.name}: ${window.frames} frames`).join(', '));

  // --- The file ----------------------------------------------------------------
  const facts = await probe(video);
  const frames = await countFrames(video);
  const boxes = await mp4Boxes(video);
  const order = boxes.map((box) => box.type);
  const filmSeconds = run.frames / fps;
  check('H.264 video', facts.video?.codec === 'h264', `${facts.video?.codec} ${facts.video?.pixelFormat} (${facts.video?.color})`);
  check(`${output.width}x${output.height}`, facts.video?.width === output.width && facts.video?.height === output.height, `${facts.video?.width}x${facts.video?.height}`);
  check(`${fps} fps, every frame present`, facts.video?.fps === fps && frames === run.frames, `${facts.video?.fps} fps, ${frames} of ${run.frames} frames`);
  // Short-form platforms cut at a minute. Half a second of air under that.
  check('50 to 59.5 seconds', facts.durationSeconds >= 50 && facts.durationSeconds <= 59.5 && Math.abs(facts.durationSeconds - filmSeconds) < 0.1, `${facts.durationSeconds?.toFixed(2)} s`);

  // The first frame is what a feed shows before anyone presses play. Pulled
  // back out of the file, so it can be looked at as the thumbnail it will be.
  const thumbnail = path.join(keyDir, 'thumbnail-from-mp4.png');
  await ffmpeg(['-y', '-i', video, '-frames:v', '1', '-vf', 'scale=in_color_matrix=bt709:in_range=tv:out_range=pc:flags=accurate_rnd+full_chroma_int,format=rgb24', thumbnail]);
  const firstCaptured = await patchColor(path.join(keyDir, '00000-first-frame.png'), { x: 0, y: 0, size: 1080 });
  const firstEncoded = await patchColor(thumbnail, { x: 0, y: 0, size: 1080 });
  const thumbnailDrift = Math.max(...firstCaptured.map((value, channel) => Math.abs(value - firstEncoded[channel])));
  check('frame 0 of the file is the opening poster', thumbnailDrift <= 2, `mean colour within ${thumbnailDrift.toFixed(2)} levels of the captured first frame, saved as ${path.relative(outDir, thumbnail)}`);

  // For looking at, not for passing: the cover as a profile grid crops it, and
  // every key frame with Instagram's furniture drawn over it.
  if (format.gridCrop) {
    const [x, y, width, height] = format.gridCrop;
    await ffmpeg(['-y', '-i', thumbnail, '-vf', `crop=${width}:${height}:${x}:${y}`, path.join(keyDir, 'thumbnail-grid-crop.png')]);
  }
  if (format.covered) {
    const overlayDir = path.join(keyDir, 'safe-area');
    await mkdir(overlayDir, { recursive: true });
    const zones = format.covered.map(([x, y, width, height]) => `drawbox=x=${x}:y=${y}:w=${width}:h=${height}:color=red@0.38:t=fill`).join(',');
    for (const name of (await readdir(keyDir)).filter((entry) => /^\d{5}-(?!colour-reference).*\.png$/.test(entry))) {
      await ffmpeg(['-y', '-i', path.join(keyDir, name), '-vf', `${zones},scale=540:-1`, path.join(overlayDir, name)]);
    }
    console.log(`      safe-area overlays in ${path.relative(outDir, overlayDir)}`);
  }
  check('bt709, limited range', /bt709/.test(facts.video?.color ?? '') && /tv/.test(facts.video?.color ?? ''), facts.video?.color);
  check('AAC audio at 48 kHz', facts.audio?.codec === 'aac' && facts.audio?.sampleRate === SAMPLE_RATE, `${facts.audio?.codec} ${facts.audio?.sampleRate} Hz ${facts.audio?.layout}`);
  check('moov atom before the media (fast start)', order.indexOf('moov') !== -1 && order.indexOf('moov') < order.indexOf('mdat'), order.join(' '));

  // --- Colour ----------------------------------------------------------------
  // A patch of bare paper between grid lines, in the bottom-left corner.
  const spot = { x: 9, y: output.height - 19, size: 8 };
  let worst = 0;
  const colours = [];
  for (const frame of run.colourFrames) {
    const source = await patchColor(path.join(outDir, frame.file), spot);
    const encoded = await patchColor(video, { ...spot, at: frame.index / fps, video: true });
    const drift = Math.max(...source.map((value, channel) => Math.abs(value - encoded[channel])));
    worst = Math.max(worst, drift);
    colours.push(`#${frame.index} rgb(${source.map((v) => v.toFixed(0)).join(',')}) to rgb(${encoded.map((v) => v.toFixed(0)).join(',')})`);
  }
  check('paper colour survives the encode (within 2 levels)', worst <= 2, colours.join('; '));

  // --- Sound against picture ---------------------------------------------------
  const samples = await audioSamples(video);
  const cueTimes = report.cues.map((cue) => (cue.tVirtualMs / 1000) * run.filmPerVirtual);
  const onsets = measureOnsets(samples, cueTimes);
  const heard = onsets.filter((entry) => entry.onset !== null);
  const errors = heard.map((entry) => entry.onset - entry.expected);
  const worstError = errors.reduce((most, error) => Math.max(most, Math.abs(error)), 0);
  check(
    'audio onsets match the cue log within a sixtieth of a second',
    heard.length === onsets.length && onsets.length >= 10 && worstError <= STEP,
    `${heard.length} of ${onsets.length} isolated cues found, worst offset ${(worstError * 1000).toFixed(1)} ms`,
  );
  let peak = 0;
  for (let i = 0; i < samples.length; i++) peak = Math.max(peak, Math.abs(samples[i]));
  check('audio is neither silent nor clipped', peak > 0.1 && peak < 0.99, `peak ${peak.toFixed(3)} (${(20 * Math.log10(peak)).toFixed(1)} dBFS)`);

  const failed = results.filter((result) => !result.pass);
  return { results, failed, facts: { ...facts, report: undefined, frames, boxes: order, cueSummary } };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const here = path.dirname(fileURLToPath(import.meta.url));
  const outDir = path.resolve(args.includes('--out') ? args[args.indexOf('--out') + 1] : path.join(here, '..', 'out'));
  const { failed } = await verify(outDir, formatFrom(args));
  console.log(failed.length === 0 ? '\nAll checks passed.' : `\n${failed.length} check(s) FAILED.`);
  process.exit(failed.length === 0 ? 0 : 1);
}
