import React from 'react';
import { SEAT_ACCENTS } from '@/lib/council/contract';
import { BUST, Blob, Brows, DETAIL, Eyes, FACE_D, FACE_SHADE_D, Fill, Line, Mouth, PortraitDef, circ, ell, mirror } from './kit';

// Karl Marx, after the 1875 Mayall photograph: a grey mane swept back off a
// high forehead and standing out wide at the sides, a paler beard running
// into it, a darker moustache, heavy brows, and a frock coat (here in the
// seat's red).

const SKIN = '#f1c5a3';
const SKIN_SHADE = '#dda584';
const BLUSH = '#eba28a';
const MANE = '#cfc9bd';
const BEARD = '#ece8de';
const MANE_WARM = '#aaa091';
const MANE_COOL = '#9aa7b0';
const BEARD_WARM = '#c4bbab';
const BEARD_COOL = '#b3bec6';
const TACHE = '#55504a';
const TACHE_LIGHT = '#8c877f';
const BROW = '#433d37';
const COAT = SEAT_ACCENTS.marxist;
const COAT_SHADE = '#a2371f';
const BUTTON = '#e6b32a';

// The mane is a union of uneven tufts so its edge reads as hair, not as a
// hood. The front piece carries the hairline: receding at the temples with
// a forelock in the middle.
const MANE_TUFTS = [
  ell(100, 52, 31, 14),
  ell(62, 64, 23, 16, -38),
  ell(138, 64, 23, 16, 38),
  ell(41, 90, 17, 23, -8),
  ell(159, 90, 17, 23, 8),
  ell(45, 119, 15, 17, 18),
  ell(155, 119, 15, 17, -18),
  ell(53, 134, 9, 7, 30),
  ell(147, 134, 9, 7, -30),
];
const MANE_FRONT =
  'M58 106C56 84 64 70 78 62C86 60 94 64 100 70C106 64 114 60 122 62C136 70 144 84 142 106C150 80 130 48 100 48C70 48 50 80 58 106Z';
const BEARD_D =
  'M54 112C52 132 50 150 54 166C58 182 68 192 78 196C84 204 94 206 100 202C106 206 116 204 122 196C132 192 142 182 146 166C150 150 148 132 146 112C144 130 134 139 120 141C112 134 106 132 100 132C94 132 88 134 80 141C66 139 56 130 54 112Z';
const TACHE_L = 'M101 133C92 128 78 132 69 150C82 154 97 149 101 141Z';

export const marxist: PortraitDef = {
  sil: {
    body: [BUST],
    head: [FACE_D, ...MANE_TUFTS, BEARD_D],
  },
  body: (
    <>
      <Blob parts={[BUST]} fill={COAT} />
      <Line d="M40 198C46 208 50 218 52 226" w={5} color={COAT_SHADE} />
      <Line d="M160 198C154 208 150 218 148 226" w={5} color={COAT_SHADE} />
      <Line d="M100 196L100 226" />
      <Blob parts={[circ(88, 217, 3.5)]} fill={BUTTON} w={2.5} />
      <Blob parts={[circ(112, 217, 3.5)]} fill={BUTTON} w={2.5} />
    </>
  ),
  head: (
    <>
      <Blob parts={[FACE_D]} fill={SKIN} />
      <Fill d={FACE_SHADE_D} fill={SKIN_SHADE} />
      <Fill d={ell(70, 127, 8.5, 5)} fill={BLUSH} />
      <Fill d={ell(130, 127, 8.5, 5)} fill={BLUSH} />

      <Blob parts={[BEARD_D]} fill={BEARD} />
      <Line d="M64 158C67 170 73 180 82 186" w={4} color={BEARD_WARM} />
      <Line d="M136 158C133 170 127 180 118 186" w={4} color={BEARD_COOL} />
      <Line d="M100 170L100 192" w={4} color={BEARD_WARM} />
      <Line d="M83 164C84 171 86 177 90 182" w={4} color={BEARD_COOL} />
      <Line d="M117 164C116 171 114 177 110 182" w={4} color={BEARD_WARM} />

      <Blob parts={[...MANE_TUFTS, MANE_FRONT]} fill={MANE} />
      <Line d="M80 56C70 56 60 62 52 72" w={3.5} color={MANE_WARM} />
      <Line d="M120 56C130 56 140 62 148 72" w={3.5} color={MANE_COOL} />
      <Line d="M66 76C56 80 48 88 44 98" w={3.5} color={MANE_COOL} />
      <Line d="M134 76C144 80 152 88 156 98" w={3.5} color={MANE_WARM} />
      <Line d="M54 100C46 106 42 114 42 124" w={3.5} color={MANE_WARM} />
      <Line d="M146 100C154 106 158 114 158 124" w={3.5} color={MANE_COOL} />
      <Line d="M90 50C96 47 104 47 110 50" w={3.5} color={MANE_WARM} />

      <Line d="M74 122Q81 125 88 122" w={3} color={SKIN_SHADE} />
      <Line d="M112 122Q119 125 126 122" w={3} color={SKIN_SHADE} />
      <Brows>
        <Line d="M68 101Q80 93 93 100" w={7} color={BROW} />
        <Line d="M107 100Q120 93 132 101" w={7} color={BROW} />
      </Brows>
      <Eyes skin={SKIN} lid={0.2} />
      <Line d="M100 110L96 125Q101 132 108 127" />

      <Fill d="M90 152C95 160 105 160 110 152C105 149 95 149 90 152Z" fill={TACHE_LIGHT} />
      <Mouth y={151}>
        <Line d="M94 151Q100 153.5 106 151" />
      </Mouth>
      <Blob parts={[TACHE_L, mirror(TACHE_L)]} fill={TACHE} w={DETAIL} />
    </>
  ),
};
