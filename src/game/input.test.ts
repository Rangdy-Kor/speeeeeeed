import { afterEach, describe, expect, it, vi } from 'vitest';
import type { GameCanvas } from './canvas';
import { InputController, normalizeWheelDelta } from './input';

afterEach(() => vi.unstubAllGlobals());

function setup() {
  const doc = Object.assign(new EventTarget(), { activeElement: null as unknown, hidden: false });
  const element = Object.assign(new EventTarget(), {
    setPointerCapture: vi.fn(),
    focus: () => { doc.activeElement = element; },
  });
  vi.stubGlobal('window', new EventTarget());
  vi.stubGlobal('document', doc);
  const dispatch = vi.fn();
  const before = vi.fn();
  const state = { playing: true, wheel: false };
  const canvas = {
    element, viewport: { height: 844 },
    point: (x: number, y: number) => ({ x: x - 10, y: y - 20 }),
  } as unknown as GameCanvas;
  const input = new InputController(canvas, before, dispatch, () => state.playing, () => state.wheel);
  const fire = (type: string, properties: Record<string, unknown> = {}) => {
    const event = Object.assign(new Event(type, { cancelable: true }), properties);
    element.dispatchEvent(event);
    return event;
  };
  return { input, fire, dispatch, before, state, doc, element };
}

describe('standard browser input adapters', () => {
  it('forwards only the native dblclick event while Gameplay has focus', () => {
    const { input, fire, dispatch, element } = setup();
    fire('dblclick', { button: 0, clientX: 20, clientY: 30 });
    expect(dispatch).not.toHaveBeenCalled();
    element.focus();
    fire('click', { button: 0, clientX: 20, clientY: 30 });
    fire('click', { button: 0, clientX: 20, clientY: 30 });
    expect(dispatch.mock.calls.map(call => call[0].type)).toEqual(['click', 'click']);
    fire('dblclick', { button: 0, clientX: 120, clientY: 230 });
    expect(dispatch.mock.lastCall?.[0]).toEqual({ type: 'dblclick', point: { x: 110, y: 210 } });
    input.dispose();
    fire('dblclick', { button: 0, clientX: 120, clientY: 230 });
    expect(dispatch).toHaveBeenCalledTimes(3);
  });
  it('blocks page scrolling only when the playing mission consumes wheel and normalizes deltaMode', () => {
    const { input, fire, dispatch, state } = setup();
    const properties = { deltaY: -3, deltaX: 0, deltaMode: 1 };
    expect(fire('wheel', properties).defaultPrevented).toBe(false);
    expect(dispatch).not.toHaveBeenCalled();
    state.wheel = true;
    expect(fire('wheel', properties).defaultPrevented).toBe(true);
    expect(dispatch.mock.lastCall?.[0]).toEqual({ type: 'wheel', delta: -48 });
    expect(fire('wheel', { deltaY: 0, deltaX: 120, deltaMode: 0 }).defaultPrevented).toBe(true);
    expect(dispatch.mock.lastCall?.[0]).toEqual({ type: 'wheel', delta: 120 });
    state.playing = false;
    expect(fire('wheel', properties).defaultPrevented).toBe(false);
    expect(dispatch).toHaveBeenCalledTimes(2);
    expect(normalizeWheelDelta(1, 2, 844)).toBe(844);
    input.dispose();
  });
  it('does not forward keyboard auto-repeat and clears held input on blur', () => {
    const { input, fire, dispatch, doc } = setup();
    expect(fire('keydown', { code: 'Space', repeat: false }).defaultPrevented).toBe(true);
    fire('keydown', { code: 'Space', repeat: true });
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(input.keys.has('Space')).toBe(true);
    fire('blur');
    expect(input.keys.size).toBe(0);
    expect(dispatch.mock.lastCall?.[0]).toEqual({ type: 'reset' });
    doc.activeElement = null;
    input.dispose();
  });
});
