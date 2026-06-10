'use client';

import React, { useCallback, useEffect, useRef } from 'react';
import { PROJECTS } from '@/data/projects';
import { SKILLS } from '@/data/skills';
import { NOW } from '@/data/now';
import { Project } from '@/types';
import styles from './ExperienceTakeover.module.css';

interface ExperienceTakeoverProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Full-screen "what i'm building" takeover. Reuses the Modal a11y contract
 * (role=dialog, focus trap, Escape, body scroll lock) but is intentionally NOT
 * nested inside Modal. It renders as a sibling of <main>, outside the scaled
 * Stage, so it sits at true viewport scale. The panel is the scroll container.
 */
export function ExperienceTakeover({ open, onClose }: ExperienceTakeoverProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  // Autofocus the close button when the takeover opens.
  useEffect(() => {
    if (open && closeButtonRef.current) {
      closeButtonRef.current.focus();
    }
  }, [open]);

  // Body scroll lock while open (the panel itself scrolls).
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  // Escape to close + a real Tab focus trap scoped to the overlay.
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key !== 'Tab' || !overlayRef.current) return;

      const focusable = overlayRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;

      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    },
    [onClose]
  );

  if (!open) return null;

  return (
    <div
      ref={overlayRef}
      className={styles.overlay}
      role="dialog"
      aria-modal="true"
      aria-labelledby="experience-title"
      onKeyDown={handleKeyDown}
    >
      <button
        ref={closeButtonRef}
        type="button"
        className={styles.close}
        onClick={onClose}
        aria-label="Close"
      >
        ✕
      </button>

      <div className={styles.panel}>
        <div className={styles.inner}>
          {/* 1. Header band */}
          <header className={`${styles.section} ${styles.header}`} style={{ '--i': 0 } as React.CSSProperties}>
            <p className={styles.eyebrow}>what i&apos;m building</p>
            <h1 id="experience-title" className={styles.headline}>
              My Experience
            </h1>
          </header>

          {/* 2. NOW hero */}
          <section className={`${styles.section} ${styles.now}`} style={{ '--i': 1 } as React.CSSProperties}>
            <p className={styles.nowRole}>{NOW.role}</p>
            <p className={styles.nowThesis}>{NOW.thesis}</p>
            {NOW.body.map((para, i) => (
              <p key={i} className={styles.nowBody}>
                {para}
              </p>
            ))}
            <ul className={styles.signals}>
              {NOW.signals.map((s) => (
                <li key={s} className={styles.signal}>
                  {s}
                </li>
              ))}
            </ul>
          </section>

          {/* 3. Trajectory */}
          <section className={`${styles.section} ${styles.trajectory}`} style={{ '--i': 2 } as React.CSSProperties}>
            <h2 className={styles.groupLabel}>trajectory</h2>
            <ol className={styles.roleList}>
              {PROJECTS.map((p, i) => (
                <RoleRow key={p.id} project={p} dim={i > 0} />
              ))}
            </ol>
          </section>

          {/* 4. Skills / capabilities */}
          <section className={`${styles.section} ${styles.skills}`} style={{ '--i': 3 } as React.CSSProperties}>
            <h2 className={styles.groupLabel}>capabilities</h2>
            <div className={styles.skillGrid}>
              {SKILLS.map((g) => (
                <div key={g.label} className={styles.skillGroup}>
                  <h3 className={styles.skillGroupLabel}>{g.label}</h3>
                  <ul className={styles.pillRow}>
                    {g.items.map((item) => (
                      <li key={item} className={styles.pill}>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>

          {/* 5. CTA: the deepest engagement point should end with a next step */}
          <section className={`${styles.section} ${styles.ctaSection}`} style={{ '--i': 4 } as React.CSSProperties}>
            <h2 className={styles.groupLabel}>work with me</h2>
            <p className={styles.ctaText}>
              Building an AI product? Need someone who turns messy requirements into shipped code? Let&apos;s talk.
            </p>
            <div className={styles.ctaRow}>
              <a href="mailto:pradyumnarohan@gmail.com" className={styles.ctaPrimary}>
                email me →
              </a>
              <a
                href="https://www.linkedin.com/in/rohanpradyumna/"
                target="_blank"
                rel="noreferrer"
                className={styles.ctaSecondary}
              >
                connect on linkedin
              </a>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function RoleRow({ project, dim }: { project: Project; dim: boolean }) {
  const monogram = project.monogram ?? project.name.slice(0, 2);
  return (
    <li className={`${styles.role} ${dim ? styles.roleDim : ''}`}>
      <div className={styles.mark} style={{ background: project.color }} aria-hidden="true">
        {monogram}
      </div>
      <div className={styles.roleBody}>
        <div className={styles.roleTop}>
          <span className={styles.roleName}>{project.name}</span>
          {project.subtitle && <span className={styles.roleSub}>{project.subtitle}</span>}
          <span className={styles.rolePeriod}>{project.period}</span>
        </div>
        <p className={styles.roleTitle} style={{ color: project.color }}>
          {project.role}
        </p>
        <p className={styles.roleTagline}>{project.description}</p>
        {project.highlights && project.highlights.length > 0 && (
          <ul className={styles.highlights}>
            {project.highlights.map((h) => (
              <li key={h} className={styles.highlight}>
                {h}
              </li>
            ))}
          </ul>
        )}
        <ul className={styles.techRow}>
          {project.techStack.map((t) => (
            <li key={t} className={styles.tech}>
              {t}
            </li>
          ))}
        </ul>
        {project.link && (
          <a className={styles.roleLink} href={project.link.href} target="_blank" rel="noreferrer">
            {project.link.label} →
          </a>
        )}
      </div>
    </li>
  );
}
