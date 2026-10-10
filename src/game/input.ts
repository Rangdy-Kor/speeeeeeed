import type { GameCanvas } from './canvas';
import type { GameInput, InputState, Point } from './mission';

export class InputController implements InputState {
  readonly keys = new Set<string>();
  readonly pointers = new Map<number, Point>();
  private readonly abort = new AbortController();
  constructor(
    canvas: GameCanvas,
    beforeEvent: (now: number) => void,
    dispatch: (event: GameInput, now: number) => void,
    isPlaying: () => boolean,
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
  clear(): void { this.keys.clear(); this.pointers.clear(); }
  dispose(): void { this.abort.abort(); this.clear(); }
}
