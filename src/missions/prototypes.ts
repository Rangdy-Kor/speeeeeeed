import type { GameInput, InputState, Mission, MissionFactory, Point } from '../game/mission';
import { HEIGHT, WIDTH } from '../game/config';
import { ViewportTransform } from '../game/viewport';
import type { GameViewport } from '../game/viewport';

type ViewportProvider = () => GameViewport;

const inside = (p: Point, center: Point, radius: number) => Math.hypot(p.x - center.x, p.y - center.y) <= radius;
const circle = (ctx: CanvasRenderingContext2D, p: Point, radius: number, color: string) => {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
  ctx.fill();
};
const label = (ctx: CanvasRenderingContext2D, text: string, p: Point) => {
  ctx.fillStyle = '#10131d';
  ctx.font = 'bold 28px system-ui';
  ctx.textAlign = 'center';
  ctx.fillText(text, p.x, p.y + 10);
};

class ClickMission implements Mission {
  readonly instruction = '누르세요!';
  private complete = false;
  private readonly viewport: ViewportProvider;
  constructor(viewport: ViewportProvider) { this.viewport = viewport; }
  private get target(): Point { const v = this.viewport(); return { x: v.centerX, y: v.centerY }; }
  start(): void { this.complete = false; }
  update(): void {}
  render(ctx: CanvasRenderingContext2D): void {
    circle(ctx, this.target, 85, '#d5ff60');
    label(ctx, '●', this.target);
  }
  handleInput(event: GameInput): void {
    if (event.type === 'pointerdown' && inside(event.point, this.target, 85)) this.complete = true;
  }
  isComplete(): boolean { return this.complete; }
  end(): void {}
}

class DragMission implements Mission {
  readonly instruction = '옮기세요!';
  private position = { x: 400, y: 390 };
  private readonly viewport: ViewportProvider;
  private previousSize = { width: 0, height: 0 };
  constructor(viewport: ViewportProvider) { this.viewport = viewport; }
  private get destination(): Point {
    const v = this.viewport();
    return { x: v.centerX + this.separation, y: v.centerY };
  }
  private get separation(): number { return Math.min(240, this.viewport().width * 0.26); }
  private pointerId: number | null = null;
  private offset = { x: 0, y: 0 };
  private complete = false;
  start(): void {
    const v = this.viewport();
    this.position = { x: v.centerX - this.separation, y: v.centerY };
    this.previousSize = { width: v.width, height: v.height };
    this.pointerId = null;
    this.complete = false;
  }
  private syncLayout(): void {
    const v = this.viewport();
    if (v.width === this.previousSize.width && v.height === this.previousSize.height) return;
    this.position.x += (v.width - this.previousSize.width) / 2;
    this.position.y += (v.height - this.previousSize.height) / 2;
    this.position = this.constrain(this.position);
    this.previousSize = { width: v.width, height: v.height };
    this.pointerId = null;
  }
  private constrain(p: Point): Point {
    const v = this.viewport();
    const marginX = Math.min(58, v.centerX);
    const marginY = Math.min(58, v.centerY);
    return { x: Math.max(marginX, Math.min(v.width - marginX, p.x)), y: Math.max(marginY, Math.min(v.height - marginY, p.y)) };
  }
  update(): void { this.syncLayout(); }
  render(ctx: CanvasRenderingContext2D): void {
    this.syncLayout();
    ctx.strokeStyle = '#d5ff60';
    ctx.lineWidth = 5;
    ctx.setLineDash([12, 12]);
    ctx.beginPath();
    ctx.arc(this.destination.x, this.destination.y, 85, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#69748d';
    ctx.font = '48px system-ui';
    ctx.textAlign = 'center';
    const v = this.viewport();
    ctx.fillText('→', v.centerX, v.centerY + 15);
    circle(ctx, this.position, 58, '#d5ff60');
  }
  handleInput(event: GameInput): void {
    this.syncLayout();
    if (event.type === 'reset') this.pointerId = null;
    if (event.type === 'pointerdown' && this.pointerId === null && inside(event.point, this.position, 58)) {
      this.pointerId = event.pointerId;
      this.offset = { x: this.position.x - event.point.x, y: this.position.y - event.point.y };
    }
    if ('pointerId' in event && event.pointerId === this.pointerId) {
      if (event.type === 'pointermove' || event.type === 'pointerup') {
        this.position = this.constrain({ x: event.point.x + this.offset.x, y: event.point.y + this.offset.y });
        this.complete = inside(this.position, this.destination, 27);
      }
      if (event.type === 'pointerup' || event.type === 'pointercancel') this.pointerId = null;
    }
  }
  isComplete(): boolean { return this.complete; }
  end(): void { this.pointerId = null; }
}

class HoldMission implements Mission {
  readonly instruction = '꾹 누르세요!';
  private heldMs = 0;
  private active = false;
  private readonly viewport: ViewportProvider;
  constructor(viewport: ViewportProvider) { this.viewport = viewport; }
  private get target(): Point { const v = this.viewport(); return { x: v.centerX, y: v.centerY }; }
  start(): void { this.heldMs = 0; this.active = false; }
  update(deltaMs: number, input: InputState): void {
    // Require a fresh press in this mission; an earlier mission's held input cannot complete it.
    if (this.active && (input.keys.has('Space') || [...input.pointers.values()].some(p => inside(p, this.target, 90)))) {
      this.heldMs += deltaMs;
    } else {
      this.heldMs = 0;
      this.active = false;
    }
  }
  render(ctx: CanvasRenderingContext2D): void {
    circle(ctx, this.target, 90, '#d5ff60');
    label(ctx, 'SPACE', this.target);
    ctx.strokeStyle = '#f5f7ff';
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.arc(this.target.x, this.target.y, 110, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, this.heldMs / 700));
    ctx.stroke();
  }
  handleInput(event: GameInput): void {
    if ((event.type === 'keydown' && event.code === 'Space') || (event.type === 'pointerdown' && inside(event.point, this.target, 90))) this.active = true;
    if (event.type === 'reset') { this.active = false; this.heldMs = 0; }
  }
  isComplete(): boolean { return this.heldMs >= 700; }
  end(): void { this.active = false; }
}

// Registration order is the prototype playlist; each run receives fresh instances.
const defaultViewport = new ViewportTransform({ left: 0, top: 0, width: WIDTH, height: HEIGHT }, 1);
export const createPrototypeMissions = (viewport: ViewportProvider): readonly MissionFactory[] => [
  () => new ClickMission(viewport),
  () => new DragMission(viewport),
  () => new HoldMission(viewport),
];
export const prototypeMissions = createPrototypeMissions(() => defaultViewport);
