'use client';

import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { MotionConfig } from 'framer-motion';
import { useResponsive, DESIGN_W, DESIGN_H } from '@/hooks/useDimensions';
import { useSongAudio } from '@/hooks/useAudio';
import { CardStack } from '@/components/cards';
import { Modal, StoicWisdomModal, AIShowcaseModal, UmdRoll } from '@/components/modals';
import { WorkDesktop } from '@/components/experience/WorkDesktop';
import { HatRack } from '@/components/hats/HatRack';
import { EqBars } from '@/components/ui/EqBars';
import { FixedCTA } from '@/components/ui/FixedCTA';
import { DesktopStickers, Stage, MobileDragCanvas } from '@/components/layouts';
import { STOIC_QUOTES } from '@/data/quotes';
import { StoicQuote } from '@/types';
import { placeOrbital, resolveCluster, positionsToObject } from '@/utils/layoutEngine';

type ModalType =
  | 'phone'
  | 'music'
  | 'terrapin'
  | 'charminar'
  | 'travel'
  | 'beach'
  | 'pickleball'
  | 'camera'
  | 'coffee'
  | 'gym'
  | 'portrait'
  | 'work'
  | 'hats'
  | 'stoic'
  | null;

export default function Home() {
  // Modal state
  const [modal, setModal] = useState<ModalType>(null);
  const [workFocus, setWorkFocus] = useState<string | undefined>(undefined);
  const [musicPlaying, setMusicPlaying] = useState(false);
  const [stoicQuote, setStoicQuote] = useState<StoicQuote | null>(null);
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [keySequence, setKeySequence] = useState('');

  // Client-side mount detection to avoid SSR/hydration mismatches
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  // First visit only: the laptop ("what I've shipped") nudges once, a few seconds
  // in view, to invite the first click. It counts as seen once it has played or
  // the visitor has clicked something (they've found their way). A scroll is not
  // a click, so phones still get it when the laptop scrolls into view.
  const [nudge, setNudge] = useState(false);
  useEffect(() => {
    const KEY = 'pf_nudge_seen';
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    try {
      if (localStorage.getItem(KEY)) return;
    } catch {
      return;
    }
    setNudge(true);
    const done = () => {
      try {
        localStorage.setItem(KEY, '1');
      } catch {}
      setNudge(false);
      cleanup();
    };
    // CSS modules hash the keyframe name, so match on the readable part.
    const onAnimEnd = (e: AnimationEvent) => {
      if (e.animationName.includes('stickerNudge')) done();
    };
    const cleanup = () => {
      window.removeEventListener('click', done);
      window.removeEventListener('animationend', onAnimEnd);
    };
    window.addEventListener('click', done);
    window.addEventListener('animationend', onAnimEnd);
    return cleanup;
  }, []);

  // Writing count drives the folder's "more to read" badge. Default to a sane
  // value so the badge renders immediately, then confirm against the live index
  // (tiny cached JSON) so the count never drifts as posts are added.
  const [writingCount, setWritingCount] = useState(3);
  useEffect(() => {
    fetch('/posts/index.json')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (Array.isArray(d) && d.length > 0) setWritingCount(d.length);
      })
      .catch(() => {});
  }, []);

  // Responsive state
  const { isMobile, scale, s, d } = useResponsive();

  // Audio
  const { togglePlay, stop } = useSongAudio('/assets/believer.m4a');

  // Dynamic lighting: written straight to CSS vars on the light layer, once per
  // frame. Holding the position in React state re-rendered every sticker on
  // every mousemove.
  const lightRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let frame = 0;
    const handleMouseMove = (e: MouseEvent) => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        const el = lightRef.current;
        if (!el) return;
        el.style.setProperty('--light-x', `${(e.clientX / window.innerWidth) * 100}%`);
        el.style.setProperty('--light-y', `${(e.clientY / window.innerHeight) * 100}%`);
      });
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      cancelAnimationFrame(frame);
    };
  }, []);

  // The usage hint retires after the first real interaction: once someone has
  // touched the board they know how it works, and on phones it sits on stickers.
  const [hintDone, setHintDone] = useState(false);
  useEffect(() => {
    const retire = () => setHintDone(true);
    window.addEventListener('pointerdown', retire, { once: true });
    // On a phone, scrolling past the card is interaction too; the pinned hint
    // shouldn't ride along over every sticker.
    window.addEventListener('scroll', retire, { once: true, passive: true });
    return () => {
      window.removeEventListener('pointerdown', retire);
      window.removeEventListener('scroll', retire);
    };
  }, []);

  // Easter egg: type "ai" to show AI showcase modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if in input field
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      const newSequence = (keySequence + e.key.toLowerCase()).slice(-2);
      setKeySequence(newSequence);

      if (newSequence === 'ai') {
        setAiModalOpen(true);
        setKeySequence('');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [keySequence]);

  // Portrait sizes (~23% larger than the original 170 x 255 base)
  const portraitW = isMobile ? 120 : s(210);
  const portraitH = isMobile ? 150 : s(315);

  // Calculate orbital positions in the fixed design canvas. These are constant:
  // the Stage handles all viewport scaling, so positions never depend on dims.
  const { positions, bbox } = useMemo(() => {
    if (isMobile) return { positions: {}, bbox: null };

    const cx = DESIGN_W / 2;
    const cy = DESIGN_H / 2;
    const cardW = Math.round(440 * scale);
    const cardH = Math.round(320 * scale);

    const config = { cx, cy, cardW, cardH };

    // Gentle radial tightening: pull every orbital sticker slightly toward the
    // card so the cluster reads as one centered group rather than drifting to the
    // edges. resolveCluster keeps the card/coffee machine immovable (pad 12), so
    // pulling in can never overlap the card; the nearest stickers just settle at
    // card-edge + gap.
    const PULL = 0.88;
    const od = (dist: number) => d(Math.round(dist * PULL));

    // Orbital home positions. The width/height passed here only shapes the initial
    // top-left anchor (it matches the long-standing layout); actual collision/bbox
    // math below uses the true RENDER sizes so spacing is visually correct.
    const raw = [
      { id: 'plane', ...placeOrbital(-98, od(110), s(110), s(76), 0, config) },
      { id: 'tagPM', ...placeOrbital(-150, od(95), s(117), s(39), 0, config) },
      { id: 'tagAI', ...placeOrbital(5, od(80), s(181), s(39), 0, config) },
      { id: 'charminar', ...placeOrbital(-128, od(160), s(120), s(110), 0, config) },
      { id: 'portrait', ...placeOrbital(162, od(155), s(215), s(323), 0, config) },
      { id: 'linkedin', ...placeOrbital(200, od(80), s(90), s(90), 0, config) },
      { id: 'pickleball', ...placeOrbital(224, od(120), s(90), s(90), 0, config) },
      { id: 'email', ...placeOrbital(18, od(95), s(100), s(74), 0, config) },
      { id: 'beach', ...placeOrbital(52, od(120), s(92), s(92), 0, config) },
      { id: 'coffee', ...placeOrbital(22, od(235), s(80), s(86), 0, config) },
      { id: 'terrapin', ...placeOrbital(68, od(215), s(96), s(96), 0, config) },
      { id: 'headphones', ...placeOrbital(244, od(105), s(90), s(100), 0, config) },
      { id: 'camera', ...placeOrbital(266, od(165), s(96), s(76), 0, config) },
      { id: 'gym', ...placeOrbital(300, od(115), s(96), s(96), 0, config) },
      { id: 'laptop', ...placeOrbital(-58, od(150), s(100), s(90), 0, config) },
      { id: 'folder', ...placeOrbital(122, od(160), s(100), s(80), 0, config) },
      { id: 'wheel', ...placeOrbital(-78, od(190), s(104), s(120), 0, config) },
      { id: 'council', ...placeOrbital(-24, od(120), s(116), s(116), 0, config) },
      { id: 'hats', ...placeOrbital(-158, od(215), s(110), s(124), 0, config) },
    ];

    // True on-screen sizes per sticker (some components render a different size
    // than the anchor width/height above). Used for collision + bounding box.
    const renderSize: Record<string, [number, number]> = {
      plane: [s(104), s(104)],
      tagPM: [s(117), s(39)],
      tagAI: [s(181), s(39)],
      charminar: [s(116), s(116)],
      portrait: [portraitW, portraitH],
      linkedin: [s(92), s(92)],
      pickleball: [s(90), s(94)],
      email: [s(100), s(79)],
      beach: [s(98), s(98)],
      coffee: [s(88), s(88)],
      terrapin: [s(96), s(96)],
      headphones: [s(90), s(100)],
      camera: [s(96), s(81)],
      gym: [s(96), s(96)],
      laptop: [s(100), s(90)],
      folder: [s(100), s(80)],
      wheel: [s(104), s(120)],
      council: [s(116), s(116)],
      hats: [s(110), s(124)],
    };

    // Immovable obstacles: the center card and the bottom-left coffee machine
    // (the latter is placed directly in DesktopStickers, not via placeOrbital).
    const coffeeMachineBox = { x: 6, y: DESIGN_H - 180, w: s(107), h: s(135) };
    const obstacles = [
      { x: cx - cardW / 2, y: cy - cardH / 2, w: cardW, h: cardH },
      coffeeMachineBox,
    ];

    // Spread overlapping stickers apart with a breathing gap, keeping each near
    // its orbital home. Collision uses render sizes anchored at the orbital point.
    const clusterIn = raw.map((r) => {
      const [w, h] = renderSize[r.id];
      return { id: r.id, x: r.x, y: r.y, w, h };
    });
    const resolved = resolveCluster(clusterIn, obstacles, { pad: 12 });

    const positionsArr = resolved.map((r) => ({ id: r.id, x: r.x, y: r.y, w: r.w, h: r.h, rot: 0 }));

    // Content bounding box (design space) the Stage uses to scale + center the
    // cluster to fill the viewport. Built from resolved render boxes + obstacles.
    const boxes = [...resolved, coffeeMachineBox];
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const b of boxes) {
      minX = Math.min(minX, b.x);
      minY = Math.min(minY, b.y);
      maxX = Math.max(maxX, b.x + b.w);
      maxY = Math.max(maxY, b.y + b.h);
    }

    // Center the board on the CARD (the design center), not the raw cluster
    // center. The sticker mass is heavier on one side (coffee machine + left
    // stickers), so a raw-bbox center would drift the card off-screen-center
    // and make everything look left-leaning. We instead build a box that's
    // symmetric about the card center, sized to the furthest extent on each
    // axis, so the card sits dead-center and the cluster is balanced.
    const halfW = Math.max(cx - minX, maxX - cx);
    const halfH = Math.max(cy - minY, maxY - cy);
    const contentBox = {
      w: halfW * 2,
      h: halfH * 2,
      cx,
      cy,
    };

    return { positions: positionsToObject(positionsArr), bbox: contentBox };
  }, [isMobile, scale, s, d, portraitW, portraitH]);

  // Event handlers
  const handlers = useMemo(
    () => ({
      openLinkedIn: () => window.open('https://www.linkedin.com/in/rohanpradyumna/', '_blank'),
      openEmail: () => (window.location.href = 'mailto:pradyumnarohan@gmail.com'),
      charminarFact: () => setModal('charminar'),
      travelList: () => setModal('travel'),
      beachVibes: () => setModal('beach'),
      pickleballVibes: () => setModal('pickleball'),
      cameraVibes: () => setModal('camera'),
      coffeeVibes: () => setModal('coffee'),
      gymVibes: () => setModal('gym'),
      portraitClick: () => setModal('portrait'),
      toggleMusic: () => {
        const playing = togglePlay();
        setMusicPlaying(playing);
        setModal('music');
      },
      terrapinFact: () => setModal('terrapin'),
      openWork: () => {
        setWorkFocus(undefined);
        setModal('work');
      },
      openHats: () => setModal('hats'),
      openWriting: () => (window.location.href = '/blog.html'),
      openWheel: () => (window.location.href = '/wheel'),
      openCouncil: () => (window.location.href = '/council'),
      brewCoffee: () => {
        const randomQuote = STOIC_QUOTES[Math.floor(Math.random() * STOIC_QUOTES.length)];
        setStoicQuote(randomQuote);
        setModal('stoic');
      },
    }),
    [togglePlay]
  );

  const closeModal = useCallback(() => {
    setModal(null);
    if (modal === 'music') {
      stop();
      setMusicPlaying(false);
    }
  }, [modal, stop]);

  return (
    // reducedMotion="user": the CSS reduced-motion rule can't reach framer's JS
    // springs, so this drops their transform motion and keeps the opacity fades.
    <MotionConfig reducedMotion="user">
      {/* Board background */}
      <div className="board">
        <div className="board-light" ref={lightRef} />
      </div>

      {/* Brand header */}
      <header className="brand">
        <h1 className="brand-title">
          <span className="name">rohan</span>
          <span className="dot" aria-hidden="true" />
          <span className="sub">a sticker board by rohan pradyumna</span>
        </h1>
      </header>

      {/* Status corner */}
      <div className="corner">
        <span className="live">online</span>
        <Clock />
      </div>

      {/* Hint */}
      <div className={`hint${hintDone ? ' hint-done' : ''}`} aria-hidden={hintDone}>
        drag stickers · tap to interact · swipe cards
      </div>

      {/* Persistent contact pill (appears after a short delay, outside the Stage) */}
      <FixedCTA />

      {/* Main content */}
      <main suppressHydrationWarning>
        {isMobile ? (
          <>
            {/* Hero hook above the cards */}
            <div
              style={{
                marginTop: 'calc(64px + env(safe-area-inset-top))',
                padding: '0 24px',
                textAlign: 'center',
                fontFamily: 'var(--font-mono)',
                // The fixed .board background paints above plain in-flow text;
                // a positioned stacking context keeps the hero visible.
                position: 'relative',
                zIndex: 1,
              }}
            >
              <div
                aria-hidden="true"
                style={{
                  fontFamily: 'var(--font-serif)',
                  fontStyle: 'italic',
                  fontSize: 40,
                  lineHeight: 1,
                  letterSpacing: '-0.02em',
                  color: 'var(--ink)',
                  marginBottom: 10,
                }}
              >
                Rohan Pradyumna
              </div>
              <p
                style={{
                  fontSize: 13,
                  lineHeight: 1.4,
                  color: 'var(--ink)',
                  textWrap: 'balance',
                }}
              >
                ai product manager
                <br />
                building YottaBuilder
              </p>
              <div
                style={{
                  fontSize: 12,
                  color: 'var(--ink-secondary)',
                  marginTop: 6,
                }}
              >
                swipe to explore ›
              </div>
            </div>
            {/* Center card stack */}
            <CardStack />
            {/* Mobile: draggable pocket canvas below card */}
            <MobileDragCanvas handlers={handlers} nudge={nudge} writingCount={writingCount} />
          </>
        ) : (
          // Desktop: fixed design canvas, uniformly scaled to fit the viewport
          <Stage bbox={bbox}>
            <DesktopStickers
              positions={positions}
              portraitW={portraitW}
              portraitH={portraitH}
              handlers={handlers}
              nudge={nudge}
              writingCount={writingCount}
            />
            <CardStack />
          </Stage>
        )}
      </main>

      {/* Modals */}
      <Modal open={modal === 'phone'} onClose={closeModal} title="call me" color="#1a1a1a">
        <div
          style={{
            fontSize: 28,
            fontFamily: 'var(--font-mono)',
            letterSpacing: '0.05em',
            margin: '8px 0 14px',
            color: '#f2c230',
          }}
        >
          +1 (240) 854-3253
        </div>
        <div style={{ fontSize: 12, color: 'rgba(245,242,232,0.55)', marginBottom: 16 }}>
          tap below to dial · or just call me.
        </div>
        <a
          href="tel:+12408543253"
          style={{
            display: 'inline-block',
            padding: '10px 16px',
            background: '#f2c230',
            color: '#1a1a1a',
            fontSize: 12,
            fontWeight: 700,
            borderRadius: 8,
            textDecoration: 'none',
            letterSpacing: '0.02em',
          }}
        >
          dial now →
        </a>
      </Modal>

      <Modal open={modal === 'music'} onClose={closeModal} title="now playing" color="#1a1a1a">
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 6 }}>
          <EqBars playing={musicPlaying} />
          <div>
            <div style={{ fontSize: 14, color: '#f5f2e8', fontWeight: 500 }}>Believer</div>
            <div style={{ fontSize: 11, color: 'rgba(245,242,232,0.55)', marginTop: 4 }}>Imagine Dragons</div>
          </div>
        </div>
        <button
          onClick={() => {
            const p = togglePlay();
            setMusicPlaying(p);
          }}
          style={{
            marginTop: 14,
            padding: '10px 20px',
            background: musicPlaying ? 'rgba(245,242,232,0.15)' : 'var(--accent-orange)',
            color: '#f5f2e8',
            border: 'none',
            borderRadius: 8,
            cursor: 'pointer',
            fontSize: 13,
            fontWeight: 600,
            fontFamily: 'var(--font-mono)',
          }}
        >
          {musicPlaying ? '⏸ pause' : '▶ play'}
        </button>
      </Modal>

      <Modal open={modal === 'terrapin'} onClose={closeModal} title="go terps 🐢" color="#c8102e">
        <div style={{ fontSize: 13.5, lineHeight: 1.6, color: '#faf7ef', marginBottom: 10 }}>
          masters from the robert h. smith school of business. disruptive innovation, digital business transformation,
          and machine learning. the stuff that got me building AI in d.c. fear the turtle.
        </div>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.92)', lineHeight: 1.6 }}>
          plenty of volleyball and good times in the startup shell, plus the wildest parties I could throw along the
          way. I loved my professors, and I&apos;d run the whole course all over again given the chance.
        </div>
        <UmdRoll />
      </Modal>

      <Modal open={modal === 'charminar'} onClose={closeModal} title="hyderabad 🍛" color="#8a5f36">
        <div style={{ fontSize: 13.5, lineHeight: 1.6, color: '#faf7ef', marginBottom: 10 }}>
          home. my heart lives here even when I don&apos;t. the city that never sleeps, and neither did I when I was
          there.
        </div>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.92)', lineHeight: 1.6 }}>
          the biryani hits different. the nightlife hits different. the energy of the city hits different. someday
          I&apos;m going back to build things there. until then, I cope with phone calls home and food that&apos;s never
          quite the same.
        </div>
      </Modal>

      <Modal open={modal === 'travel'} onClose={closeModal} title="travel vibes ✈️" color="#1a1a1a">
        <div style={{ fontSize: 13.5, lineHeight: 1.6, color: '#faf7ef', marginBottom: 12 }}>
          hot take: I&apos;d rather go back to a place I love than hunt for somewhere new. once a city clicks, I want to
          keep going back. they tell me stories.
        </div>
        <div style={{ fontSize: 12, color: 'rgba(245,242,232,0.7)', marginBottom: 12 }}>
          <b style={{ color: 'var(--accent-orange)' }}>annapolis, maryland</b>: been there 10+ times and counting. idk what it is,
          but that place has me.
        </div>
        <div style={{ fontSize: 11, color: 'rgba(245,242,232,0.5)', fontStyle: 'italic' }}>
          haven&apos;t traveled as much as I&apos;d like yet, but working on it.
        </div>
      </Modal>

      <Modal open={modal === 'beach'} onClose={closeModal} title="beach brain" color="#2a63cf">
        <div style={{ fontSize: 13.5, lineHeight: 1.6, color: '#faf7ef' }}>
          my best product ideas happen when I&apos;m 10 feet from the water and nowhere near a laptop. kerala backwaters
          &gt; boardrooms.
        </div>
      </Modal>

      <Modal
        open={modal === 'pickleball'}
        onClose={closeModal}
        title="racket sports 🏓"
        color="#34703d"
      >
        <div style={{ fontSize: 13.5, lineHeight: 1.6, color: '#faf7ef', marginBottom: 10 }}>
          pickleball, tennis, badminton, TT. I play them all and I&apos;m weirdly decent at each? not pro level, but
          I&apos;ll make you work for it.
        </div>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.92)' }}>
          also trying golf now because apparently I needed another hobby. if you&apos;re in DC and want to play anything
          with a racket (or club), let&apos;s go.
        </div>
      </Modal>

      <Modal open={modal === 'camera'} onClose={closeModal} title="photo walks" color="#1a1a1a">
        <div style={{ fontSize: 13.5, lineHeight: 1.6, color: '#f5f2e8' }}>
          mostly street + architecture on a fuji x100v. not for the &apos;gram, just for me. there&apos;s something
          about noticing that makes me a better PM too.
        </div>
      </Modal>

      <Modal
        open={modal === 'coffee'}
        onClose={closeModal}
        title="coffee obsession ☕"
        color="#6b3a1f"
      >
        <div style={{ fontSize: 13.5, lineHeight: 1.6, color: '#faf7ef', marginBottom: 10 }}>
          yes, I&apos;m that guy who asks where the beans are from. black, or their specialty if I&apos;m feeling fancy,
          but always strong.
        </div>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.92)', lineHeight: 1.6, marginBottom: 10 }}>
          I drink based on the coffee belt: <b>Ethiopian · Colombian · Vietnamese · Indian · Peruvian</b>. Medium roast,
          proper brews, fine grinds for espresso. I have opinions.
        </div>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.75)', fontStyle: 'italic' }}>
          if we&apos;re getting coffee, I&apos;m 100% going to ask what you&apos;re building.
        </div>
      </Modal>

      <Modal open={modal === 'gym'} onClose={closeModal} title="fitness arc 💪" color="#2a63cf">
        <div style={{ fontSize: 13.5, lineHeight: 1.6, color: '#faf7ef' }}>
          currently in my &quot;get fit&quot; era. shipping products = sitting all day, so the gym is non-negotiable.
          compound effect works here too: small reps, big gains. (that&apos;s the plan anyway)
        </div>
      </Modal>

      <Modal open={modal === 'portrait'} onClose={closeModal} title="that's me" color="#1a1a1a">
        <div style={{ fontSize: 13.5, lineHeight: 1.6, color: '#f5f2e8' }}>
          occasionally productive, generally fun, always smiling. the coffee helps.
        </div>
      </Modal>

      {/* What I've shipped: Mac-style desktop takeover (rendered outside the Stage) */}
      <WorkDesktop open={modal === 'work'} onClose={closeModal} initialProjectId={workFocus} />

      {/* What you get: the hat rack takeover (rendered outside the Stage) */}
      <HatRack
        open={modal === 'hats'}
        onClose={closeModal}
        onOpenProject={(id) => {
          setWorkFocus(id);
          setModal('work');
        }}
      />

      {/* Stoic Wisdom Modal */}
      <StoicWisdomModal open={modal === 'stoic'} onClose={closeModal} quote={stoicQuote} />

      {/* AI Showcase Easter Egg Modal */}
      <AIShowcaseModal open={aiModalOpen} onClose={() => setAiModalOpen(false)} />
    </MotionConfig>
  );
}

// Clock component
function Clock() {
  const [time, setTime] = useState('--:--');

  useEffect(() => {
    const updateClock = () => {
      const d = new Date();
      const hh = String(d.getHours()).padStart(2, '0');
      const mm = String(d.getMinutes()).padStart(2, '0');
      setTime(`${hh}:${mm} local`);
    };

    updateClock();
    const interval = setInterval(updateClock, 30000);

    return () => clearInterval(interval);
  }, []);

  return <span>{time}</span>;
}
