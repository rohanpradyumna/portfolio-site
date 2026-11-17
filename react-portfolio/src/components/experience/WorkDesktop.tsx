'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  AnimatePresence,
  MotionValue,
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from 'framer-motion';
import { PROJECTS } from '@/data/projects';
import { Project } from '@/types';
import { Takeover } from './Takeover';
import { HomeMark } from '@/components/ui/HomeMark';
import { useCanvasFit } from '@/hooks/useCanvasFit';
import styles from './WorkDesktop.module.css';

interface WorkDesktopProps {
  open: boolean;
  onClose: () => void;
  /** Window to show first (the hat rack deep-links here). Defaults to the first project. */
  initialProjectId?: string;
}

const ICON = 56;
const ICON_MAX = 84;
/** The canvas below the menu bar (see useCanvasFit). */
const CANVAS = { width: 1280, height: 700, min: 0.6, max: 1.35 };
const REACH = 150;

/** "What I've shipped": a Mac-style desktop with a Dock of products. */
export function WorkDesktop(props: WorkDesktopProps) {
  // Mounted only while open, so each open (or deep link) starts on its window.
  if (!props.open) return null;
  return <OpenDesktop key={props.initialProjectId ?? 'default'} {...props} />;
}

function OpenDesktop({ open, onClose, initialProjectId }: WorkDesktopProps) {
  const [activeId, setActiveId] = useState<string | null>(initialProjectId ?? PROJECTS[0].id);
  const mouseX = useMotionValue(Infinity);
  const reduce = useReducedMotion();
  const [canMagnify, setCanMagnify] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  useCanvasFit(stageRef, canvasRef, CANVAS);

  useEffect(() => {
    const mq = window.matchMedia('(hover: hover) and (pointer: fine) and (min-width: 769px)');
    const sync = () => setCanMagnify(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  const magnify = canMagnify && !reduce;
  const active = PROJECTS.find((p) => p.id === activeId) ?? null;

  const onDockKey = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    const buttons = Array.from(e.currentTarget.querySelectorAll<HTMLButtonElement>('button'));
    const i = buttons.indexOf(document.activeElement as HTMLButtonElement);
    if (i < 0) return;
    e.preventDefault();
    const next = e.key === 'ArrowRight' ? (i + 1) % buttons.length : (i - 1 + buttons.length) % buttons.length;
    buttons[next].focus();
  };

  return (
    <Takeover open={open} onClose={onClose} labelledBy="work-title" className={styles.overlay}>
      <div className={styles.menuBar}>
        <HomeMark onClick={onClose} className={styles.menuMark} />
        <h1 id="work-title" className={styles.menuTitle}>
          What I&apos;ve shipped
        </h1>
        <span className={styles.menuItem} aria-hidden="true">
          {active ? active.name : 'Finder'}
        </span>
        <div className={styles.menuRight}>
          <a href="mailto:pradyumnarohan@gmail.com" className={styles.menuCta}>
            email me
          </a>
          <a
            href="https://www.linkedin.com/in/rohanpradyumna/"
            target="_blank"
            rel="noreferrer"
            className={styles.menuLink}
          >
            linkedin
          </a>
        </div>
      </div>

      {/* Below the menu bar: one canvas, scaled to fit like the board's Stage. */}
      <div ref={stageRef} className={styles.stage}>
        <div ref={canvasRef} className={styles.canvas}>
      <div className={styles.desktop}>
        <AnimatePresence mode="wait" initial={false}>
          {active ? (
            <ProjectWindow key={active.id} project={active} onClose={() => setActiveId(null)} />
          ) : (
            <motion.p
              key="empty"
              className={styles.empty}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              pick a product from the Dock
            </motion.p>
          )}
        </AnimatePresence>
      </div>

      <nav className={styles.dockWrap} aria-label="Products">
        <div
          className={styles.dock}
          onMouseMove={magnify ? (e) => mouseX.set(e.clientX) : undefined}
          onMouseLeave={() => mouseX.set(Infinity)}
          onKeyDown={onDockKey}
        >
          {PROJECTS.map((p) => (
            <DockIcon
              key={p.id}
              project={p}
              mouseX={mouseX}
              magnify={magnify}
              active={p.id === activeId}
              onOpen={() => setActiveId(p.id)}
            />
          ))}
        </div>
      </nav>
        </div>
      </div>
    </Takeover>
  );
}

function DockIcon({
  project,
  mouseX,
  magnify,
  active,
  onOpen,
}: {
  project: Project;
  mouseX: MotionValue<number>;
  magnify: boolean;
  active: boolean;
  onOpen: () => void;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  // Width (not scale) so neighbours make room, like the real Dock. Five
  // buttons laying out per frame is cheap.
  const distance = useTransform(mouseX, (x) => {
    const b = ref.current?.getBoundingClientRect();
    return b ? x - b.left - b.width / 2 : Infinity;
  });
  const target = useTransform(distance, [-REACH, 0, REACH], [ICON, ICON_MAX, ICON], { clamp: true });
  const size = useSpring(target, { mass: 0.1, stiffness: 180, damping: 14 });

  return (
    <motion.button
      ref={ref}
      type="button"
      className={styles.dockIcon}
      style={magnify ? { width: size, height: size } : undefined}
      onClick={onOpen}
      aria-label={`${project.name}${project.company ? `, ${project.company}` : ''}`}
      aria-pressed={active}
    >
      <span className={styles.tooltip} aria-hidden="true">
        {project.name}
      </span>
      {project.logo ? (
        <img src={project.logo} alt="" className={styles.tileImg} draggable={false} />
      ) : (
        <span className={styles.tile} style={{ background: project.color }} aria-hidden="true">
          {project.monogram ?? project.name.slice(0, 2)}
        </span>
      )}
      {active && <span className={styles.activeDot} aria-hidden="true" />}
    </motion.button>
  );
}

function ProjectWindow({ project, onClose }: { project: Project; onClose: () => void }) {
  const brief = project.brief;
  const titleId = `win-${project.id}`;

  return (
    <motion.section
      className={styles.window}
      style={{ '--app': project.color } as React.CSSProperties}
      aria-labelledby={titleId}
      initial={{ opacity: 0, scale: 0.94, y: 24 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97, y: 8 }}
      transition={{ type: 'spring', stiffness: 420, damping: 34, mass: 0.8 }}
    >
      <div className={styles.titleBar}>
        <div className={styles.lights}>
          <button
            type="button"
            className={`${styles.light} ${styles.lightRed}`}
            onClick={onClose}
            aria-label={`Close ${project.name} window`}
          />
          <span className={`${styles.light} ${styles.lightYellow}`} aria-hidden="true" />
          <span className={`${styles.light} ${styles.lightGreen}`} aria-hidden="true" />
        </div>
        <span className={styles.titleText}>
          {project.name}
          {project.company ? ` · ${project.company}` : ''}
        </span>
      </div>

      <div className={styles.windowBody}>
        <header className={styles.winHeader}>
          <span className={styles.winTile} style={{ background: project.color }} aria-hidden="true">
            {project.monogram ?? project.name.slice(0, 2)}
          </span>
          <div className={styles.winHeadText}>
            <p className={styles.winPeriod}>{project.period}</p>
            <h2 id={titleId} className={styles.winName}>
              {project.name}
            </h2>
            <p className={styles.winTagline}>{project.tagline}</p>
          </div>
        </header>

        <p className={styles.winRole} style={{ color: project.color }}>
          {project.role}
        </p>

        {brief ? (
          <dl className={styles.brief}>
            <BriefRow label="The problem" text={brief.problem} />
            <BriefRow label="What I owned" text={brief.owned} />
            <BriefRow label="The call I made" text={brief.call} accent={project.color} />
            <BriefRow label="What happened" text={brief.result} />
            {brief.differently && <BriefRow label="What I'd do differently" text={brief.differently} />}
          </dl>
        ) : (
          <p className={styles.briefText}>{project.description}</p>
        )}

        {project.techStack.length > 0 && (
          <ul className={styles.techRow}>
            {project.techStack.map((t) => (
              <li key={t} className={styles.tech}>
                {t}
              </li>
            ))}
          </ul>
        )}
      </div>
    </motion.section>
  );
}

function BriefRow({ label, text, accent }: { label: string; text: string; accent?: string }) {
  return (
    <div className={styles.briefRow} style={accent ? ({ '--row-accent': accent } as React.CSSProperties) : undefined}>
      <dt className={styles.briefLabel}>{label}</dt>
      <dd className={`${styles.briefText} ${accent ? styles.briefCall : ''}`}>{text}</dd>
    </div>
  );
}
