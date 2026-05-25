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
    triggerHaptic,
  };
}

// Song audio hook for the music player
export function useSongAudio(src: string) {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      audioRef.current = new Audio(src);
      audioRef.current.loop = true;
    }

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, [src]);

  const togglePlay = useCallback((): boolean => {
    if (!audioRef.current) return false;

    if (audioRef.current.paused) {
      audioRef.current.play();
      return true;
    } else {
      audioRef.current.pause();
      return false;
    }
  }, []);

  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
  }, []);

  return { togglePlay, stop };
}
