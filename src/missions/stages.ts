import type { GameInput, Mission, MissionFactory, Point } from '../game/mission';
import type { GameViewport } from '../game/viewport';

export const STAGE_TUNING = {
  buttonRadius: 42,
  spaceFillMs: 75,
  dragTargetRadius: 58,
  dragOverlapDistance: 72,
  dragMaxSeparation: 240,
  dragWidthFraction: 0.26,
  wheelGainPerPixel: 1 / 600,
  wheelDecayPerSecond: 0.12,
  gaugeMaxWidth: 480,
} as const;

export const STAGE_INSTRUCTIONS = [
  { ko: '버튼을 누르세요!', en: 'Click the button!' },
  { ko: '스페이스바를 누르세요!', en: 'Press the spacebar!' },
  { ko: '버튼을 옮기세요!', en: 'Drag the button!' },
  { ko: '마우스 휠을 굴리세요!', en: 'Scroll the wheel!' },
  { ko: '1부터 9까지 누르세요!', en: 'Press 1 to 9!' },
  { ko: '더블 클릭하세요!', en: 'Double-click!' },
] as const;

type ViewportProvider = () => GameViewport;
const ACCENT = '#d5ff60';
const MUTED = '#69748d';
const clamp = (value: number, min = 0, max = 1) => Math.max(min, Math.min(max, value));
const inside = (p: Point, center: Point, radius: number) => Math.hypot(p.x - center.x, p.y - center.y) <= radius;
const center = (v: GameViewport): Point => ({ x: v.centerX, y: v.centerY });
function circle(ctx: CanvasRenderingContext2D, p: Point, radius: number): void {
  ctx.beginPath();
  ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
  ctx.fillStyle = ACCENT;
  ctx.fill();
}
function text(ctx: CanvasRenderingContext2D, value: string, p: Point, color = MUTED, size = 24): void {
  ctx.fillStyle = color;
  ctx.font = `600 ${size}px system-ui`;
  ctx.textAlign = 'center';
  ctx.fillText(value, p.x, p.y);
}

export class ButtonStage implements Mission {
  readonly instruction = STAGE_INSTRUCTIONS[0].ko;
  private complete = false;
  private readonly viewport: ViewportProvider;
  constructor(viewport: ViewportProvider) { this.viewport = viewport; }
  start(): void { this.complete = false; }
  update(): void {}
  isInteractive(point: Point): boolean { return inside(point, center(this.viewport()), STAGE_TUNING.buttonRadius); }
  handleInput(event: GameInput): void {
    if (event.type === 'click' && this.isInteractive(event.point)) this.complete = true;
  }
  render(ctx: CanvasRenderingContext2D): void { circle(ctx, center(this.viewport()), STAGE_TUNING.buttonRadius); }
  isComplete(): boolean { return this.complete; }
  end(): void {}
}

export class SpaceStage implements Mission {
  readonly instruction = STAGE_INSTRUCTIONS[1].ko;
  private pressed = false;
  private elapsedMs = 0;
  private readonly viewport: ViewportProvider;
  constructor(viewport: ViewportProvider) { this.viewport = viewport; }
  get progress(): number { return clamp(this.elapsedMs / STAGE_TUNING.spaceFillMs); }
  start(): void { this.pressed = false; this.elapsedMs = 0; }
  handleInput(event: GameInput): void {
    if (event.type === 'keydown' && event.code === 'Space') this.pressed = true;
  }
  update(deltaMs: number): void {
    if (this.pressed) this.elapsedMs += Math.max(0, deltaMs);
  }
  render(ctx: CanvasRenderingContext2D): void {
    const p = center(this.viewport());
    ctx.lineWidth = 8;
    ctx.strokeStyle = '#2b3343';
    ctx.beginPath();
    ctx.arc(p.x, p.y, 72, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = ACCENT;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 72, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * this.progress);
    ctx.stroke();
    text(ctx, 'SPACE', { x: p.x, y: p.y + 8 }, '#f5f7ff', 22);
  }
  isComplete(): boolean { return this.progress === 1; }
  end(): void { this.pressed = false; }
}

