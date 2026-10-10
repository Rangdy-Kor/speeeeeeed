import type { Point } from './mission';

export interface GameViewport {
  readonly width: number;
  readonly height: number;
  readonly centerX: number;
  readonly centerY: number;
}

export interface ViewportRect { left: number; top: number; width: number; height: number }

/** One logical unit is one CSS pixel; aspect ratio changes the available space. */
export class ViewportTransform implements GameViewport {
  readonly scale = 1;
  readonly width: number;
  readonly height: number;
  readonly centerX: number;
  readonly centerY: number;
  readonly backingWidth: number;
  readonly backingHeight: number;
  readonly backingScaleX: number;
  readonly backingScaleY: number;
  private readonly left: number;
  private readonly top: number;

  constructor(rect: ViewportRect, dpr: number) {
    if (rect.width <= 0 || rect.height <= 0 || !Number.isFinite(dpr) || dpr <= 0) {
      throw new Error('Viewport size and DPR must be positive.');
    }
    this.left = rect.left;
    this.top = rect.top;
    this.width = rect.width / this.scale;
    this.height = rect.height / this.scale;
    this.centerX = this.width / 2;
    this.centerY = this.height / 2;
    this.backingWidth = Math.max(1, Math.round(rect.width * dpr));
    this.backingHeight = Math.max(1, Math.round(rect.height * dpr));
    // Compensate integer backing-store rounding so both displayed axes stay at scale 1.
    this.backingScaleX = this.backingWidth / rect.width * this.scale;
    this.backingScaleY = this.backingHeight / rect.height * this.scale;
  }

  logicalToScreen(point: Point): Point {
    return { x: this.left + point.x * this.scale, y: this.top + point.y * this.scale };
  }

  screenToLogical(point: Point): Point {
    return { x: (point.x - this.left) / this.scale, y: (point.y - this.top) / this.scale };
  }
}
