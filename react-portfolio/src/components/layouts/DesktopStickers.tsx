'use client';

import React from 'react';
import { Position } from '@/types';
import { useResponsive, DESIGN_H } from '@/hooks/useDimensions';
import {
  PhotoSticker,
  ImageSticker,
  WordSticker,
  EmailSticker,
  AirPodsSticker,
  LaptopSticker,
  CameraSticker,
  PickleballSticker,
  FolderSticker,
  CoffeeMachineSticker,
} from '@/components/stickers';

// First-visit wake-up wave: content stickers breathe once in a gentle stagger,
// top→bottom of the cluster. Starts after the entrance stagger (last sticker is
// the coffee machine at 1200ms) settles, spanning ~0.8s.
const WAKE_BASE = 1100;
const WAKE_STAGGER = 60;
const WAKE_ORDER = [
  'portrait',
  'charminar',
  'linkedin',
  'email',
  'plane',
  'laptop',
  'folder',
  'airpods',
  'beach',
  'camera',
  'gym',
  'pickleball',
  'terrapin',
];
const wakeDelayFor = (id: string) => WAKE_BASE + Math.max(0, WAKE_ORDER.indexOf(id)) * WAKE_STAGGER;

interface DesktopStickersProps {
  positions: Record<string, Position>;
  portraitW: number;
  portraitH: number;
  wake?: boolean;
  writingCount?: number;
  handlers: {
    openLinkedIn: () => void;
    openEmail: () => void;
    charminarFact: () => void;
    travelList: () => void;
    beachVibes: () => void;
    pickleballVibes: () => void;
    cameraVibes: () => void;
    coffeeVibes: () => void;
    gymVibes: () => void;
    portraitClick: () => void;
    toggleMusic: () => void;
    terrapinFact: () => void;
    openWork: () => void;
    openWriting: () => void;
    brewCoffee: () => void;
  };
}

