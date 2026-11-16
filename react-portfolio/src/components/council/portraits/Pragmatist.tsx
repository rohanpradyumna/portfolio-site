import React from 'react';
import { SEAT_ACCENTS } from '@/lib/council/contract';
import { BUST, Blob, Brows, DETAIL, Eyes, Fill, Line, Mouth, NECK, PortraitDef, circ, ell, mirror } from './kit';

// William James, after the late photographs: a tall bare forehead, wisps of
// grey flying out over the ears, a broad squared beard under a walrus
// moustache, and a kindly, alert look.

const SKIN = '#f2c9a9';
const SKIN_SHADE = '#e0a988';
const BLUSH = '#eda58e';
const HAIR = '#c3b9a8';
const BEARD_FILL = '#d6cfc2';
const HAIR_SHADE = '#a69d8e';
const TACHE = '#dedacf';
const BROW = '#7a6d61';
const JACKET = SEAT_ACCENTS.pragmatist;
const JACKET_SHADE = '#2c5687';
const SHIRT = '#fffdf8';
const BOW = '#e6b32a';
const BOW_SHADE = '#c9951a';

const FACE_J = 'M56 108C56 74 74 52 100 52C126 52 144 74 144 108C144 138 126 162 100 162C74 162 56 138 56 108Z';
const FACE_J_SHADE = 'M144 108C144 138 126 162 100 162C118 155 135 136 135 108C135 86 130 70 120 59C136 68 144 88 144 108Z';
const EAR_L = ell(53, 116, 7, 10);
const EAR_R = ell(147, 116, 7, 10);

const TOP_HAIR = 'M58 88C60 60 82 44 102 44C122 44 140 60 142 88C136 72 124 62 110 59C98 56 84 58 75 64C66 70 61 78 58 88Z';
const TUFTS = [
  circ(53, 86, 10),
  circ(45, 99, 11.5),
  circ(47, 113, 9),
  circ(147, 86, 10),
  circ(155, 99, 11.5),
  circ(153, 113, 9),
];

const BEARD =
  'M56 118C58 131 66 139 80 141C88 134 94 132 100 132C106 132 112 134 120 141C134 139 142 131 144 118C150 138 149 160 144 176C139 189 120 193 100 190C80 193 61 189 56 176C51 160 50 138 56 118Z';
const TACHE_L = 'M101 133C93 128 80 132 71 148C84 152 97 147 101 140Z';

const LAPEL_L = 'M82 178L100 224L74 226L60 200L72 196L66 186Z';
const BOW_L = 'M100 212L85 203L85 221Z';

export const pragmatist: PortraitDef = {
  sil: {
    body: [BUST],
    head: [FACE_J, EAR_L, EAR_R, TOP_HAIR, ...TUFTS, BEARD],
  },
  body: (
    <>
      <Blob parts={[BUST]} fill={JACKET} />
      <Fill d="M82 178L100 224L118 178Z" fill={SHIRT} />
      <Blob parts={[LAPEL_L]} fill={JACKET_SHADE} w={DETAIL} />
      <Blob parts={[mirror(LAPEL_L)]} fill={JACKET_SHADE} w={DETAIL} />
      <Blob parts={[NECK]} fill={SKIN_SHADE} />
      <Blob parts={['M82 178L100 206L88 212L76 192Z', 'M118 178L100 206L112 212L124 192Z']} fill={SHIRT} w={DETAIL} />
      <Blob parts={[BOW_L, mirror(BOW_L)]} fill={BOW} w={DETAIL} />
      {[
        [89.5, 208.5],
        [90, 215.5],
        [110.5, 208.5],
        [110, 215.5],
      ].map(([x, y]) => (
        <Fill key={`${x}-${y}`} d={circ(x, y, 1.5)} fill={JACKET_SHADE} />
      ))}
      <Blob parts={[circ(100, 212, 4.5)]} fill={BOW_SHADE} w={DETAIL} />
    </>
  ),
  head: (
    <>
      <Blob parts={[EAR_L, EAR_R]} fill={SKIN} />
      <Blob parts={[FACE_J]} fill={SKIN} />
      <Fill d={FACE_J_SHADE} fill={SKIN_SHADE} />

      <Line d="M84 80Q100 76 116 80" w={3} color={SKIN_SHADE} />
      <Line d="M88 88Q100 85 112 88" w={3} color={SKIN_SHADE} />
      <Fill d={ell(72, 128, 7.5, 4.5)} fill={BLUSH} />
      <Fill d={ell(128, 128, 7.5, 4.5)} fill={BLUSH} />

      <Brows>
        <Line d="M69 102Q80 95 92 100" w={5.5} color={BROW} />
        <Line d="M108 100Q120 95 131 102" w={5.5} color={BROW} />
      </Brows>
      <Eyes skin={SKIN} lid={0.14} />
      <Line d="M75 120.5Q81 117.5 87 120.5" w={3} color={SKIN_SHADE} />
      <Line d="M113 120.5Q119 117.5 125 120.5" w={3} color="#cf9877" />
      <Line d="M100 110L97 126Q101 131 107 127" />

      <Blob parts={[BEARD]} fill={BEARD_FILL} />
      <Fill d="M56 118C58 131 66 139 80 141C74 150 68 160 66 172C62 176 58 178 56 176C51 160 50 138 56 118Z" fill={HAIR} />
      <Fill d="M144 118C142 131 134 139 120 141C126 150 132 160 134 172C138 176 142 178 144 176C149 160 150 138 144 118Z" fill={HAIR} />
      <Line d="M82 160C80 168 81 176 85 183" w={3.5} color={HAIR_SHADE} />
      <Line d="M100 164L100 190" w={3.5} color={HAIR_SHADE} />
      <Line d="M118 160C120 168 119 176 115 183" w={3.5} color={HAIR_SHADE} />
      <Blob parts={[TOP_HAIR, ...TUFTS]} fill={HAIR} />
      <Line d="M76 62C84 54 94 51 104 51" w={3} color={HAIR_SHADE} />
      <Line d="M110 52C118 53 126 58 131 65" w={3} color={HAIR_SHADE} />
      <Line d="M47 92C44 98 44 104 47 110" w={3} color={HAIR_SHADE} />
      <Line d="M153 92C156 98 156 104 153 110" w={3} color={HAIR_SHADE} />
      <Mouth y={149}>
        <Line d="M95 149Q100 151.5 105 149" />
      </Mouth>
      <Blob parts={[TACHE_L, mirror(TACHE_L)]} fill={TACHE} w={DETAIL} />
    </>
  ),
};
