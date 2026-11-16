import React from 'react';
import styles from './portraits.module.css';

// Shared drawing kit for the council portraits. Every seat is built from the
// same handful of primitives so the six read as one sticker set: one outline
// weight, one eye construction, one die-cut border offset.

export const INK = '#2a251f';
export const CREAM = '#fdfbf7';

export const VB_W = 200;
export const VB_H = 240;

/** Outline weight around every filled shape, in viewBox units. */
export const OUT = 5;
/** Interior feature lines (nose, folds, curls). */
export const DETAIL = 3.5;
/** Width of the cream die-cut ring beyond the ink outline. */
export const RING = 8;

/** Face anchor points shared by all six heads. */
export const FACE = { cx: 100, eyeY: 111, eyeDx: 19 } as const;

const r1 = (n: number) => Math.round(n * 10) / 10;

export const circ = (x: number, y: number, r: number) =>
  `M${r1(x - r)} ${r1(y)}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0Z`;

export const ell = (x: number, y: number, rx: number, ry: number, rot = 0) => {
  const c = Math.cos((rot * Math.PI) / 180);
  const s = Math.sin((rot * Math.PI) / 180);
  const x1 = r1(x - rx * c);
  const y1 = r1(y - rx * s);
  const x2 = r1(x + rx * c);
  const y2 = r1(y + rx * s);
  return `M${x1} ${y1}A${rx} ${ry} ${rot} 1 0 ${x2} ${y2}A${rx} ${ry} ${rot} 1 0 ${x1} ${y1}Z`;
};

/** A pointed leaf whose stem sits at (x, y), pointing along `deg` (screen degrees). */
export const leaf = (x: number, y: number, deg: number, len = 20, wid = 6) => {
  const c = Math.cos((deg * Math.PI) / 180);
  const s = Math.sin((deg * Math.PI) / 180);
  const p = (lx: number, ly: number) => `${r1(x + lx * c - ly * s)} ${r1(y + lx * s + ly * c)}`;
  return `M${p(0, 0)}C${p(len * 0.25, -wid)} ${p(len * 0.7, -wid)} ${p(len, 0)}C${p(len * 0.7, wid)} ${p(len * 0.25, wid)} ${p(0, 0)}Z`;
};

/** Mirror a path made only of absolute M/L/C/Q/Z commands around x = 100. */
export const mirror = (d: string) =>
  d.replace(/(-?\d+(?:\.\d+)?)[ ,](-?\d+(?:\.\d+)?)/g, (_, x: string, y: string) => `${r1(200 - parseFloat(x))} ${y}`);

type Part = string | { d: string; fill: string };
const dOf = (p: Part) => (typeof p === 'string' ? p : p.d);

/**
 * A filled shape with the set's outline. The outline is drawn as a fat ink
 * stroke under ALL the parts and the fills go on top, so overlapping parts
 * merge into one silhouette with no seams between them (curls, manes, beards
 * are unions of circles). The outline therefore sits outside the geometry.
 */
export function Blob({ parts, fill, w = OUT }: { parts: Part[]; fill?: string; w?: number }) {
  return (
    <>
      {parts.map((p, i) => (
        <path key={`o${i}`} d={dOf(p)} fill={INK} stroke={INK} strokeWidth={w * 2} strokeLinejoin="round" />
      ))}
      {parts.map((p, i) => (
        <path key={`f${i}`} d={dOf(p)} fill={typeof p === 'string' ? fill : p.fill} />
      ))}
    </>
  );
}

/** Flat fill with no outline: shading, patterns, highlights. */
export function Fill({ d, fill }: { d: string; fill: string }) {
  return <path d={d} fill={fill} />;
}

export function Line({ d, w = DETAIL, color = INK }: { d: string; w?: number; color?: string }) {
  return <path d={d} fill="none" stroke={color} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" />;
}

/** The cream die-cut border: the silhouette again, fatter, under the art. */
export function Halo({ shapes, reach = OUT + RING }: { shapes: string[]; reach?: number }) {
  return (
    <>
      {shapes.map((d, i) => (
        <path key={i} d={d} fill={CREAM} stroke={CREAM} strokeWidth={reach * 2} strokeLinejoin="round" />
      ))}
    </>
  );
}

/**
 * The one eye construction for the whole set: an ink oval with a small
 * highlight, plus an optional upper lid. `lid` is how much of the eye the lid
 * covers (0 wide open, 0.45 serene). The oval sits in two nested groups so the
 * glance (translate) and the blink (scaleY) never fight over one transform.
 */
export function Eyes({
  skin,
  lid = 0.2,
  y = FACE.eyeY,
  dx = FACE.eyeDx,
  rx = 4.5,
  ry = 5.6,
}: {
  skin: string;
  lid?: number;
  y?: number;
  dx?: number;
  rx?: number;
  ry?: number;
}) {
  const lidY = y - ry + 2 * ry * lid;
  return (
    <>
      {[FACE.cx - dx, FACE.cx + dx].map((ex) => (
        <g key={ex}>
          <g className={styles.gaze}>
            <g className={styles.eye}>
              <ellipse cx={ex} cy={y} rx={rx} ry={ry} fill={INK} />
              <circle cx={ex - 1.5} cy={y - 0.6 + ry * lid} r={1.4} fill={CREAM} />
            </g>
          </g>
          {lid > 0 && (
            <>
              <rect x={ex - rx - 2.5} y={y - ry - 4} width={rx * 2 + 5} height={lidY - (y - ry - 4)} fill={skin} />
              <Line d={`M${ex - rx - 3} ${r1(lidY + 1)}Q${ex} ${r1(lidY - 1.8)} ${ex + rx + 3} ${r1(lidY + 1)}`} />
            </>
          )}
        </g>
      ))}
    </>
  );
}

