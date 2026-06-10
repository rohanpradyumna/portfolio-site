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
    openWriting: () => void;
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

const LAYOUT: LayoutItem[] = [
  { id: 'portrait', xFrac: 0.5, y: 0, w: 150, h: 226, rot: -2 },
  { id: 'tagFounder', xFrac: 0.14, y: 250, w: 108, h: 40, rot: -3 },
  { id: 'tagAI', xFrac: 0.58, y: 258, w: 150, h: 40, rot: 2 },
  { id: 'linkedin', xFrac: 0.16, y: 322, w: 88, h: 88, rot: -4 },
  { id: 'email', xFrac: 0.62, y: 330, w: 100, h: 74, rot: 3 },
  { id: 'charminar', xFrac: 0.08, y: 430, w: 104, h: 104, rot: -3 },
  { id: 'plane', xFrac: 0.9, y: 470, w: 92, h: 92, rot: 6 },
  { id: 'laptop', xFrac: 0.18, y: 560, w: 100, h: 96, rot: -2 },
  { id: 'folder', xFrac: 0.6, y: 552, w: 100, h: 86, rot: 3 },
  { id: 'airpods', xFrac: 0.1, y: 672, w: 90, h: 100, rot: -5 },
  { id: 'beach', xFrac: 0.46, y: 680, w: 92, h: 92, rot: 4 },
  { id: 'camera', xFrac: 0.84, y: 668, w: 96, h: 80, rot: -3 },
  { id: 'coffee', xFrac: 0.12, y: 788, w: 84, h: 84, rot: 5 },
  { id: 'gym', xFrac: 0.42, y: 796, w: 88, h: 88, rot: -4 },
  { id: 'pickleball', xFrac: 0.74, y: 784, w: 90, h: 94, rot: 6 },
  { id: 'terrapin', xFrac: 0.5, y: 892, w: 96, h: 96, rot: -3 },
  { id: 'coffeeMachine', xFrac: 0.5, y: 1030, w: 100, h: 130, rot: 2 },
];

const CANVAS_MIN_HEIGHT = 1210;

