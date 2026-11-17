import React from 'react';
import {
  BUST,
  Blob,
  Brows,
  DETAIL,
  Eyes,
  Fill,
  INK,
  Line,
  Mouth,
  NECK,
  PortraitDef,
  circ,
  ell,
  mirror,
} from '@/components/council/portraits/kit';

// Rohan, after the booth photo: wavy dark hair swept across the forehead,
// chunky clear-grey rectangular frames, clean-shaven but for a slim mustache,
// and a light-blue oxford button-down. Built from the council kit so he sits in the
// same sticker set.

const SKIN = '#dcab84';
const SKIN_SHADE = '#c48f68';
const BLUSH = '#e5987d';
const HAIR = '#231a16';
const HAIR_LIGHT = '#43342c';
const BEARD = '#3a2c24';
const FRAME = '#a8a29d';
const SHIRT = '#a9c3e1';
const SHIRT_SHADE = '#91acd0';
const COLLAR = '#bcd2eb';
const BUTTON = '#f4f7fb';
const TEETH = '#fffdf8';

const FACE = 'M58 104C58 76 76 58 100 58C124 58 142 76 142 104C142 132 131 151 117 160C109 165 91 165 83 160C69 151 58 132 58 104Z';
const FACE_SHADE =
  'M142 104C142 132 131 151 117 160C112 163 106 165 100 165C116 158 133 138 133 106C133 89 128 76 120 67C134 75 142 89 142 104Z';
const EAR_L = ell(55, 114, 7, 11);
const EAR_R = ell(145, 114, 7, 11);

// Wavy hair with volume on top, swept from his left across the forehead. The
// top edge dips once for the wave; it stays under every hat's crown, so only
// the sides show beneath a brim.
const HAIR_CAP =
  'M54 100C49 82 52 64 62 54C66 44 76 38 86 40C92 32 104 30 112 36C120 31 134 34 140 44C148 52 150 66 148 80C147 90 145 96 143 100C140 92 135 86 128 82C112 75 94 77 80 81C68 85 60 92 54 100Z';
const SIDES = [circ(56, 90, 7), circ(145, 88, 6)];
const WAVES = [HAIR_CAP, ...SIDES];
// The swoop that falls across the forehead.
const CURL =
  'M58 94C57 76 68 62 86 58C100 55 112 58 120 66C112 64 104 66 98 70C102 74 102 80 98 84C94 78 86 76 80 80C72 85 64 90 58 94Z';

// Clean-shaven but for a slim mustache.
const TACHE_L = 'M100 138C94 135 87 136 83 140C89 139.5 95 139.5 100 140Z';

// Chunky rectangular frames, drawn twice: ink edge, then the clear grey acetate.
// Absolute L/Q only: the kit's mirror() flips coordinate pairs, not H/V shorthands.
const RIM_L = 'M69 100L90 100Q95 100 95 105L95 118Q95 124 89 124L70 124Q64 124 64 118L64 105Q64 100 69 100Z';
const RIM_R = mirror(RIM_L);

const COLLAR_L = 'M88 176L100 194L86 204L72 186Z';

export const rohan: PortraitDef = {
  scribble: '#c4472a',
  sil: {
    body: [BUST],
    head: [FACE, EAR_L, EAR_R, ...WAVES],
  },
  body: (
    <>
      <Blob parts={[BUST]} fill={SHIRT} />
      <Fill d="M150 190C166 196 178 208 178 226L152 226Z" fill={SHIRT_SHADE} />
      <Line d="M100 196L100 226" w={2.5} color={SHIRT_SHADE} />
      <Fill d={circ(100, 206, 2.2)} fill={BUTTON} />
      <Fill d={circ(100, 220, 2.2)} fill={BUTTON} />
      <Blob parts={[NECK]} fill={SKIN_SHADE} />
      <Fill d="M88 176L100 194L112 176Z" fill={SKIN} />
      <Blob parts={[COLLAR_L, mirror(COLLAR_L)]} fill={COLLAR} w={DETAIL} />
      {/* Button-down collar points. */}
      <Fill d={circ(80, 196, 1.8)} fill={BUTTON} />
      <Fill d={circ(120, 196, 1.8)} fill={BUTTON} />
    </>
  ),
  head: (
    <>
      <Blob parts={[EAR_L, EAR_R]} fill={SKIN} />
      <Line d="M53 109Q50 114 54 119" w={2.5} color={SKIN_SHADE} />
      <Line d="M147 109Q150 114 146 119" w={2.5} color={SKIN_SHADE} />
      <Blob parts={[FACE]} fill={SKIN} />
      <Fill d={FACE_SHADE} fill={SKIN_SHADE} />
      <Fill d={ell(71, 132, 6, 3.5)} fill={BLUSH} />
      <Fill d={ell(129, 132, 6, 3.5)} fill={BLUSH} />

      <Blob parts={WAVES} fill={HAIR} />
      <Line d="M66 64C72 54 82 50 90 52" w={3} color={HAIR_LIGHT} />
      <Line d="M100 44C108 40 118 42 124 48" w={3} color={HAIR_LIGHT} />
      <Line d="M126 58C134 58 140 64 142 72" w={3} color={HAIR_LIGHT} />
      <Blob parts={[CURL]} fill={HAIR} w={DETAIL} />
      <Line d="M66 84C72 74 82 68 94 66" w={2.5} color={HAIR_LIGHT} />

      <Brows>
        <Line d="M67 93Q79 88 92 92" w={5} color={HAIR} />
        <Line d="M108 92Q121 88 133 93" w={5} color={HAIR} />
      </Brows>
      <Eyes skin={SKIN} lid={0.16} y={112} />


      {/* Frames over the eyes: a faint lens tint, the ink edge, the grey acetate. */}
      <path d={RIM_L} fill={BUTTON} fillOpacity={0.14} />
      <path d={RIM_R} fill={BUTTON} fillOpacity={0.14} />
      <g fill="none" strokeLinejoin="round" strokeLinecap="round">
        <path d={RIM_L} stroke={INK} strokeWidth={5.5} />
        <path d={RIM_R} stroke={INK} strokeWidth={5.5} />
        <path d="M95 106Q100 102 105 106" stroke={INK} strokeWidth={5} />
        <path d={RIM_L} stroke={FRAME} strokeWidth={2} />
        <path d={RIM_R} stroke={FRAME} strokeWidth={2} />
        <path d="M95 106Q100 102 105 106" stroke={FRAME} strokeWidth={1.8} />
      </g>
      <Line d="M64 104L56 106" w={3.5} />
      <Line d="M99 126L97 130Q101 134 106 131" />
      <Line d="M136 104L144 106" w={3.5} />


      <Mouth y={148} scale={1.1}>
        <path d="M85 145Q100 160 115 145Q100 150 85 145Z" fill={TEETH} stroke={INK} strokeWidth={3} strokeLinejoin="round" />
      </Mouth>
      <Fill d={TACHE_L} fill={BEARD} />
      <Fill d={mirror(TACHE_L)} fill={BEARD} />
      {/* A soft chin line, now that no beard defines the jaw. */}
      <Line d="M92 158Q100 161 108 158" w={2.5} color={SKIN_SHADE} />
    </>
  ),
};
