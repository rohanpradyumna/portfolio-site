import { Position, StickerPosition } from '@/types';

interface OrbitalConfig {
  cx: number;
  cy: number;
  cardW: number;
  cardH: number;
  padding?: number; // Scaled padding from card edge (default 40)
}

interface ZoneConfig {
  screenW: number;
  screenH: number;
  cardW: number;
  cardH: number;
}

type Zone = 'top-left' | 'top' | 'top-right' | 'right' | 'bottom-right' | 'bottom-left' | 'left' | 'far-left';

/**
 * Place a sticker in a zone with natural variation
 * Creates organic, hand-placed feeling layouts
 */
export function placeInZone(
  zone: Zone,
  offsetX: number,
  offsetY: number,
  w: number,
  h: number,
  rot: number,
  config: ZoneConfig
): StickerPosition {
  const { screenW, screenH, cardW, cardH } = config;
  const cx = screenW / 2;
  const cy = screenH / 2;

  // Card boundaries with padding
  const cardLeft = cx - cardW / 2 - 60;
  const cardRight = cx + cardW / 2 + 60;
  const cardTop = cy - cardH / 2 - 60;
  const cardBottom = cy + cardH / 2 + 60;

  let baseX = 0;
  let baseY = 0;

  switch (zone) {
    case 'top-left':
      baseX = cardLeft * 0.4;
      baseY = cardTop * 0.5;
      break;
    case 'top':
      baseX = cx;
      baseY = cardTop * 0.4;
      break;
    case 'top-right':
      baseX = cardRight + (screenW - cardRight) * 0.4;
      baseY = cardTop * 0.5;
      break;
    case 'right':
      baseX = cardRight + (screenW - cardRight) * 0.5;
      baseY = cy;
      break;
    case 'bottom-right':
      baseX = cardRight + (screenW - cardRight) * 0.4;
      baseY = cardBottom + (screenH - cardBottom) * 0.4;
      break;
    case 'bottom-left':
      baseX = cardLeft * 0.5;
      baseY = cardBottom + (screenH - cardBottom) * 0.4;
      break;
    case 'left':
      baseX = cardLeft * 0.5;
      baseY = cy;
      break;
    case 'far-left':
      baseX = cardLeft * 0.25;
      baseY = cy;
      break;
  }

  // Apply offsets (scaled to screen size for responsiveness)
  const x = baseX + offsetX - w / 2;
  const y = baseY + offsetY - h / 2;

  return { x, y, w, h, rot };
}

/**
 * Place a sticker at an orbital position around the center card
 * @param angleDeg - Angle in degrees (0 = right, 90 = bottom, 180 = left, 270 = top)
 * @param distance - Distance from the card edge
 * @param w - Sticker width
 * @param h - Sticker height
 * @param rot - Rotation in degrees
 * @param config - Center and card dimensions
 */
export function placeOrbital(
  angleDeg: number,
  distance: number,
  w: number,
  h: number,
  rot: number,
  config: OrbitalConfig
): StickerPosition {
  const { cx, cy, cardW, cardH, padding = 40 } = config;
  const angle = (angleDeg * Math.PI) / 180;

  // Elliptical base distance accounts for card dimensions
  const baseX = cardW / 2 + padding; // card half-width + scaled padding
  const baseY = cardH / 2 + padding; // card half-height + scaled padding

  // Calculate position on ellipse + additional distance
  const radiusX = baseX + distance;
  const radiusY = baseY + distance * 0.7; // Slightly compressed vertically

  const x = cx + Math.cos(angle) * radiusX - w / 2;
  const y = cy + Math.sin(angle) * radiusY - h / 2;

  return { x, y, w, h, rot };
}

/**
 * Check if two rectangles overlap
 */
export function overlaps(a: StickerPosition, b: StickerPosition, pad: number = 6): boolean {
  return (
    a.x + a.w + pad > b.x &&
    a.x < b.x + b.w + pad &&
    a.y + a.h + pad > b.y &&
    a.y < b.y + b.h + pad
  );
}

/**
 * Resolve overlapping stickers by pushing them apart
 * Uses a spring-based physics approach for smoother results
 */
