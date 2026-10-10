// @vitest-environment jsdom
import type { NotepadState } from '../domain';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createDesktopStore } from '../store';
import { VirtualDesktop } from './VirtualDesktop';

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', class { observe(): void {} disconnect(): void {} });
  Object.defineProperty(HTMLElement.prototype, 'setPointerCapture', { configurable: true, value: vi.fn() });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  Reflect.deleteProperty(HTMLElement.prototype, 'setPointerCapture');
});

describe('Notepad DOM interaction', () => {
  it('opens by double click, edits text, maximizes/restores, minimizes/taskbar restores, then closes', async () => {
    const user = userEvent.setup();
    const store = createDesktopStore();
    render(<VirtualDesktop store={store} />);
    const icon = screen.getByRole('button', { name: '메모장 열기' });
    await user.click(icon);
    expect(screen.queryByRole('textbox')).toBeNull();
    await user.dblClick(icon);
    const editor = screen.getByRole('textbox') as HTMLTextAreaElement;
    expect(document.activeElement).toBe(editor);
    await user.type(editor, 'Hello desktop');
    await user.click(screen.getByRole('button', { name: '최대화' }));
    expect(store.getSnapshot().windows['window-1']!.mode).toBe('maximized');
    await user.click(screen.getByRole('button', { name: '이전 크기로 복원' }));
    expect(editor.value).toBe('Hello desktop');
    await user.click(screen.getByRole('button', { name: '최소화' }));
    expect(screen.queryByRole('textbox')).toBeNull();
    await user.click(screen.getByRole('button', { name: '메모장 notepad-1 표시' }));
    expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe('Hello desktop');
    await user.click(screen.getByRole('button', { name: '닫기' }));
    await user.click(screen.getByRole('button', { name: '저장 안 함' }));
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(Object.keys(store.getSnapshot().windows)).toHaveLength(0);
  });
  it('moves the title bar through pointer actions', async () => {
    const store = createDesktopStore();
    render(<VirtualDesktop store={store} />);
    await userEvent.setup().dblClick(screen.getByRole('button', { name: '메모장 열기' }));
    await userEvent.setup().dblClick(screen.getByRole('button', { name: '파일 탐색기 열기' }));
    const titlebar = screen.getByRole('region', { name: '메모장 notepad-1' }).querySelector('header')!;
    const pointer = (type: string, x: number, y: number) => fireEvent(titlebar, Object.assign(new Event(type, { bubbles: true }), { pointerId: 1, clientX: x, clientY: y, button: 0 }));
    pointer('pointerdown', 150, 90);
    pointer('pointermove', 230, 140);
    pointer('pointerup', 230, 140);
    expect(store.getSnapshot().focusedWindowId).toBe('window-1');
    expect(store.getSnapshot().windows['window-1']!.bounds.x).toBe(180);
    expect(store.getSnapshot().windows['window-1']!.bounds.y).toBe(122);
  });
  it('raises the clicked window and keeps text when another application is open', async () => {
    const user = userEvent.setup();
    const store = createDesktopStore();
    render(<VirtualDesktop store={store} />);
    const icon = screen.getByRole('button', { name: '메모장 열기' });
    await user.dblClick(icon);
    await user.type(screen.getByRole('textbox'), 'first');
    await user.dblClick(screen.getByRole('button', { name: '파일 탐색기 열기' }));
    const editors = screen.getAllByRole('textbox') as HTMLTextAreaElement[];
    expect(editors).toHaveLength(1);
    await user.click(editors[0]!);
    expect(store.getSnapshot().focusedWindowId).toBe('window-1');
    expect(store.getSnapshot().zOrder).toEqual(['window-2', 'window-1']);
    expect((store.getSnapshot().applications['notepad-1'] as NotepadState).session.content).toBe('first');
  });
  it('offers keyboard Enter activation for the desktop icon', async () => {
    const user = userEvent.setup();
    const store = createDesktopStore();
    render(<VirtualDesktop store={store} />);
    screen.getByRole('button', { name: '메모장 열기' }).focus();
    await user.keyboard('{Enter}');
    expect(screen.getByRole('textbox')).toBeTruthy();
  });
});

