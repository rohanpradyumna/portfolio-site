'use client';

import React, { useMemo } from 'react';
import { Position } from '@/types';
import { useResponsive, DESIGN_W, DESIGN_H } from '@/hooks/useDimensions';
import { waveSlot, type StickerEntrance } from '@/components/stickers/base/Sticker';
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
  WheelSticker,
  CouncilSticker,
  HatRackSticker,
} from '@/components/stickers';

// The center card, in design space. The entrance wave spreads out from its edge.
const CARD = { cx: DESIGN_W / 2, cy: DESIGN_H / 2, halfW: 220, halfH: 160 };
const COFFEE_MACHINE = { x: 6, y: DESIGN_H - 180, w: 107, h: 135 };
// Render boxes for the center math; anything unlisted is close enough to 100x100.
const BOX: Record<string, [number, number]> = { tagPM: [117, 39], tagAI: [181, 39] };

type Slot = { entrance: StickerEntrance; entranceDelay: number };

interface DesktopStickersProps {
  positions: Record<string, Position>;
  portraitW: number;
  portraitH: number;
  /** First visit: the laptop nudges once to invite the first click. */
  nudge?: boolean;
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
    openHats: () => void;
    openWriting: () => void;
    openWheel: () => void;
    openCouncil: () => void;
    brewCoffee: () => void;
  };
}

