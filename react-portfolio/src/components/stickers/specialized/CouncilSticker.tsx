'use client';

import React from 'react';
import { Sticker, StickerProps } from '../base/Sticker';
import { useResponsive } from '@/hooks/useDimensions';
import { CouncilEntryArt } from '@/components/council/portraits';

export const COUNCIL_STICKER_SIZE = 116;

// Entry point to /council. The art lives with the council portraits so the
// homepage sticker and the seats stay one illustrated family.
export function CouncilSticker(props: Omit<StickerProps, 'children'>) {
  const { s } = useResponsive();

  return (
    <Sticker {...props}>
      <CouncilEntryArt size={s(COUNCIL_STICKER_SIZE)} />
    </Sticker>
  );
}
