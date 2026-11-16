import { SoundName } from './events';

// The council's sound palette, synthesized. Everything is filtered noise or a
// short low sine, because the board is paper and stickers: a slap, a flick, a
// pencil, a knuckle on a desk. Nothing here is a tone you could hum, except
// the two soft notes that answer "Ask something".
//
// One AudioContext for the whole feature, created on the first real gesture.
// A sound asked for while the context is not running is dropped, never
// queued: a suspended context would otherwise replay the backlog in one burst
// the moment the visitor first taps.

/** Overall level. Every sound below is mixed against this, so one number turns the feature up or down. */
const MASTER_GAIN = 0.55;
/** A sound that could not start within this many milliseconds of its cause is no longer feedback. */
const STALE_MS = 180;

type AudioContextCtor = typeof AudioContext;

let context: AudioContext | null = null;
let master: GainNode | null = null;
let noise: AudioBuffer | null = null;
let unlockInstalled = false;

function contextCtor(): AudioContextCtor | null {
  if (typeof window === 'undefined') return null;
  return window.AudioContext ?? (window as unknown as { webkitAudioContext?: AudioContextCtor }).webkitAudioContext ?? null;
}

function ensureContext(): AudioContext | null {
  if (context) return context;
  const Ctor = contextCtor();
  if (!Ctor) return null;
  context = new Ctor();
  master = context.createGain();
  master.gain.value = MASTER_GAIN;
  master.connect(context.destination);
  return context;
}

/**
 * Wakes the context from inside a gesture. Called on every pointer and key
 * press (it is a no-op once running) because iOS re-suspends audio whenever
 * the tab is backgrounded or a call comes in.
 */
function wake(shouldCreate: () => boolean): void {
  try {
    if (!context && !shouldCreate()) return;
    const ctx = ensureContext();
    if (ctx && ctx.state !== 'running') void ctx.resume().catch(() => {});
  } catch {
    // No audio on this device. Everything still works.
  }
}

/** Installs the gesture listeners once. `shouldCreate` lets a muted visitor never allocate a context. */
export function installSoundUnlock(shouldCreate: () => boolean): void {
  if (unlockInstalled || typeof window === 'undefined') return;
  unlockInstalled = true;
  const onGesture = () => wake(shouldCreate);
  // Capture phase on pointerdown: the context is resuming before any click handler asks for a sound.
  window.addEventListener('pointerdown', onGesture, { capture: true, passive: true });
  window.addEventListener('keydown', onGesture, { capture: true, passive: true });
}

function noiseBuffer(ctx: AudioContext): AudioBuffer {
  if (noise && noise.sampleRate === ctx.sampleRate) return noise;
  const length = Math.floor(ctx.sampleRate * 0.5);
  noise = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = noise.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
  return noise;
}

interface Voice {
  ctx: AudioContext;
  out: AudioNode;
  /** Start time on the context clock. */
  t: number;
  /** Loudness multiplier for this firing, 0 to 1. */
  level: number;
}

/** A slice of white noise through one filter, with an attack and an exponential tail. */
function noiseBurst(
  { ctx, out, level }: Voice,
  at: number,
  shape: { type: BiquadFilterType; freq: number; freqEnd?: number; q?: number; peak: number; attack: number; decay: number },
): void {
  const source = ctx.createBufferSource();
  source.buffer = noiseBuffer(ctx);
  const filter = ctx.createBiquadFilter();
  filter.type = shape.type;
  filter.frequency.setValueAtTime(shape.freq, at);
  if (shape.freqEnd) filter.frequency.exponentialRampToValueAtTime(shape.freqEnd, at + shape.attack + shape.decay);
  filter.Q.value = shape.q ?? 0.9;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, shape.peak * level), at + shape.attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + shape.attack + shape.decay);
  source.connect(filter).connect(gain).connect(out);
  // A random offset into the buffer, so two ticks in a row are not the same sample.
  source.start(at, Math.random() * 0.3, shape.attack + shape.decay + 0.02);
}

/** A short sine that slides in pitch: the body of a thump, a knock or a pop. */
function sineDrop(
  { ctx, out, level }: Voice,
  at: number,
  shape: { from: number; to: number; glide: number; peak: number; attack: number; decay: number },
): void {
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(shape.from, at);
  osc.frequency.exponentialRampToValueAtTime(shape.to, at + shape.glide);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, shape.peak * level), at + shape.attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + shape.attack + shape.decay);
  osc.connect(gain).connect(out);
  osc.start(at);
  osc.stop(at + shape.attack + shape.decay + 0.02);
}

