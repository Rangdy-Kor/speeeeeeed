export type Point = { x: number; y: number };

export type GameInput =
  | { type: 'pointerdown' | 'pointermove' | 'pointerup' | 'pointercancel'; pointerId: number; point: Point }
  | { type: 'keydown' | 'keyup'; code: string }
  | { type: 'click' | 'dblclick'; point: Point }
  | { type: 'wheel'; delta: number }
  | { type: 'reset' };

export interface InputState {
  readonly keys: ReadonlySet<string>;
  readonly pointers: ReadonlyMap<number, Point>;
}

export interface Mission {
  readonly instruction: string;
  readonly usesWheel?: boolean;
  isInteractive?(point: Point): boolean;
  start(): void;
  update(deltaMs: number, input: InputState): void;
  render(ctx: CanvasRenderingContext2D): void;
  handleInput(event: GameInput): void;
  isComplete(): boolean;
  end(): void;
}

export type MissionFactory = () => Mission;
