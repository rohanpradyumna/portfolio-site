'use client';

import React, { useRef } from 'react';
import { useResponsive } from '@/hooks/useDimensions';
import { useMotion } from '@/hooks/useMotion';
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

// First-visit wake-up wave timing (mirrors DesktopStickers). On touch this is the
// primary discoverability cue: there's no hover, so no peek labels.
const WAKE_BASE = 1100;
const WAKE_STAGGER = 60;

interface MobileDragCanvasProps {
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
    openHats: () => void;
    openWriting: () => void;
    openWheel: () => void;
    openCouncil: () => void;
    brewCoffee: () => void;
  };
}

// Scattered vertical cascade. `xFrac` is the horizontal position as a fraction of
// the free width (canvasW - w) so nothing overflows on narrow screens; `y` is an
// absolute pixel offset down the canvas; `w`/`h` are the sticker's render box and
// drive both the x math and the canvas min-height.
interface LayoutItem {
  id: string;
  xFrac: number;
  y: number;
  w: number;
  h: number;
  /** Static tilt in degrees so the canvas reads hand-placed, not grid-stamped. */
  rot: number;
}

// Phone reading order: who (portrait, tags), then the work doors, then how to
// reach me, then the flavour stickers, with the coffee machine as the last egg.
const LAYOUT: LayoutItem[] = [
  { id: 'portrait', xFrac: 0.5, y: 0, w: 150, h: 226, rot: -2 },
  { id: 'tagFounder', xFrac: 0.04, y: 250, w: 108, h: 40, rot: -3 },
  { id: 'tagAI', xFrac: 0.7, y: 258, w: 166, h: 40, rot: 2 },
  // The work: what you get, what I've shipped, The Council, Rabbit holes.
  { id: 'hats', xFrac: 0.08, y: 330, w: 110, h: 124, rot: -3 },
  { id: 'laptop', xFrac: 0.88, y: 344, w: 100, h: 96, rot: 2 },
  { id: 'council', xFrac: 0.1, y: 492, w: 116, h: 116, rot: 3 },
  { id: 'wheel', xFrac: 0.86, y: 488, w: 104, h: 120, rot: -2 },
  // Reach me, and the writing.
  { id: 'linkedin', xFrac: 0.06, y: 650, w: 88, h: 88, rot: -4 },
  { id: 'email', xFrac: 0.5, y: 658, w: 100, h: 74, rot: 3 },
  { id: 'folder', xFrac: 0.96, y: 646, w: 100, h: 86, rot: -3 },
  // Flavour, most telling first: where I'm from and where I've been, then the
  // music player, then the hobbies. Every row is full so no row reads as a hole.
  { id: 'charminar', xFrac: 0.02, y: 770, w: 104, h: 104, rot: -3 },
  { id: 'terrapin', xFrac: 0.5, y: 776, w: 96, h: 96, rot: -3 },
  { id: 'plane', xFrac: 0.98, y: 784, w: 92, h: 92, rot: 6 },
  { id: 'airpods', xFrac: 0.08, y: 900, w: 90, h: 100, rot: -5 },
  { id: 'camera', xFrac: 0.5, y: 906, w: 96, h: 80, rot: -3 },
  { id: 'beach', xFrac: 0.92, y: 904, w: 92, h: 92, rot: 4 },
  { id: 'coffee', xFrac: 0.1, y: 1026, w: 84, h: 84, rot: 5 },
  { id: 'gym', xFrac: 0.5, y: 1030, w: 88, h: 88, rot: -4 },
  { id: 'pickleball', xFrac: 0.9, y: 1022, w: 90, h: 94, rot: 6 },
  { id: 'coffeeMachine', xFrac: 0.5, y: 1170, w: 100, h: 130, rot: 2 },
];

const BY_ID = Object.fromEntries(LAYOUT.map((l) => [l.id, l])) as Record<string, LayoutItem>;
// Tall enough for the lowest sticker plus its label, and no taller.
const CANVAS_MAX_W = 520;
const CANVAS_MIN_HEIGHT = Math.max(...LAYOUT.map((l) => l.y + l.h)) + 24;

