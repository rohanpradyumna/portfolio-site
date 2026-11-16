import { describe, expect, it } from 'vitest';
import { PORTRAIT_ASPECT } from './constants';
import { TAG_BLOCK, computeLayout, sceneSeatSize } from './layout';

const VIEWPORTS = [
  { name: 'small phone', w: 320, h: 568 },
  { name: 'phone', w: 390, h: 844, safeTop: 47, safeBottom: 34 },
  { name: 'short phone', w: 375, h: 667 },
  { name: 'tablet', w: 768, h: 1024 },
  { name: 'laptop', w: 1440, h: 900 },
  { name: 'short laptop', w: 1280, h: 620 },
  { name: 'wide monitor', w: 2560, h: 1300 },
];

describe('sceneSeatSize', () => {
  it('mirrors the scene breakpoints', () => {
    expect(sceneSeatSize(320)).toBe(70);
    expect(sceneSeatSize(390)).toBe(86);
    expect(sceneSeatSize(768)).toBe(86);
    expect(sceneSeatSize(1000)).toBe(104);
    expect(sceneSeatSize(1440)).toBe(124);
  });
});

describe.each(VIEWPORTS)('computeLayout on a $name', (viewport) => {
  const layout = computeLayout(viewport);
  const top = viewport.safeTop ?? 0;
  const bottom = viewport.h - (viewport.safeBottom ?? 0);

  it('keeps the stage portrait inside the viewport, clear of the safe areas', () => {
    const { cx, cy, width } = layout.stage;
    expect(cx - width / 2).toBeGreaterThanOrEqual(0);
    expect(cx + width / 2).toBeLessThanOrEqual(viewport.w);
    expect(cy - (width * PORTRAIT_ASPECT) / 2).toBeGreaterThanOrEqual(top);
    expect(cy + (width * PORTRAIT_ASPECT) / 2).toBeLessThanOrEqual(bottom);
  });

  it('never upscales a portrait: every pose is at or below the render size', () => {
    for (const pose of [layout.stage, ...layout.slots, ...layout.assembly]) {
      expect(pose.width).toBeLessThanOrEqual(layout.renderSize + 0.5);
    }
  });

  it('fits six lineup places across, in order, each a 44px target on a phone', () => {
    expect(layout.slots).toHaveLength(6);
    expect(layout.slots[0].cx - layout.slots[0].width / 2).toBeGreaterThanOrEqual(0);
    expect(layout.slots[5].cx + layout.slots[5].width / 2).toBeLessThanOrEqual(viewport.w);
    for (let i = 1; i < 6; i++) {
      expect(layout.slots[i].cx - layout.slots[i - 1].cx).toBeGreaterThanOrEqual(layout.slots[i].width);
    }
    expect(layout.slots[0].width * PORTRAIT_ASPECT).toBeGreaterThanOrEqual(44);
    expect(layout.slots[0].cy - (layout.slots[0].width * PORTRAIT_ASPECT) / 2).toBeGreaterThanOrEqual(top);
  });

  it('keeps the bubble and the card on screen horizontally', () => {
    for (const box of [layout.bubble, layout.card]) {
      expect(box.left).toBeGreaterThanOrEqual(0);
      expect(box.left + box.width).toBeLessThanOrEqual(viewport.w);
      expect(box.width).toBeGreaterThanOrEqual(280);
    }
  });

  it('seats the assembly above the card, at or under the scene seat size', () => {
    const lowest = Math.max(...layout.assembly.map((pose) => pose.cy + (pose.width * PORTRAIT_ASPECT) / 2));
    expect(lowest + TAG_BLOCK).toBeLessThanOrEqual(layout.card.top);
    for (const pose of layout.assembly) {
      expect(pose.width).toBeLessThanOrEqual(sceneSeatSize(viewport.w));
      expect(pose.cx - pose.width / 2).toBeGreaterThanOrEqual(0);
      expect(pose.cx + pose.width / 2).toBeLessThanOrEqual(viewport.w);
      expect(pose.cy - (pose.width * PORTRAIT_ASPECT) / 2).toBeGreaterThanOrEqual(top);
    }
  });

  it('has the next member waiting at the right edge: partly in frame, clear of the stage', () => {
    const { waiting, stage } = layout;
    const left = waiting.cx - waiting.width / 2;
    const right = waiting.cx + waiting.width / 2;
    expect(left).toBeLessThan(viewport.w);
    expect(right).toBeGreaterThan(viewport.w);
    expect(viewport.w - left).toBeGreaterThan(waiting.width * 0.3);
    expect(left).toBeGreaterThanOrEqual(stage.cx + stage.width / 2 - 1);
    expect(waiting.width).toBeLessThan(stage.width);
  });

  it('keeps the bottom band clear for the scroll cue', () => {
    const floor = viewport.h - (viewport.safeBottom ?? 0) - layout.cueBand;
    expect(layout.cueBand).toBeGreaterThanOrEqual(48 + 18);
    expect(layout.stage.cy + (layout.stage.width * PORTRAIT_ASPECT) / 2).toBeLessThanOrEqual(floor);
    expect(layout.card.top).toBeLessThan(floor);
  });
});

describe('computeLayout arrangement', () => {
  it('stacks on phones and tablets, and goes side by side on a landscape desktop', () => {
    expect(computeLayout({ w: 390, h: 844 }).wide).toBe(false);
    expect(computeLayout({ w: 768, h: 1024 }).wide).toBe(false);
    expect(computeLayout({ w: 1440, h: 900 }).wide).toBe(true);
    expect(computeLayout({ w: 390, h: 844 }).bubble.tail).toBe('up');
    expect(computeLayout({ w: 1440, h: 900 }).bubble.tail).toBe('left');
  });

  it('puts the bubble under the portrait when stacked and beside it when wide', () => {
    const phone = computeLayout({ w: 390, h: 844 });
    expect(phone.bubble.top).toBeGreaterThan(phone.stage.cy + (phone.stage.width * PORTRAIT_ASPECT) / 2);
    const desk = computeLayout({ w: 1440, h: 900 });
    expect(desk.bubble.left).toBeGreaterThan(desk.stage.cx + desk.stage.width / 2);
  });

  it('uses the scene seat size for the assembly when there is room, so the handoff does not rescale', () => {
    expect(computeLayout({ w: 390, h: 844 }).assembly[0].width).toBe(86);
    expect(computeLayout({ w: 1440, h: 900 }).assembly[0].width).toBe(124);
  });
});
