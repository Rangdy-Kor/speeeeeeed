import { afterEach, describe, expect, it, vi } from 'vitest';
import { GameCanvas } from './canvas';

afterEach(() => vi.unstubAllGlobals());

function setup(width: number, height: number, dpr: number) {
  const rect = { left: 11, top: 23, width, height };
  const context = { setTransform: vi.fn(), fillRect: vi.fn(), fillStyle: '' };
  const element = {
    width: 300, height: 150,
    getContext: () => context,
    getBoundingClientRect: () => rect,
  };
  const queries: { addEventListener: ReturnType<typeof vi.fn>; removeEventListener: ReturnType<typeof vi.fn> }[] = [];
  const host = {
    devicePixelRatio: dpr,
    addEventListener: vi.fn(), removeEventListener: vi.fn(),
    matchMedia: vi.fn(() => {
      const query = { addEventListener: vi.fn(), removeEventListener: vi.fn() };
      queries.push(query);
      return query;
    }),
  };
  vi.stubGlobal('window', host);
  vi.stubGlobal('ResizeObserver', class {
    observe(): void {}
    disconnect(): void {}
  });
  const canvas = new GameCanvas(element as unknown as HTMLCanvasElement);
  return { canvas, element, context, rect, host, queries };
}

describe('Canvas rendering and pointer transform integration', () => {
  for (const [width, height] of [[1920, 1080], [1280, 720], [800, 1200], [390, 844], [2560, 1080]]) {
    it(`${width}×${height}: the actual render matrix preserves displayed radii and pointer hits`, () => {
      const { canvas, context, element, rect } = setup(width!, height!, 1.25);
      canvas.beginFrame();
      const [sx, , , sy] = context.setTransform.mock.calls[0]! as number[];
      const screenRadiusX = 85 * sx! / element.width * rect.width;
      const screenRadiusY = 85 * sy! / element.height * rect.height;
      expect(screenRadiusX).toBeCloseTo(85, 10);
      expect(screenRadiusY).toBeCloseTo(screenRadiusX, 10);
      const point = canvas.point(rect.left + width! / 2, rect.top + height! / 2);
      expect(point).toEqual({ x: canvas.viewport.centerX, y: canvas.viewport.centerY });
      expect(context.fillRect).toHaveBeenLastCalledWith(0, 0, width, height);
      canvas.dispose();
    });
  }
  it('refreshes size before input, preserves the visible viewport while hidden, and detects DPR changes', () => {
    const { canvas, rect, element, host, queries } = setup(1280, 720, 1);
    rect.width = 390;
    rect.height = 844;
    expect(canvas.point(206, 445)).toEqual({ x: 195, y: 422 });
    expect(element.width).toBe(390);
    const viewport = canvas.viewport;
    rect.width = rect.height = 0;
    canvas.refresh();
    expect(canvas.viewport).toBe(viewport);
    rect.width = 390;
    rect.height = 844;
    host.devicePixelRatio = 3;
    const dprChanged = queries[0]!.addEventListener.mock.calls[0]![1] as () => void;
    dprChanged();
    expect(element.width).toBe(1170);
    expect(element.height).toBe(2532);
    expect(canvas.point(206, 445)).toEqual({ x: 195, y: 422 });
    canvas.dispose();
    expect(queries[1]!.removeEventListener).toHaveBeenCalled();
  });
});