export function Brows({ children }: { children: React.ReactNode }) {
  return <g className={styles.brows}>{children}</g>;
}

/**
 * Resting mouth plus two shared talk shapes that the speaking mood flips
 * between. `overlay` keeps the resting mouth visible under the talk shapes
 * (for drawn lips that should not vanish mid-word).
 */
export function Mouth({
  y,
  x = FACE.cx,
  scale = 1,
  overlay = false,
  children,
}: {
  y: number;
  x?: number;
  scale?: number;
  overlay?: boolean;
  children: React.ReactNode;
}) {
  const a = 5.4 * scale;
  return (
    <g>
      <g className={overlay ? undefined : styles.mouthRest}>{children}</g>
      {/* A: an open smile, mid-word. B: a rounder vowel. */}
      <path
        className={styles.mouthA}
        d={`M${r1(x - a)} ${r1(y - 0.8)}Q${x} ${r1(y + 8.5 * scale)} ${r1(x + a)} ${r1(y - 0.8)}Q${x} ${r1(y + 1.4)} ${r1(x - a)} ${r1(y - 0.8)}Z`}
        fill={INK}
        stroke={INK}
        strokeWidth={1.6}
        strokeLinejoin="round"
      />
      <ellipse className={styles.mouthB} cx={x} cy={y + 1.2} rx={4 * scale} ry={3.6 * scale} fill={INK} />
    </g>
  );
}

// Three takes of the same pencil tangle. The thinking mood flips between them
// a few times a second ("line boil"), which reads as hand-drawn and only costs
// opacity changes.
const SCRIBBLES = [
  'M-9 3C-10 -5 -3 -10 1 -5C4 -1 -3 3 -4 -2C-4 -7 6 -9 8 -3C10 3 4 8 -2 7',
  'M-9 2C-9 -6 -2 -9 2 -5C5 0 -2 4 -4 -1C-5 -6 5 -10 8 -4C11 2 5 7 -1 8',
  'M-8 4C-11 -4 -4 -10 1 -6C5 -2 -2 2 -3 -2C-3 -8 7 -8 9 -2C10 4 3 8 -3 6',
];

export function ThoughtMark({ accent, stroke, x = 170, y = 32 }: { accent: string; stroke?: string; x?: number; y?: number }) {
  const bubble = 'M0 -17C10 -18 18 -10 17 0C17 10 9 17 -1 17C-11 17 -18 9 -17 -1C-17 -10 -9 -17 0 -17Z';
  return (
    <g className={styles.thought} transform={`translate(${x} ${y})`}>
      <g className={styles.thoughtPop}>
        <Halo shapes={[bubble, circ(-22, 22, 5), circ(-31, 33, 3)]} />
        <g className={styles.dot2}>
          <Blob parts={[circ(-31, 33, 3)]} fill={accent} w={DETAIL} />
        </g>
        <g className={styles.dot1}>
          <Blob parts={[circ(-22, 22, 5)]} fill={accent} w={DETAIL} />
        </g>
        <Blob parts={[bubble]} fill={CREAM} />
        {SCRIBBLES.map((d, i) => (
          <g key={i} className={styles[`scribble${i}`]}>
            <Line d={d} w={4} color={stroke ?? accent} />
          </g>
        ))}
      </g>
    </g>
  );
}

export interface PortraitDef {
  /** Outer shapes that define the die-cut border, split by what moves. */
  sil: { body: string[]; head: string[]; front?: string[] };
  body: React.ReactNode;
  head: React.ReactNode;
  /** Body-anchored art that overlaps the head (an upturned collar). */
  front?: React.ReactNode;
  /** Scribble stroke when the accent is too pale to draw with on cream. */
  scribble?: string;
}

/** The standard shoulders every bust is cut from. */
export const BUST = 'M22 226C22 200 36 188 66 182L84 176L116 176L134 182C164 188 178 200 178 226Z';
export const NECK = 'M84 148L84 190L116 190L116 148Z';

/** Circles of radius r spaced along an arc of radius R around (cx, cy). Angles in degrees, 90 is straight up. */
export const arc = (cx: number, cy: number, R: number, r: number, angles: number[]) =>
  angles.map((a) => circ(cx + R * Math.cos((a * Math.PI) / 180), cy - R * Math.sin((a * Math.PI) / 180), r));

/** The shared head: same width, eye line and chin for every seat. */
export const FACE_D = 'M56 108C56 78 74 60 100 60C126 60 144 78 144 108C144 138 126 162 100 162C74 162 56 138 56 108Z';
/** Flat shadow down the viewer's right side of the shared face. */
export const FACE_SHADE_D = 'M144 108C144 138 126 162 100 162C118 155 135 136 135 108C135 90 130 76 121 66C136 74 144 90 144 108Z';
export const EAR_L = ell(53, 115, 7, 10);
export const EAR_R = ell(147, 115, 7, 10);
