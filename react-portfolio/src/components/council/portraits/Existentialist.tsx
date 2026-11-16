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
  circ,
  ell,
  mirror,
} from './kit';

// Simone de Beauvoir, after the mid-century photographs: centre-parted dark
// hair swept up under a knotted turban, high arched brows, a level gaze,
// lipstick and a wide open collar.

const SKIN = '#f5d1b6';
const SKIN_SHADE = '#e4ae92';
const BLUSH = '#f0ab9a';
const HAIR = '#5b3d2d';
const HAIR_LIGHT = '#7c5740';
const TURBAN = SEAT_ACCENTS.existentialist;
const TURBAN_LIGHT = '#8560a0';
const TURBAN_SHADE = '#54375f';
const GOLD = '#e6b32a';
const LIPS = '#c4473c';
const JACKET = '#4f3459';
const JACKET_SHADE = '#3d2746';
const COLLAR = '#fffdf8';

const TURBAN_D = 'M50 102C40 62 64 26 100 26C136 26 160 62 150 102C144 80 124 64 100 62C76 64 56 80 50 102Z';
const KNOT_L = ell(88, 45, 13, 9, -24);
const KNOT_R = ell(112, 45, 13, 9, 24);
const HAIR_L = 'M101 61C82 60 60 74 54 106C56 111 58 115 61 117C64 97 78 81 101 75Z';
const HAIR_R = mirror(HAIR_L);

const COLLAR_L = 'M86 176C74 178 64 184 57 193L80 215L100 198Z';
const NECK_V = 'M84 148L84 178L100 202L116 178L116 148Z';

export const existentialist: PortraitDef = {
  sil: {
    body: [BUST],
    head: [FACE_D, EAR_L, EAR_R, TURBAN_D, KNOT_L, KNOT_R],
  },
  body: (
    <>
      <Blob parts={[BUST]} fill={JACKET} />
      <Line d="M44 200L42 226" w={4} color={JACKET_SHADE} />
      <Line d="M156 200L158 226" w={4} color={JACKET_SHADE} />
      <Line d="M100 204L100 226" />
      <Blob parts={[NECK_V]} fill={SKIN} />
      <Fill d="M84 150L116 150L116 170C106 176 94 176 84 170Z" fill={SKIN_SHADE} />
      <Blob parts={[COLLAR_L]} fill={COLLAR} />
      <Blob parts={[mirror(COLLAR_L)]} fill={COLLAR} />
    </>
  ),
  head: (
    <>
      <Blob parts={[EAR_L, EAR_R]} fill={SKIN} />
      <Blob parts={[FACE_D]} fill={SKIN} />
      <Fill d={FACE_SHADE_D} fill={SKIN_SHADE} />
      <Fill d={ell(71, 129, 8, 4.5)} fill={BLUSH} />
      <Fill d={ell(129, 129, 8, 4.5)} fill={BLUSH} />

      <Blob parts={[HAIR_L, HAIR_R]} fill={HAIR} />
      <Line d="M64 100C68 88 80 78 96 72" w={3} color={HAIR_LIGHT} />
      <Line d="M136 100C132 88 120 78 104 72" w={3} color={HAIR_LIGHT} />

      <Blob parts={[TURBAN_D]} fill={TURBAN} />
      <Line d="M82 58C68 63 58 75 54 92" w={4} color={TURBAN_SHADE} />
      <Line d="M118 58C132 63 142 75 146 92" w={4} color={TURBAN_SHADE} />
      <Line d="M74 40C60 50 51 64 48 82" w={4} color={TURBAN_SHADE} />
      <Line d="M126 40C140 50 149 64 152 82" w={4} color={TURBAN_SHADE} />
      {[
        [66, 52],
        [134, 52],
        [57, 78],
        [143, 78],
        [100, 31],
        [72, 70],
        [128, 70],
      ].map(([x, y]) => (
        <Fill key={`${x}-${y}`} d={circ(x, y, 3)} fill={GOLD} />
      ))}
      <Blob parts={[KNOT_L]} fill={TURBAN_LIGHT} w={DETAIL} />
      <Blob parts={[KNOT_R]} fill={TURBAN_LIGHT} w={DETAIL} />
      <Blob parts={[circ(100, 49, 6.5)]} fill={TURBAN} w={DETAIL} />

      <Blob parts={[circ(52, 130, 4.5)]} fill={GOLD} w={3} />
      <Blob parts={[circ(148, 130, 4.5)]} fill={GOLD} w={3} />

      <Brows>
        <Line d="M70 100Q80 90 93 97" />
        <Line d="M107 97Q120 90 130 100" />
      </Brows>
      <Eyes skin={SKIN} lid={0.22} />
      <Line d="M73.5 108.5L69 105" w={3} />
      <Line d="M126.5 108.5L131 105" w={3} />
      <Line d="M100 108L98 125Q101 129 106 126" />

      <Mouth y={143.5} scale={0.8} overlay>
        <Blob parts={['M89 142C94 138 97 139 100 141C103 139 106 138 111 142C106 149.5 94 149.5 89 142Z']} fill={LIPS} w={2.5} />
        <Line d="M90 142.5Q100 146 110 142.5" w={2.5} />
      </Mouth>
    </>
  ),
};
