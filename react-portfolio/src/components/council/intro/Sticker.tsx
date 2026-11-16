'use client';

import React, { memo, useEffect, useMemo, useRef } from 'react';
import { MotionValue, motion, useTransform } from 'framer-motion';
import { PortraitMood, Seat } from '@/lib/council/contract';
import { SeatPortrait } from '@/components/council/portraits';
import { IntroLayout, Pose } from './layout';
import { ASSEMBLY_STEP, MEMBER_COUNT, liftAt } from './sequence';
import styles from './intro.module.css';

/** How much bigger a sticker looks at full lift. It is closer to the eye. */
const LIFT_SCALE = 0.2;
/** The shadow at rest and at full lift, in screen pixels. Lifted, it slides away from the sticker and thins. */
const SHADOW = { restY: 4, liftY: 30, liftX: 10, restOpacity: 0.3, liftOpacity: 0.15 } as const;
/** How long after its last movement a sticker gives its compositor layer back. Milliseconds. */
const SETTLE_MS = 240;

const mix = (from: number, to: number, amount: number) => from + (to - from) * amount;

interface Track {
  keys: number[];
  cx: number[];
  cy: number[];
  width: number[];
  rotate: number[];
}

/**
 * The places one member passes through, keyed by progress: out of frame,
 * waiting at the edge of the stage, the stage, its place in the lineup, and
 * finally the assembly.
 */
function poseTrack(index: number, layout: IntroLayout): Track {
  const { waiting } = layout;
  const offstage: Pose = { ...waiting, cx: waiting.cx + waiting.width * 1.1 };
  const stops: Array<[number, Pose]> = [
    [index - 2, offstage],
    // One step early, they slide into view and wait their turn.
    [index - 1, waiting],
    [index, layout.stage],
  ];
  if (index < MEMBER_COUNT - 1) {
    stops.push([index + 1, layout.slots[index]]);
    if (index + 1 < ASSEMBLY_STEP - 1) stops.push([ASSEMBLY_STEP - 1, layout.slots[index]]);
  }
  stops.push([ASSEMBLY_STEP, layout.assembly[index]]);
  return {
    keys: stops.map(([key]) => key),
    cx: stops.map(([, pose]) => pose.cx),
    cy: stops.map(([, pose]) => pose.cy),
    width: stops.map(([, pose]) => pose.width),
    rotate: stops.map(([, pose]) => pose.rotate),
  };
}

export interface StickerProps {
  index: number;
  seat: Seat;
  layout: IntroLayout;
  progress: MotionValue<number>;
  /** 0 normally. Sprung to 1 on a skip, to bring every sticker to its assembled place by the direct route. */
  gather: MotionValue<number>;
  /** Squash on impact, added to scale. Sprung by the intro when this sticker lands. */
  press: MotionValue<number>;
  /** Rotation wobble on impact, in degrees. */
  wobble: MotionValue<number>;
  /** `dimmed` while this member is still locked, waiting to be scrolled to. */
  mood: PortraitMood;
  /** Show "lens" after the lens name, as the scene does above phone widths. */
  showSuffix: boolean;
  /** Carry the scene's layoutId, so the seats can take over from this sticker. Off for the fade exit. */
  shareLayout: boolean;
}