describe('inactive control regression and taskbar state', () => {
  for (const [label, property] of [['닫기', 'closed'], ['최소화', 'minimized'], ['최대화', 'maximized']] as const) {
    it(`inactive ${label} works on the first click`, async () => {
      const user = userEvent.setup();
      const store = createDesktopStore();
      render(<VirtualDesktop store={store} />);
      const icon = screen.getByRole('button', { name: '메모장 열기' });
      await user.dblClick(icon);
      await user.dblClick(screen.getByRole('button', { name: '파일 탐색기 열기' }));
      const first = screen.getByRole('region', { name: '메모장 notepad-1' });
      expect(store.getSnapshot().focusedWindowId).toBe('window-2');
      await user.click(within(first).getByRole('button', { name: label }));
      const window = store.getSnapshot().windows['window-1'];
      if (property === 'closed') expect(window).toBeUndefined();
      if (property === 'minimized') expect(window?.minimized).toBe(true);
      if (property === 'maximized') expect(window?.mode).toBe('maximized');
    });
  }
  it('inactive Restore works on the first click', async () => {
    const user = userEvent.setup();
    const store = createDesktopStore();
    render(<VirtualDesktop store={store} />);
    const icon = screen.getByRole('button', { name: '메모장 열기' });
    await user.dblClick(icon);
    await user.click(screen.getByRole('button', { name: '최대화' }));
    await user.dblClick(screen.getByRole('button', { name: '파일 탐색기 열기' }));
    const first = screen.getByRole('region', { name: '메모장 notepad-1' });
    await user.click(within(first).getByRole('button', { name: '이전 크기로 복원' }));
    expect(store.getSnapshot().windows['window-1']!.mode).toBe('normal');
  });
  it('keeps window DOM order stable when focus raises a window', async () => {
    const user = userEvent.setup();
    const store = createDesktopStore();
    render(<VirtualDesktop store={store} />);
    const icon = screen.getByRole('button', { name: '메모장 열기' });
    await user.dblClick(icon); await user.dblClick(screen.getByRole('button', { name: '파일 탐색기 열기' }));
    const first = screen.getByRole('region', { name: '메모장 notepad-1' });
    const sibling = first.nextElementSibling;
    await user.click(within(first).getByRole('textbox'));
    expect(store.getSnapshot().focusedWindowId).toBe('window-1');
    expect(first.nextElementSibling).toBe(sibling);
    expect(first.style.zIndex).toBe('2');
  });
  it('keeps title text constant and distinguishes active, inactive and minimized indicators', async () => {
    const user = userEvent.setup();
    const store = createDesktopStore();
    render(<VirtualDesktop store={store} />);
    const icon = screen.getByRole('button', { name: '메모장 열기' });
    await user.dblClick(icon); await user.dblClick(screen.getByRole('button', { name: '파일 탐색기 열기' }));
    const firstTask = screen.getByRole('button', { name: '메모장 notepad-1 표시' });
    const secondTask = screen.getByRole('button', { name: '파일 탐색기 explorer-2 표시' });
    expect(firstTask.classList.contains('inactive')).toBe(true);
    expect(secondTask.classList.contains('active')).toBe(true);
    const title = secondTask.textContent;
    await user.click(within(screen.getByRole('region', { name: '파일 탐색기 explorer-2' })).getByRole('button', { name: '최소화' }));
    expect(secondTask.textContent).toBe(title);
    expect(secondTask.classList.contains('minimized')).toBe(true);
    expect(firstTask.classList.contains('active')).toBe(true);
    await user.click(secondTask);
    expect(secondTask.classList.contains('active')).toBe(true);
    expect(secondTask.classList.contains('minimized')).toBe(false);
  });
});

describe('document lifecycle dialogs', () => {
  it('saves a new document and updates the same file without a second dialog', async () => {
    const user = userEvent.setup();
    const store = createDesktopStore();
    render(<VirtualDesktop store={store} />);
    await user.dblClick(screen.getByRole('button', { name: '메모장 열기' }));
    await user.type(screen.getByRole('textbox'), 'hello');
    await user.click(screen.getByRole('button', { name: '저장' }));
    const dialog = screen.getByRole('dialog', { name: '문서 저장' });
    expect(screen.getByRole('region', { name: '메모장 notepad-1' }).querySelector('.window-content')?.hasAttribute('inert')).toBe(true);
    await user.keyboard('test.txt');
    await user.click(within(dialog).getByRole('button', { name: '저장' }));
    expect(store.getSnapshot().fileSystem.entries['file-1']).toMatchObject({ name: 'test.txt', content: 'hello' });
    await user.type(screen.getByRole('textbox'), ' world');
    await user.click(screen.getByRole('button', { name: '저장' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(store.getSnapshot().fileSystem.entries['file-1']).toMatchObject({ content: 'hello world' });
    expect((store.getSnapshot().applications['notepad-1'] as NotepadState).session.dirty).toBe(false);
  });
  it('Close Cancel preserves the session, discard closes, and reopening is empty', async () => {
    const user = userEvent.setup();
    const store = createDesktopStore();
    render(<VirtualDesktop store={store} />);
    const icon = screen.getByRole('button', { name: '메모장 열기' });
    await user.dblClick(icon);
    await user.type(screen.getByRole('textbox'), 'draft');
    await user.click(screen.getByRole('button', { name: '닫기' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: '취소' }));
    expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe('draft');
    await user.click(screen.getByRole('button', { name: '닫기' }));
    await user.click(screen.getByRole('button', { name: '저장 안 함' }));
    await user.dblClick(icon);
    expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe('');
  });
  it('Close Save opens a filename dialog and closes only after saving the file', async () => {
    const user = userEvent.setup();
    const store = createDesktopStore();
    render(<VirtualDesktop store={store} />);
    await user.dblClick(screen.getByRole('button', { name: '메모장 열기' }));
    await user.type(screen.getByRole('textbox'), 'saved on close');
    await user.click(screen.getByRole('button', { name: '닫기' }));
    await user.click(within(screen.getByRole('dialog', { name: '닫기 확인' })).getByRole('button', { name: '저장' }));
    const dialog = screen.getByRole('dialog', { name: '문서 저장' });
    await user.keyboard('closed.txt');
    await user.click(within(dialog).getByRole('button', { name: '저장' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(Object.keys(store.getSnapshot().windows)).toHaveLength(0);
    expect(store.getSnapshot().fileSystem.entries['file-1']).toMatchObject({ name: 'closed.txt', content: 'saved on close' });
  });
});


