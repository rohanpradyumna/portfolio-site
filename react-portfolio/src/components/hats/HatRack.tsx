'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { animate, motion, useMotionValue, useReducedMotion, useSpring } from 'framer-motion';
import { PortraitMood } from '@/lib/council/contract';
import { HAT_LIST } from '@/data/hats';
import { useAudio } from '@/hooks/useAudio';
import { useCanvasFit } from '@/hooks/useCanvasFit';
import { HatId } from './portrait/hats';
import { HatArt, RohanPortrait } from './portrait/RohanPortrait';
import { Takeover } from '@/components/experience/Takeover';
import { HomeMark } from '@/components/ui/HomeMark';
import styles from './HatRack.module.css';

/** Rendered width of a hat on the rack; every flying hat is this box, scaled. */
const RACK_HAT = 84;
const HAT_W = RACK_HAT;
const HAT_H = (RACK_HAT * 128) / 156;
/** Flying hats are drawn this many times rack size and scaled down, so they stay crisp at head size. */
const SHARP = 3;
/*
 * Desktop canvas. Like the board's Stage, the rack is laid out once at this size
 * and scaled uniformly to the viewport, so a 13" laptop and a 27" monitor see the
 * same composition. Phones skip it and stack in normal flow.
 */
const CANVAS_W = 1120;
const CANVAS_H = 800;
const CANVAS_MIN = 0.6;
const CANVAS_MAX = 1.35;
/** Movement before a press becomes a drag instead of a tap. */
const DRAG_START = 5;
/** Let go within this many px of where it was picked up and a rack hat goes back on its peg. */
const RETURN_RADIUS = 70;
/** Within this distance of the head a carried hat is full head size. */
const NEAR_HEAD = 60;
/** How far a hat pulled off the head travels before it is back to rack size. */
const SHRINK_SPAN = 260;

/** Where a hat sits: its unscaled top-left in viewport px, its scale and tilt. */
interface Pose {
  left: number;
  top: number;
  scale: number;
  rotate: number;
}

interface Carry {
  id: HatId;
  pointerId: number;
  fromHead: boolean;
  startX: number;
  startY: number;
  /** Grab point inside the hat, in unscaled px, so it never jumps to the cursor. */
  ox: number;
  oy: number;
  /** Pointer distance to the head at pick-up, so a rack hat starts growing from its own size. */
  span: number;
  /** The hat's size on the rack (smaller on a phone), which it shrinks back to away from the head. */
  base: number;
  moved: boolean;
}

interface Flight {
  key: number;
  id: HatId;
  from: Pose;
  to: Pose;
  dest: 'head' | 'rack';
}

/*
 * Flying hats pivot on their bottom centre, like the hats on the pegs. With that
 * origin a scaled box's top-left moves, so motion x/y are solved from the pose.
 * The box itself is SHARP times rack size, so a pose's scale is divided by SHARP.
 */
const place = (p: Pose) => {
  const k = p.scale / SHARP;
  return {
    x: p.left - ((HAT_W * SHARP) / 2) * (1 - k),
    y: p.top - HAT_H * SHARP * (1 - k),
    scale: k,
    rotate: p.rotate,
  };
};

const restTilt = (id: HatId) => (HAT_LIST.findIndex((h) => h.id === id) % 2 === 0 ? -4 : 5);

interface HatRackProps {
  open: boolean;
  onClose: () => void;
  /** Jump to a product window in "what I've shipped". */
  onOpenProject: (projectId?: string) => void;
}

/** "What you get": put a hat on Rohan, the card shows what you get and the receipt. */
export function HatRack(props: HatRackProps) {
  // Mounted only while open, so every visit starts hatless.
  return props.open ? <OpenRack {...props} /> : null;
}