export const Sticker = memo(function Sticker({
  index,
  seat,
  layout,
  progress,
  gather,
  press,
  wobble,
  mood,
  showSuffix,
  shareLayout,
}: StickerProps) {
  const anchorRef = useRef<HTMLDivElement>(null);
  const tiltRef = useRef<HTMLDivElement>(null);
  const shadowRef = useRef<HTMLDivElement>(null);
  const track = useMemo(() => poseTrack(index, layout), [index, layout]);
  const size = layout.renderSize;

  // Where the sequence puts this sticker...
  const trackX = useTransform(progress, track.keys, track.cx);
  const trackY = useTransform(progress, track.keys, track.cy);
  const trackWidth = useTransform(progress, track.keys, track.width);
  const trackTilt = useTransform(progress, track.keys, track.rotate);
  const trackLift = useTransform(progress, (value) => liftAt(index, value));
  // Out of frame until the member before them is nearly on stage.
  const trackOpacity = useTransform(progress, [index - 1.7, index - 1.3], [0, 1]);
  // ...and `gather` pulling it from there straight to its assembled place,
  // whatever it was doing, when the visitor skips.
  const home = layout.assembly[index];
  const x = useTransform(() => mix(trackX.get(), home.cx, gather.get()));
  const y = useTransform(() => mix(trackY.get(), home.cy, gather.get()));
  const width = useTransform(() => mix(trackWidth.get(), home.width, gather.get()));
  const tilt = useTransform(() => mix(trackTilt.get(), home.rotate, gather.get()));
  const lift = useTransform(() => trackLift.get() * (1 - gather.get()));
  const scale = useTransform(() => (width.get() / size) * (1 + LIFT_SCALE * lift.get()));
  const opacity = useTransform(() => Math.max(trackOpacity.get(), Math.min(1, gather.get() * 1.6)));
  const rotate = useTransform(() => tilt.get() + wobble.get());
  const squash = useTransform(press, (value) => 1 + value);
  // The shadow lives inside the scaled sticker, so screen pixels are divided
  // by the scale to keep its offset honest at every size.
  const shadowX = useTransform(() => (SHADOW.liftX * lift.get()) / scale.get());
  const shadowY = useTransform(() => (SHADOW.restY + (SHADOW.liftY - SHADOW.restY) * lift.get()) / scale.get());
  const shadowOpacity = useTransform(lift, [0, 1], [SHADOW.restOpacity, SHADOW.liftOpacity]);
  const trackTag = useTransform(progress, [ASSEMBLY_STEP - 0.5, ASSEMBLY_STEP], [0, 1]);
  const tagOpacity = useTransform(() => Math.max(trackTag.get(), gather.get()));

  // A compositor layer only while moving. In flight the sticker must not
  // repaint, but a permanent layer keeps its stage-size raster and a lineup
  // sticker would be that raster squeezed to a quarter by the GPU: soft and
  // shimmering. Dropping the layer at rest lets the browser redraw the vector
  // art crisply at whatever size it settled.
  useEffect(() => {
    const nodes = [anchorRef.current, tiltRef.current, shadowRef.current];
    let timer: ReturnType<typeof setTimeout> | undefined;
    const settle = () => {
      timer = undefined;
      nodes.forEach((node) => node?.style.removeProperty('will-change'));
    };
    const moving = () => {
      if (timer === undefined) nodes.forEach((node) => node?.style.setProperty('will-change', 'transform, opacity'));
      else clearTimeout(timer);
      timer = setTimeout(settle, SETTLE_MS);
    };
    const stops = [x.on('change', moving), scale.on('change', moving), press.on('change', moving), wobble.on('change', moving)];
    return () => {
      stops.forEach((stop) => stop());
      if (timer !== undefined) clearTimeout(timer);
      settle();
    };
  }, [x, scale, press, wobble]);

  const [lensName, ...lensRest] = seat.lensLabel.split(' ');

  return (
    <motion.div ref={anchorRef} className={styles.sticker} style={{ x, y, scale, opacity, zIndex: index + 1 }}>
      {/* The same box as a seat in the scene (portrait, gap, lens tag), so the
          shared-layout handoff is a move and not a stretch. It carries no
          transform of its own: framer measures it clean. */}
      <motion.div
        className={styles.seatBox}
        layoutId={shareLayout ? `council-seat-${seat.id}` : undefined}
        layoutDependency={0}
        data-seat={seat.id}
      >
        <motion.div ref={tiltRef} className={styles.tilt} style={{ rotate, scale: squash }}>
          {/* The shadow is a second, frozen copy of the portrait, blacked out
              and blurred once. Moving it is then only transform and opacity,
              where a drop-shadow on the sticker would be re-filtered on every
              frame the face blinks or talks. */}
          <motion.div ref={shadowRef} className={styles.shadow} style={{ x: shadowX, y: shadowY, opacity: shadowOpacity }}>
            <SeatPortrait seatId={seat.id} size={size} mood="idle" className={styles.shadowArt} />
          </motion.div>
          <SeatPortrait seatId={seat.id} size={size} mood={mood} />
        </motion.div>
        <motion.span className={styles.tag} data-odd={index % 2 === 1 || undefined} style={{ opacity: tagOpacity }}>
          {lensName}
          {showSuffix && lensRest.length > 0 && ` ${lensRest.join(' ')}`}
        </motion.span>
      </motion.div>
    </motion.div>
  );
});