export function DesktopStickers({
  positions,
  portraitW,
  portraitH,
  nudge = false,
  writingCount,
  handlers,
}: DesktopStickersProps) {
  const { s } = useResponsive();

  // Each sticker's place in the wave is its rank by gap to the card's edge, so
  // the wave runs outward from the card and one far-flung sticker (the coffee
  // machine) can't squash everyone else into the first beat.
  const wave = useMemo(() => {
    const boxes: Record<string, { x: number; y: number; w: number; h: number }> = {
      coffeeMachine: COFFEE_MACHINE,
    };
    for (const [id, p] of Object.entries(positions)) {
      if (id === 'portrait') continue;
      const [w, h] = BOX[id] ?? [100, 100];
      boxes[id] = { x: p.x, y: p.y, w, h };
    }
    const gap = ({ x, y, w, h }: (typeof boxes)[string]) =>
      Math.hypot(
        Math.max(0, Math.abs(x + w / 2 - CARD.cx) - CARD.halfW),
        Math.max(0, Math.abs(y + h / 2 - CARD.cy) - CARD.halfH)
      );
    const order = Object.keys(boxes).sort((a, b) => gap(boxes[a]) - gap(boxes[b]));
    const slots: Record<string, Slot> = {};
    order.forEach((id, i) => {
      slots[id] = waveSlot(i / Math.max(1, order.length - 1));
    });
    return slots;
  }, [positions]);
  const enter = (id: string): Slot => wave[id] ?? waveSlot(1);

  return (
    <>
      {/* Word tags at top */}
      <WordSticker
        id="tag-founder"
        text="ex-founder"
        initial={positions.tagPM || { x: 0, y: 0, rot: 0 }}
        zBase={5}
        bg="#1a1a1a"
        fg="#faf7ef"
        fontSize={s(13)}
        padX={s(14)}
        padY={s(7)}
        {...enter('tagPM')}
      />
      <WordSticker
        id="tag-ai"
        text="ai product manager"
        initial={positions.tagAI || { x: 0, y: 0, rot: 0 }}
        zBase={5}
        bg="var(--accent-orange)"
        fg="#faf7ef"
        fontSize={s(13)}
        padX={s(14)}
        padY={s(7)}
        {...enter('tagAI')}
      />

      {/* Portrait */}
      <PhotoSticker
        id="portrait"
        src="/assets/rohan-casual-cut.webp"
        w={portraitW}
        h={portraitH}
        initial={positions.portrait || { x: 0, y: 0, rot: 0 }}
        zBase={15}
        noBorder={true}
        onClick={handlers.portraitClick}
        entrance="lead"
        peekLabel="that's me"
      />

      {/* Location stickers */}
      <ImageSticker
        id="charminar"
        src="/assets/icons/charminar.png"
        size={s(116)}
        initial={positions.charminar || { x: 0, y: 0, rot: 0 }}
        zBase={8}
        onClick={handlers.charminarFact}
        {...enter('charminar')}
        peekLabel="hyderabad"
      />

      {/* Communication */}
      <ImageSticker
        id="linkedin"
        src="/assets/icons/linkedin.png"
        size={s(92)}
        initial={positions.linkedin || { x: 0, y: 0, rot: 0 }}
        zBase={10}
        onClick={handlers.openLinkedIn}
        {...enter('linkedin')}
        peekLabel="linkedin ↗"
      />
      <EmailSticker
        id="email"
        initial={positions.email || { x: 0, y: 0, rot: 0 }}
        zBase={10}
        onClick={handlers.openEmail}
        {...enter('email')}
        peekLabel="say hi"
      />

      {/* Travel */}
      <ImageSticker
        id="plane"
        src="/assets/icons/plane.png"
        size={s(104)}
        initial={positions.plane || { x: 0, y: 0, rot: 0 }}
        zBase={7}
        onClick={handlers.travelList}
        {...enter('plane')}
        peekLabel="where i've been"
      />
      <ImageSticker
        id="beach"
        src="/assets/icons/beach.png"
        size={s(98)}
        initial={positions.beach || { x: 0, y: 0, rot: 0 }}
        zBase={7}
        onClick={handlers.beachVibes}
        {...enter('beach')}
        peekLabel="beach brain"
      />

      {/* Hobbies / lifestyle */}
      <AirPodsSticker
        id="airpods"
        initial={positions.headphones || { x: 0, y: 0, rot: 0 }}
        zBase={7}
        onPlay={handlers.toggleMusic}
        {...enter('headphones')}
        peekLabel="press play"
      />
      <ImageSticker
        id="coffee"
        src="/assets/icons/coffee.png"
        size={s(88)}
        initial={positions.coffee || { x: 0, y: 0, rot: 0 }}
        zBase={7}
        onClick={handlers.coffeeVibes}
        {...enter('coffee')}
        peekLabel="coffee talk"
      />
      <CameraSticker
        id="camera"
        initial={positions.camera || { x: 0, y: 0, rot: 0 }}
        zBase={7}
        onClick={handlers.cameraVibes}
        {...enter('camera')}
        peekLabel="street photos"
      />
      <ImageSticker
        id="gym"
        src="/assets/icons/gym.png"
        size={s(96)}
        initial={positions.gym || { x: 0, y: 0, rot: 0 }}
        zBase={7}
        onClick={handlers.gymVibes}
        {...enter('gym')}
        peekLabel="the grind"
      />
      <PickleballSticker
        id="pickleball"
        initial={positions.pickleball || { x: 0, y: 0, rot: 0 }}
        zBase={7}
        onClick={handlers.pickleballVibes}
        {...enter('pickleball')}
        peekLabel="racket sports"
      />
      <ImageSticker
        id="terrapin"
        src="/assets/icons/terrapin.png"
        size={s(96)}
        initial={positions.terrapin || { x: 0, y: 0, rot: 0 }}
        zBase={7}
        onClick={handlers.terrapinFact}
        {...enter('terrapin')}
        peekLabel="go terps"
      />

      {/* My Work - Laptop sticker */}
      <LaptopSticker
        id="laptop"
        initial={positions.laptop || { x: 0, y: 0, rot: 0 }}
        zBase={8}
        onClick={handlers.openWork}
        {...enter('laptop')}
        nudge={nudge}
      />

      {/* What you get - Hat rack sticker */}
      <HatRackSticker
        id="hats"
        initial={positions.hats || { x: 0, y: 0, rot: 0 }}
        zBase={8}
        onClick={handlers.openHats}
        {...enter('hats')}
        title="what you get · pick a hat"
        peekLabel="try on a hat →"
      />

      {/* Writing - Folder sticker */}
      <FolderSticker
        id="folder"
        initial={positions.folder || { x: 0, y: 0, rot: 0 }}
        zBase={8}
        onClick={handlers.openWriting}
        {...enter('folder')}
        count={writingCount}
        title={writingCount ? `writing · ${writingCount} posts` : 'writing'}
        peekLabel={writingCount ? `${writingCount} reads inside →` : 'read my writing →'}
      />

      {/* Rabbit holes: the topic machine */}
      <WheelSticker
        id="wheel"
        initial={positions.wheel || { x: 0, y: 0, rot: 0 }}
        zBase={7}
        onClick={handlers.openWheel}
        {...enter('wheel')}
        peekLabel="find something to learn →"
      />

      {/* The Council */}
      <CouncilSticker
        id="council"
        initial={positions.council || { x: 0, y: 0, rot: 0 }}
        zBase={7}
        onClick={handlers.openCouncil}
        {...enter('council')}
        title="the council · question everything"
        peekLabel="the council has opinions →"
      />

      {/* Easter Egg: Coffee Machine, tucked into the bottom-left corner */}
      <CoffeeMachineSticker
        id="coffeeMachine"
        initial={{ x: COFFEE_MACHINE.x, y: COFFEE_MACHINE.y, rot: -3 }}
        zBase={6}
        onBrew={handlers.brewCoffee}
        {...enter('coffeeMachine')}
      />
    </>
  );
}
