import { describe, expect, it } from 'vitest';
import { ViewportTransform } from './viewport';
import { createPrototypeMissions } from '../missions/prototypes';
import type { GameInput, InputState } from './mission';

const sizes = [
  { width: 1920, height: 1080 },
  { width: 1280, height: 720 },
  { width: 800, height: 1200 },
  { width: 390, height: 844 },
  { width: 2560, height: 1080 },
  { width: 390.3, height: 843.7 },
];
const empty: InputState = { keys: new Set(), pointers: new Map() };
const pointer = (type: 'pointerdown' | 'pointermove', x: number, y: number): GameInput => ({ type, pointerId: 1, point: { x, y } });

describe('viewport geometry and inverse transform', () => {
  for (const size of sizes) {
    for (const dpr of [1, 1.25, 2, 3]) {
      it(`${size.width}×${size.height}, DPR ${dpr}: uniform scale, circle, center, full space and round trip`, () => {
        const v = new ViewportTransform({ ...size, left: 17.2, top: 31.5 }, dpr);
        const center = { x: v.centerX, y: v.centerY };
        const screen = v.logicalToScreen(center);
        const xEdge = v.logicalToScreen({ x: center.x + 85, y: center.y });
        const yEdge = v.logicalToScreen({ x: center.x, y: center.y + 85 });
        expect(xEdge.x - screen.x).toBeCloseTo(yEdge.y - screen.y, 10);
        expect(screen.x).toBeCloseTo(17.2 + size.width / 2, 10);
        expect(screen.y).toBeCloseTo(31.5 + size.height / 2, 10);
        // Backing pixels are CSS-scaled by the browser: displayed X/Y distances must match.
        const screenScaleX = v.backingScaleX * size.width / v.backingWidth;
        const screenScaleY = v.backingScaleY * size.height / v.backingHeight;
        expect(screenScaleX).toBeCloseTo(screenScaleY, 12);
        expect(screenScaleX).toBeCloseTo(1, 12);
        expect(v.width).toBe(size.width);
        expect(v.height).toBe(size.height);
        for (const p of [{ x: 0, y: 0 }, center, { x: v.width, y: v.height }, { x: 123.456, y: 67.89 }]) {
          const recovered = v.screenToLogical(v.logicalToScreen(p));
          expect(recovered.x).toBeCloseTo(p.x, 10);
          expect(recovered.y).toBeCloseTo(p.y, 10);
        }
      });
    }
  }
  it('DPR only changes backing resolution, not logical coordinates', () => {
    const rect = { left: 10, top: 20, width: 390, height: 844 };
    const low = new ViewportTransform(rect, 1);
    const high = new ViewportTransform(rect, 3);
    expect(high.backingWidth).toBe(low.backingWidth * 3);
    expect(high.screenToLogical({ x: 205, y: 442 })).toEqual(low.screenToLogical({ x: 205, y: 442 }));
  });
});

describe('mission layout and visual hit tests', () => {
  for (const size of sizes.slice(0, 5)) {
    it(`${size.width}×${size.height}: click, drag and touch hold remain playable`, () => {
      const v = new ViewportTransform({ ...size, left: 15, top: 25 }, 2);
      const missions = createPrototypeMissions(() => v);
      const click = missions[0]!();
      click.start();
      const screen = v.logicalToScreen({ x: v.centerX + 86, y: v.centerY });
      click.handleInput({ type: 'pointerdown', pointerId: 1, point: v.screenToLogical(screen) });
      expect(click.isComplete()).toBe(false);
      const center = v.screenToLogical(v.logicalToScreen({ x: v.centerX, y: v.centerY }));
      click.handleInput(pointer('pointerdown', center.x, center.y));
      expect(click.isComplete()).toBe(true);
      const drag = missions[1]!();
      drag.start();
      const gap = Math.min(240, v.width * 0.26);
      drag.handleInput(pointer('pointerdown', v.centerX - gap, v.centerY));
      drag.handleInput(pointer('pointermove', v.centerX + gap, v.centerY));
      expect(drag.isComplete()).toBe(true);
      const hold = missions[2]!();
      hold.start();
      hold.handleInput(pointer('pointerdown', center.x, center.y));
      hold.update(700, { keys: new Set(), pointers: new Map([[1, center]]) });
      expect(hold.isComplete()).toBe(true);
    });
  }
  it('resize during a drag preserves an accessible object and allows completion', () => {
    let viewport = new ViewportTransform({ left: 0, top: 0, width: 1280, height: 720 }, 1);
    const mission = createPrototypeMissions(() => viewport)[1]!();
    mission.start();
    mission.handleInput(pointer('pointerdown', 400, 360));
    mission.handleInput(pointer('pointermove', 800, 360));
    viewport = new ViewportTransform({ left: 0, top: 0, width: 390, height: 844 }, 2);
    mission.update(0, empty);
    // Center-relative position is clamped inside the new right edge; re-grab it.
    mission.handleInput(pointer('pointerdown', 332, 422));
    mission.handleInput(pointer('pointermove', 195 + 390 * 0.26, 422));
    expect(mission.isComplete()).toBe(true);
  });
});