function OpenRack({ open, onClose, onOpenProject }: HatRackProps) {
  /** The hat the card describes. */
  const [hatId, setHatId] = useState<HatId | null>(null);
  /** The hat drawn on the head right now (empty while one is in the air). */
  const [headHat, setHeadHat] = useState<HatId | null>(null);
  /** A hat in the air on its way to the head: the rack already marks it as chosen. */
  const [incoming, setIncoming] = useState<HatId | null>(null);
  const [mood, setMood] = useState<PortraitMood>('thinking');
  const [flights, setFlights] = useState<Flight[]>([]);
  const [carry, setCarry] = useState<HatId | null>(null);
  const [carryFromHead, setCarryFromHead] = useState(false);
  const [overHead, setOverHead] = useState(false);

  const moodTimer = useRef<number | undefined>(undefined);
  const cardRef = useRef<HTMLDivElement>(null);
  const figureRef = useRef<HTMLDivElement>(null);
  const slotRefs = useRef<Partial<Record<HatId, HTMLButtonElement | null>>>({});
  const carryRef = useRef<Carry | null>(null);
  const flightKey = useRef(0);
  /** The hat most recently sent to the head; an older one that lands first goes home. */
  const latest = useRef<HatId | null>(null);
  const suppressClick = useRef(false);

  const reduce = useReducedMotion();
  const { playTapSound, triggerHaptic } = useAudio();

  const cx = useMotionValue(0);
  const cy = useMotionValue(0);
  const cScale = useMotionValue(1);
  const tilt = useMotionValue(0);
  const cRotate = useSpring(tilt, { stiffness: 300, damping: 20 });

  useEffect(() => () => window.clearTimeout(moodTimer.current), []);

  // Fit the desktop canvas to the viewport (see CANVAS_W).
  const panelRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  useCanvasFit(panelRef, innerRef, { width: CANVAS_W, height: CANVAS_H, min: CANVAS_MIN, max: CANVAS_MAX });

  const hat = HAT_LIST.find((h) => h.id === hatId) ?? null;
  const headHatData = HAT_LIST.find((h) => h.id === headHat) ?? null;
  const inAir = new Set<HatId>([...flights.map((f) => f.id), ...(carry ? [carry] : [])]);

  // ---- Geometry -------------------------------------------------------------

  /** Where a hat sits on the head, at head size. */
  const headPose = (): Pose | null => {
    const svg = figureRef.current?.querySelector('svg');
    if (!svg) return null;
    const r = svg.getBoundingClientRect();
    const k = r.width / 200; // viewBox units to px
    // HatArt's viewBox starts at (22, -30) and is 156 units wide.
    return { left: r.left + 22 * k, top: r.top - 30 * k, scale: (156 * k) / RACK_HAT, rotate: 0 };
  };

  /** Where a hat hangs on its peg. */
  const slotPose = (id: HatId): Pose | null => {
    const btn = slotRefs.current[id];
    const b = btn?.getBoundingClientRect();
    const svg = btn?.querySelector('svg');
    if (!btn || !b || !svg) return null;
    // Rendered size: the CSS width (smaller on a phone) times the canvas scale.
    const k = btn.offsetWidth ? b.width / btn.offsetWidth : 1;
    const w = (parseFloat(getComputedStyle(svg).width) || HAT_W) * k;
    return { left: b.left + (b.width - w) / 2, top: b.top + 8 * k, scale: w / HAT_W, rotate: restTilt(id) };
  };

  const headCentre = () => {
    const p = headPose();
    if (!p) return null;
    return { x: p.left + (HAT_W * p.scale) / 2, y: p.top + (HAT_H * p.scale) / 2, pose: p };
  };

  const isOverHead = (x: number, y: number) => {
    const r = figureRef.current?.querySelector('svg')?.getBoundingClientRect();
    if (!r) return false;
    return x >= r.left && x <= r.right && y >= r.top - 40 && y <= r.top + r.height * 0.62;
  };

  // ---- Outcomes -------------------------------------------------------------

  const speak = () => {
    setMood('speaking');
    window.clearTimeout(moodTimer.current);
    moodTimer.current = window.setTimeout(() => setMood('idle'), 1500);
  };

  const landed = (id: HatId) => {
    if (latest.current !== id) {
      // Something newer is on its way to the head: this one goes home.
      const from = headPose();
      if (from) launch(id, from, 'rack');
      return;
    }
    setIncoming(null);
    setHeadHat(id);
    setHatId(id);
    playTapSound();
    triggerHaptic(12);
    speak();
    // On a phone the card sits below the fold: let the hat land, then bring the card up.
    if (window.matchMedia('(max-width: 768px)').matches) {
      window.setTimeout(() => cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 600);
    }
  };

  const launch = (id: HatId, from: Pose, dest: 'head' | 'rack') => {
    const to = dest === 'head' ? headPose() : slotPose(id);
    if (!to) {
      if (dest === 'head') landed(id);
      return;
    }
    const key = ++flightKey.current;
    setFlights((fs) => [...fs, { key, id, from, to, dest }]);
  };

  const onFlightDone = (f: Flight) => {
    setFlights((fs) => fs.filter((x) => x.key !== f.key));
    if (f.dest === 'head') landed(f.id);
    else playTapSound();
  };

  /** The hat currently on the head flies back to its peg. */
  const sendHeadHatHome = () => {
    const from = headPose();
    if (headHat && from) launch(headHat, from, 'rack');
    setHeadHat(null);
  };

  /** Tap (or Enter) on a hat on the rack. */
  const wearByTap = (id: HatId) => {
    const from = slotPose(id);
    if (!from) return;
    if (headHat && headHat !== id) sendHeadHatHome();
    latest.current = id;
    setIncoming(id);
    playTapSound();
    launch(id, from, 'head');
  };

  /** Tap on the faded hat whose peg is empty: take it off. */
  const takeOff = () => {
    latest.current = null;
    setIncoming(null);
    sendHeadHatHome();
    setHatId(null);
    setMood('thinking');
  };

  // ---- Carrying ---------------------------------------------------------------

  const startCarry = (e: React.PointerEvent<HTMLElement>, id: HatId, fromHead: boolean) => {
    if (e.button !== 0 || carryRef.current) return;
    // Stops the browser starting a text selection; the click still fires.
    e.preventDefault();
    const centre = headCentre();
    const rack = slotPose(id);
    const pose = fromHead ? centre?.pose : rack;
    if (!pose || !centre || !rack) return;
    carryRef.current = {
      id,
      pointerId: e.pointerId,
      fromHead,
      startX: e.clientX,
      startY: e.clientY,
      ox: (e.clientX - pose.left) / pose.scale,
      oy: (e.clientY - pose.top) / pose.scale,
      span: fromHead ? SHRINK_SPAN : Math.max(Math.hypot(e.clientX - centre.x, e.clientY - centre.y) - NEAR_HEAD, 80),
      base: rack.scale,
      moved: false,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const moveCarry = (e: React.PointerEvent<HTMLElement>) => {
    const c = carryRef.current;
    if (!c || c.pointerId !== e.pointerId) return;
    const centre = headCentre();
    if (!centre) return;

    if (!c.moved) {
      if (Math.hypot(e.clientX - c.startX, e.clientY - c.startY) < DRAG_START) return;
      c.moved = true;
      const startRot = c.fromHead ? 0 : restTilt(c.id);
      tilt.set(startRot);
      cRotate.jump(startRot);
      setCarry(c.id);
      setCarryFromHead(c.fromHead);
      if (c.fromHead) setHeadHat(null);
      setMood('thinking');
      playTapSound();
    }

    // Grows toward head size as it nears the head, shrinks as it leaves.
    const d = Math.hypot(e.clientX - centre.x, e.clientY - centre.y);
    const near = Math.min(1, Math.max(0, 1 - (d - NEAR_HEAD) / c.span));
    const scale = c.base + (centre.pose.scale - c.base) * near * near * (3 - 2 * near);
    const p = place({ left: e.clientX - c.ox * scale, top: e.clientY - c.oy * scale, scale, rotate: 0 });
    cx.set(p.x);
    cy.set(p.y);
    cScale.set(p.scale);
    // Swing with the motion, like a hat held by the brim.
    tilt.set(Math.max(-16, Math.min(16, e.movementX * 1.6)));

    const over = isOverHead(e.clientX, e.clientY);
    if (over !== overHead) {
      setOverHead(over);
      setMood(over ? 'challenged' : 'thinking');
      if (over) triggerHaptic(6);
    }
  };

  const flyCarry = async (to: Pose) => {
    const t = place(to);
    const opts = reduce ? { duration: 0 } : { type: 'spring' as const, stiffness: 380, damping: 30 };
    tilt.set(to.rotate);
    await Promise.all([animate(cx, t.x, opts), animate(cy, t.y, opts), animate(cScale, t.scale, opts)]);
  };

  /** Let go (or cancel) a carried hat. `at` is null for a cancel. */
  const endCarry = async (at: { x: number; y: number } | null) => {
    const c = carryRef.current;
    carryRef.current = null;
    if (!c?.moved) return;
    suppressClick.current = true;
    window.setTimeout(() => (suppressClick.current = false), 0);
    setOverHead(false);

    const head = headPose();
    const home = slotPose(c.id);
    if (!head || !home) {
      setCarry(null);
      return;
    }

    if (c.fromHead) {
      if (at === null || isOverHead(at.x, at.y)) {
        await flyCarry(head);
        setHeadHat(c.id);
        setMood('idle');
      } else {
        // Pulled off: the card empties now, the hat goes home.
        latest.current = null;
        setIncoming(null);
        setHatId(null);
        setMood('thinking');
        await flyCarry(home);
        playTapSound();
      }
      setCarry(null);
      return;
    }

    const stayed = at === null || Math.hypot(at.x - c.startX, at.y - c.startY) < RETURN_RADIUS;
    if (stayed) {
      await flyCarry(home);
      setMood(headHat ? 'idle' : 'thinking');
      setCarry(null);
      return;
    }
    if (headHat && headHat !== c.id) sendHeadHatHome();
    latest.current = c.id;
    setIncoming(c.id);
    await flyCarry(head);
    setCarry(null);
    landed(c.id);
  };

  // Escape while carrying puts the hat back instead of closing the takeover.
  const endCarryRef = useRef(endCarry);
  useEffect(() => {
    endCarryRef.current = endCarry;
  });
  useEffect(() => {
    if (!carry) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      e.stopPropagation();
      endCarryRef.current(null);
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [carry]);

  const carryHandlers = {
    onPointerMove: moveCarry,
    onPointerUp: (e: React.PointerEvent<HTMLElement>) => {
      if (carryRef.current?.pointerId === e.pointerId) endCarry({ x: e.clientX, y: e.clientY });
    },
    onPointerCancel: () => endCarry(null),
    onDragStart: (e: React.DragEvent) => e.preventDefault(),
  };

  const onRailKey = useCallback((e: React.KeyboardEvent<HTMLUListElement>) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    const buttons = Array.from(e.currentTarget.querySelectorAll<HTMLButtonElement>('button'));
    const i = buttons.indexOf(document.activeElement as HTMLButtonElement);
    if (i < 0) return;
    e.preventDefault();
    const next = e.key === 'ArrowRight' ? (i + 1) % buttons.length : (i - 1 + buttons.length) % buttons.length;
    buttons[next].focus();
  }, []);

  const hint = carryFromHead
    ? overHead
      ? 'keep it on'
      : 'let go to hang it up'
    : overHead
      ? 'let go!'
      : 'drop it on my head';

  return (
    <Takeover
      open={open}
      onClose={onClose}
      labelledBy="hats-title"
      className={`${styles.overlay} ${carry ? styles.carrying : ''}`}
    >
      {flights.map((f) => (
        <motion.div
          key={f.key}
          className={styles.ghost}
          initial={place(f.from)}
          animate={place(f.to)}
          transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 260, damping: 26 }}
          onAnimationComplete={() => onFlightDone(f)}
          aria-hidden="true"
        >
          <HatArt hat={f.id} size={RACK_HAT * SHARP} />
        </motion.div>
      ))}

      {carry && (
        <motion.div
          className={styles.ghost}
          style={{ x: cx, y: cy, scale: cScale, rotate: cRotate }}
          aria-hidden="true"
        >
          <HatArt hat={carry} size={RACK_HAT * SHARP} />
        </motion.div>
      )}

      {/* Outside the scrolling panel, so it stays put like the board's own header. */}
      <HomeMark pinned onClick={onClose} />

      <div ref={panelRef} className={`${styles.panel} ${carry ? styles.dragging : ''}`}>
        <div ref={innerRef} className={styles.inner}>
          <header className={styles.header}>
            <h1 id="hats-title" className={styles.title}>
              What you get
            </h1>
            <p className={styles.sub}>
              Pick a hat: drag one onto my head, or just tap it. Five versions of me, one hire, and each hat comes with
              a receipt.
            </p>
          </header>

          <div className={styles.stage}>
            <div className={styles.portrait} style={{ '--hat': headHatData?.accent } as React.CSSProperties}>
              {carry && (
                <span className={`${styles.dropHint} ${overHead ? styles.dropHintHot : ''}`} aria-hidden="true">
                  {hint}
                </span>
              )}
              <div ref={figureRef} className={styles.figure}>
                <RohanPortrait size={300} hat={headHat} mood={mood} entry="settle" className={styles.portraitSvg} />
                {/* Stays mounted while its hat is carried off, or the pointer capture is lost. */}
                {(headHat || (carry && carryFromHead)) && (
                  <div
                    className={styles.headHandle}
                    onPointerDown={(e) => headHat && startCarry(e, headHat, true)}
                    {...carryHandlers}
                    aria-hidden="true"
                  />
                )}
                {headHatData && headHat === hatId && !carry && (
                  <p key={headHatData.id} className={styles.bubble}>
                    {headHatData.line}
                  </p>
                )}
              </div>
            </div>

            <div className={styles.side}>
              <div className={styles.rack}>
                <ul className={styles.rail} aria-label="Hats" onKeyDown={onRailKey}>
                  {HAT_LIST.map((h) => {
                    const worn = h.id === headHat;
                    const chosen = h.id === (incoming ?? headHat);
                    const away = inAir.has(h.id);
                    return (
                      <li key={h.id} className={styles.slot}>
                        <button
                          ref={(el) => {
                            slotRefs.current[h.id] = el;
                          }}
                          type="button"
                          className={`${styles.hatButton} ${worn ? styles.worn : ''} ${chosen ? styles.chosen : ''} ${away ? styles.lifted : ''}`}
                          onClick={() => {
                            if (suppressClick.current || carry || away) return;
                            if (worn) takeOff();
                            else wearByTap(h.id);
                          }}
                          onPointerDown={(e) => {
                            if (!worn && !away) startCarry(e, h.id, false);
                          }}
                          {...carryHandlers}
                          aria-pressed={h.id === hatId}
                          aria-label={worn ? `Take off the ${h.label} hat` : `Wear the ${h.label} hat`}
                        >
                          <span className={styles.hatArt}>
                            <HatArt hat={h.id} size={RACK_HAT} />
                          </span>
                          <span className={styles.peg} aria-hidden="true" />
                          <span className={styles.hatLabel}>{h.label}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
                <div className={styles.bar} aria-hidden="true" />
              </div>

              <div
                ref={cardRef}
                className={`${styles.card} ${hat ? '' : styles.cardEmpty} ${carry && carryFromHead && !overHead ? styles.cardLeaving : ''}`}
                style={{ '--hat': hat?.accent } as React.CSSProperties}
              >
                <p className={styles.srOnly} aria-live="polite">
                  {hat ? `${hat.label}. ${hat.youGet}` : ''}
                </p>
                {/* Once a hat is on, every hat's card is stacked in one grid cell, so the box is
                    as tall as the tallest one and nothing below it jumps when you swap hats. */}
                {!hat ? (
                  <p className={styles.emptyCard}>
                    Hatless, for now. Drag one onto my head to see what you get when I wear it.
                  </p>
                ) : (
                  <div className={styles.cardStack}>
                    {HAT_LIST.map((h) => (
                      <div
                        key={h.id}
                        className={`${styles.layer} ${h.id === hatId ? styles.layerOn : ''}`}
                        aria-hidden={h.id !== hatId}
                      >
                        <h2 className={styles.cardTitle}>{h.label}</h2>
                        <p className={styles.kicker}>You get</p>
                        <p className={styles.youGet}>{h.youGet}</p>
                        <div className={styles.receipt}>
                          <p className={styles.kicker}>Receipt</p>
                          <p className={styles.receiptText}>{h.receipt}</p>
                          {'projectId' in h.proof ? (
                            <button
                              type="button"
                              className={styles.proof}
                              onClick={() => 'projectId' in h.proof && onOpenProject(h.proof.projectId)}
                            >
                              {h.proof.label}
                            </button>
                          ) : (
                            <a className={styles.proof} href={h.proof.href}>
                              {h.proof.label}
                            </a>
                          )}
                        </div>
                        <ul className={styles.skills}>
                          {h.skills.map((sk) => (
                            <li key={sk} className={styles.skill}>
                              {sk}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <footer className={styles.footer}>
              <p className={styles.footText}>Need the whole wardrobe?</p>
              <a href="mailto:pradyumnarohan@gmail.com" className={styles.ctaPrimary}>
                email me
              </a>
              <button type="button" className={styles.ctaSecondary} onClick={() => onOpenProject()}>
                see what I&apos;ve shipped
              </button>
            </footer>
          </div>
        </div>
      </div>
    </Takeover>
  );
}
