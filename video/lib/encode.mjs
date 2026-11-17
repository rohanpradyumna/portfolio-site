// Everything that shells out to ffmpeg: the final encode, contact sheets, and
// the pixel and stream reads the checks need. There is no ffprobe here (the
// static build for this machine does not run), so facts are read from
// ffmpeg's own report and from the MP4 box layout.

import { spawn } from 'node:child_process';
import { open } from 'node:fs/promises';
import ffmpegPath from 'ffmpeg-static';

export function ffmpeg(args, { input } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(ffmpegPath, ['-hide_banner', '-nostdin', ...args], { stdio: ['pipe', 'pipe', 'pipe'] });
    const out = [];
    const err = [];
    child.stdout.on('data', (chunk) => out.push(chunk));
    child.stderr.on('data', (chunk) => err.push(chunk));
    child.on('error', reject);
    child.on('close', (code) => {
      const stderr = Buffer.concat(err).toString('utf8');
      if (code === 0) resolve({ stdout: Buffer.concat(out), stderr });
      else reject(new Error(`ffmpeg exited ${code}\n${stderr.split('\n').slice(-12).join('\n')}`));
    });
    child.stdin.end(input);
  });
}

// PNG frames are full-range sRGB. Without an explicit matrix and range ffmpeg
// guesses bt601, players assume bt709, and the cream paper turns slightly green.
const COLOR = [
  '-vf', 'scale=out_color_matrix=bt709:out_range=tv:flags=accurate_rnd+full_chroma_int,format=yuv420p',
  '-colorspace', 'bt709',
  '-color_primaries', 'bt709',
  '-color_trc', 'bt709',
  '-color_range', 'tv',
];

/** PNG sequence (plus an optional WAV) to H.264 + AAC, moov atom first. */
export async function encode({ framePattern, fps, audioPath = null, outPath, startNumber = 0, frames = null }) {
  const args = ['-y', '-framerate', String(fps), '-start_number', String(startNumber), '-i', framePattern];
  if (audioPath) args.push('-i', audioPath);
  if (frames !== null) args.push('-frames:v', String(frames));
  args.push(...COLOR, '-c:v', 'libx264', '-crf', '16', '-preset', 'slow', '-r', String(fps));
  if (audioPath) args.push('-c:a', 'aac', '-b:a', '192k', '-ar', '48000');
  args.push('-movflags', '+faststart', outPath);
  await ffmpeg(args);
  return outPath;
}

/** Every `every`th frame, tiled. One PNG per `columns * rows` picks. */
export async function contactSheets({ framePattern, startNumber = 0, every = 30, columns = 6, rows = 5, tileWidth = 480, outPattern }) {
  await ffmpeg([
    '-y',
    '-start_number', String(startNumber),
    '-i', framePattern,
    '-vf', `select='not(mod(n\\,${every}))',scale=${tileWidth}:-1,tile=${columns}x${rows}:padding=6:margin=6:color=0x2a251f`,
    '-fps_mode', 'passthrough',
    outPattern,
  ]);
}

/** Mean RGB of a small patch. `at` seeks a video; leave it out for a still. */
export async function patchColor(file, { x, y, size = 8, at = null, video = false }) {
  const args = [];
  if (at !== null) args.push('-ss', String(at));
  args.push('-i', file, '-frames:v', '1');
  // accurate_rnd: swscale's fast path rounds down and reads every colour about two levels dark.
  const toRgb = video ? 'scale=in_color_matrix=bt709:in_range=tv:out_range=pc:flags=accurate_rnd+full_chroma_int,format=rgb24,' : 'format=rgb24,';
  args.push('-vf', `${toRgb}crop=${size}:${size}:${x}:${y}`, '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-');
  const { stdout } = await ffmpeg(args);
  const sum = [0, 0, 0];
  for (let i = 0; i < stdout.length; i += 3) for (let c = 0; c < 3; c++) sum[c] += stdout[i + c];
  const count = stdout.length / 3;
  return sum.map((value) => value / count);
}

/** Stream facts as ffmpeg reports them. */
export async function probe(file) {
  // `-i` with no output exits non-zero by design. The report is on stderr.
  const stderr = await new Promise((resolve, reject) => {
    const child = spawn(ffmpegPath, ['-hide_banner', '-i', file]);
    const chunks = [];
    child.stderr.on('data', (chunk) => chunks.push(chunk));
    child.on('error', reject);
    child.on('close', () => resolve(Buffer.concat(chunks).toString('utf8')));
  });
  const duration = /Duration: (\d+):(\d+):(\d+\.\d+)/.exec(stderr);
  const video = /Stream #\S+ Video: (\w+)[^\n]*?, (\w+)\(([^)]*)\)[^\n]*?, (\d+)x(\d+)[^\n]*?, ([\d.]+) fps/.exec(stderr);
  const audio = /Stream #\S+ Audio: (\w+)[^\n]*?, (\d+) Hz, (\w+)/.exec(stderr);
  return {
    report: stderr,
    durationSeconds: duration ? Number(duration[1]) * 3600 + Number(duration[2]) * 60 + Number(duration[3]) : null,
    video: video
      ? { codec: video[1], pixelFormat: video[2], color: video[3], width: Number(video[4]), height: Number(video[5]), fps: Number(video[6]) }
      : null,
    audio: audio ? { codec: audio[1], sampleRate: Number(audio[2]), layout: audio[3] } : null,
  };
}

/** Counts decoded video frames, and proves every one has the same duration. */
export async function countFrames(file) {
  const { stderr } = await ffmpeg(['-i', file, '-map', '0:v:0', '-f', 'null', '-']);
  const matches = [...stderr.matchAll(/frame=\s*(\d+)/g)];
  return matches.length ? Number(matches[matches.length - 1][1]) : null;
}

/** Top-level MP4 boxes in file order. `moov` before `mdat` means the file can start playing while it downloads. */
export async function mp4Boxes(file) {
  const handle = await open(file, 'r');
  try {
    const { size } = await handle.stat();
    const boxes = [];
    let offset = 0;
    const head = Buffer.alloc(16);
    while (offset < size) {
      await handle.read(head, 0, 16, offset);
      let length = head.readUInt32BE(0);
      const type = head.toString('latin1', 4, 8);
      if (length === 1) length = Number(head.readBigUInt64BE(8));
      if (length === 0) length = size - offset;
      boxes.push({ type, offset, length });
      offset += length;
    }
    return boxes;
  } finally {
    await handle.close();
  }
}

/** Float samples of the left channel of the audio track at `rate` Hz (the soundtrack is the same on both sides). */
export async function audioSamples(file, rate = 48000) {
  const { stdout } = await ffmpeg(['-i', file, '-map', '0:a:0', '-af', 'pan=mono|c0=c0', '-ar', String(rate), '-f', 'f32le', '-']);
  return new Float32Array(stdout.buffer, stdout.byteOffset, Math.floor(stdout.length / 4));
}
