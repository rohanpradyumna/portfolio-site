import React from 'react';
import { Blob, CREAM, DETAIL, Fill, Line, circ } from '@/components/council/portraits/kit';

// Five hats drawn in the portrait's 200x240 space so they sit on the hair
// cloud as-is. Each one carries its own die-cut silhouette (`sil`).

export type HatId = 'pm' | 'ai' | 'entrepreneur' | 'designer' | 'data';

export interface HatDef {
  sil: string[];
  art: React.ReactNode;
}

const r1 = (n: number) => Math.round(n * 10) / 10;

/** Five-point star centred on (cx, cy). */
const star = (cx: number, cy: number, r: number) => {
  const pts = Array.from({ length: 10 }, (_, i) => {
    const a = (Math.PI / 5) * i - Math.PI / 2;
    const rr = i % 2 === 0 ? r : r * 0.45;
    return `${r1(cx + rr * Math.cos(a))} ${r1(cy + rr * Math.sin(a))}`;
  });
  return `M${pts.join('L')}Z`;
};

// ---- Product manager: a ball cap with a roadmap patch ----
const CAP_CROWN = 'M50 76C50 38 72 18 100 18C128 18 150 38 150 76Z';
const CAP_BRIM = 'M40 76Q100 62 160 76Q163 88 150 90Q100 80 50 90Q37 88 40 76Z';
const CAP_PATCH = 'M82 40H118Q123 40 123 45V57Q123 62 118 62H82Q77 62 77 57V45Q77 40 82 40Z';

// ---- AI builder: a hard hat with a circuit sticker ----
const HARD_DOME = 'M50 78C50 40 72 20 100 20C128 20 150 40 150 78Z';
const HARD_BRIM = 'M34 78Q100 66 166 78L166 87Q100 77 34 87Z';
const HARD_RIDGE = 'M91 21C93 19 107 19 109 21L111 77L89 77Z';

// ---- Entrepreneur: a top hat ----
const TOP_CROWN = 'M60 2Q100 -6 140 2L135 72Q100 77 65 72Z';
const TOP_BAND = 'M63 52Q100 58 137 52L135 70Q100 75 65 70Z';
const TOP_BRIM = 'M32 74Q100 60 168 74Q172 87 152 89Q100 79 48 89Q28 87 32 74Z';

// ---- Designer: a tilted beret with paint dots ----
const BERET = 'M44 70C38 50 62 32 98 30C138 28 164 44 160 62C157 76 132 82 100 82C72 82 48 80 44 70Z';

// ---- Data wizard: a pointy hat with a bar chart and stars ----
const WIZ_CONE = 'M58 78Q82 42 96 8Q104 -14 128 -18Q114 -4 113 14Q118 48 142 78Z';
const WIZ_BRIM = 'M32 80Q100 64 168 80Q171 93 152 93Q100 84 48 93Q29 93 32 80Z';

export const HATS: Record<HatId, HatDef> = {
  pm: {
    sil: [CAP_CROWN, CAP_BRIM],
    art: (
      <>
        <Blob parts={[CAP_CROWN]} fill="#3d6fa8" />
        <Fill d="M150 76C150 46 136 26 116 20C132 30 140 50 140 76Z" fill="#2f5888" />
        <Line d="M100 20L100 40" w={3} color="#2f5888" />
        <Blob parts={[circ(100, 18, 4.5)]} fill="#2f5888" w={DETAIL} />
        <Blob parts={[CAP_PATCH]} fill={CREAM} w={DETAIL} />
        <Line d="M84 56L94 47L104 53L116 45" w={2.6} color="#c4472a" />
        {[
          [84, 56],
          [104, 53],
          [116, 45],
        ].map(([x, y]) => (
          <Fill key={x} d={circ(x, y, 2.6)} fill="#2a251f" />
        ))}
        <Blob parts={[CAP_BRIM]} fill="#2f5888" />
      </>
    ),
  },
  ai: {
    sil: [HARD_DOME, HARD_BRIM],
    art: (
      <>
        <Blob parts={[HARD_DOME]} fill="#e6b32a" />
        <Fill d="M150 78C150 48 136 28 116 22C132 34 140 54 140 78Z" fill="#c9951a" />
        <Blob parts={[HARD_RIDGE]} fill="#f2c94c" w={DETAIL} />
        <Blob parts={['M118 44H138V62H118Z']} fill="#3d6fa8" w={DETAIL} />
        <Line d="M122 49H128V57H134" w={2} color={CREAM} />
        <Fill d={circ(134, 49, 1.8)} fill={CREAM} />
        <Fill d={circ(122, 57, 1.8)} fill={CREAM} />
        <Line d="M64 52C68 42 74 36 82 32" w={3} color="#f7dc8a" />
        <Blob parts={[HARD_BRIM]} fill="#c9951a" />
      </>
    ),
  },
  entrepreneur: {
    sil: [TOP_CROWN, TOP_BRIM],
    art: (
      <>
        <Blob parts={[TOP_CROWN]} fill="#33303b" />
        <Fill d="M140 2L135 72Q128 73 122 74L127 -1Q134 0 140 2Z" fill="#26232c" />
        <Line d="M73 12L71 44" w={3.5} color="#4d4957" />
        <Fill d={TOP_BAND} fill="#2f8f8a" />
        <Line d="M63 52Q100 58 137 52" w={DETAIL} />
        <Blob parts={[TOP_BRIM]} fill="#26232c" />
      </>
    ),
  },
  designer: {
    sil: [BERET, circ(104, 26, 5)],
    art: (
      <>
        <Line d="M103 31L106 21" w={5} />
        <Blob parts={[BERET]} fill="#c4472a" />
        <Fill d="M160 62C157 76 132 82 100 82C128 76 148 66 150 50C156 54 161 58 160 62Z" fill="#a33a22" />
        <Line d="M54 72Q100 86 150 70" w={DETAIL} color="#8f3220" />
        <Blob parts={[circ(74, 52, 6)]} fill="#e6b32a" w={DETAIL} />
        <Blob parts={[circ(92, 44, 4.5)]} fill="#3d6fa8" w={DETAIL} />
        <Blob parts={[circ(122, 46, 5)]} fill="#4a8b54" w={DETAIL} />
      </>
    ),
  },
  data: {
    sil: [WIZ_CONE, WIZ_BRIM],
    art: (
      <>
        <Blob parts={[WIZ_CONE]} fill="#6b4fa0" />
        <Fill d="M113 14Q118 48 142 78L124 78Q108 46 106 10Z" fill="#55397f" />
        <Blob parts={['M84 64H91V52H84Z', 'M94 64H101V42H94Z', 'M104 64H111V48H104Z']} fill={CREAM} w={2.5} />
        <Blob parts={[star(116, 30, 7)]} fill="#f2c94c" w={2.5} />
        <Blob parts={[star(86, 30, 4.5)]} fill="#f2c94c" w={2.5} />
        <Blob parts={[WIZ_BRIM]} fill="#55397f" />
      </>
    ),
  },
};
