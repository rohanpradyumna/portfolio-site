import React from 'react';
import { SEAT_ACCENTS } from '@/lib/council/contract';
import { BUST, Blob, Brows, Eyes, FACE_D, FACE_SHADE_D, Fill, Line, Mouth, NECK, PortraitDef, circ, ell } from './kit';

// Adi Shankara, after the traditional iconography: shaved head, the three
// ash lines of the tripundra across the forehead, a robe over one shoulder,
// rudraksha beads and a settled, gentle expression. Drawn plainly and with
// respect: nothing here is exaggerated for effect.

const SKIN = '#cd9365';
const SKIN_SHADE = '#b5794d';
const SCALP = '#b98862';
const ROBE = SEAT_ACCENTS.advaita;
const ROBE_SHADE = '#dd8f24';
const ASH = '#f8f0e1';
const BINDU = '#c4472a';
const BEAD = '#84472c';
const BROW = '#3a2a20';

const EAR_L = ell(52, 118, 7.5, 13);
const EAR_R = ell(148, 118, 7.5, 13);
const ROBE_D = 'M116 180L134 182C164 188 178 200 178 226L34 226C76 219 106 204 116 184Z';

const BEADS = Array.from({ length: 11 }, (_, i) => {
  const a = ((204 + i * 13.2) * Math.PI) / 180;
  return circ(100 + 29 * Math.cos(a), 183 - 27 * Math.sin(a), 4.2);
});

export const advaita: PortraitDef = {
  scribble: '#c98a14',
  sil: {
    body: [BUST],
    head: [FACE_D, EAR_L, EAR_R],
  },
  body: (
    <>
      <Blob parts={[BUST, { d: ROBE_D, fill: ROBE }, NECK]} fill={SKIN} />
      <Line d="M130 188C124 205 104 219 80 226" w={5} color={ROBE_SHADE} />
      <Line d="M152 194C148 209 136 220 120 226" w={5} color={ROBE_SHADE} />
      <Line d="M116 184C106 204 76 219 34 226" />
      <Line d="M52 196C60 194 68 194 74 197" w={3} color={SKIN_SHADE} />
      <Fill d="M84 150L116 150L116 172C106 178 94 178 84 172Z" fill={SKIN_SHADE} />
      {BEADS.map((d, i) => (
        <Blob key={i} parts={[d]} fill={BEAD} w={2.5} />
      ))}
    </>
  ),
  head: (
    <>
      <Blob parts={[EAR_L, EAR_R]} fill={SKIN} />
      <Line d="M51 112C48 116 48 121 51 125" w={2.5} color={SKIN_SHADE} />
      <Line d="M149 112C152 116 152 121 149 125" w={2.5} color={SKIN_SHADE} />
      <Blob parts={[FACE_D]} fill={SKIN} />
      <Fill d={FACE_SHADE_D} fill={SKIN_SHADE} />
      <Fill d="M61 90C62 72 78 60 100 60C122 60 138 72 139 90C129 75 116 68 100 68C84 68 71 75 61 90Z" fill={SCALP} />

      <Line d="M77 78Q100 74 123 78" w={4.5} color={ASH} />
      <Line d="M75 85.5Q100 81.5 125 85.5" w={4.5} color={ASH} />
      <Line d="M77 93Q100 89 123 93" w={4.5} color={ASH} />
      <Fill d={circ(100, 85, 3.8)} fill={BINDU} />

      <Brows>
        <Line d="M71 103Q81 98 92 102" w={4.5} color={BROW} />
        <Line d="M108 102Q119 98 129 103" w={4.5} color={BROW} />
      </Brows>
      <Eyes skin={SKIN} lid={0.4} y={113} />
      <Line d="M100 110L98 127Q101 131 106 128" />

      <Mouth y={144}>
        <Line d="M90 143.5Q100 150.5 110 143.5" />
      </Mouth>
    </>
  ),
};