export function MobileDragCanvas({ wake = false, writingCount, handlers }: MobileDragCanvasProps) {
  const { dims } = useResponsive();
  const { reducedMotion } = useMotion();
  const canvasRef = useRef<HTMLDivElement>(null);

  // Free horizontal track inside the 16px side padding.
  const canvasW = Math.max(0, dims.w - 32);

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
          minHeight: CANVAS_MIN_HEIGHT,
          // Let the page scroll vertically; each sticker (touchAction:none) still
          // drags freely in any direction.
          touchAction: 'pan-y',
        }}
      >
        <PhotoSticker
          id="portrait-m"
          src="/assets/rohan-casual.webp"
          w={150}
          h={226}
          initial={pos(LAYOUT[0])}
          zBase={15}
          noBorder={true}
          onClick={handlers.portraitClick}
          entranceDelay={delayFor('portrait')}
          dragConstraints={canvasRef}
          disableSnap
          wake={wake}
          wakeDelay={wakeDelayFor('portrait')}
        />

        <WordSticker
          id="tag-founder-m"
          text="founder"
          initial={pos(LAYOUT[1])}
          zBase={5}
          bg="#1a1a1a"
          fg="#faf7ef"
          fontSize={12}
          padX={12}
          padY={6}
          entranceDelay={delayFor('tagFounder')}
          dragConstraints={canvasRef}
          disableSnap
        />
        <WordSticker
          id="tag-ai-m"
          text="ai · strategist"
          initial={pos(LAYOUT[2])}
          zBase={5}
          bg="#e85d3a"
          fg="#faf7ef"
          fontSize={12}
          padX={12}
          padY={6}
          entranceDelay={delayFor('tagAI')}
          dragConstraints={canvasRef}
          disableSnap
        />

        <ImageSticker
          id="linkedin-m"
          src="/assets/icons/linkedin.png"
          size={88}
          initial={pos(LAYOUT[3])}
          zBase={10}
          onClick={handlers.openLinkedIn}
          entranceDelay={delayFor('linkedin')}
          dragConstraints={canvasRef}
          disableSnap
          wake={wake}
          wakeDelay={wakeDelayFor('linkedin')}
        />
        <EmailSticker
          id="email-m"
          initial={pos(LAYOUT[4])}
          zBase={10}
          onClick={handlers.openEmail}
          entranceDelay={delayFor('email')}
          dragConstraints={canvasRef}
          disableSnap
          wake={wake}
          wakeDelay={wakeDelayFor('email')}
        />

        <ImageSticker
          id="charminar-m"
          src="/assets/icons/charminar.png"
          size={104}
          initial={pos(LAYOUT[5])}
          zBase={8}
          onClick={handlers.charminarFact}
          entranceDelay={delayFor('charminar')}
          dragConstraints={canvasRef}
          disableSnap
          wake={wake}
          wakeDelay={wakeDelayFor('charminar')}
        />
        <ImageSticker
          id="plane-m"
          src="/assets/icons/plane.png"
          size={92}
          initial={pos(LAYOUT[6])}
          zBase={7}
          onClick={handlers.travelList}
          entranceDelay={delayFor('plane')}
          dragConstraints={canvasRef}
          disableSnap
          wake={wake}
          wakeDelay={wakeDelayFor('plane')}
        />

        <LaptopSticker
          id="laptop-m"
          initial={pos(LAYOUT[7])}
          zBase={8}
          onClick={handlers.openWork}
          entranceDelay={delayFor('laptop')}
          dragConstraints={canvasRef}
          disableSnap
          wake={wake}
          wakeDelay={wakeDelayFor('laptop')}
        />
        <FolderSticker
          id="folder-m"
          initial={pos(LAYOUT[8])}
          zBase={8}
          onClick={handlers.openWriting}
          entranceDelay={delayFor('folder')}
          count={writingCount}
          title={writingCount ? `writing · ${writingCount} posts` : 'writing'}
          dragConstraints={canvasRef}
          disableSnap
          wake={wake}
          wakeDelay={wakeDelayFor('folder')}
        />

        <AirPodsSticker
          id="airpods-m"
          initial={pos(LAYOUT[9])}
          zBase={7}
          onPlay={handlers.toggleMusic}
          entranceDelay={delayFor('airpods')}
          dragConstraints={canvasRef}
          disableSnap
          wake={wake}
          wakeDelay={wakeDelayFor('airpods')}
        />
        <ImageSticker
          id="beach-m"
          src="/assets/icons/beach.png"
          size={92}
          initial={pos(LAYOUT[10])}
          zBase={7}
          onClick={handlers.beachVibes}
          entranceDelay={delayFor('beach')}
          dragConstraints={canvasRef}
          disableSnap
          wake={wake}
          wakeDelay={wakeDelayFor('beach')}
        />
        <CameraSticker
          id="camera-m"
          initial={pos(LAYOUT[11])}
          zBase={7}
          onClick={handlers.cameraVibes}
          entranceDelay={delayFor('camera')}
          dragConstraints={canvasRef}
          disableSnap
          wake={wake}
          wakeDelay={wakeDelayFor('camera')}
        />

        <ImageSticker
          id="coffee-m"
          src="/assets/icons/coffee.png"
          size={84}
          initial={pos(LAYOUT[12])}
          zBase={7}
          onClick={handlers.coffeeVibes}
          entranceDelay={delayFor('coffee')}
          dragConstraints={canvasRef}
          disableSnap
          wake={wake}
          wakeDelay={wakeDelayFor('coffee')}
        />
        <ImageSticker
          id="gym-m"
          src="/assets/icons/gym.png"
          size={88}
          initial={pos(LAYOUT[13])}
          zBase={7}
          onClick={handlers.gymVibes}
          entranceDelay={delayFor('gym')}
          dragConstraints={canvasRef}
          disableSnap
          wake={wake}
          wakeDelay={wakeDelayFor('gym')}
        />
        <PickleballSticker
          id="pickleball-m"
          initial={pos(LAYOUT[14])}
          zBase={7}
          onClick={handlers.pickleballVibes}
          entranceDelay={delayFor('pickleball')}
          dragConstraints={canvasRef}
          disableSnap
          wake={wake}
          wakeDelay={wakeDelayFor('pickleball')}
        />
        <ImageSticker
          id="terrapin-m"
          src="/assets/icons/terrapin.png"
          size={96}
          initial={pos(LAYOUT[15])}
          zBase={7}
          onClick={handlers.terrapinFact}
          entranceDelay={delayFor('terrapin')}
          dragConstraints={canvasRef}
          disableSnap
          wake={wake}
          wakeDelay={wakeDelayFor('terrapin')}
        />

        {/* Easter egg label + coffee machine, tucked at the bottom of the canvas */}
        <div
          style={{
            position: 'absolute',
            top: LAYOUT[16].y - 26,
            left: 0,
            width: '100%',
            textAlign: 'center',
            fontFamily: "'Geist Mono', monospace",
            fontSize: 10,
            color: 'var(--ink-secondary)',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            opacity: 0.55,
            pointerEvents: 'none',
          }}
        >
          ↓ easter egg ↓
        </div>
        <CoffeeMachineSticker
          id="coffeeMachine-m"
          initial={pos(LAYOUT[16])}
          zBase={6}
          onBrew={handlers.brewCoffee}
          entranceDelay={delayFor('coffeeMachine')}
          dragConstraints={canvasRef}
          disableSnap
        />
      </div>
    </div>
  );
}
