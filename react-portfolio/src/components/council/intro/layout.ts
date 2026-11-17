import { PORTRAIT_ASPECT } from './constants';
import { viewScale } from '../scale';

// Where everything sits, computed from the viewport instead of measured from
// the DOM, so the stickers can be driven by transforms alone and the whole
// arrangement can be unit tested. All coordinates are in overlay pixels.

/** A sticker's resting place: the centre of its portrait, the portrait's width, and its tilt in degrees. */
export interface Pose {
  cx: number;
  cy: number;
  width: number;
  rotate: number;
}

export interface Box {
  left: number;
  top: number;
  width: number;
}

export interface IntroLayout {
  w: number;
  h: number;
  /** Side by side (portrait left, bubble right) instead of stacked. */
  wide: boolean;
  /** The `size` every portrait is rendered at. Smaller poses scale down from it, so nothing is ever upscaled. */
  renderSize: number;
  stage: Pose;
  /**
   * Where the next member waits, locked: small, at the right edge of the
   * stage and partly off it, until the scroll reaches them.
   */
  waiting: Pose;
  /** The six lineup places along the top, which double as the progress marks. */
  slots: Pose[];
  /** The assembled council behind the beats. Sized like the scene's seats so the handoff is a short hop. */
  assembly: Pose[];
  bubble: Box & { tail: 'up' | 'left' };
  card: Box;
  /** Top of the row of progress strokes under the lineup. */
  marksTop: number;
  /** Height of the band at the bottom kept clear for the scroll cue. */
  cueBand: number;
}

export interface Viewport {
  w: number;
  h: number;
  safeTop?: number;
  safeBottom?: number;
}

/** Resting tilt per seat. The same values the scene uses, so a handed-off sticker does not twitch. */
export const SEAT_TILTS = [-5, 3.5, -2.5, 3, -4, 5] as const;

/** Height added under a portrait by its lens tag, at seat scale: 7px gap plus a 24px tag. */
export const TAG_BLOCK = 31;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/**
 * The scene's own seat sizes for the empty state (see seatSize in CouncilScene),
 * at design scale. Pass the height too to get the size the scene actually
 * renders on a screen bigger than the laptop it was drawn on.
 */
export function sceneSeatSize(w: number, h?: number): number {
  const base = w <= 359 ? 70 : w <= 768 ? 86 : w <= 1100 ? 104 : 124;
  return h === undefined ? base : Math.round(base * viewScale(w, h));
}

/**
 * The intro is laid out at the scene's design scale and grown with it on a
 * big screen, so the stickers land on seats of the size the scene renders.
 */
export function computeLayout(viewport: Viewport): IntroLayout {
  const k = viewScale(viewport.w, viewport.h);
  if (k === 1) return computeDesignLayout(viewport);
  const base = computeDesignLayout({
    w: viewport.w / k,
    h: viewport.h / k,
    safeTop: (viewport.safeTop ?? 0) / k,
    safeBottom: (viewport.safeBottom ?? 0) / k,
  });
  const pose = (p: Pose): Pose => ({ ...p, cx: p.cx * k, cy: p.cy * k, width: p.width * k });
  const box = <B extends Box>(b: B): B => ({ ...b, left: b.left * k, top: b.top * k, width: b.width * k });
  return {
    ...base,
    w: viewport.w,
    h: viewport.h,
    // Rounded up, so no pose is ever drawn larger than the portrait is rendered.
    renderSize: Math.ceil(base.stage.width * k),
    stage: pose(base.stage),
    waiting: pose(base.waiting),
    slots: base.slots.map(pose),
    // The scene rounds its seat size; land on exactly that so the handoff does not resize.
    assembly: base.assembly.map((p) => ({ ...pose(p), width: Math.min(p.width * k, sceneSeatSize(viewport.w, viewport.h)) })),
    bubble: box(base.bubble),
    card: box(base.card),
    marksTop: base.marksTop * k,
    cueBand: base.cueBand * k,
  };
}