export class DragStage implements Mission {
  readonly instruction = STAGE_INSTRUCTIONS[2].ko;
  private readonly viewport: ViewportProvider;
  private previousSize = { width: 0, height: 0 };
  private position: Point = { x: 0, y: 0 };
  private offset: Point = { x: 0, y: 0 };
  private pointerId: number | null = null;
  private complete = false;
  constructor(viewport: ViewportProvider) { this.viewport = viewport; }
  private get separation(): number { return Math.min(STAGE_TUNING.dragMaxSeparation, this.viewport().width * STAGE_TUNING.dragWidthFraction); }
  private get destination(): Point { const v = this.viewport(); return { x: v.centerX + this.separation, y: v.centerY }; }
  start(): void {
    const v = this.viewport();
    this.position = { x: v.centerX - this.separation, y: v.centerY };
    this.previousSize = { width: v.width, height: v.height };
    this.pointerId = null;
    this.complete = false;
  }
  private constrain(p: Point): Point {
    const v = this.viewport();
    const mx = Math.min(STAGE_TUNING.buttonRadius, v.centerX);
    const my = Math.min(STAGE_TUNING.buttonRadius, v.centerY);
    return { x: clamp(p.x, mx, v.width - mx), y: clamp(p.y, my, v.height - my) };
  }
  private syncLayout(): void {
    const v = this.viewport();
    if (v.width === this.previousSize.width && v.height === this.previousSize.height) return;
    this.position = this.constrain({ x: this.position.x + (v.width - this.previousSize.width) / 2, y: this.position.y + (v.height - this.previousSize.height) / 2 });
    this.previousSize = { width: v.width, height: v.height };
    this.pointerId = null;
  }
  update(): void { this.syncLayout(); }
  isInteractive(p: Point): boolean { this.syncLayout(); return inside(p, this.position, STAGE_TUNING.buttonRadius); }
  handleInput(event: GameInput): void {
    this.syncLayout();
    if (event.type === 'reset') this.pointerId = null;
    if (event.type === 'pointerdown' && this.pointerId === null && this.isInteractive(event.point)) {
      this.pointerId = event.pointerId;
      this.offset = { x: this.position.x - event.point.x, y: this.position.y - event.point.y };
    }
    if ('pointerId' in event && event.pointerId === this.pointerId) {
      if (event.type === 'pointermove' || event.type === 'pointerup') {
        this.position = this.constrain({ x: event.point.x + this.offset.x, y: event.point.y + this.offset.y });
        this.complete = inside(this.position, this.destination, STAGE_TUNING.dragOverlapDistance);
      }
      if (event.type === 'pointerup' || event.type === 'pointercancel') this.pointerId = null;
    }
  }
  render(ctx: CanvasRenderingContext2D): void {
    this.syncLayout();
    const v = this.viewport();
    const p = this.destination;
    ctx.lineWidth = 3;
    ctx.strokeStyle = ACCENT;
    ctx.setLineDash([8, 8]);
    ctx.beginPath();
    ctx.arc(p.x, p.y, STAGE_TUNING.dragTargetRadius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    text(ctx, '→', { x: v.centerX, y: v.centerY + 12 }, MUTED, 44);
    circle(ctx, this.position, STAGE_TUNING.buttonRadius);
  }
  isComplete(): boolean { return this.complete; }
  end(): void { this.pointerId = null; }
}

export class WheelStage implements Mission {
  readonly instruction = STAGE_INSTRUCTIONS[3].ko;
  readonly usesWheel = true;
  private value = 0;
  private readonly viewport: ViewportProvider;
  constructor(viewport: ViewportProvider) { this.viewport = viewport; }
  get progress(): number { return this.value; }
  start(): void { this.value = 0; }
  update(deltaMs: number): void { this.value = clamp(this.value - Math.max(0, deltaMs) / 1000 * STAGE_TUNING.wheelDecayPerSecond); }
  handleInput(event: GameInput): void {
    if (event.type === 'wheel') this.value = clamp(this.value + Math.abs(event.delta) * STAGE_TUNING.wheelGainPerPixel);
  }
  render(ctx: CanvasRenderingContext2D): void {
    const v = this.viewport();
    const width = Math.min(STAGE_TUNING.gaugeMaxWidth, v.width * 0.8);
    ctx.fillStyle = '#2b3343';
    ctx.fillRect(v.centerX - width / 2, v.centerY - 12, width, 24);
    ctx.fillStyle = ACCENT;
    ctx.fillRect(v.centerX - width / 2, v.centerY - 12, width * this.value, 24);
    text(ctx, '↕ WHEEL', { x: v.centerX, y: v.centerY + 58 });
  }
  isComplete(): boolean { return this.value === 1; }
  end(): void {}
}

export class NumbersStage implements Mission {
  readonly instruction = STAGE_INSTRUCTIONS[4].ko;
  private filled = 0;
  private readonly viewport: ViewportProvider;
  constructor(viewport: ViewportProvider) { this.viewport = viewport; }
  get completedSteps(): number { return this.filled; }
  start(): void { this.filled = 0; }
  update(): void {}
  handleInput(event: GameInput): void {
    if (event.type !== 'keydown') return;
    const digit = /^(?:Digit|Numpad)([1-9])$/.exec(event.code)?.[1];
    if (digit && Number(digit) === this.filled + 1) this.filled++;
  }
  render(ctx: CanvasRenderingContext2D): void {
    const v = this.viewport();
    const width = Math.min(STAGE_TUNING.gaugeMaxWidth, v.width * 0.85);
    const step = width / 9;
    for (let i = 0; i < 9; i++) {
      const x = v.centerX - width / 2 + i * step;
      ctx.fillStyle = i < this.filled ? ACCENT : '#2b3343';
      ctx.fillRect(x + 2, v.centerY - 16, step - 4, 32);
      text(ctx, `${i + 1}`, { x: x + step / 2, y: v.centerY + 49 }, i === this.filled ? '#f5f7ff' : MUTED, 18);
    }
  }
  isComplete(): boolean { return this.filled === 9; }
  end(): void {}
}

export class DoubleClickStage implements Mission {
  readonly instruction = STAGE_INSTRUCTIONS[5].ko;
  private complete = false;
  start(): void { this.complete = false; }
  update(): void {}
  render(): void {}
  handleInput(event: GameInput): void { if (event.type === 'dblclick') this.complete = true; }
  isComplete(): boolean { return this.complete; }
  end(): void {}
}

export function createStages(viewport: ViewportProvider): readonly MissionFactory[] {
  return [
    () => new ButtonStage(viewport), () => new SpaceStage(viewport),
    () => new DragStage(viewport), () => new WheelStage(viewport),
    () => new NumbersStage(viewport), () => new DoubleClickStage(),
  ];
}
