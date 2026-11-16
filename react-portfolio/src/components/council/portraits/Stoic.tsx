import React from 'react';
import { SEAT_ACCENTS } from '@/lib/council/contract';
import {
  BUST,
  Blob,
  Brows,
  DETAIL,
  EAR_L,
  EAR_R,
  Eyes,
  FACE_D,
  FACE_SHADE_D,
  Fill,
  Line,
  Mouth,
  PortraitDef,
  arc,
  circ,
  leaf,
  mirror,
} from './kit';

// Marcus Aurelius, after the Roman portrait busts: a cap of tight curls, a
// full curled beard that forks at the chin, heavy calm lids, a laurel wreath
// and a cloak pinned at the shoulder.

const SKIN = '#ecba90';
const SKIN_SHADE = '#d99e74';
const HAIR = '#7b5a3f';
const HAIR_LINE = '#5b4230';
const TUNIC = '#f6eedd';
const TUNIC_SHADE = '#e3d3b6';
const CLOAK = SEAT_ACCENTS.stoic;
const CLOAK_SHADE = '#6d5940';
const LAUREL = '#86a44a';
const LAUREL_DARK = '#688636';
const GOLD = '#e6b32a';

const HAIR_OUTER = arc(100, 100, 46, 13, [186, 162, 138, 114, 90, 66, 42, 18, -6]);
const HAIR_FRINGE = arc(100, 100, 36, 9.5, [152, 121, 90, 59, 28]);
const HAIR_CAP = 'M58 100C56 70 76 54 100 54C124 54 144 70 142 100C132 80 118 72 100 72C82 72 68 80 58 100Z';

// Leaves climb each side of the head toward the crown, like a wreath seen
// from the front. Alternating tilt keeps them from reading as a zip.
const leafAt = (theta: number, tilt: number) => {
  const t = (theta * Math.PI) / 180;
  const x = 100 + 49 * Math.cos(t);
  const y = 100 - 49 * Math.sin(t);
  const along = (Math.atan2(Math.cos(t), Math.sin(t)) * 180) / Math.PI;
  return leaf(x, y, along + tilt, 25, 7.5);
};
const LEAVES_L = [leafAt(180, -24), leafAt(160, 14), leafAt(140, -22), leafAt(120, 12), leafAt(102, -16)];
const LEAVES_R = LEAVES_L.map(mirror);

const BEARD_BASE =
  'M55 102C56 128 70 139 82 139C88 133 94 131 100 131C106 131 112 133 118 139C130 139 144 128 145 102C150 146 132 178 100 182C68 178 50 146 55 102Z';
const BEARD_CURLS = [
  circ(58, 139, 9.5),
  circ(65, 158, 10),
  circ(78, 172, 10),
  circ(92.5, 181, 10),
  circ(107.5, 181, 10),
  circ(122, 172, 10),
  circ(135, 158, 10),
  circ(142, 139, 9.5),
];
const TACHE_L = 'M101 132C94 128 84 131 77 142C86 145 96 142 101 137Z';
const TACHE = [TACHE_L, mirror(TACHE_L)];

const CLOAK_D = 'M100 226C114 212 124 196 126 180L134 182C164 188 178 200 178 226Z';

export const stoic: PortraitDef = {
  sil: {
    body: [BUST],
    head: [FACE_D, EAR_L, EAR_R, ...HAIR_OUTER, BEARD_BASE, ...BEARD_CURLS, ...LEAVES_L, ...LEAVES_R],
  },
  body: (
    <>
      <Blob parts={[BUST, { d: CLOAK_D, fill: CLOAK }]} fill={TUNIC} />
      <Line d="M58 192C68 202 76 214 78 226" w={5} color={TUNIC_SHADE} />
      <Line d="M40 200C50 208 56 218 58 226" w={5} color={TUNIC_SHADE} />
      <Line d="M100 226C114 212 124 196 126 180" />
      <Line d="M146 194C148 206 146 216 141 226" w={5} color={CLOAK_SHADE} />
      <Line d="M163 202C165 210 164 219 161 226" w={5} color={CLOAK_SHADE} />
      <Blob parts={['M86 150L86 182L114 182L114 150Z']} fill={SKIN_SHADE} />
      <Line d="M74 181C84 196 104 200 122 186" w={5} color={TUNIC_SHADE} />
      <Blob parts={[circ(137, 191, 6.5)]} fill={GOLD} w={DETAIL} />
    </>
  ),
  head: (
    <>
      <Blob parts={[EAR_L, EAR_R]} fill={SKIN} />
      <Blob parts={[FACE_D]} fill={SKIN} />
      <Fill d={FACE_SHADE_D} fill={SKIN_SHADE} />

      <Blob parts={[BEARD_BASE, ...BEARD_CURLS]} fill={HAIR} />
      {BEARD_CURLS.map((d, i) => (
        <Line key={i} d={d} w={3} color={HAIR_LINE} />
      ))}
      <Line d="M72 150C76 156 82 158 86 154" w={3} color={HAIR_LINE} />
      <Line d="M128 150C124 156 118 158 114 154" w={3} color={HAIR_LINE} />
      <Line d="M94 160C96 166 104 166 106 160" w={3} color={HAIR_LINE} />

      <Blob parts={[...HAIR_OUTER, HAIR_CAP, ...HAIR_FRINGE]} fill={HAIR} />
      {[...HAIR_OUTER, ...HAIR_FRINGE].map((d, i) => (
        <Line key={i} d={d} w={3} color={HAIR_LINE} />
      ))}
      {[...LEAVES_L, ...LEAVES_R].map((d, i) => (
        <Blob key={i} parts={[d]} fill={i % 2 ? LAUREL : LAUREL_DARK} w={DETAIL} />
      ))}

      <Brows>
        <Line d="M71 100Q81 95 92 99" w={4.5} color={HAIR_LINE} />
        <Line d="M108 99Q119 95 129 100" w={4.5} color={HAIR_LINE} />
      </Brows>
      <Eyes skin={SKIN} lid={0.4} />
      <Line d="M100 110L98 126Q101 130 106 127" />

      <Mouth y={146}>
        <Line d="M94 146Q100 149.5 106 146" />
      </Mouth>
      <Blob parts={TACHE} fill={HAIR} w={DETAIL} />
    </>
  ),
};
