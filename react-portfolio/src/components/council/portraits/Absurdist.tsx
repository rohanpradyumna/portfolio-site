import React from 'react';
import { SEAT_ACCENTS } from '@/lib/council/contract';
import { BUST, Blob, Brows, DETAIL, Eyes, Fill, Line, Mouth, NECK, PortraitDef, ell, mirror } from './kit';

// Albert Camus, after the 1950s press photographs: dark hair swept back off a
// high forehead, prominent ears, one brow up, a wry half smile, and the
// collar of a trench coat turned up.

const SKIN = '#eec4a0';
const SKIN_SHADE = '#daa47e';
const HAIR = '#3e2c21';
const HAIR_LIGHT = '#624735';
const COAT = SEAT_ACCENTS.absurdist;
const COAT_SHADE = '#3a7145';
const COAT_DARK = '#2f5c39';
const SHIRT = '#fffdf8';
const TIE = '#a5452f';

const FACE_C = 'M57 106C57 78 74 60 100 60C126 60 143 78 143 106C143 128 137 147 121 158C112 164 88 164 79 158C63 147 57 128 57 106Z';
const FACE_C_SHADE = 'M143 106C143 128 137 147 121 158C116 161 108 163 100 163C116 156 134 138 134 106C134 90 130 76 121 66C136 74 143 90 143 106Z';
const EAR_L = ell(52, 116, 8, 12);
const EAR_R = ell(148, 116, 8, 12);

const HAIR_D =
  'M57 104C53 96 51 82 55 68C59 50 70 36 88 33C99 31 106 37 116 37C133 37 144 50 147 70C149 84 147 96 143 104C142 97 140 89 136 82C132 74 126 69 118 67C106 64 90 63 78 67C70 70 64 78 61 88C59 94 58 99 57 104Z';

const FLAP_L = 'M63 147L92 180L97 208L72 219C60 204 56 176 63 147Z';
const FLAP_R = mirror(FLAP_L);
const COLLAR_BACK = 'M68 152L132 152L132 192L68 192Z';

export const absurdist: PortraitDef = {
  sil: {
    body: [BUST, COLLAR_BACK],
    head: [FACE_C, EAR_L, EAR_R, HAIR_D],
    front: [FLAP_L, FLAP_R],
  },
  body: (
    <>
      <Blob parts={[BUST, COLLAR_BACK]} fill={COAT} />
      <Fill d={COLLAR_BACK} fill={COAT_DARK} />
      <Line d="M36 204L60 196" w={4} color={COAT_SHADE} />
      <Line d="M164 204L140 196" w={4} color={COAT_SHADE} />
      <Fill d="M82 178L100 226L118 178Z" fill={SHIRT} />
      <Blob parts={[NECK]} fill={SKIN} />
      <Fill d="M84 150L116 150L116 172C106 178 94 178 84 172Z" fill={SKIN_SHADE} />
      <Blob parts={['M95 190L105 190L109 226L91 226Z']} fill={TIE} w={DETAIL} />
      <Blob parts={['M93 184L107 184L105 194L95 194Z']} fill={TIE} w={DETAIL} />
    </>
  ),
  head: (
    <>
      <Blob parts={[EAR_L, EAR_R]} fill={SKIN} />
      <Line d="M51 111C48 114 48 119 51 122" w={2.5} color={SKIN_SHADE} />
      <Line d="M149 111C152 114 152 119 149 122" w={2.5} color={SKIN_SHADE} />
      <Blob parts={[FACE_C]} fill={SKIN} />
      <Fill d={FACE_C_SHADE} fill={SKIN_SHADE} />

      <Blob parts={[HAIR_D]} fill={HAIR} />
      <Line d="M66 72C66 60 72 51 82 46" w={3.5} color={HAIR_LIGHT} />
      <Line d="M80 62C88 52 100 48 114 48" w={3.5} color={HAIR_LIGHT} />
      <Line d="M104 60C114 54 126 54 136 60" w={3.5} color={HAIR_LIGHT} />

      <Line d="M82 79Q100 75 118 78" w={3} color={SKIN_SHADE} />
      <Line d="M87 87Q100 84 113 86" w={3} color={SKIN_SHADE} />
      <Line d="M75 122Q81 124.5 87 122" w={3} color={SKIN_SHADE} />
      <Line d="M113 122Q119 124.5 125 122" w={3} color={SKIN_SHADE} />

      <Brows>
        <Line d="M69 103Q79 96 92 99" w={5.5} color={HAIR} />
        <Line d="M108 97Q120 89 131 97" w={5.5} color={HAIR} />
      </Brows>
      <Eyes skin={SKIN} lid={0.32} />
      <Line d="M100 110L97 128Q101 133 107 129" />
      <Line d="M117 131Q120 137 117 142" w={3} color={SKIN_SHADE} />

      <Mouth y={146}>
        <Line d="M88 146.5Q99 149.5 109 145Q113 143 115 139.5" />
      </Mouth>
      <Blob parts={['M91 144.5L72 150L73.5 155L92.5 149.5Z']} fill="#fffdf8" w={2.5} />
      <Fill d="M72 150L76.5 148.7L78 153.7L73.5 155Z" fill="#e2703a" />
    </>
  ),
  front: (
    <>
      <Blob parts={[FLAP_L]} fill={COAT} />
      <Blob parts={[FLAP_R]} fill={COAT} />
      <Line d="M68 160C64 178 66 196 74 212" w={4} color={COAT_SHADE} />
      <Line d="M132 160C136 178 134 196 126 212" w={4} color={COAT_SHADE} />
    </>
  ),
};
