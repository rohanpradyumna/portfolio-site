'use client';

import React from 'react';
import { Card } from '@/types';

interface CardBodyProps {
  card: Card;
  isMobile: boolean;
}

const titleStyle = {
  fontFamily: "'Instrument Serif', serif",
  fontSize: 30,
  fontStyle: 'italic' as const,
  color: '#f5f2e8',
  letterSpacing: '-0.01em',
};

const footStyle = {
  marginTop: 14,
  fontFamily: "'Geist Mono', monospace",
  fontSize: 11,
  color: 'rgba(245,242,232,0.5)',
  letterSpacing: '0.05em',
  textTransform: 'uppercase' as const,
};

const ctaBtn = {
  display: 'inline-block',
  padding: '8px 14px',
  background: '#e85d3a',
  color: '#faf7ef',
  fontFamily: "'Geist Mono', monospace",
  fontSize: 12,
  fontWeight: 600,
  borderRadius: 8,
  textDecoration: 'none',
  letterSpacing: '0.02em',
};

export function CardBody({ card, isMobile }: CardBodyProps) {
  const mTitleStyle = {
    ...titleStyle,
    fontSize: isMobile ? 24 : 30,
  };
  const mFootStyle = {
    ...footStyle,
    fontSize: isMobile ? 10 : 11,
    marginTop: isMobile ? 10 : 14,
  };
  const mCtaBtn = {
    ...ctaBtn,
    padding: isMobile ? '12px 18px' : '8px 14px',
    fontSize: isMobile ? 13 : 12,
    minWidth: isMobile ? 44 : 'auto',
    minHeight: isMobile ? 44 : 'auto',
  };

  if (card.kind === 'intro') {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <div
          style={{
            fontFamily: "'Geist Mono', monospace",
            fontSize: isMobile ? 16 : 19,
            lineHeight: 1.5,
            fontWeight: 500,
            textWrap: 'pretty' as 'pretty',
          }}
        >
          {card.body}
        </div>
        <div style={mFootStyle}>{card.foot}</div>
      </div>
    );
  }

  if (card.kind === 'quote') {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <div
          style={{
            fontFamily: "'Instrument Serif', serif",
            fontSize: isMobile ? 22 : 28,
            lineHeight: 1.25,
            fontStyle: 'italic',
            color: '#f5f2e8',
            textWrap: 'balance' as 'balance',
          }}
        >
          {card.body}
        </div>
        <div style={mFootStyle}>{card.foot}</div>
      </div>
    );
  }

  if (card.kind === 'cta') {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <div style={mTitleStyle}>{card.title}</div>
        <div
          style={{
            fontFamily: "'Geist Mono', monospace",
            fontSize: isMobile ? 12 : 14,
            lineHeight: 1.55,
            color: 'rgba(245,242,232,0.85)',
            marginTop: isMobile ? 8 : 10,
            textWrap: 'pretty' as 'pretty',
          }}
        >
          {card.body}
        </div>
        <div style={{ marginTop: isMobile ? 16 : 14 }}>
          <a href="mailto:pradyumnarohan@gmail.com" style={mCtaBtn}>
            {card.foot} →
          </a>
        </div>
      </div>
    );
  }

  // bullets
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
      <div style={mTitleStyle}>{card.title}</div>
      <ul style={{ listStyle: 'none', padding: 0, margin: isMobile ? '8px 0 0' : '10px 0 0' }}>
        {card.items.map((t, i) => (
          <li
            key={i}
            style={{
              fontFamily: "'Geist Mono', monospace",
              fontSize: isMobile ? 12 : 13.5,
              lineHeight: 1.55,
              color: 'rgba(245,242,232,0.92)',
              padding: isMobile ? '4px 0' : '5px 0',
              display: 'flex',
              gap: isMobile ? 8 : 10,
            }}
          >
            <span style={{ color: '#e85d3a', flexShrink: 0 }}>▸</span>
            <span style={{ textWrap: 'pretty' as 'pretty' }}>{t}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
