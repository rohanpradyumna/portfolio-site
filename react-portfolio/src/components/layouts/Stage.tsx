'use client';

import React, { useCallback, useMemo } from 'react';
import { MotionConfig } from 'framer-motion';
import { useDimensions, DESIGN_W, DESIGN_H } from '@/hooks/useDimensions';

// Viewport breathing room (px) kept around the content on every edge.
const VIEWPORT_MARGIN = 32;

// Uniform scale bounds. Floor keeps the board readable in small desktop windows;
// the ceiling stops it from "buffing up" to fill large external monitors; past
// this the board just gains comfortable margin rather than growing further.
const STAGE_MIN_SCALE = 0.7;
const STAGE_MAX_SCALE = 1.4;

interface ContentBox {
  w: number;
  h: number;
  cx: number;
  cy: number;
}

/**
 * Fixed-size design canvas, uniformly scaled to fit the actual content cluster
 * into the viewport and centered on screen.
 *
 * Rather than fitting the empty DESIGN_W x DESIGN_H frame (which wastes space and
 * makes the board look small on monitors), we fit the measured content bounding
 * box. The scale uses the SMALLER of the width/height fit ratios so the cluster is
 * always contained on both axes, so a wide-but-short window can never push vertical
 * stickers off-screen (the original distortion bug). The content box center is then
 * translated to the viewport center.
 *
 * framer-motion already compensates for a scaled ancestor when dragging, so
 * stickers/cards inside the stage still track the cursor 1:1. (Do NOT add a
 * transformPagePoint correction, which double-corrects and breaks drag tracking.)
 */
export function Stage({
  bbox,
  children,
}: {
  bbox: ContentBox | null;
  children: React.ReactNode;
}) {
  const { w: vw, h: vh } = useDimensions();

  const { scale, tx, ty } = useMemo(() => {
    if (!bbox || bbox.w <= 0 || bbox.h <= 0) {
      // Fallback: fit/center the whole design frame.
      const fit = Math.min(vw / DESIGN_W, vh / DESIGN_H);
      const s = Math.max(STAGE_MIN_SCALE, Math.min(STAGE_MAX_SCALE, fit));
      return {
        scale: s,
        tx: vw / 2 - (DESIGN_W / 2) * s,
        ty: vh / 2 - (DESIGN_H / 2) * s,
      };
    }

    const fit = Math.min(
      (vw - 2 * VIEWPORT_MARGIN) / bbox.w,
      (vh - 2 * VIEWPORT_MARGIN) / bbox.h
    );
    const s = Math.max(STAGE_MIN_SCALE, Math.min(STAGE_MAX_SCALE, fit));

    // Place the content-box center at the viewport center.
    return {
      scale: s,
      tx: vw / 2 - bbox.cx * s,
      ty: vh / 2 - bbox.cy * s,
    };
  }, [vw, vh, bbox]);

  // The board is a plain CSS-transformed div, so framer-motion has no idea its
  // draggables live inside a scaled ancestor. Without help it moves a sticker by
  // the raw cursor delta in DESIGN space, so on-screen it travels delta*scale and
  // outruns the cursor on big monitors. Dividing every page point by the scale
  // makes the drag offset land in design space (delta/scale), which renders back
  // as exactly the cursor delta → true 1:1 tracking. Scoped here so it only ever
  // touches the scaled subtree (stickers + cards); modals live outside the Stage.
  const transformPagePoint = useCallback(
    (point: { x: number; y: number }) => ({ x: point.x / scale, y: point.y / scale }),
    [scale]
  );

  return (
    <MotionConfig transformPagePoint={transformPagePoint}>
      <div
        data-stage
        suppressHydrationWarning
        style={{
          position: 'fixed',
          left: 0,
          top: 0,
          width: DESIGN_W,
          height: DESIGN_H,
          transform: `translate(${tx}px, ${ty}px) scale(${scale})`,
          transformOrigin: '0 0',
          zIndex: 1,
        }}
      >
        {children}
      </div>
    </MotionConfig>
  );
}
