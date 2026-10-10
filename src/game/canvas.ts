import type { Point } from './mission';
import { ViewportTransform } from './viewport';

export class GameCanvas {
  readonly element: HTMLCanvasElement;
  readonly context: CanvasRenderingContext2D;
  private readonly observer: ResizeObserver;
  private transform = new ViewportTransform({ left: 0, top: 0, width: 1, height: 1 }, 1);
  private dprQuery: MediaQueryList | null = null;
  constructor(element: HTMLCanvasElement) {
    this.element = element;
    const context = element.getContext('2d');
    if (!context) throw new Error('Canvas 2D is unavailable.');
    this.context = context;
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(element);
    window.addEventListener('resize', this.resize);
    this.resize();
    this.watchDpr();
  }
  get viewport(): ViewportTransform { return this.transform; }

  private watchDpr = (): void => {
    this.dprQuery?.removeEventListener('change', this.onDprChange);
    this.dprQuery = window.matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`);
    this.dprQuery.addEventListener('change', this.onDprChange);
  };
  private onDprChange = (): void => { this.resize(); this.watchDpr(); };
  private resize = (): void => {
    const rect = this.element.getBoundingClientRect();
    // Hidden lobby/result Canvas has no layout; keep the last usable game space.
    if (rect.width <= 0 || rect.height <= 0) return;
    const dpr = window.devicePixelRatio || 1;
    this.transform = new ViewportTransform(rect, dpr);
    if (this.element.width !== this.transform.backingWidth) this.element.width = this.transform.backingWidth;
    if (this.element.height !== this.transform.backingHeight) this.element.height = this.transform.backingHeight;
  };
  refresh(): void { this.resize(); }
  point(clientX: number, clientY: number): Point {
    this.refresh();
    return this.transform.screenToLogical({ x: clientX, y: clientY });
  }
  beginFrame(): CanvasRenderingContext2D {
    this.refresh();
    const ctx = this.context;
    ctx.setTransform(this.transform.backingScaleX, 0, 0, this.transform.backingScaleY, 0, 0);
    ctx.fillStyle = '#10131d';
    ctx.fillRect(0, 0, this.transform.width, this.transform.height);
    return ctx;
  }
  dispose(): void {
    this.observer.disconnect();
    window.removeEventListener('resize', this.resize);
    this.dprQuery?.removeEventListener('change', this.onDprChange);
  }
}
