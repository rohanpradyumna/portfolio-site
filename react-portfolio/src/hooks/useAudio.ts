'use client';

import { useRef, useCallback, useEffect } from 'react';

// Global audio context reference
let globalAudioContext: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!globalAudioContext) {
    globalAudioContext = new (window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
  }
  return globalAudioContext;
}

export function useAudio() {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Play tap sound effect
  const playTapSound = useCallback(() => {
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') ctx.resume();

    const now = ctx.currentTime;
    const bufferSize = ctx.sampleRate * 0.015; // 15ms
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      const envelope = Math.exp(-i / (bufferSize * 0.15));
      data[i] = (Math.random() * 2 - 1) * envelope;
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 2500;
    filter.Q.value = 1.2;

    const gain = ctx.createGain();
    gain.gain.value = 0.4;

    noise.connect(filter).connect(gain).connect(ctx.destination);
    noise.start(now);
  }, []);

  // Play shuffle/flick sound effect
  const playShuffleSound = useCallback(() => {
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') ctx.resume();

    const now = ctx.currentTime;
    const flickSize = ctx.sampleRate * 0.06;
    const flickBuffer = ctx.createBuffer(1, flickSize, ctx.sampleRate);
    const flickData = flickBuffer.getChannelData(0);

    for (let i = 0; i < flickSize; i++) {
      const t = i / flickSize;
      const envelope = Math.exp(-t * 8) * (1 - Math.exp(-t * 80));
      flickData[i] = (Math.random() * 2 - 1) * envelope;
    }

    const flick = ctx.createBufferSource();
    flick.buffer = flickBuffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 2500;
    filter.Q.value = 0.8;

    const gain = ctx.createGain();
    gain.gain.value = 0.3;

    flick.connect(filter).connect(gain).connect(ctx.destination);
    flick.start(now);
  }, []);

  // Play AirPods opening sound
  const playOpenSound = useCallback(() => {
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') ctx.resume();

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, now);
    osc.frequency.exponentialRampToValueAtTime(1200, now + 0.1);
    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);

    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.2);
  }, []);

  // Play coffee brewing sound
  const playBrewSound = useCallback(() => {
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') ctx.resume();

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(80, now);
    osc.frequency.exponentialRampToValueAtTime(40, now + 1.5);
    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 1.8);

    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 2);
  }, []);

  // Wheel spin: a low whoosh that decays over the spin animation's duration.
  const playSpinSound = useCallback((duration: number = 3) => {
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') ctx.resume();

    const now = ctx.currentTime;
    const bufferSize = ctx.sampleRate * duration;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1800, now);
    filter.frequency.exponentialRampToValueAtTime(300, now + duration);
    filter.Q.value = 0.9;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + duration);

    noise.connect(filter).connect(gain).connect(ctx.destination);
    noise.start(now);
    noise.stop(now + duration);
  }, []);

  // Wheel tick: a short click, called once per wedge boundary the wheel
  // crosses while spinning so ticks naturally decelerate with the rotation.
  const playTickSound = useCallback(() => {
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') ctx.resume();

    const now = ctx.currentTime;
    const bufferSize = ctx.sampleRate * 0.02;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      const envelope = Math.exp(-i / (bufferSize * 0.1));
      data[i] = (Math.random() * 2 - 1) * envelope;
    }

    const click = ctx.createBufferSource();
    click.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 3000;

    const gain = ctx.createGain();
    gain.gain.value = 0.25;

    click.connect(filter).connect(gain).connect(ctx.destination);
    click.start(now);
  }, []);

  // Wheel reveal chime: a short bright two-note rise once the wheel settles.
  const playRevealChime = useCallback(() => {
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') ctx.resume();

    const now = ctx.currentTime;
    [660, 990].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      const start = now + i * 0.09;
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0.001, start);
      gain.gain.exponentialRampToValueAtTime(0.16, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.3);
      osc.connect(gain).connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.32);
    });
  }, []);

  // Haptic feedback (mobile)
  const triggerHaptic = useCallback((duration: number = 10) => {
    if (navigator.vibrate) {
      navigator.vibrate(duration);
    }
  }, []);

  // Clean up audio context on unmount
  useEffect(() => {
    return () => {
      if (globalAudioContext && globalAudioContext.state !== 'closed') {
        // Don't close the context as it might be shared
      }
    };
  }, []);

  return {
    audioRef,
    playTapSound,
    playShuffleSound,
    playOpenSound,
    playBrewSound,
    playSpinSound,
    playTickSound,
    playRevealChime,
    triggerHaptic,
  };
}

// Song audio hook for the music player
export function useSongAudio(src: string) {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Tear down only on unmount. We no longer create the element here, so the
  // ~3.4MB track is never fetched until the visitor actually presses play.
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const togglePlay = useCallback((): boolean => {
    // Lazy-create on first interaction so nothing downloads on page load.
    if (!audioRef.current) {
      audioRef.current = new Audio(src);
      audioRef.current.loop = true;
    }

    if (audioRef.current.paused) {
      audioRef.current.play();
      return true;
    } else {
      audioRef.current.pause();
      return false;
    }
  }, [src]);

  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
  }, []);

  return { togglePlay, stop };
}
