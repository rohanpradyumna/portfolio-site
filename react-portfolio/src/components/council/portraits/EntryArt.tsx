import React from 'react';
import { SEAT_ACCENTS } from '@/lib/council/contract';
import { Blob, CREAM, Fill, Halo, INK, Line, arc, circ, ell, leaf } from './kit';
import styles from './portraits.module.css';

// Homepage entry sticker: the six seats peeking over a note card that says
// QUESTION EVERYTHING. The heads are redrawn small and bold for this size
// (about 20px each on the board) instead of shrinking the full portraits,
// whose detail would turn to mush.

const OUTLINE = 2.6; // outline, in the 120-unit box
const REACH = OUTLINE + 3.2; // outline plus die-cut ring
const HEAD_SCALE = 0.92;
const W = OUTLINE / HEAD_SCALE; // heads are drawn at 1 and scaled, so pre-divide
const R = 10.5; // head radius before scaling

const CARD = 'M15 52H105a8 8 0 0 1 8 8V103a8 8 0 0 1 -8 8H15a8 8 0 0 1 -8 -8V60a8 8 0 0 1 8 -8Z';
const CARD_FILL = '#f2c54b';
const BADGE = circ(101, 102, 9);

interface MiniHead {
  sil: string[];
  art: React.ReactNode;
}

const dots = (y = 0.6, dx = 3.8) => (
  <>
    <circle cx={-dx} cy={y} r={1.45} fill={INK} />
    <circle cx={dx} cy={y} r={1.45} fill={INK} />
  </>
);
const brows = (color: string, y = -2.6, w = 1.6) => (
  <>
    <Line d={`M-5.8 ${y + 0.6}Q-3.8 ${y - 0.8} -1.8 ${y}`} w={w} color={color} />
    <Line d={`M1.8 ${y}Q3.8 ${y - 0.8} 5.8 ${y + 0.6}`} w={w} color={color} />
  </>
);
const LOWER_FACE = `M${-R} 1C-7 4.5 -3 3.2 0 3.2C3 3.2 7 4.5 ${R} 1C${R} 7 6 ${R} 0 ${R}C-6 ${R} ${-R} 7 ${-R} 1Z`;
const FACE = circ(0, 0, R);

const marcusHair = arc(0, 0, 10.5, 4.3, [204, 166, 128, 90, 52, 14, -24]);
const marcusLeaves = [leaf(-12.5, -3, -72, 9, 2.8), leaf(-8.5, -10.5, -38, 9, 2.8), leaf(12.5, -3, -108, 9, 2.8), leaf(8.5, -10.5, -142, 9, 2.8)];
const jamesFace = ell(0, -1, 10.5, 11.5);
const jamesTufts = [circ(-11.2, 1.5, 4.4), circ(11.2, 1.5, 4.4), circ(-10.2, -4.5, 3.4), circ(10.2, -4.5, 3.4)];
const simoneTurban = 'M-11.5 -2C-14.5 -12 -7 -19.5 0 -19.5C7 -19.5 14.5 -12 11.5 -2C9 -8 5 -11 0 -11C-5 -11 -9 -8 -11.5 -2Z';
const camusHair = 'M-10.8 -1C-12.6 -9 -7.5 -16 -1 -15.6C6 -16.4 12.6 -9.5 10.8 -1C9 -6 5 -8.6 0 -8.6C-5 -8.6 -9 -6 -10.8 -1Z';
const camusEars = [circ(-10.9, 1.2, 2.6), circ(10.9, 1.2, 2.6)];
const shankaraEars = [ell(-10.9, 1.8, 2.4, 3.8), ell(10.9, 1.8, 2.4, 3.8)];
const marxMane = [ell(0, -10.2, 9.5, 4.6), ell(-9.6, -6, 6.4, 5, -32), ell(9.6, -6, 6.4, 5, 32), ell(-12.4, 1.5, 4.6, 6.4), ell(12.4, 1.5, 4.6, 6.4)];

