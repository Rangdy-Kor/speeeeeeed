import type { NotepadState } from './domain';
import { describe, expect, it } from 'vitest';
import { createDesktopState, desktopReducer, getWindowBounds } from './domain';
import { createDesktopStore } from './store';
import type { VirtualDesktopState } from './domain';

const open = (state: VirtualDesktopState) => desktopReducer(state, { type: 'openApplication', application: Object.keys(state.windows).length ? 'explorer' : 'notepad' });

describe('virtual desktop state', () => {
  it('opens independent applications and focuses the newest window', () => {
    const initial = createDesktopState();
    const state = open(open(initial));
    expect(Object.keys(initial.windows)).toHaveLength(0);
    expect(Object.keys(state.windows)).toHaveLength(2);
    expect(Object.keys(state.applications)).toHaveLength(2);
    expect(state.focusedWindowId).toBe('window-2');
    expect(state.zOrder).toEqual(['window-1', 'window-2']);
  });
  it('brings a clicked window forward without duplicate order entries', () => {
    const state = open(open(createDesktopState()));
    const focused = desktopReducer(state, { type: 'focusWindow', id: 'window-1' });
    expect(focused.focusedWindowId).toBe('window-1');
    expect(focused.zOrder).toEqual(['window-2', 'window-1']);
    expect(desktopReducer(focused, { type: 'focusWindow', id: 'window-1' }).zOrder).toEqual(focused.zOrder);
  });
  it('closes a focused window and focuses the next visible window', () => {
    const state = open(open(createDesktopState()));
    const closed = desktopReducer(state, { type: 'closeWindow', id: 'window-2' });
    expect(closed.windows['window-2']).toBeUndefined();
    expect(closed.focusedWindowId).toBe('window-1');
    expect(closed.zOrder).toEqual(['window-1']);
    expect(desktopReducer(closed, { type: 'closeWindow', id: 'window-1' }).focusedWindowId).toBeNull();
  });
  it('maximizes to the work area and restores the prior normal geometry', () => {
    const state = open(createDesktopState());
    const maximized = desktopReducer(state, { type: 'maximizeWindow', id: 'window-1' });
    expect(maximized.windows['window-1']!.mode).toBe('maximized');
    expect(getWindowBounds(maximized.windows['window-1']!, maximized.workArea)).toEqual({ x: 0, y: 0, width: 1280, height: 672 });
    const restored = desktopReducer(maximized, { type: 'restoreWindow', id: 'window-1' });
    expect(restored.windows['window-1']!.mode).toBe('normal');
    expect(restored.windows['window-1']!.bounds).toEqual(state.windows['window-1']!.bounds);
  });
  it('minimizes, transfers focus, and reveals a maximized window through taskbar focus', () => {
    const opened = open(open(createDesktopState()));
    const max = desktopReducer(opened, { type: 'maximizeWindow', id: 'window-2' });
    const min = desktopReducer(max, { type: 'minimizeWindow', id: 'window-2' });
    expect(min.windows['window-2']!.minimized).toBe(true);
    expect(min.focusedWindowId).toBe('window-1');
    const visible = desktopReducer(min, { type: 'focusWindow', id: 'window-2' });
    expect(visible.windows['window-2']!.minimized).toBe(false);
    expect(visible.windows['window-2']!.mode).toBe('maximized');
    expect(visible.focusedWindowId).toBe('window-2');
  });
  it('focus never selects minimized windows after close or minimize', () => {
    const state = open(open(createDesktopState()));
    const min = desktopReducer(state, { type: 'minimizeWindow', id: 'window-1' });
    const closed = desktopReducer(min, { type: 'closeWindow', id: 'window-2' });
    expect(closed.focusedWindowId).toBeNull();
  });
  it('moves normal windows and constrains them inside the current work area', () => {
    const state = open(createDesktopState());
    const moved = desktopReducer(state, { type: 'moveWindow', id: 'window-1', x: 220, y: 190 });
    expect(moved.windows['window-1']!.bounds.x).toBe(220);
    expect(moved.windows['window-1']!.bounds.y).toBe(190);
    const outside = desktopReducer(moved, { type: 'moveWindow', id: 'window-1', x: -300, y: 2000 });
    expect(outside.windows['window-1']!.bounds.x).toBe(0);
    expect(outside.windows['window-1']!.bounds.y).toBe(292);
    const max = desktopReducer(state, { type: 'maximizeWindow', id: 'window-1' });
    expect(desktopReducer(max, { type: 'moveWindow', id: 'window-1', x: 5, y: 5 })).toBe(max);
  });
  for (const [width, height] of [[390, 796], [800, 1152], [2560, 1032]]) {
    it(`recalculates normal and maximized windows for ${width}×${height} work areas`, () => {
      const state = open(open(createDesktopState()));
      const max = desktopReducer(state, { type: 'maximizeWindow', id: 'window-2' });
      const resized = desktopReducer(max, { type: 'setWorkArea', width: width!, height: height! });
      const normal = resized.windows['window-1']!.bounds;
      expect(normal.x).toBeGreaterThanOrEqual(0);
      expect(normal.y).toBeGreaterThanOrEqual(0);
      expect(normal.x + normal.width).toBeLessThanOrEqual(width!);
      expect(normal.y + normal.height).toBeLessThanOrEqual(height!);
      expect(getWindowBounds(resized.windows['window-2']!, resized.workArea)).toEqual({ x: 0, y: 0, width, height });
    });
  }
  it('keeps document sessions across all window changes without mixing documents', () => {
    let state = open(open(createDesktopState()));
    state = desktopReducer(state, { type: 'setNotepadText', applicationId: 'notepad-1', text: '안녕하세요\nSPEEEEEED!!!' });
    for (const type of ['maximizeWindow', 'restoreWindow', 'minimizeWindow', 'focusWindow'] as const) state = desktopReducer(state, { type, id: 'window-1' });
    expect((state.applications['notepad-1'] as NotepadState).session.content).toBe('안녕하세요\nSPEEEEEED!!!');
    expect(state.applications['explorer-2']?.type).toBe('explorer');
    const reopened = desktopReducer(state, { type: 'openApplication', application: 'notepad' });
    expect(Object.keys(reopened.windows)).toHaveLength(2);
    expect((reopened.applications['notepad-1'] as NotepadState).session.content).toBe('안녕하세요\nSPEEEEEED!!!');
  });
  it('ignores stale window actions and leaves immutable prior snapshots intact', () => {
    const state = open(createDesktopState());
    expect(desktopReducer(state, { type: 'closeWindow', id: 'missing' })).toBe(state);
    const updated = desktopReducer(state, { type: 'setNotepadText', applicationId: 'notepad-1', text: 'new' });
    expect((state.applications['notepad-1'] as NotepadState).session.content).toBe('');
    expect((updated.applications['notepad-1'] as NotepadState).session.content).toBe('new');
  });
});

describe('observable domain store', () => {
  it('notifies observers with current result state and supports unsubscribe', () => {
    const store = createDesktopStore();
    const observed: VirtualDesktopState[] = [];
    const unsubscribe = store.subscribe(() => observed.push(store.getSnapshot()));
    store.dispatch({ type: 'openApplication', application: 'notepad' });
    expect(observed[0]!.focusedWindowId).toBe('window-1');
    unsubscribe();
    store.dispatch({ type: 'closeWindow', id: 'window-1' });
    expect(observed).toHaveLength(1);
  });
});


