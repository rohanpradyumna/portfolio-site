'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useResponsive } from '@/hooks/useDimensions';
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

type Slot = { entrance: StickerEntrance; entranceDelay: number };
const STILL: Slot = { entrance: 'none', entranceDelay: 0 };

interface MobileDragCanvasProps {
  /** First visit: the laptop nudges once, when it scrolls into view. */
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
// Free horizontal track inside the 16px side padding, capped so a phone on its
// side keeps the stickers in a readable column instead of at the far edges.
const fitCanvas = (viewportW: number) => Math.max(0, Math.min(viewportW - 32, CANVAS_MAX_W));

export function MobileDragCanvas({ nudge = false, writingCount, handlers }: MobileDragCanvasProps) {
  const { dims } = useResponsive();
  const canvasRef = useRef<HTMLDivElement>(null);

  const canvasW = fitCanvas(dims.w);

  const pos = (item: LayoutItem) => ({
    x: Math.round(item.xFrac * (canvasW - item.w)),
    y: item.y,
    rot: item.rot,
  });

  // The entrance is planned once, from where the canvas sits when the page opens.
  // The portrait leads; the other stickers on screen follow by their distance from
  // the card above, and anything below the fold is simply there (an entrance
  // nobody sees only delays it). Stickers mount with this plan, so none of them
  // flashes in with the wrong treatment. Two things settle just after mount and
  // would put the fold in the wrong place: a phone can hydrate at a briefly wrong
  // width (360 reads as 401), so the plan waits for the tracked width to agree with
  // the window (400ms at most), and the card stack above still has one render to
  // go before it sits in the flow, so the measurement waits two frames.
  const [plan, setPlan] = useState<{ w: number; slots: Record<string, Slot> } | null>(null);
  const [waited, setWaited] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => setWaited(true), 400);
    return () => window.clearTimeout(t);
  }, []);
  useEffect(() => {
    if (plan || (!waited && fitCanvas(window.innerWidth) !== canvasW)) return;
    const measure = () => {
      const el = canvasRef.current;
      if (!el) return;
      const top = el.getBoundingClientRect().top;
      const fold = window.innerHeight;
      const reach = Math.hypot(canvasW / 2, Math.max(1, fold - top));
      const slots: Record<string, Slot> = {};
      for (const item of LAYOUT) {
        if (top + item.y >= fold) slots[item.id] = STILL;
        else if (item.id === 'portrait') slots[item.id] = { entrance: 'lead', entranceDelay: 0 };
        else {
          const dx = (item.xFrac - 0.5) * (canvasW - item.w);
          slots[item.id] = waveSlot(Math.hypot(dx, item.y + item.h / 2) / reach);
        }
      }
      setPlan({ w: canvasW, slots });
    };
    let raf = requestAnimationFrame(() => {
      raf = requestAnimationFrame(measure);
    });
    return () => cancelAnimationFrame(raf);
  }, [plan, canvasW, waited]);

  // The canvas re-keys (remounts every sticker) when its width changes, e.g. on
  // rotation. Those remounts must not replay the wave, so once the width has moved
  // off the planned one, every sticker is just there.
  const [stale, setStale] = useState(false);
  if (plan && !stale && canvasW !== plan.w) setStale(true);
  const enter = (id: string): Slot =>
    !plan || stale || canvasW !== plan.w ? STILL : plan.slots[id];

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
        {plan && (
          <>
            <PhotoSticker
              id="portrait-m"
              src="/assets/rohan-casual-cut.webp"
              w={150}
              h={226}
              initial={pos(BY_ID.portrait)}
              zBase={15}
              noBorder={true}
              onClick={handlers.portraitClick}
              {...enter('portrait')}
              dragConstraints={canvasRef}
              disableSnap
              allowPageScroll
              snapBackHome
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
              {...enter('tagFounder')}
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
              {...enter('tagAI')}
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
              {...enter('linkedin')}
              dragConstraints={canvasRef}
              disableSnap
              allowPageScroll
              snapBackHome
            />
            <EmailSticker
              id="email-m"
              initial={pos(BY_ID.email)}
              zBase={10}
              onClick={handlers.openEmail}
              {...enter('email')}
              dragConstraints={canvasRef}
              disableSnap
              allowPageScroll
              snapBackHome
            />

            <ImageSticker
              id="charminar-m"
              src="/assets/icons/charminar.png"
              size={104}
              initial={pos(BY_ID.charminar)}
              zBase={8}
              onClick={handlers.charminarFact}
              {...enter('charminar')}
              dragConstraints={canvasRef}
              disableSnap
              allowPageScroll
              snapBackHome
            />
            <ImageSticker
              id="plane-m"
              src="/assets/icons/plane.png"
              size={92}
              initial={pos(BY_ID.plane)}
              zBase={7}
              onClick={handlers.travelList}
              {...enter('plane')}
              dragConstraints={canvasRef}
              disableSnap
              allowPageScroll
              snapBackHome
            />

            <LaptopSticker
              id="laptop-m"
              initial={pos(BY_ID.laptop)}
              zBase={8}
              onClick={handlers.openWork}
              {...enter('laptop')}
              nudge={nudge}
              dragConstraints={canvasRef}
              disableSnap
              allowPageScroll
              snapBackHome
            />
            <FolderSticker
              id="folder-m"
              initial={pos(BY_ID.folder)}
              zBase={8}
              onClick={handlers.openWriting}
              {...enter('folder')}
              count={writingCount}
              title={writingCount ? `writing · ${writingCount} posts` : 'writing'}
              dragConstraints={canvasRef}
              disableSnap
              allowPageScroll
              snapBackHome
            />

            <AirPodsSticker
              id="airpods-m"
              initial={pos(BY_ID.airpods)}
              zBase={7}
              onPlay={handlers.toggleMusic}
              {...enter('airpods')}
              dragConstraints={canvasRef}
              disableSnap
              allowPageScroll
              snapBackHome
            />
            <ImageSticker
              id="beach-m"
              src="/assets/icons/beach.png"
              size={92}
              initial={pos(BY_ID.beach)}
              zBase={7}
              onClick={handlers.beachVibes}
              {...enter('beach')}
              dragConstraints={canvasRef}
              disableSnap
              allowPageScroll
              snapBackHome
            />
            <CameraSticker
              id="camera-m"
              initial={pos(BY_ID.camera)}
              zBase={7}
              onClick={handlers.cameraVibes}
              {...enter('camera')}
              dragConstraints={canvasRef}
              disableSnap
              allowPageScroll
              snapBackHome
            />

            <ImageSticker
              id="coffee-m"
              src="/assets/icons/coffee.png"
              size={84}
              initial={pos(BY_ID.coffee)}
              zBase={7}
              onClick={handlers.coffeeVibes}
              {...enter('coffee')}
              dragConstraints={canvasRef}
              disableSnap
              allowPageScroll
              snapBackHome
            />
            <ImageSticker
              id="gym-m"
              src="/assets/icons/gym.png"
              size={88}
              initial={pos(BY_ID.gym)}
              zBase={7}
              onClick={handlers.gymVibes}
              {...enter('gym')}
              dragConstraints={canvasRef}
              disableSnap
              allowPageScroll
              snapBackHome
            />
            <PickleballSticker
              id="pickleball-m"
              initial={pos(BY_ID.pickleball)}
              zBase={7}
              onClick={handlers.pickleballVibes}
              {...enter('pickleball')}
              dragConstraints={canvasRef}
              disableSnap
              allowPageScroll
              snapBackHome
            />
            <ImageSticker
              id="terrapin-m"
              src="/assets/icons/terrapin.png"
              size={96}
              initial={pos(BY_ID.terrapin)}
              zBase={7}
              onClick={handlers.terrapinFact}
              {...enter('terrapin')}
              dragConstraints={canvasRef}
              disableSnap
              allowPageScroll
              snapBackHome
            />

            <WheelSticker
              id="wheel-m"
              initial={pos(BY_ID.wheel)}
              zBase={7}
              onClick={handlers.openWheel}
              {...enter('wheel')}
              dragConstraints={canvasRef}
              disableSnap
              allowPageScroll
              snapBackHome
            />

            <CouncilSticker
              id="council-m"
              initial={pos(BY_ID.council)}
              zBase={7}
              onClick={handlers.openCouncil}
              {...enter('council')}
              dragConstraints={canvasRef}
              disableSnap
              allowPageScroll
              snapBackHome
              title="the council · question everything"
            />

            <HatRackSticker
              id="hats-m"
              initial={pos(BY_ID.hats)}
              zBase={8}
              onClick={handlers.openHats}
              {...enter('hats')}
              dragConstraints={canvasRef}
              disableSnap
              allowPageScroll
              snapBackHome
              title="what you get · pick a hat"
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
              {...enter('coffeeMachine')}
              dragConstraints={canvasRef}
              disableSnap
              allowPageScroll
              snapBackHome
            />
          </>
        )}
      </div>
    </div>
  );
}
