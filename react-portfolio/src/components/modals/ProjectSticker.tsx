'use client';

import React from 'react';
import { Project } from '@/types';
import { useResponsive } from '@/hooks/useDimensions';

interface ProjectStickerProps {
  project: Project;
  isExpanded: boolean;
  onToggle: () => void;
  index: number;
}

export function ProjectSticker({ project, isExpanded, onToggle }: ProjectStickerProps) {
  const { isMobile } = useResponsive();

  return (
    <div
      onClick={onToggle}
      style={{
        background: '#ffffff',
        borderRadius: 14,
        borderLeft: `4px solid ${project.color}`,
        padding: isMobile ? '14px 16px' : '16px 20px',
        cursor: 'pointer',
        boxShadow: isExpanded ? '0 8px 24px rgba(0,0,0,0.15)' : '0 3px 12px rgba(0,0,0,0.08)',
        transition: 'all 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)',
        overflow: 'hidden',
      }}
      role="button"
      aria-expanded={isExpanded}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onToggle();
        }
      }}
    >
      {/* Header - always visible */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{ fontSize: isMobile ? 18 : 20 }}>{project.icon}</span>
            <span
              style={{
                fontSize: isMobile ? 15 : 16,
                fontWeight: 600,
                color: '#1a1a1a',
                fontFamily: "'Geist', sans-serif",
              }}
            >
              {project.name}
            </span>
            {project.subtitle && (
              <span
                style={{
                  fontSize: isMobile ? 10 : 11,
                  color: 'rgba(26,26,26,0.5)',
                  fontWeight: 400,
                }}
              >
                {project.subtitle}
              </span>
            )}
          </div>
          <div
            style={{
              fontSize: isMobile ? 12 : 13,
              color: 'rgba(26,26,26,0.7)',
              lineHeight: 1.4,
              fontFamily: "'Geist', sans-serif",
            }}
          >
            {project.tagline}
          </div>
        </div>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-end',
            gap: 6,
            marginLeft: 12,
          }}
        >
          <span
            style={{
              fontSize: isMobile ? 9 : 10,
              color: project.color,
              fontFamily: "'Geist Mono', monospace",
              fontWeight: 500,
            }}
          >
            {project.period.split('·')[0].trim()}
          </span>
          <span
            style={{
              fontSize: 14,
              color: 'rgba(26,26,26,0.4)',
              transition: 'transform 0.3s ease',
              transform: `rotate(${isExpanded ? 180 : 0}deg)`,
            }}
            aria-hidden="true"
          >
            ▾
          </span>
        </div>
      </div>

      {/* Expanded content */}
      <div
        style={{
          maxHeight: isExpanded ? 200 : 0,
          opacity: isExpanded ? 1 : 0,
          overflow: 'hidden',
          transition: 'all 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)',
          marginTop: isExpanded ? 14 : 0,
        }}
      >
        <div
          style={{
            borderTop: '1px solid rgba(26,26,26,0.1)',
            paddingTop: 14,
          }}
        >
          <div
            style={{
              fontSize: 11,
              color: project.color,
              fontWeight: 600,
              fontFamily: "'Geist Mono', monospace",
              marginBottom: 6,
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
            }}
          >
            {project.role}
          </div>
          <div
            style={{
              fontSize: isMobile ? 12 : 13,
              color: 'rgba(26,26,26,0.8)',
              lineHeight: 1.5,
              fontFamily: "'Geist', sans-serif",
              marginBottom: 12,
            }}
          >
            {project.description}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {project.techStack.map((tech, i) => (
              <span
                key={i}
                style={{
                  fontSize: isMobile ? 10 : 11,
                  padding: '4px 10px',
                  borderRadius: 20,
                  background: `${project.color}15`,
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
      </div>
    </div>
  );
}
