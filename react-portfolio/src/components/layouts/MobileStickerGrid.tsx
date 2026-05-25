'use client';

import React from 'react';
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

interface MobileStickerGridProps {
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

export function MobileStickerGrid({ handlers }: MobileStickerGridProps) {
  const { isSmallMobile, mobileScale } = useResponsive();

  const gridStyle: React.CSSProperties = {
    display: 'flex',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: isSmallMobile ? 12 : 16,
    padding: '24px 16px 32px',
    maxWidth: 420,
    margin: '0 auto',
  };

  const stickerWrapStyle: React.CSSProperties = {
    position: 'relative',
    transform: `scale(${mobileScale})`,
    transformOrigin: 'center center',
  };

  const initialPos = { x: 0, y: 0, rot: 0 };

  return (
    <div style={gridStyle}>
      {/* Portrait - larger, centered first */}
      <div style={{ width: '100%', display: 'flex', justifyContent: 'center', marginBottom: 8 }}>
        <div style={{ ...stickerWrapStyle, transform: 'scale(1)' }}>
          <PhotoSticker
            id="portrait-m"
            src="/assets/rohan-casual.png"
            w={143}
            h={215}
            initial={initialPos}
            zBase={15}
            noBorder={true}
            onClick={handlers.portraitClick}
            entranceDelay={50}
            style={{ position: 'relative' }}
          />
        </div>
      </div>

      {/* Tags row */}
      <div style={{ width: '100%', display: 'flex', justifyContent: 'center', gap: 12, marginBottom: 8 }}>
        <div style={stickerWrapStyle}>
          <WordSticker
            id="tag-founder-m"
            text="founder"
            initial={initialPos}
            zBase={5}
            bg="#1a1a1a"
            fg="#faf7ef"
            fontSize={11}
            padX={10}
            padY={5}
            entranceDelay={100}
            style={{ position: 'relative' }}
          />
        </div>
        <div style={stickerWrapStyle}>
          <WordSticker
            id="tag-ai-m"
            text="ai · strategist"
            initial={initialPos}
            zBase={5}
            bg="#e85d3a"
            fg="#faf7ef"
            fontSize={11}
            padX={10}
            padY={5}
            entranceDelay={150}
            style={{ position: 'relative' }}
          />
        </div>
      </div>

      {/* Contact stickers */}
      <div style={stickerWrapStyle}>
        <ImageSticker
          id="linkedin-m"
          src="/assets/icons/linkedin.png"
          size={76}
          initial={initialPos}
          zBase={10}
          onClick={handlers.openLinkedIn}
          entranceDelay={200}
          style={{ position: 'relative' }}
        />
      </div>
      <div style={stickerWrapStyle}>
        <EmailSticker
          id="email-m"
          initial={initialPos}
          zBase={10}
          onClick={handlers.openEmail}
          entranceDelay={250}
          style={{ position: 'relative' }}
        />
      </div>

      {/* Location stickers */}
      <div style={stickerWrapStyle}>
        <ImageSticker
          id="charminar-m"
          src="/assets/icons/charminar.png"
          size={90}
          initial={initialPos}
          zBase={8}
          onClick={handlers.charminarFact}
          entranceDelay={400}
          style={{ position: 'relative' }}
        />
      </div>
      <div style={stickerWrapStyle}>
        <ImageSticker
          id="dc-m"
          src="/assets/icons/dc.png"
          size={86}
          initial={initialPos}
          zBase={8}
          onClick={handlers.dcFact}
          entranceDelay={450}
          style={{ position: 'relative' }}
        />
      </div>

      {/* My Work - Laptop sticker */}
      <div style={stickerWrapStyle}>
        <LaptopSticker
          id="laptop-m"
          initial={initialPos}
          zBase={8}
          onClick={handlers.openWork}
          entranceDelay={475}
          style={{ position: 'relative' }}
        />
      </div>

      {/* Writing - Folder sticker */}
      <div style={stickerWrapStyle}>
        <FolderSticker
          id="folder-m"
          initial={initialPos}
          zBase={8}
          onClick={handlers.openWriting}
          entranceDelay={480}
          style={{ position: 'relative' }}
        />
      </div>

      {/* Hobby stickers */}
      <div style={stickerWrapStyle}>
        <AirPodsSticker
          id="airpods-m"
          initial={initialPos}
          zBase={7}
          onPlay={handlers.toggleMusic}
          entranceDelay={500}
          style={{ position: 'relative' }}
        />
      </div>
      <div style={stickerWrapStyle}>
        <ImageSticker
          id="plane-m"
          src="/assets/icons/plane.png"
          size={84}
          initial={initialPos}
          zBase={7}
          onClick={handlers.travelList}
          entranceDelay={550}
          style={{ position: 'relative' }}
        />
      </div>
      <div style={stickerWrapStyle}>
        <ImageSticker
          id="beach-m"
          src="/assets/icons/beach.png"
          size={78}
          initial={initialPos}
          zBase={7}
          onClick={handlers.beachVibes}
          entranceDelay={600}
          style={{ position: 'relative' }}
        />
      </div>
      <div style={stickerWrapStyle}>
        <CameraSticker
          id="camera-m"
          initial={initialPos}
          zBase={7}
          onClick={handlers.cameraVibes}
          entranceDelay={650}
          style={{ position: 'relative' }}
        />
      </div>
      <div style={stickerWrapStyle}>
        <ImageSticker
          id="coffee-m"
          src="/assets/icons/coffee.png"
          size={72}
          initial={initialPos}
          zBase={7}
          onClick={handlers.coffeeVibes}
          entranceDelay={700}
          style={{ position: 'relative' }}
        />
      </div>
      <div style={stickerWrapStyle}>
        <ImageSticker
          id="gym-m"
          src="/assets/icons/gym.png"
          size={76}
          initial={initialPos}
          zBase={7}
          onClick={handlers.gymVibes}
          entranceDelay={750}
          style={{ position: 'relative' }}
        />
      </div>
      <div style={stickerWrapStyle}>
        <PickleballSticker
          id="pickleball-m"
          initial={initialPos}
          zBase={7}
          onClick={handlers.pickleballVibes}
          entranceDelay={800}
          style={{ position: 'relative' }}
        />
      </div>
      <div style={stickerWrapStyle}>
        <LegoSticker
          id="lego-m"
          initial={initialPos}
          zBase={7}
          onClick={handlers.bumpLego}
          entranceDelay={850}
          style={{ position: 'relative' }}
        />
      </div>

      {/* Easter Egg: Coffee Machine */}
      <div
        style={{
          width: '100%',
          marginTop: 24,
          paddingTop: 20,
          borderTop: '1px dashed rgba(160, 140, 80, 0.3)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <div
          style={{
            fontFamily: "'Geist Mono', monospace",
            fontSize: 9,
            color: 'var(--ink-secondary)',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            opacity: 0.6,
          }}
        >
          ↓ easter egg ↓
        </div>
        <div style={{ ...stickerWrapStyle, transform: 'scale(0.9)' }}>
          <CoffeeMachineSticker
            id="coffeeMachine-m"
            initial={initialPos}
            zBase={6}
            onBrew={handlers.brewCoffee}
            entranceDelay={1000}
            style={{ position: 'relative' }}
          />
        </div>
      </div>
    </div>
  );
}
