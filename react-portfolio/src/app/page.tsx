'use client';

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useResponsive, DESIGN_W, DESIGN_H } from '@/hooks/useDimensions';
import { useSongAudio } from '@/hooks/useAudio';
import { CardStack } from '@/components/cards';
import { Modal, StoicWisdomModal, WorkCardStack, AIShowcaseModal } from '@/components/modals';
import { EqBars } from '@/components/ui/EqBars';
import { DesktopStickers, Stage } from '@/components/layouts';
import { MobileStickerGrid } from '@/components/layouts/MobileStickerGrid';
import { PROJECTS } from '@/data/projects';
import { STOIC_QUOTES } from '@/data/quotes';
import { StoicQuote } from '@/types';
import { placeOrbital, resolveCluster, positionsToObject } from '@/utils/layoutEngine';

type ModalType =
  | 'phone'
  | 'music'
  | 'lego'
  | 'charminar'
  | 'dc'
  | 'travel'
  | 'beach'
  | 'pickleball'
  | 'camera'
  | 'coffee'
  | 'gym'
  | 'portrait'
  | 'work'
  | 'stoic'
  | null;

export default function Home() {
  // Modal state
  const [modal, setModal] = useState<ModalType>(null);
  const [legoCount, setLegoCount] = useState(0);
  const [musicPlaying, setMusicPlaying] = useState(false);
  const [stoicQuote, setStoicQuote] = useState<StoicQuote | null>(null);
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [keySequence, setKeySequence] = useState('');

  // Client-side mount detection to avoid SSR/hydration mismatches
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  // Responsive state
  const { isMobile, scale, s, d } = useResponsive();

  // Audio
  const { togglePlay, stop } = useSongAudio('/assets/believer.mp3');

  // Dynamic lighting state
  const [lightPos, setLightPos] = useState({ x: 50, y: 40 });

  // Track mouse for dynamic lighting
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const x = (e.clientX / window.innerWidth) * 100;
      const y = (e.clientY / window.innerHeight) * 100;
      setLightPos({ x, y });
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
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

  // Calculate orbital positions in the fixed design canvas. These are constant —
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
    // pulling in can never overlap the card — the nearest stickers just settle at
    // card-edge + gap.
    const PULL = 0.88;
    const od = (dist: number) => d(Math.round(dist * PULL));

    // Orbital home positions. The width/height passed here only shapes the initial
    // top-left anchor (it matches the long-standing layout); actual collision/bbox
    // math below uses the true RENDER sizes so spacing is visually correct.
    const raw = [
      { id: 'plane', ...placeOrbital(-98, od(110), s(110), s(76), 0, config) },
      { id: 'tagPM', ...placeOrbital(-150, od(95), s(160), s(36), 0, config) },
      { id: 'tagAI', ...placeOrbital(5, od(80), s(140), s(36), 0, config) },
      { id: 'charminar', ...placeOrbital(-128, od(160), s(120), s(110), 0, config) },
      { id: 'washingtondc', ...placeOrbital(-35, od(150), s(120), s(86), 0, config) },
      { id: 'portrait', ...placeOrbital(162, od(155), s(215), s(323), 0, config) },
      { id: 'linkedin', ...placeOrbital(200, od(80), s(90), s(90), 0, config) },
      { id: 'pickleball', ...placeOrbital(224, od(120), s(90), s(90), 0, config) },
      { id: 'email', ...placeOrbital(18, od(95), s(100), s(74), 0, config) },
      { id: 'beach', ...placeOrbital(52, od(120), s(92), s(92), 0, config) },
      { id: 'coffee', ...placeOrbital(22, od(235), s(80), s(86), 0, config) },
      { id: 'lego', ...placeOrbital(68, od(215), s(88), s(76), 0, config) },
      { id: 'headphones', ...placeOrbital(244, od(105), s(90), s(100), 0, config) },
      { id: 'camera', ...placeOrbital(266, od(165), s(96), s(76), 0, config) },
      { id: 'gym', ...placeOrbital(300, od(115), s(96), s(96), 0, config) },
      { id: 'laptop', ...placeOrbital(-58, od(150), s(100), s(90), 0, config) },
      { id: 'folder', ...placeOrbital(138, od(115), s(100), s(80), 0, config) },
    ];

    // True on-screen sizes per sticker (some components render a different size
    // than the anchor width/height above). Used for collision + bounding box.
    const renderSize: Record<string, [number, number]> = {
      plane: [s(104), s(104)],
      tagPM: [s(92), s(39)],
      tagAI: [s(157), s(39)],
      charminar: [s(116), s(116)],
      washingtondc: [s(110), s(110)],
      portrait: [portraitW, portraitH],
      linkedin: [s(92), s(92)],
      pickleball: [s(90), s(94)],
      email: [s(100), s(79)],
      beach: [s(98), s(98)],
      coffee: [s(88), s(88)],
      lego: [s(88), s(80)],
      headphones: [s(90), s(100)],
      camera: [s(96), s(81)],
      gym: [s(96), s(96)],
      laptop: [s(100), s(90)],
      folder: [s(100), s(80)],
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
      dcFact: () => setModal('dc'),
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
      bumpLego: () => {
        setLegoCount((c) => c + 1);
        setModal('lego');
      },
      openWork: () => setModal('work'),
      openWriting: () => (window.location.href = '/blog.html'),
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
    <>
      {/* Board background */}
      <div className="board">
        <div
          className="board-light"
          style={{
            background: `radial-gradient(circle at ${lightPos.x}% ${lightPos.y}%, rgba(255, 251, 239, 0.3), transparent 60%)`,
          }}
        />
      </div>

      {/* Brand header */}
      <header className="brand">
        <span className="name">rohan</span>
        <span className="dot" />
        <span className="sub">a sticker board by rohan pradyumna</span>
      </header>

      {/* Status corner */}
      <div className="corner">
        <span className="live">online</span>
        <Clock />
      </div>

      {/* Hint */}
      <div className="hint">drag stickers · tap to interact · swipe cards</div>

      {/* Main content */}
      <main suppressHydrationWarning>
        {isMobile ? (
          <>
            {/* Center card stack */}
            <CardStack />
            {/* Mobile: sticker grid below card */}
            <MobileStickerGrid handlers={handlers} />
          </>
        ) : (
          // Desktop: fixed design canvas, uniformly scaled to fit the viewport
          <Stage bbox={bbox}>
            <DesktopStickers
              positions={positions}
              portraitW={portraitW}
              portraitH={portraitH}
              handlers={handlers}
            />
            <CardStack />
          </Stage>
        )}
      </main>

      {/* Modals */}
      <Modal open={modal === 'phone'} noAnimation={true} onClose={closeModal} title="call me" color="#1a1a1a">
        <div
          style={{
            fontSize: 28,
            fontFamily: "'Geist Mono', monospace",
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

      <Modal open={modal === 'music'} noAnimation={true} onClose={closeModal} title="now playing" color="#1a1a1a">
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
            background: musicPlaying ? 'rgba(245,242,232,0.15)' : '#e85d3a',
            color: '#f5f2e8',
            border: 'none',
            borderRadius: 8,
            cursor: 'pointer',
            fontSize: 13,
            fontWeight: 600,
            fontFamily: "'Geist Mono', monospace",
          }}
        >
          {musicPlaying ? '⏸ pause' : '▶ play'}
        </button>
      </Modal>

      <Modal open={modal === 'lego'} noAnimation={true} onClose={closeModal} title="click!" color="#d4584f">
        <div style={{ fontSize: 14, color: '#f5f2e8', marginBottom: 8 }}>
          you&apos;ve clicked the brick <b>{legoCount}</b> {legoCount === 1 ? 'time' : 'times'}.
        </div>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)' }}>
          building is the same whether it&apos;s lego or software — you start with one brick, and keep going.
        </div>
        <div style={{ marginTop: 16, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {Array.from({ length: Math.min(legoCount, 24) }).map((_, i) => (
            <span
              key={i}
              style={{
                display: 'inline-block',
                width: 18,
                height: 12,
                background: ['#f2c230', '#2d6cdf', '#3a7d44', '#1a1a1a', '#faf7ef'][i % 5],
                border: '1px solid rgba(255,255,255,0.3)',
                borderRadius: 2,
                animation: `pop 0.3s ease ${i * 0.02}s both`,
              }}
            />
          ))}
        </div>
      </Modal>

      <Modal open={modal === 'charminar'} noAnimation={true} onClose={closeModal} title="hyderabad 🍛" color="#a8794a">
        <div style={{ fontSize: 13.5, lineHeight: 1.6, color: '#faf7ef', marginBottom: 10 }}>
          home. my heart lives here even when I don&apos;t. the city that never sleeps — and neither did I when I was
          there.
        </div>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)', lineHeight: 1.6 }}>
          the biryani hits different. the nightlife hits different. the energy of the city hits different. someday
          I&apos;m going back to build things there. until then, I cope with phone calls home and food that&apos;s never
          quite the same.
        </div>
      </Modal>

      <Modal open={modal === 'dc'} noAnimation={true} onClose={closeModal} title="washington, dc 🏛️" color="#2d6cdf">
        <div style={{ fontSize: 13.5, lineHeight: 1.6, color: '#faf7ef', marginBottom: 10 }}>
          current base of operations. UMD brought me here, AI keeps me here, Hyderabad will eventually take me back.
        </div>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)' }}>
          solid coffee scene, good energy, and Annapolis is a quick escape when I need water vibes. hit me up if
          you&apos;re around — I&apos;m always down for a chat.
        </div>
      </Modal>

      <Modal open={modal === 'travel'} noAnimation={true} onClose={closeModal} title="travel vibes ✈️" color="#1a1a1a">
        <div style={{ fontSize: 13.5, lineHeight: 1.6, color: '#faf7ef', marginBottom: 12 }}>
          hot take: I&apos;d rather go back to a place I love than hunt for somewhere new. once a city clicks, I want to
          keep going back. they tell me stories.
        </div>
        <div style={{ fontSize: 12, color: 'rgba(245,242,232,0.7)', marginBottom: 12 }}>
          <b style={{ color: '#e85d3a' }}>annapolis, maryland</b> — been there 10+ times and counting. idk what it is,
          but that place has me.
        </div>
        <div style={{ fontSize: 11, color: 'rgba(245,242,232,0.5)', fontStyle: 'italic' }}>
          haven&apos;t traveled as much as I&apos;d like yet, but working on it.
        </div>
      </Modal>

      <Modal open={modal === 'beach'} noAnimation={true} onClose={closeModal} title="beach brain" color="#2d6cdf">
        <div style={{ fontSize: 13.5, lineHeight: 1.6, color: '#faf7ef' }}>
          my best product ideas happen when I&apos;m 10 feet from the water and nowhere near a laptop. kerala backwaters
          &gt; boardrooms.
        </div>
      </Modal>

      <Modal
        open={modal === 'pickleball'}
        noAnimation={true}
        onClose={closeModal}
        title="racket sports 🏓"
        color="#3a7d44"
      >
        <div style={{ fontSize: 13.5, lineHeight: 1.6, color: '#faf7ef', marginBottom: 10 }}>
          pickleball, tennis, badminton, TT — I play them all and I&apos;m weirdly decent at each? not pro level, but
          I&apos;ll make you work for it.
        </div>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)' }}>
          also trying golf now because apparently I needed another hobby. if you&apos;re in DC and want to play anything
          with a racket (or club), let&apos;s go.
        </div>
      </Modal>

      <Modal open={modal === 'camera'} noAnimation={true} onClose={closeModal} title="photo walks" color="#1a1a1a">
        <div style={{ fontSize: 13.5, lineHeight: 1.6, color: '#f5f2e8' }}>
          mostly street + architecture on a fuji x100v. not for the &apos;gram — just for me. there&apos;s something
          about noticing that makes me a better PM too.
        </div>
      </Modal>

      <Modal
        open={modal === 'coffee'}
        noAnimation={true}
        onClose={closeModal}
        title="coffee obsession ☕"
        color="#6b3a1f"
      >
        <div style={{ fontSize: 13.5, lineHeight: 1.6, color: '#faf7ef', marginBottom: 10 }}>
          yes, I&apos;m that guy who asks where the beans are from. black, or their specialty if I&apos;m feeling fancy
          — but always strong.
        </div>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)', lineHeight: 1.6, marginBottom: 10 }}>
          I drink based on the coffee belt: <b>Ethiopian · Colombian · Vietnamese · Indian · Peruvian</b>. Medium roast,
          proper brews, fine grinds for espresso. I have opinions.
        </div>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', fontStyle: 'italic' }}>
          if we&apos;re getting coffee, I&apos;m 100% going to ask what you&apos;re building.
        </div>
      </Modal>

      <Modal open={modal === 'gym'} noAnimation={true} onClose={closeModal} title="fitness arc 💪" color="#2d6cdf">
        <div style={{ fontSize: 13.5, lineHeight: 1.6, color: '#faf7ef' }}>
          currently in my &quot;get fit&quot; era. shipping products = sitting all day, so the gym is non-negotiable.
          compound effect works here too — small reps, big gains. (that&apos;s the plan anyway)
        </div>
      </Modal>

      <Modal open={modal === 'portrait'} noAnimation={true} onClose={closeModal} title="that's me" color="#1a1a1a">
        <div style={{ fontSize: 13.5, lineHeight: 1.6, color: '#f5f2e8' }}>
          occasionally productive, generally fun, always smiling. the coffee helps.
        </div>
      </Modal>

      {/* My Work Modal */}
      <Modal open={modal === 'work'} onClose={closeModal} title="my work" color="#1a1a1a" noAnimation={true}>
        <WorkCardStack projects={PROJECTS} />
      </Modal>

      {/* Stoic Wisdom Modal */}
      <StoicWisdomModal open={modal === 'stoic'} onClose={closeModal} quote={stoicQuote} />

      {/* AI Showcase Easter Egg Modal */}
      <AIShowcaseModal open={aiModalOpen} onClose={() => setAiModalOpen(false)} />
    </>
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