export function resolveOverlaps(
  stickers: (StickerPosition & { id: string })[],
  options: {
    padding?: number;
    maxIterations?: number;
    springConstant?: number;
    dampening?: number;
  } = {}
): (StickerPosition & { id: string })[] {
  const { padding = 6, maxIterations = 50, springConstant = 0.5, dampening = 0.9 } = options;

  // Clone stickers to avoid mutation
  const list = stickers.map((s) => ({ ...s }));
  const velocities = list.map(() => ({ vx: 0, vy: 0 }));

  for (let iter = 0; iter < maxIterations; iter++) {
    let hasCollision = false;

    for (let i = 0; i < list.length; i++) {
      let fx = 0;
      let fy = 0;

      for (let j = 0; j < list.length; j++) {
        if (i === j) continue;

        const dx = list[i].x + list[i].w / 2 - (list[j].x + list[j].w / 2);
        const dy = list[i].y + list[i].h / 2 - (list[j].y + list[j].h / 2);
        const dist = Math.hypot(dx, dy) || 1;
        const minDist = (list[i].w + list[j].w) / 2 + padding;

        if (dist < minDist) {
          hasCollision = true;
          const force = springConstant * (minDist - dist);
          fx += (dx / dist) * force;
          fy += (dy / dist) * force;
        }
      }

      // Apply forces with dampening
      velocities[i].vx = velocities[i].vx * dampening + fx;
      velocities[i].vy = velocities[i].vy * dampening + fy;

      list[i].x += velocities[i].vx;
      list[i].y += velocities[i].vy;
    }

    if (!hasCollision) break;
  }

  return list;
}

/**
 * Simple overlap resolution with scaled push distance
 */
export function resolveOverlapsSimple(
  list: (StickerPosition & { id: string })[]
): (StickerPosition & { id: string })[] {
  const result = list.map((s) => ({ ...s }));

  for (let i = 0; i < result.length; i++) {
    for (let j = 0; j < i; j++) {
      let tries = 0;
      // Scale push distance based on average sticker size (larger stickers need bigger pushes)
      const avgSize = (result[i].w + result[i].h + result[j].w + result[j].h) / 4;
      const pushDistance = Math.max(10, avgSize * 0.12);

      while (overlaps(result[i], result[j]) && tries < 50) {
        const ax = result[i].x + result[i].w / 2;
        const ay = result[i].y + result[i].h / 2;
        const bx = result[j].x + result[j].w / 2;
        const by = result[j].y + result[j].h / 2;

        const dx = ax - bx || 0.5;
        const dy = ay - by || 0.5;
        const len = Math.hypot(dx, dy) || 1;

        result[i].x += (dx / len) * pushDistance;
        result[i].y += (dy / len) * pushDistance;
        tries++;
      }
    }
  }

  return result;
}

export interface ClusterBox {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface ClusterObstacle {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Spread an overlapping cluster apart just enough to give every box a breathing
 * gap, while keeping each box as close to its starting (orbital) home as possible.
 *
 * Each overlapping pair is separated along its axis of least penetration (minimal
 * translation), so stickers slide apart the smallest distance needed rather than
 * being flung radially. This preserves the hand-placed arrangement. Immovable
 * obstacles (the center card, the coffee machine) push stickers out but never move.
 * A weak per-iteration pull back toward home keeps drift small and the layout
 * recognisable. Operate on RENDER sizes for visual accuracy.
 */
export function resolveCluster(
  items: ClusterBox[],
  obstacles: ClusterObstacle[] = [],
  options: { pad?: number; iterations?: number; homePull?: number } = {}
): ClusterBox[] {
  const { pad = 12, iterations = 400, homePull = 0.02 } = options;
  const list = items.map((s) => ({ ...s }));
  const home = list.map((s) => ({ x: s.x, y: s.y }));

  // Push two boxes apart along their smallest-overlap axis. `bMovable=false`
  // means b is an immovable obstacle, so a absorbs the full push.
  const push = (a: ClusterBox, b: ClusterBox | ClusterObstacle, bMovable: boolean): boolean => {
    const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) + pad;
    const oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) + pad;
    if (ox <= 0 || oy <= 0) return false;
    const aCenterX = a.x + a.w / 2;
    const bCenterX = b.x + b.w / 2;
    const aCenterY = a.y + a.h / 2;
    const bCenterY = b.y + b.h / 2;
    let dx = 0;
    let dy = 0;
    if (ox < oy) dx = (aCenterX < bCenterX ? -1 : 1) * ox;
    else dy = (aCenterY < bCenterY ? -1 : 1) * oy;

    if (bMovable) {
      a.x += dx / 2;
      a.y += dy / 2;
      (b as ClusterBox).x -= dx / 2;
      (b as ClusterBox).y -= dy / 2;
    } else {
      a.x += dx;
      a.y += dy;
    }
    return true;
  };

  for (let iter = 0; iter < iterations; iter++) {
    let collided = false;

    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        if (push(list[i], list[j], true)) collided = true;
      }
      for (const ob of obstacles) {
        if (push(list[i], ob, false)) collided = true;
      }
    }

    // Weak spring back toward each box's original orbital home.
    for (let i = 0; i < list.length; i++) {
      list[i].x += (home[i].x - list[i].x) * homePull;
      list[i].y += (home[i].y - list[i].y) * homePull;
    }

    if (!collided) break;
  }

  return list;
}

/**
 * Convert array of sticker positions to a positions object
 */
export function positionsToObject(
  positions: (StickerPosition & { id: string })[]
): Record<string, Position> {
  const result: Record<string, Position> = {};
  positions.forEach((p) => {
    result[p.id] = { x: p.x, y: p.y, rot: p.rot };
  });
  return result;
}