export function MobileDragCanvas({ wake = false, writingCount, handlers }: MobileDragCanvasProps) {
  const { dims } = useResponsive();
  const { reducedMotion } = useMotion();
  const canvasRef = useRef<HTMLDivElement>(null);

  // Free horizontal track inside the 16px side padding.
  // Capped so a phone on its side keeps the stickers in a readable column
  // instead of flinging them to the far edges.
  const canvasW = Math.max(0, Math.min(dims.w - 32, CANVAS_MAX_W));

  const pos = (item: LayoutItem) => ({
    x: Math.round(item.xFrac * (canvasW - item.w)),
    y: item.y,
    rot: item.rot,
  });

  // Entrance stagger keyed to vertical order, suppressed under reduced motion.
  const order = LAYOUT.map((l) => l.id);
  const delayFor = (id: string) => (reducedMotion ? 0 : 50 + order.indexOf(id) * 45);
  const wakeDelayFor = (id: string) => WAKE_BASE + Math.max(0, order.indexOf(id)) * WAKE_STAGGER;

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        // Top padding clears the card stack's layered shadows so the portrait
        // never floats over the card; bottom padding clears the fixed hint bar
        // and CTA pill at full scroll.
        padding: '32px 16px 150px',
        // Contain every sticker z-index (including the 9999 drag bump) so
        // dragged stickers never paint over the fixed header, hint, or modals.
        isolation: 'isolate',
      }}
    >
      {/* Keyed by canvasW: the base Sticker captures its `initial` position only
          once (useMotionValue), so when the viewport width changes (including the
          SSR-default 1440 → real-width correction on first mount) we remount the
          subtree to re-seed every sticker at the correct, responsive coordinates. */}
      <div
        key={canvasW}
        ref={canvasRef}
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: CANVAS_MAX_W,
          margin: '0 auto',
          minHeight: CANVAS_MIN_HEIGHT,
          // Let the page scroll vertically. Stickers use allowPageScroll
          // (touch-action: pan-y) so a vertical swipe that starts on a sticker
          // scrolls the page instead of dragging the sticker; horizontal drags
          // still work.
          touchAction: 'pan-y',
        }}
      >
        <PhotoSticker
          id="portrait-m"
          src="/assets/rohan-casual.webp"
          w={150}
          h={226}
          initial={pos(BY_ID.portrait)}
          zBase={15}
          noBorder={true}
          onClick={handlers.portraitClick}
          entranceDelay={delayFor('portrait')}
          dragConstraints={canvasRef}
          disableSnap
          allowPageScroll
          snapBackHome
          wake={wake}
          wakeDelay={wakeDelayFor('portrait')}
        />

        <WordSticker
          id="tag-founder-m"
          text="ex-founder"
          initial={pos(BY_ID.tagFounder)}
          zBase={5}
          bg="#1a1a1a"
          fg="#faf7ef"
          fontSize={12}
          padX={12}
          padY={6}
          entranceDelay={delayFor('tagFounder')}
          dragConstraints={canvasRef}
          disableSnap
          allowPageScroll
          snapBackHome
        />
        <WordSticker
          id="tag-ai-m"
          text="ai product manager"
          initial={pos(BY_ID.tagAI)}
          zBase={5}
          bg="var(--accent-orange)"
          fg="#faf7ef"
          fontSize={12}
          padX={12}
          padY={6}
          entranceDelay={delayFor('tagAI')}
          dragConstraints={canvasRef}
          disableSnap
          allowPageScroll
          snapBackHome
        />

        <ImageSticker
          id="linkedin-m"
          src="/assets/icons/linkedin.png"
          size={88}
          initial={pos(BY_ID.linkedin)}
          zBase={10}
          onClick={handlers.openLinkedIn}
          entranceDelay={delayFor('linkedin')}
          dragConstraints={canvasRef}
          disableSnap
          allowPageScroll
          snapBackHome
          wake={wake}
          wakeDelay={wakeDelayFor('linkedin')}
        />
        <EmailSticker
          id="email-m"
          initial={pos(BY_ID.email)}
          zBase={10}
          onClick={handlers.openEmail}
          entranceDelay={delayFor('email')}
          dragConstraints={canvasRef}
          disableSnap
          allowPageScroll
          snapBackHome
          wake={wake}
          wakeDelay={wakeDelayFor('email')}
        />

        <ImageSticker
          id="charminar-m"
          src="/assets/icons/charminar.png"
          size={104}
          initial={pos(BY_ID.charminar)}
          zBase={8}
          onClick={handlers.charminarFact}
          entranceDelay={delayFor('charminar')}
          dragConstraints={canvasRef}
          disableSnap
          allowPageScroll
          snapBackHome
          wake={wake}
          wakeDelay={wakeDelayFor('charminar')}
        />
        <ImageSticker
          id="plane-m"
          src="/assets/icons/plane.png"
          size={92}
          initial={pos(BY_ID.plane)}
          zBase={7}
          onClick={handlers.travelList}
          entranceDelay={delayFor('plane')}
          dragConstraints={canvasRef}
          disableSnap
          allowPageScroll
          snapBackHome
          wake={wake}
          wakeDelay={wakeDelayFor('plane')}
        />

        <LaptopSticker
          id="laptop-m"
          initial={pos(BY_ID.laptop)}
          zBase={8}
          onClick={handlers.openWork}
          entranceDelay={delayFor('laptop')}
          dragConstraints={canvasRef}
          disableSnap
          allowPageScroll
          snapBackHome
          wake={wake}
          wakeDelay={wakeDelayFor('laptop')}
        />
        <FolderSticker
          id="folder-m"
          initial={pos(BY_ID.folder)}
          zBase={8}
          onClick={handlers.openWriting}
          entranceDelay={delayFor('folder')}
          count={writingCount}
          title={writingCount ? `writing · ${writingCount} posts` : 'writing'}
          dragConstraints={canvasRef}
          disableSnap
          allowPageScroll
          snapBackHome
          wake={wake}
          wakeDelay={wakeDelayFor('folder')}
        />

        <AirPodsSticker
          id="airpods-m"
          initial={pos(BY_ID.airpods)}
          zBase={7}
          onPlay={handlers.toggleMusic}
          entranceDelay={delayFor('airpods')}
          dragConstraints={canvasRef}
          disableSnap
          allowPageScroll
          snapBackHome
          wake={wake}
          wakeDelay={wakeDelayFor('airpods')}
        />
        <ImageSticker
          id="beach-m"
          src="/assets/icons/beach.png"
          size={92}
          initial={pos(BY_ID.beach)}
          zBase={7}
          onClick={handlers.beachVibes}
          entranceDelay={delayFor('beach')}
          dragConstraints={canvasRef}
          disableSnap
          allowPageScroll
          snapBackHome
          wake={wake}
          wakeDelay={wakeDelayFor('beach')}
        />
        <CameraSticker
          id="camera-m"
          initial={pos(BY_ID.camera)}
          zBase={7}
          onClick={handlers.cameraVibes}
          entranceDelay={delayFor('camera')}
          dragConstraints={canvasRef}
          disableSnap
          allowPageScroll
          snapBackHome
          wake={wake}
          wakeDelay={wakeDelayFor('camera')}
        />

        <ImageSticker
          id="coffee-m"
          src="/assets/icons/coffee.png"
          size={84}
          initial={pos(BY_ID.coffee)}
          zBase={7}
          onClick={handlers.coffeeVibes}
          entranceDelay={delayFor('coffee')}
          dragConstraints={canvasRef}
          disableSnap
          allowPageScroll
          snapBackHome
          wake={wake}
          wakeDelay={wakeDelayFor('coffee')}
        />
        <ImageSticker
          id="gym-m"
          src="/assets/icons/gym.png"
          size={88}
          initial={pos(BY_ID.gym)}
          zBase={7}
          onClick={handlers.gymVibes}
          entranceDelay={delayFor('gym')}
          dragConstraints={canvasRef}
          disableSnap
          allowPageScroll
          snapBackHome
          wake={wake}
          wakeDelay={wakeDelayFor('gym')}
        />
        <PickleballSticker
          id="pickleball-m"
          initial={pos(BY_ID.pickleball)}
          zBase={7}
          onClick={handlers.pickleballVibes}
          entranceDelay={delayFor('pickleball')}
          dragConstraints={canvasRef}
          disableSnap
          allowPageScroll
          snapBackHome
          wake={wake}
          wakeDelay={wakeDelayFor('pickleball')}
        />
        <ImageSticker
          id="terrapin-m"
          src="/assets/icons/terrapin.png"
          size={96}
          initial={pos(BY_ID.terrapin)}
          zBase={7}
          onClick={handlers.terrapinFact}
          entranceDelay={delayFor('terrapin')}
          dragConstraints={canvasRef}
          disableSnap
          allowPageScroll
          snapBackHome
          wake={wake}
          wakeDelay={wakeDelayFor('terrapin')}
        />

        <WheelSticker
          id="wheel-m"
          initial={pos(BY_ID.wheel)}
          zBase={7}
          onClick={handlers.openWheel}
          entranceDelay={delayFor('wheel')}
          dragConstraints={canvasRef}
          disableSnap
          allowPageScroll
          snapBackHome
          wake={wake}
          wakeDelay={wakeDelayFor('wheel')}
        />

        <CouncilSticker
          id="council-m"
          initial={pos(BY_ID.council)}
          zBase={7}
          onClick={handlers.openCouncil}
          entranceDelay={delayFor('council')}
          dragConstraints={canvasRef}
          disableSnap
          allowPageScroll
          snapBackHome
          title="the council · question everything"
          wake={wake}
          wakeDelay={wakeDelayFor('council')}
        />

        <HatRackSticker
          id="hats-m"
          initial={pos(BY_ID.hats)}
          zBase={8}
          onClick={handlers.openHats}
          entranceDelay={delayFor('hats')}
          dragConstraints={canvasRef}
          disableSnap
          allowPageScroll
          snapBackHome
          title="what you get · pick a hat"
          wake={wake}
          wakeDelay={wakeDelayFor('hats')}
        />

        {/* Easter egg label + coffee machine, tucked at the bottom of the canvas */}
        <div
          style={{
            position: 'absolute',
            top: BY_ID.coffeeMachine.y - 26,
            left: 0,
            width: '100%',
            textAlign: 'center',
            fontFamily: 'var(--font-mono)',
            fontSize: 12,
            color: 'var(--ink-secondary)',
            pointerEvents: 'none',
          }}
        >
          ↓ easter egg ↓
        </div>
        <CoffeeMachineSticker
          id="coffeeMachine-m"
          initial={pos(BY_ID.coffeeMachine)}
          zBase={6}
          onBrew={handlers.brewCoffee}
          entranceDelay={delayFor('coffeeMachine')}
          dragConstraints={canvasRef}
          disableSnap
          allowPageScroll
          snapBackHome
        />
      </div>
    </div>
  );
}
