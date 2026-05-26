'use client';

import React, { useState, useCallback } from 'react';
import { motion, PanInfo, AnimatePresence } from 'framer-motion';
import { useResponsive } from '@/hooks/useDimensions';
import { useAudio } from '@/hooks/useAudio';
import { Project } from '@/types';

interface WorkCardStackProps {
  projects: Project[];
}

const cardSpring = {
  type: 'spring' as const,
  stiffness: 350,
  damping: 30,
};

export function WorkCardStack({ projects }: WorkCardStackProps) {
  const [idx, setIdx] = useState(0);
  const [direction, setDirection] = useState<'next' | 'prev' | null>(null);
  const { isMobile } = useResponsive();
  const { playShuffleSound } = useAudio();

  const DRAG_THRESHOLD = 60;

  const next = useCallback(() => {
    if (idx >= projects.length - 1) return;
    playShuffleSound();
    setDirection('next');
    setIdx((i) => i + 1);
  }, [idx, projects.length, playShuffleSound]);

  const prev = useCallback(() => {
    if (idx <= 0) return;
    playShuffleSound();
    setDirection('prev');
    setIdx((i) => i - 1);
  }, [idx, playShuffleSound]);

  const handleDragEnd = (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    const velocity = info.velocity.x;
    const offset = info.offset.x;

    if (offset < -DRAG_THRESHOLD || velocity < -400) {
      next();
    } else if (offset > DRAG_THRESHOLD || velocity > 400) {
      prev();
    }
  };

  const project = projects[idx];

  const slideVariants = {
    enter: (dir: 'next' | 'prev' | null) => ({
      x: dir === 'next' ? 300 : dir === 'prev' ? -300 : 0,
      opacity: 0,
      scale: 0.9,
    }),
    center: {
      x: 0,
      opacity: 1,
      scale: 1,
    },
    exit: (dir: 'next' | 'prev' | null) => ({
      x: dir === 'next' ? -300 : dir === 'prev' ? 300 : 0,
      opacity: 0,
      scale: 0.9,
    }),
  };

  return (
    <div style={{ position: 'relative', minHeight: isMobile ? 340 : 320 }}>
      {/* Navigation header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 16,
        }}
      >
        <motion.button
          onClick={prev}
          disabled={idx === 0}
          style={{
            background: idx === 0 ? 'rgba(245,242,232,0.05)' : 'rgba(245,242,232,0.1)',
            border: '1px solid rgba(245,242,232,0.2)',
            color: idx === 0 ? 'rgba(245,242,232,0.3)' : 'rgba(245,242,232,0.9)',
            width: 36,
            height: 36,
            borderRadius: 18,
            cursor: idx === 0 ? 'not-allowed' : 'pointer',
            fontSize: 18,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          whileHover={idx > 0 ? { scale: 1.1, background: 'rgba(245,242,232,0.15)' } : {}}
          whileTap={idx > 0 ? { scale: 0.95 } : {}}
          aria-label="Previous project"
        >
          ‹
        </motion.button>

        <div
          style={{
            fontFamily: "'Geist Mono', monospace",
            fontSize: 11,
            color: 'rgba(245,242,232,0.5)',
            letterSpacing: '0.05em',
          }}
        >
          {String(idx + 1).padStart(2, '0')} / {String(projects.length).padStart(2, '0')}
        </div>

        <motion.button
          onClick={next}
          disabled={idx === projects.length - 1}
          style={{
            background: idx === projects.length - 1 ? 'rgba(245,242,232,0.05)' : 'rgba(245,242,232,0.1)',
            border: '1px solid rgba(245,242,232,0.2)',
            color: idx === projects.length - 1 ? 'rgba(245,242,232,0.3)' : 'rgba(245,242,232,0.9)',
            width: 36,
            height: 36,
            borderRadius: 18,
            cursor: idx === projects.length - 1 ? 'not-allowed' : 'pointer',
            fontSize: 18,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          whileHover={idx < projects.length - 1 ? { scale: 1.1, background: 'rgba(245,242,232,0.15)' } : {}}
          whileTap={idx < projects.length - 1 ? { scale: 0.95 } : {}}
          aria-label="Next project"
        >
          ›
        </motion.button>
      </div>

      {/* Card container */}
      <div style={{ position: 'relative', overflow: 'hidden', borderRadius: 14 }}>
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={project.id}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={cardSpring}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.8}
            onDragEnd={handleDragEnd}
            style={{
              background: '#ffffff',
              borderRadius: 14,
              overflow: 'hidden',
              cursor: 'grab',
              touchAction: 'pan-y',
            }}
            whileDrag={{ cursor: 'grabbing', scale: 1.02 }}
          >
            {/* Project header with accent color */}
            <div
              style={{
                background: project.color,
                padding: isMobile ? '16px 18px' : '20px 24px',
                color: '#ffffff',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                <span style={{ fontSize: isMobile ? 22 : 26 }}>{project.icon}</span>
                <div>
                  <div
                    style={{
                      fontSize: isMobile ? 18 : 22,
                      fontWeight: 600,
                      fontFamily: "'Fraunces', Georgia, serif",
                      letterSpacing: '-0.01em',
                    }}
                  >
                    {project.name}
                  </div>
                  {project.subtitle && (
                    <div
                      style={{
                        fontSize: isMobile ? 10 : 11,
                        opacity: 0.8,
                        fontFamily: "'Geist Mono', monospace",
                      }}
                    >
                      {project.subtitle}
                    </div>
                  )}
                </div>
              </div>

              {/* Key metric highlight */}
              <div
                style={{
                  fontSize: isMobile ? 14 : 16,
                  fontWeight: 500,
                  marginTop: 8,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <span style={{ opacity: 0.7 }}>→</span>
                {project.tagline}
              </div>
            </div>

            {/* Project body */}
            <div style={{ padding: isMobile ? '16px 18px' : '20px 24px' }}>
              {/* Role & Period */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 14,
                }}
              >
                <span
                  style={{
                    fontSize: isMobile ? 10 : 11,
                    color: project.color,
                    fontWeight: 600,
                    fontFamily: "'Geist Mono', monospace",
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                  }}
                >
                  {project.role}
                </span>
                <span
                  style={{
                    fontSize: isMobile ? 9 : 10,
                    color: 'rgba(26,26,26,0.5)',
                    fontFamily: "'Geist Mono', monospace",
                  }}
                >
                  {project.period}
                </span>
              </div>

              {/* Description */}
              <div
                style={{
                  fontSize: isMobile ? 13 : 14,
                  color: 'rgba(26,26,26,0.85)',
                  lineHeight: 1.6,
                  fontFamily: "'Inter', sans-serif",
                  marginBottom: 16,
                }}
              >
                {project.description}
              </div>

              {/* Tech stack pills */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {project.techStack.map((tech, i) => (
                  <span
                    key={i}
                    style={{
                      fontSize: isMobile ? 10 : 11,
                      padding: '5px 12px',
                      borderRadius: 20,
                      background: `${project.color}12`,
                      color: project.color,
                      fontFamily: "'Geist Mono', monospace",
                      fontWeight: 500,
                    }}
                  >
                    {tech}
                  </span>
                ))}
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Progress dots */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          gap: 8,
          marginTop: 16,
        }}
      >
        {projects.map((_, i) => (
          <motion.button
            key={i}
            onClick={() => {
              if (i !== idx) {
                playShuffleSound();
                setDirection(i > idx ? 'next' : 'prev');
                setIdx(i);
              }
            }}
            style={{
              width: i === idx ? 20 : 8,
              height: 8,
              borderRadius: 4,
              background: i === idx ? projects[i].color : 'rgba(245,242,232,0.3)',
              border: 'none',
              cursor: 'pointer',
              padding: 0,
            }}
            whileHover={{ scale: 1.2 }}
            whileTap={{ scale: 0.9 }}
            animate={{ width: i === idx ? 20 : 8 }}
            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
            aria-label={`Go to project ${i + 1}`}
          />
        ))}
      </div>

      {/* Swipe hint */}
      <div
        style={{
          textAlign: 'center',
          marginTop: 12,
          fontSize: 10,
          color: 'rgba(245,242,232,0.4)',
          fontFamily: "'Geist Mono', monospace",
          letterSpacing: '0.05em',
        }}
      >
        swipe or tap arrows
      </div>
    </div>
  );
}
