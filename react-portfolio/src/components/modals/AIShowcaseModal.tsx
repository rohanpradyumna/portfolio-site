'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { useResponsive } from '@/hooks/useDimensions';

interface AIShowcaseModalProps {
  open: boolean;
  onClose: () => void;
}

const AI_TOOLS = [
  { name: 'Claude', desc: 'Primary pair programmer', color: '#d4a574' },
  { name: 'Cursor', desc: 'AI-native IDE', color: '#00d4aa' },
  { name: 'v0', desc: 'UI prototyping', color: '#000000' },
  { name: 'GPT-4', desc: 'Research & ideation', color: '#10a37f' },
];

const PHILOSOPHY_POINTS = [
  'AI writes the first draft, humans craft the final version',
  'Ship ugly, iterate fast, let AI handle the boilerplate',
  'The best code is the code you didn\'t have to write',
  'AI makes engineers reviewers, not typers',
];

export function AIShowcaseModal({ open, onClose }: AIShowcaseModalProps) {
  const { isMobile } = useResponsive();

  if (!open) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.85)',
        backdropFilter: 'blur(8px)',
        zIndex: 10000,
        display: 'flex',
        alignItems: isMobile ? 'flex-end' : 'center',
        justifyContent: 'center',
        padding: isMobile ? 0 : 20,
      }}
    >
      <motion.div
        initial={{ scale: 0.9, y: isMobile ? 100 : 0 }}
        animate={{ scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'linear-gradient(145deg, #1a1816 0%, #252220 100%)',
          borderRadius: isMobile ? '20px 20px 0 0' : 16,
          padding: isMobile ? '28px 24px 40px' : '32px 36px',
          maxWidth: isMobile ? '100%' : 480,
          width: isMobile ? '100%' : 'auto',
          maxHeight: isMobile ? '90vh' : 'none',
          overflow: 'auto',
          border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '0 30px 60px rgba(0,0,0,0.5)',
        }}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: isMobile ? 20 : 16,
            right: isMobile ? 20 : 16,
            background: 'rgba(255,255,255,0.1)',
            border: 'none',
            borderRadius: '50%',
            width: 32,
            height: 32,
            color: 'rgba(255,255,255,0.6)',
            fontSize: 18,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          aria-label="Close"
        >
          ×
        </button>

        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <div
            style={{
              fontSize: 10,
              fontFamily: "'Geist Mono', monospace",
              color: '#d95f3e',
              letterSpacing: '0.15em',
              textTransform: 'uppercase',
              marginBottom: 8,
            }}
          >
            easter egg unlocked
          </div>
          <h2
            style={{
              fontSize: isMobile ? 24 : 28,
              fontFamily: "'Fraunces', Georgia, serif",
              color: '#f5f2e8',
              fontWeight: 400,
              margin: 0,
              lineHeight: 1.2,
            }}
          >
            Built with AI
          </h2>
          <p
            style={{
              fontSize: 13,
              color: 'rgba(245,242,232,0.6)',
              marginTop: 8,
              lineHeight: 1.5,
            }}
          >
            This portfolio was created with AI assistance. Here&apos;s how the sausage is made.
          </p>
        </div>

        {/* AI Tools Grid */}
        <div style={{ marginBottom: 24 }}>
          <div
            style={{
              fontSize: 11,
              fontFamily: "'Geist Mono', monospace",
              color: 'rgba(245,242,232,0.5)',
              marginBottom: 12,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
            }}
          >
            Tools in the Stack
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: 10,
            }}
          >
            {AI_TOOLS.map((tool, i) => (
              <motion.div
                key={tool.name}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  borderRadius: 10,
                  padding: '12px 14px',
                  borderLeft: `3px solid ${tool.color}`,
                }}
              >
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 600,
                    color: '#f5f2e8',
                    marginBottom: 2,
                  }}
                >
                  {tool.name}
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: 'rgba(245,242,232,0.5)',
                  }}
                >
                  {tool.desc}
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Philosophy */}
        <div style={{ marginBottom: 20 }}>
          <div
            style={{
              fontSize: 11,
              fontFamily: "'Geist Mono', monospace",
              color: 'rgba(245,242,232,0.5)',
              marginBottom: 12,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
            }}
          >
            Development Philosophy
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {PHILOSOPHY_POINTS.map((point, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 + i * 0.1 }}
                style={{
                  fontSize: 13,
                  color: 'rgba(245,242,232,0.8)',
                  lineHeight: 1.5,
                  paddingLeft: 16,
                  position: 'relative',
                }}
              >
                <span
                  style={{
                    position: 'absolute',
                    left: 0,
                    color: '#d95f3e',
                  }}
                >
                  →
                </span>
                {point}
              </motion.div>
            ))}
          </div>
        </div>

        {/* Fun fact */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          style={{
            background: 'rgba(217, 95, 62, 0.1)',
            borderRadius: 10,
            padding: '14px 16px',
            border: '1px solid rgba(217, 95, 62, 0.2)',
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontFamily: "'Geist Mono', monospace",
              color: '#d95f3e',
              marginBottom: 6,
            }}
          >
            FUN FACT
          </div>
          <div
            style={{
              fontSize: 13,
              color: 'rgba(245,242,232,0.85)',
              lineHeight: 1.5,
            }}
          >
            This entire portfolio — every component, animation, and interaction — was pair-programmed with Claude. The human wrote ~20% of the code.
          </div>
        </motion.div>

        {/* Signature */}
        <div
          style={{
            marginTop: 20,
            textAlign: 'center',
            fontSize: 10,
            fontFamily: "'Geist Mono', monospace",
            color: 'rgba(245,242,232,0.3)',
          }}
        >
          type &quot;ai&quot; anywhere to see this again
        </div>
      </motion.div>
    </motion.div>
  );
}