function computeDesignLayout({ w, h, safeTop = 0, safeBottom = 0 }: Viewport): IntroLayout {
  const wide = w >= 900 && w / h >= 1.1;
  const pad = w < 360 ? 12 : w < 600 ? 16 : 28;
  const topBar = 48;
  // The scroll cue: a 48px control, 18px off the bottom, and air above it.
  const cueBand = 48 + 18 + 18;

  // --- Lineup ---------------------------------------------------------------
  const gap = wide ? 16 : w < 360 ? 6 : w < 600 ? 8 : 16;
  const slotW = wide ? 62 : clamp((w - 2 * pad - 5 * gap) / 6, 34, 72);
  const slotH = slotW * PORTRAIT_ASPECT;
  const lineupW = 6 * slotW + 5 * gap;
  // On a wide screen the lineup shares the top row with the title and Skip.
  const lineupTop = wide ? safeTop + 18 : safeTop + topBar + 10;
  const slots: Pose[] = SEAT_TILTS.map((tilt, i) => ({
    cx: (w - lineupW) / 2 + slotW / 2 + i * (slotW + gap),
    cy: lineupTop + slotH / 2,
    width: slotW,
    rotate: tilt * 0.7,
  }));
  const marksTop = lineupTop + slotH + 9;

  // --- Stage and bubble -----------------------------------------------------
  const contentTop = marksTop + 3 + (wide ? 22 : 16);
  const contentBottom = h - safeBottom - cueBand;
  const avail = Math.max(120, contentBottom - contentTop);

  let stage: Pose;
  let bubble: IntroLayout['bubble'];
  if (wide) {
    const size = clamp(Math.min(h * 0.34, avail / PORTRAIT_ASPECT - 16), 150, 300);
    const bubbleW = clamp(w * 0.34, 360, 480);
    const between = 44;
    const left = (w - (size + between + bubbleW)) / 2;
    const cy = contentTop + avail / 2 - 8;
    stage = { cx: left + size / 2, cy, width: size, rotate: -2 };
    // Anchored on its vertical centre, level with the face.
    bubble = { left: left + size + between, top: cy - size * 0.12, width: bubbleW, tail: 'left' };
  } else {
    const bubbleW = Math.min(w - 2 * pad, 460);
    // Room held for the bubble: three lines of worldview on a phone, two on a tablet.
    const bubbleReserve = w < 600 ? 196 : 172;
    const between = 20;
    const size = clamp(Math.min(w * 0.54, (avail - bubbleReserve - between) / PORTRAIT_ASPECT), 88, 300);
    const group = size * PORTRAIT_ASPECT + between + bubbleReserve;
    const top = contentTop + Math.max(0, (avail - group) * 0.42);
    stage = { cx: w / 2, cy: top + (size * PORTRAIT_ASPECT) / 2, width: size, rotate: -2 };
    bubble = { left: (w - bubbleW) / 2, top: top + size * PORTRAIT_ASPECT + between, width: bubbleW, tail: 'up' };
  }

  // Mostly out of frame: enough face to recognise, not enough to have arrived.
  const waitingWidth = stage.width * 0.62;
  const waiting: Pose = {
    cx: w + waitingWidth * 0.06,
    cy: stage.cy + stage.width * 0.2,
    width: waitingWidth,
    rotate: 9,
  };

  // --- Assembly and beat card -----------------------------------------------
  const seat = sceneSeatSize(w);
  const areaTop = safeTop + topBar + 8;
  const areaBottom = h - safeBottom - cueBand;
  const area = Math.max(160, areaBottom - areaTop);
  let assembly: Pose[];
  let card: Box;
  if (wide) {
    const cardW = Math.min(560, w - 2 * pad);
    const cardReserve = 132;
    const between = 30;
    // The outer seats sit lower, as on the scene's arc.
    const arc = [44, 14, 0, 0, 14, 44];
    const fit = (area - cardReserve - between - TAG_BLOCK - 44) / PORTRAIT_ASPECT;
    const size = clamp(Math.min(seat, fit), 48, seat);
    const drop = size / 124;
    const pitch = Math.min(size + 64, (Math.min(w, 1180) - 2 * pad) / 6);
    const total = 44 * drop + size * PORTRAIT_ASPECT + TAG_BLOCK + between + cardReserve;
    const top = areaTop + Math.max(0, (area - total) * 0.42);
    assembly = SEAT_TILTS.map((tilt, i) => ({
      cx: w / 2 + (i - 2.5) * pitch,
      cy: top + arc[i] * drop + (size * PORTRAIT_ASPECT) / 2,
      width: size,
      rotate: tilt,
    }));
    card = { left: (w - cardW) / 2, top: top + 44 * drop + size * PORTRAIT_ASPECT + TAG_BLOCK + between, width: cardW };
  } else {
    // Two rows of three, as the scene seats them on a phone.
    const cardW = Math.min(w - 2 * pad, 520);
    const cardReserve = 150;
    const between = 22;
    const rowGap = 12;
    const fit = (area - cardReserve - between - 2 * TAG_BLOCK - rowGap) / 2 / PORTRAIT_ASPECT;
    const size = clamp(Math.min(seat, fit), 44, seat);
    const rowPitch = size * PORTRAIT_ASPECT + TAG_BLOCK + rowGap;
    const colPitch = Math.min((w - 2 * pad) / 3, size + 46);
    const gridH = 2 * (size * PORTRAIT_ASPECT + TAG_BLOCK) + rowGap;
    const total = gridH + between + cardReserve;
    const top = areaTop + Math.max(0, (area - total) * 0.4);
    // The middle seat of each row rides a touch higher, so the group reads as gathered, not gridded.
    const lift = [6, 0, 6];
    assembly = SEAT_TILTS.map((tilt, i) => ({
      cx: w / 2 + ((i % 3) - 1) * colPitch,
      cy: top + Math.floor(i / 3) * rowPitch + lift[i % 3] + (size * PORTRAIT_ASPECT) / 2,
      width: size,
      rotate: tilt,
    }));
    card = { left: (w - cardW) / 2, top: top + gridH + between + 6, width: cardW };
  }

  return {
    w,
    h,
    wide,
    renderSize: Math.round(stage.width),
    stage,
    waiting,
    slots,
    assembly,
    bubble,
    card,
    marksTop,
    cueBand,
  };
}