const HEADS: MiniHead[] = [
  {
    // Marcus Aurelius
    sil: [FACE, ...marcusHair, ...marcusLeaves],
    art: (
      <>
        <Blob parts={[FACE]} fill="#ecba90" w={W} />
        <g transform="translate(0 2.4)">
          <Fill d={LOWER_FACE} fill="#7b5a3f" />
        </g>
        <Blob parts={marcusHair} fill="#7b5a3f" w={W} />
        {marcusLeaves.map((d, i) => (
          <Blob key={i} parts={[d]} fill={i % 2 ? '#86a44a' : '#688636'} w={1.5} />
        ))}
        {brows('#5b4230')}
        {dots()}
      </>
    ),
  },
  {
    // William James
    sil: [jamesFace, ...jamesTufts],
    art: (
      <>
        <Blob parts={[jamesFace]} fill="#f2c9a9" w={W} />
        <Fill d={LOWER_FACE} fill="#d6cfc2" />
        <Blob parts={jamesTufts} fill="#c3b9a8" w={W} />
        <Fill d="M0 3.4C-3 2.2 -6.4 3.6 -7.8 6.8C-4.4 7.6 -1.2 6.6 0 5C1.2 6.6 4.4 7.6 7.8 6.8C6.4 3.6 3 2.2 0 3.4Z" fill="#fffdf8" />
        {brows('#7a6d61', -2.8, 1.9)}
        {dots()}
      </>
    ),
  },
  {
    // Simone de Beauvoir
    sil: [FACE, simoneTurban],
    art: (
      <>
        <Blob parts={[FACE]} fill="#f5d1b6" w={W} />
        <Fill d={`M0 ${-R}C-6 ${-R} ${-R} -6 ${-R} 1.5C-8 -4 -4 -6.6 0 -7C4 -6.6 8 -4 ${R} 1.5C${R} -6 6 ${-R} 0 ${-R}Z`} fill="#5b3d2d" />
        <Blob parts={[simoneTurban]} fill={SEAT_ACCENTS.existentialist} w={W} />
        <Blob parts={[circ(0, -15.2, 2.7)]} fill="#8560a0" w={1.5} />
        <Fill d={circ(-7.4, -12.4, 1.2)} fill="#e6b32a" />
        <Fill d={circ(7.4, -12.4, 1.2)} fill="#e6b32a" />
        {brows(INK, -3, 1.3)}
        {dots()}
      </>
    ),
  },
  {
    // Albert Camus
    sil: [FACE, ...camusEars, camusHair],
    art: (
      <>
        <Blob parts={camusEars} fill="#eec4a0" w={W} />
        <Blob parts={[FACE]} fill="#eec4a0" w={W} />
        <Blob parts={[camusHair]} fill="#3e2c21" w={W} />
        <Line d="M-6 -10.5C-3 -13 2 -13.4 6 -11.6" w={1.4} color="#624735" />
        <Line d="M-5.8 -1.8Q-3.8 -3.2 -1.8 -2.6" w={1.9} color="#3e2c21" />
        <Line d="M1.8 -3.2Q3.8 -4.6 5.8 -3.2" w={1.9} color="#3e2c21" />
        {dots()}
        <Line d="M-3.6 5.6Q0.6 7.4 4.4 4.6" w={1.5} />
      </>
    ),
  },
  {
    // Adi Shankara
    sil: [FACE, ...shankaraEars],
    art: (
      <>
        <Blob parts={shankaraEars} fill="#cd9365" w={W} />
        <Blob parts={[FACE]} fill="#cd9365" w={W} />
        <Line d="M-4.8 -7.4H4.8" w={1.5} color="#f8f0e1" />
        <Line d="M-5.6 -5.1H5.6" w={1.5} color="#f8f0e1" />
        <Line d="M-4.8 -2.8H4.8" w={1.5} color="#f8f0e1" />
        <Fill d={circ(0, -5.1, 1.35)} fill="#c4472a" />
        {dots(1.6)}
      </>
    ),
  },
  {
    // Karl Marx
    sil: [FACE, ...marxMane],
    art: (
      <>
        <Blob parts={[FACE]} fill="#f1c5a3" w={W} />
        <Fill d={LOWER_FACE} fill="#ece8de" />
        <Blob parts={marxMane} fill="#cfc9bd" w={W} />
        <Fill d="M0 3.4C-3 2.2 -6.4 3.6 -7.8 6.8C-4.4 7.6 -1.2 6.6 0 5C1.2 6.6 4.4 7.6 7.8 6.8C6.4 3.6 3 2.2 0 3.4Z" fill="#55504a" />
        {brows('#433d37', -2.4, 2.3)}
        {dots(0.9)}
      </>
    ),
  },
];

// Two staggered rows, like a crowd at a fence. The back row (the bearded
// ones, whose beards need to show) stands clear; the card hides the front
// row from the nose down.
const PLACES: [number, number][] = [
  [21, 44],
  [37, 23],
  [53, 44],
  [69, 22],
  [85, 44],
  [100, 24],
];
const ORDER = [1, 3, 5, 0, 2, 4];

export function CouncilEntryArt({ size }: { size: number }) {
  const place = (i: number, node: React.ReactNode) => (
    <g key={i} className={styles.peek} style={{ '--i': i } as React.CSSProperties}>
      <g transform={`translate(${PLACES[i][0]} ${PLACES[i][1]}) scale(${HEAD_SCALE})`}>{node}</g>
    </g>
  );

  return (
    <svg className={styles.entry} width={size} height={size} viewBox="0 0 120 120" aria-hidden="true" focusable="false">
      <g transform="rotate(-3 60 70)">
        {ORDER.map((i) => place(i, <Halo shapes={HEADS[i].sil} reach={REACH / HEAD_SCALE} />))}
        <Halo shapes={[CARD, BADGE]} reach={REACH} />

        {ORDER.map((i) => place(i, HEADS[i].art))}

        <Blob parts={[CARD]} fill={CARD_FILL} w={OUTLINE} />
        <text
          x="60"
          y="73.5"
          textAnchor="middle"
          fontSize="14.6"
          fontWeight="700"
          fill={INK}
          style={{ fontFamily: 'var(--font-mono)', letterSpacing: 0 }}
        >
          QUESTION
        </text>
        <text
          x="60"
          y="90"
          textAnchor="middle"
          fontSize="14.6"
          fontWeight="700"
          fill={INK}
          style={{ fontFamily: 'var(--font-mono)', letterSpacing: 0 }}
        >
          EVERYTHING
        </text>
        <Line d="M17 100C23 97 27 103 33 100C39 97 43 103 49 100C55 97 59 103 65 100" w={2.6} color={SEAT_ACCENTS.marxist} />

        <Blob parts={[BADGE]} fill={SEAT_ACCENTS.marxist} w={OUTLINE} />
        <text
          x="101"
          y="107.4"
          textAnchor="middle"
          fontSize="16"
          fontWeight="400"
          fill={CREAM}
          style={{ fontFamily: 'var(--font-serif)' }}
        >
          ?
        </text>
      </g>
    </svg>
  );
}
