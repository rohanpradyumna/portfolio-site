'use client';

import React from 'react';
import { Position } from '@/types';
import { useResponsive } from '@/hooks/useDimensions';
import {
  PhotoSticker,
  ImageSticker,
  WordSticker,
  EmailSticker,
  AirPodsSticker,
  LaptopSticker,
  CameraSticker,
  PickleballSticker,
  LegoSticker,
  FolderSticker,
  CoffeeMachineSticker,
} from '@/components/stickers';

interface DesktopStickersProps {
  positions: Record<string, Position>;
  portraitW: number;
  portraitH: number;
  dims: { w: number; h: number };
  handlers: {
    openLinkedIn: () => void;
    openEmail: () => void;
    charminarFact: () => void;
    dcFact: () => void;
    travelList: () => void;
    beachVibes: () => void;
    pickleballVibes: () => void;
    cameraVibes: () => void;
    coffeeVibes: () => void;
    gymVibes: () => void;
    portraitClick: () => void;
    toggleMusic: () => void;
    bumpLego: () => void;
    openWork: () => void;
    openWriting: () => void;
    brewCoffee: () => void;
  };
}

export function DesktopStickers({
  positions,
  portraitW,
  portraitH,
  dims,
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
        fontSize={13}
        padX={14}
        padY={7}
        entranceDelay={100}
      />
      <WordSticker
        id="tag-ai"
        text="ai · strategist"
        initial={positions.tagAI || { x: 0, y: 0, rot: 0 }}
        zBase={5}
        bg="#e85d3a"
        fg="#faf7ef"
        fontSize={13}
        padX={14}
        padY={7}
        entranceDelay={150}
      />

      {/* Portrait */}
      <PhotoSticker
        id="portrait"
        src="/assets/rohan-casual.png"
        w={portraitW}
        h={portraitH}
        initial={positions.portrait || { x: 0, y: 0, rot: 0 }}
        zBase={15}
        noBorder={true}
        onClick={handlers.portraitClick}
        entranceDelay={50}
      />

      {/* Location stickers */}
      <ImageSticker
        id="charminar"
        src="/assets/icons/charminar.png"
        size={s(120)}
        initial={positions.charminar || { x: 0, y: 0, rot: 0 }}
        zBase={8}
        onClick={handlers.charminarFact}
        entranceDelay={200}
      />
      <ImageSticker
        id="dc"
        src="/assets/icons/dc.png"
        size={s(120)}
        initial={positions.washingtondc || { x: 0, y: 0, rot: 0 }}
        zBase={8}
        onClick={handlers.dcFact}
        entranceDelay={250}
      />

      {/* Communication */}
      <ImageSticker
        id="linkedin"
        src="/assets/icons/linkedin.png"
        size={s(90)}
        initial={positions.linkedin || { x: 0, y: 0, rot: 0 }}
        zBase={10}
        onClick={handlers.openLinkedIn}
        entranceDelay={300}
      />
      <EmailSticker
        id="email"
        initial={positions.email || { x: 0, y: 0, rot: 0 }}
        zBase={10}
        onClick={handlers.openEmail}
        entranceDelay={350}
      />

      {/* Travel */}
      <ImageSticker
        id="plane"
        src="/assets/icons/plane.png"
        size={s(110)}
        initial={positions.plane || { x: 0, y: 0, rot: 0 }}
        zBase={7}
        onClick={handlers.travelList}
        entranceDelay={500}
      />
      <ImageSticker
        id="beach"
        src="/assets/icons/beach.png"
        size={s(92)}
        initial={positions.beach || { x: 0, y: 0, rot: 0 }}
        zBase={7}
        onClick={handlers.beachVibes}
        entranceDelay={550}
      />

      {/* Hobbies / lifestyle */}
      <AirPodsSticker
        id="airpods"
        initial={positions.headphones || { x: 0, y: 0, rot: 0 }}
        zBase={7}
        onPlay={handlers.toggleMusic}
        entranceDelay={600}
      />
      <ImageSticker
        id="coffee"
        src="/assets/icons/coffee.png"
        size={s(80)}
        initial={positions.coffee || { x: 0, y: 0, rot: 0 }}
        zBase={7}
        onClick={handlers.coffeeVibes}
        entranceDelay={650}
      />
      <CameraSticker
        id="camera"
        initial={positions.camera || { x: 0, y: 0, rot: 0 }}
        zBase={7}
        onClick={handlers.cameraVibes}
        entranceDelay={700}
      />
      <ImageSticker
        id="gym"
        src="/assets/icons/gym.png"
        size={s(96)}
        initial={positions.gym || { x: 0, y: 0, rot: 0 }}
        zBase={7}
        onClick={handlers.gymVibes}
        entranceDelay={750}
      />
      <PickleballSticker
        id="pickleball"
        initial={positions.pickleball || { x: 0, y: 0, rot: 0 }}
        zBase={7}
        onClick={handlers.pickleballVibes}
        entranceDelay={800}
      />
      <LegoSticker
        id="lego"
        initial={positions.lego || { x: 0, y: 0, rot: 0 }}
        zBase={7}
        onClick={handlers.bumpLego}
        entranceDelay={850}
      />

      {/* My Work - Laptop sticker */}
      <LaptopSticker
        id="laptop"
        initial={positions.laptop || { x: 0, y: 0, rot: 0 }}
        zBase={8}
        onClick={handlers.openWork}
        entranceDelay={900}
      />

      {/* Writing - Folder sticker */}
      <FolderSticker
        id="folder"
        initial={positions.folder || { x: 0, y: 0, rot: 0 }}
        zBase={8}
        onClick={handlers.openWriting}
        entranceDelay={950}
      />

      {/* Easter Egg: Coffee Machine */}
      <CoffeeMachineSticker
        id="coffeeMachine"
        initial={{ x: 40, y: dims.h - 180, rot: -3 }}
        zBase={6}
        onBrew={handlers.brewCoffee}
        entranceDelay={1200}
      />
    </>
  );
}
