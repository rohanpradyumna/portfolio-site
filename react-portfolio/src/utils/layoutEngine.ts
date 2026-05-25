import { Position, StickerPosition } from '@/types';

interface OrbitalConfig {
  cx: number;
  cy: number;
  cardW: number;
  cardH: number;
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
  const { cx, cy, cardW, cardH } = config;
  const angle = (angleDeg * Math.PI) / 180;

  // Elliptical base distance accounts for card dimensions
  const baseX = cardW / 2 + 40; // card half-width + padding
  const baseY = cardH / 2 + 40; // card half-height + padding

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
 * Simple overlap resolution (original algorithm)
 */
export function resolveOverlapsSimple(
  list: (StickerPosition & { id: string })[]
): (StickerPosition & { id: string })[] {
  const result = list.map((s) => ({ ...s }));

  for (let i = 0; i < result.length; i++) {
    for (let j = 0; j < i; j++) {
      let tries = 0;
      while (overlaps(result[i], result[j]) && tries < 30) {
        const ax = result[i].x + result[i].w / 2;
        const ay = result[i].y + result[i].h / 2;
        const bx = result[j].x + result[j].w / 2;
        const by = result[j].y + result[j].h / 2;

        const dx = ax - bx || 0.5;
        const dy = ay - by || 0.5;
        const len = Math.hypot(dx, dy) || 1;

        result[i].x += (dx / len) * 10;
        result[i].y += (dy / len) * 10;
        tries++;
      }
    }
  }

  return result;
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
