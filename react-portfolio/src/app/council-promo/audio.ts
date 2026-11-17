import type { SoundName } from '@/components/council/feel';
import { MASTER_GAIN, playSound, scheduleSound, setSoundTap } from '@/components/council/feel/sound';
import { FILM_PER_VIRTUAL } from './timeline';

// The film's soundtrack is the product's own sound palette. While the scene is
// performed, every sound it asks for is logged with its virtual time. After
// the capture the same synthesis code replays the log into an offline context,
// so each sound lands on the frame that caused it.

export interface SoundCue {
  /** Virtual milliseconds since the performance started. */
  tVirtualMs: number;
  name: SoundName;
  level: number;
}

const SAMPLE_RATE = 48000;
/** The loudest sample of the finished track. Near where the product itself plays, a little under full scale. */
const PEAK = 0.5;

export interface CueLog {
  cues: SoundCue[];
  /** Asks for a sound the product does not make on its own (typing, captions). Logged like any other. */
  add: (name: SoundName, level: number) => void;
  stop: () => void;
}

/** Starts listening to the palette. `now` is the director's clock, in virtual milliseconds. */
export function startCueLog(now: () => number): CueLog {
  const cues: SoundCue[] = [];
  setSoundTap((name, level) => {
    cues.push({ tVirtualMs: Math.round(now()), name, level });
  });
  return {
    cues,
    // Through playSound, so a live preview in a real tab is audible too.
    add: (name, level) => void playSound(name, level),
    stop: () => setSoundTap(null),
  };
}

/** Renders the cue log to `seconds` of stereo samples at film speed, peak-normalised. */
export async function renderCues(cues: SoundCue[], seconds: number): Promise<Float32Array[]> {
  const context = new OfflineAudioContext(2, Math.ceil(seconds * SAMPLE_RATE), SAMPLE_RATE);
  const master = context.createGain();
  master.gain.value = MASTER_GAIN;
  master.connect(context.destination);
  for (const cue of cues) {
    const t = (cue.tVirtualMs / 1000) * FILM_PER_VIRTUAL;
    if (t < seconds) scheduleSound(cue.name, { ctx: context, out: master, t, level: cue.level });
  }
  const buffer = await context.startRendering();
  const channels = [buffer.getChannelData(0), buffer.getChannelData(1)];
  let peak = 0;
  for (const channel of channels) for (let i = 0; i < channel.length; i++) peak = Math.max(peak, Math.abs(channel[i]));
  if (peak > 0) {
    const gain = PEAK / peak;
    for (const channel of channels) for (let i = 0; i < channel.length; i++) channel[i] *= gain;
  }
  return channels;
}

/** 16-bit PCM WAV. */
export function encodeWav(channels: Float32Array[], sampleRate = SAMPLE_RATE): Uint8Array {
  const frames = channels[0]?.length ?? 0;
  const blockAlign = channels.length * 2;
  const bytes = new Uint8Array(44 + frames * blockAlign);
  const view = new DataView(bytes.buffer);
  const tag = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i));
  };
  tag(0, 'RIFF');
  view.setUint32(4, 36 + frames * blockAlign, true);
  tag(8, 'WAVE');
  tag(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels.length, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  tag(36, 'data');
  view.setUint32(40, frames * blockAlign, true);
  let offset = 44;
  for (let i = 0; i < frames; i++) {
    for (const channel of channels) {
      const sample = Math.max(-1, Math.min(1, channel[i]));
      view.setInt16(offset, Math.round(sample * 32767), true);
      offset += 2;
    }
  }
  return bytes;
}

/** The soundtrack as a base64 WAV, the shape the capture harness can carry out of the page. */
export async function renderWavBase64(cues: SoundCue[], seconds: number): Promise<string> {
  const wav = encodeWav(await renderCues(cues, seconds));
  let binary = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < wav.length; i += CHUNK) binary += String.fromCharCode(...wav.subarray(i, i + CHUNK));
  return btoa(binary);
}
