import type { GameCanvas } from './canvas';
import type { GameInput, InputState, Point } from './mission';

export function normalizeWheelDelta(delta: number, mode: number, pageHeight: number): number {
  return delta * (mode === 1 ? 16 : mode === 2 ? pageHeight : 1);
}

export class InputController implements InputState {
  readonly keys = new Set<string>();
  readonly pointers = new Map<number, Point>();
  hoverPoint: Point | null = null;
  private readonly abort = new AbortController();
  constructor(
    canvas: GameCanvas,
    beforeEvent: (now: number) => void,
    dispatch: (event: GameInput, now: number) => void,
    isPlaying: () => boolean,
    consumesWheel: () => boolean = () => false,
  ) {
    const options = { signal: this.abort.signal };
    canvas.element.addEventListener('contextmenu', event => {
      if (isPlaying()) event.preventDefault();
    }, options);
    for (const type of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel'] as const) {
      canvas.element.addEventListener(type, event => {
        if (!isPlaying()) return;
        if (type === 'pointerdown' && event.button !== 0) return;
        const now = performance.now();
        beforeEvent(now);
        const point = canvas.point(event.clientX, event.clientY);
        if (event.pointerType === 'mouse') this.hoverPoint = point;
        if (type === 'pointerdown') {
          canvas.element.focus({ preventScroll: true });
          canvas.element.setPointerCapture(event.pointerId);
          this.pointers.set(event.pointerId, point);
        } else if (type === 'pointermove' && this.pointers.has(event.pointerId)) {
          this.pointers.set(event.pointerId, point);
        } else if (type === 'pointerup' || type === 'pointercancel') {
          this.pointers.delete(event.pointerId);
        }
        dispatch({ type, pointerId: event.pointerId, point }, now);
      }, options);
    }
    canvas.element.addEventListener('pointerleave', () => { this.hoverPoint = null; }, options);
    for (const type of ['click', 'dblclick'] as const) {
      canvas.element.addEventListener(type, event => {
        if (!isPlaying() || event.button !== 0) return;
        if (type === 'dblclick' && document.activeElement !== canvas.element) return;
        const now = performance.now();
        beforeEvent(now);
        dispatch({ type, point: canvas.point(event.clientX, event.clientY) }, now);
      }, options);
    }
    canvas.element.addEventListener('wheel', event => {
      if (!isPlaying() || !consumesWheel()) return;
      event.preventDefault();
      const now = performance.now();
      beforeEvent(now);
      dispatch({ type: 'wheel', delta: normalizeWheelDelta(event.deltaY || event.deltaX, event.deltaMode, canvas.viewport.height) }, now);
    }, { ...options, passive: false });
    canvas.element.addEventListener('lostpointercapture', event => {
      if (!this.pointers.has(event.pointerId)) return;
      const now = performance.now();
      beforeEvent(now);
      this.pointers.delete(event.pointerId);
      dispatch({ type: 'pointercancel', pointerId: event.pointerId, point: canvas.point(event.clientX, event.clientY) }, now);
    }, options);
    for (const type of ['keydown', 'keyup'] as const) {
      canvas.element.addEventListener(type, event => {
        if (!isPlaying()) return;
        if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) event.preventDefault();
        if (event.repeat) return;
        const now = performance.now();
        beforeEvent(now);
        if (type === 'keydown') this.keys.add(event.code);
        else this.keys.delete(event.code);
        dispatch({ type, code: event.code }, now);
      }, options);
    }
    const reset = () => {
      const now = performance.now();
      beforeEvent(now);
      this.clear();
      dispatch({ type: 'reset' }, now);
    };
    canvas.element.addEventListener('blur', reset, options);
    window.addEventListener('blur', reset, options);
    document.addEventListener('visibilitychange', () => { if (document.hidden) reset(); }, options);
  }
  clear(): void { this.keys.clear(); this.pointers.clear(); this.hoverPoint = null; }
  dispose(): void { this.abort.abort(); this.clear(); }
}