export function DesktopStickers({
  positions,
  portraitW,
  portraitH,
  wake = false,
  writingCount,
  handlers,
}: DesktopStickersProps) {
  const { s } = useResponsive();

  return (
    <>
      {/* Word tags at top */}
      <WordSticker
        id="tag-founder"
        text="founder"
        initial={positions.tagPM || { x: 0, y: 0, rot: 0 }}
        zBase={5}
        bg="#1a1a1a"
        fg="#faf7ef"
        fontSize={s(13)}
        padX={s(14)}
        padY={s(7)}
        entranceDelay={100}
      />
      <WordSticker
        id="tag-ai"
        text="ai · strategist"
        initial={positions.tagAI || { x: 0, y: 0, rot: 0 }}
        zBase={5}
        bg="#e85d3a"
        fg="#faf7ef"
        fontSize={s(13)}
        padX={s(14)}
        padY={s(7)}
        entranceDelay={150}
      />

      {/* Portrait */}
      <PhotoSticker
        id="portrait"
        src="/assets/rohan-casual.webp"
        w={portraitW}
        h={portraitH}
        initial={positions.portrait || { x: 0, y: 0, rot: 0 }}
        zBase={15}
        noBorder={true}
        onClick={handlers.portraitClick}
        entranceDelay={50}
        peekLabel="that's me"
        wake={wake}
        wakeDelay={wakeDelayFor('portrait')}
      />

      {/* Location stickers */}
      <ImageSticker
        id="charminar"
        src="/assets/icons/charminar.png"
        size={s(116)}
        initial={positions.charminar || { x: 0, y: 0, rot: 0 }}
        zBase={8}
        onClick={handlers.charminarFact}
        entranceDelay={200}
        peekLabel="hyderabad"
        wake={wake}
        wakeDelay={wakeDelayFor('charminar')}
      />

      {/* Communication */}
      <ImageSticker
        id="linkedin"
        src="/assets/icons/linkedin.png"
        size={s(92)}
        initial={positions.linkedin || { x: 0, y: 0, rot: 0 }}
        zBase={10}
        onClick={handlers.openLinkedIn}
        entranceDelay={300}
        peekLabel="linkedin ↗"
        wake={wake}
        wakeDelay={wakeDelayFor('linkedin')}
      />
      <EmailSticker
        id="email"
        initial={positions.email || { x: 0, y: 0, rot: 0 }}
        zBase={10}
        onClick={handlers.openEmail}
        entranceDelay={350}
        peekLabel="say hi"
        wake={wake}
        wakeDelay={wakeDelayFor('email')}
      />

      {/* Travel */}
      <ImageSticker
        id="plane"
        src="/assets/icons/plane.png"
        size={s(104)}
        initial={positions.plane || { x: 0, y: 0, rot: 0 }}
        zBase={7}
        onClick={handlers.travelList}
        entranceDelay={500}
        peekLabel="where i've been"
        wake={wake}
        wakeDelay={wakeDelayFor('plane')}
      />
      <ImageSticker
        id="beach"
        src="/assets/icons/beach.png"
        size={s(98)}
        initial={positions.beach || { x: 0, y: 0, rot: 0 }}
        zBase={7}
        onClick={handlers.beachVibes}
        entranceDelay={550}
        peekLabel="beach brain"
        wake={wake}
        wakeDelay={wakeDelayFor('beach')}
      />

      {/* Hobbies / lifestyle */}
      <AirPodsSticker
        id="airpods"
        initial={positions.headphones || { x: 0, y: 0, rot: 0 }}
        zBase={7}
        onPlay={handlers.toggleMusic}
        entranceDelay={600}
        peekLabel="press play"
        wake={wake}
        wakeDelay={wakeDelayFor('airpods')}
      />
      <ImageSticker
        id="coffee"
        src="/assets/icons/coffee.png"
        size={s(88)}
        initial={positions.coffee || { x: 0, y: 0, rot: 0 }}
        zBase={7}
        onClick={handlers.coffeeVibes}
        entranceDelay={650}
        peekLabel="coffee talk"
        wake={wake}
        wakeDelay={wakeDelayFor('coffee')}
      />
      <CameraSticker
        id="camera"
        initial={positions.camera || { x: 0, y: 0, rot: 0 }}
        zBase={7}
        onClick={handlers.cameraVibes}
        entranceDelay={700}
        peekLabel="street photos"
        wake={wake}
        wakeDelay={wakeDelayFor('camera')}
      />
      <ImageSticker
        id="gym"
        src="/assets/icons/gym.png"
        size={s(96)}
        initial={positions.gym || { x: 0, y: 0, rot: 0 }}
        zBase={7}
        onClick={handlers.gymVibes}
        entranceDelay={750}
        peekLabel="the grind"
        wake={wake}
        wakeDelay={wakeDelayFor('gym')}
      />
      <PickleballSticker
        id="pickleball"
        initial={positions.pickleball || { x: 0, y: 0, rot: 0 }}
        zBase={7}
        onClick={handlers.pickleballVibes}
        entranceDelay={800}
        peekLabel="racket sports"
        wake={wake}
        wakeDelay={wakeDelayFor('pickleball')}
      />
      <ImageSticker
        id="terrapin"
        src="/assets/icons/terrapin.png"
        size={s(96)}
        initial={positions.terrapin || { x: 0, y: 0, rot: 0 }}
        zBase={7}
        onClick={handlers.terrapinFact}
        entranceDelay={850}
        peekLabel="go terps"
        wake={wake}
        wakeDelay={wakeDelayFor('terrapin')}
      />

      {/* My Work - Laptop sticker */}
      <LaptopSticker
        id="laptop"
        initial={positions.laptop || { x: 0, y: 0, rot: 0 }}
        zBase={8}
        onClick={handlers.openWork}
        entranceDelay={900}
        wake={wake}
        wakeDelay={wakeDelayFor('laptop')}
      />

      {/* Writing - Folder sticker */}
      <FolderSticker
        id="folder"
        initial={positions.folder || { x: 0, y: 0, rot: 0 }}
        zBase={8}
        onClick={handlers.openWriting}
        entranceDelay={950}
        count={writingCount}
        title={writingCount ? `writing · ${writingCount} posts` : 'writing'}
        peekLabel={writingCount ? `${writingCount} reads inside →` : 'read my writing →'}
        wake={wake}
        wakeDelay={wakeDelayFor('folder')}
      />

      {/* Easter Egg: Coffee Machine, tucked into the bottom-left corner */}
      <CoffeeMachineSticker
        id="coffeeMachine"
        initial={{ x: 6, y: DESIGN_H - 180, rot: -3 }}
        zBase={6}
        onBrew={handlers.brewCoffee}
        entranceDelay={1200}
      />
    </>
  );
}