const PALETTE: Record<SoundName, (voice: Voice) => void> = {
  // A fingernail on paper.
  tick: (v) => noiseBurst(v, v.t, { type: 'bandpass', freq: 2500, q: 1.1, peak: 0.42, attack: 0.001, decay: 0.014 }),
  tickLow: (v) => noiseBurst(v, v.t, { type: 'bandpass', freq: 1500, q: 1.0, peak: 0.42, attack: 0.001, decay: 0.018 }),

  // A sticker pressed onto the board: the papery smack, then the board answering underneath.
  slap: (v) => {
    noiseBurst(v, v.t, { type: 'lowpass', freq: 2600, freqEnd: 700, q: 0.7, peak: 0.34, attack: 0.002, decay: 0.045 });
    sineDrop(v, v.t, { from: 150, to: 62, glide: 0.07, peak: 0.42, attack: 0.003, decay: 0.09 });
  },

  // A speech bubble opening: a soft upward blip, more cork than beep.
  pop: (v) => {
    sineDrop(v, v.t, { from: 300, to: 620, glide: 0.035, peak: 0.16, attack: 0.004, decay: 0.07 });
    noiseBurst(v, v.t, { type: 'bandpass', freq: 1800, q: 1.4, peak: 0.07, attack: 0.001, decay: 0.012 });
  },

  // Two quick pencil strokes.
  scratch: (v) => {
    noiseBurst(v, v.t, { type: 'bandpass', freq: 3600, freqEnd: 2900, q: 2.2, peak: 0.11, attack: 0.012, decay: 0.04 });
    noiseBurst(v, v.t + 0.062, { type: 'bandpass', freq: 3100, freqEnd: 3900, q: 2.2, peak: 0.09, attack: 0.01, decay: 0.05 });
  },

  // A card flicked across the table: the question leaving your hand.
  flick: (v) =>
    noiseBurst(v, v.t, { type: 'bandpass', freq: 1300, freqEnd: 4200, q: 0.8, peak: 0.24, attack: 0.012, decay: 0.07 }),

  // Two knuckles on the desk. No is said quietly here.
  knock: (v) => {
    for (const offset of [0, 0.13]) {
      sineDrop(v, v.t + offset, { from: 190, to: 105, glide: 0.05, peak: 0.36, attack: 0.002, decay: 0.07 });
      noiseBurst(v, v.t + offset, { type: 'lowpass', freq: 900, q: 0.7, peak: 0.1, attack: 0.001, decay: 0.02 });
    }
  },

  // The one musical moment: a paper tick, then a soft rising fifth.
  chime: (v) => {
    noiseBurst(v, v.t, { type: 'bandpass', freq: 2500, q: 1.1, peak: 0.2, attack: 0.001, decay: 0.014 });
    sineDrop(v, v.t + 0.01, { from: 587.3, to: 587.3, glide: 0.01, peak: 0.13, attack: 0.006, decay: 0.26 });
    sineDrop(v, v.t + 0.1, { from: 880, to: 880, glide: 0.01, peak: 0.11, attack: 0.006, decay: 0.34 });
  },
};

/**
 * Plays `name` now. `level` scales loudness (a harder landing is a louder
 * slap). Returns false, having done nothing, when audio is not available yet.
 */
export function playSound(name: SoundName, level = 1): boolean {
  try {
    // No context yet means no gesture yet. It is created by the unlock listeners, never here.
    const ctx = context;
    const out = master;
    if (!ctx || !out) return false;
    const play = () => PALETTE[name]({ ctx, out, t: ctx.currentTime, level: Math.min(1, Math.max(0.05, level)) });
    if (ctx.state !== 'running') {
      // The very first tap lands here: the context is still waking up. Play
      // if it wakes within the same breath, otherwise let the sound go.
      const asked = performance.now();
      void ctx
        .resume()
        .then(() => {
          if (performance.now() - asked < STALE_MS && ctx.state === 'running') play();
        })
        .catch(() => {});
      return false;
    }
    play();
    return true;
  } catch {
    return false;
  }
}
