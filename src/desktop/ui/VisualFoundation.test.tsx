// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createDesktopStore } from '../store';
import type { NotepadState } from '../domain';
import { VirtualDesktop } from './VirtualDesktop';

beforeEach(() => vi.stubGlobal('ResizeObserver', class { observe(): void {} disconnect(): void {} }));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
function setup() {
  const store = createDesktopStore();
  const user = userEvent.setup();
  render(<VirtualDesktop store={store} />);
  const open = (name: string) => user.dblClick(screen.getByRole('button', { name: `${name} 열기` }));
  const fileMenu = () => user.click(screen.getByRole('menuitem', { name: '파일' }));
  const app = () => Object.values(store.getSnapshot().applications).find((app): app is NotepadState => app.type === 'notepad')!;
  return { store, user, open, fileMenu, app };
}

describe('desktop/menu interaction', () => {
  it('selects shortcuts on single click, clears on the desktop and omits development navigation', async () => {
    const { user, store } = setup();
    const icon = screen.getByRole('button', { name: '메모장 열기' });
    await user.click(icon);
    expect(icon.getAttribute('aria-pressed')).toBe('true');
    expect(Object.keys(store.getSnapshot().windows)).toHaveLength(0);
    await user.click(screen.getByLabelText('가상 데스크톱'));
    expect(icon.getAttribute('aria-pressed')).toBe('false');
    expect(screen.queryByText(/FOUNDATION/)).toBeNull();
    expect(screen.queryByRole('link', { name: /Prototype/ })).toBeNull();
  });
  it('opens/closes the File menu by click and closes outside on the editor', async () => {
    const { user, open, fileMenu } = setup(); await open('메모장');
    await fileMenu(); expect(screen.getByRole('menu', { name: '파일' })).toBeTruthy();
    await fileMenu(); expect(screen.queryByRole('menu')).toBeNull();
    await fileMenu(); await user.click(screen.getByRole('textbox'));
    expect(screen.queryByRole('menu')).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole('textbox'));
  });
  it('Escape closes a menu and returns focus to its trigger', async () => {
    const { user, open, fileMenu } = setup(); await open('메모장'); await fileMenu();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole('menuitem', { name: '파일' }));
  });
  it('supports keyboard menu navigation and Edit selects the native textarea content', async () => {
    const { user, open } = setup(); await open('메모장');
    const editor = screen.getByRole('textbox') as HTMLTextAreaElement;
    await user.type(editor, 'Hello');
    screen.getByRole('menuitem', { name: '파일' }).focus();
    await user.keyboard('{ArrowDown}{ArrowDown}');
    expect(document.activeElement?.textContent).toContain('저장');
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('menu', { name: '편집' })).toBeTruthy();
    await user.keyboard('{Enter}');
    expect(document.activeElement).toBe(editor);
    expect(editor.selectionStart).toBe(0); expect(editor.selectionEnd).toBe(5);
  });
  it('Save menu runs the same save action as Ctrl+S', async () => {
    const { user, store, open, fileMenu, app } = setup(); await open('메모장');
    await user.type(screen.getByRole('textbox'), 'Hello');
    await fileMenu(); await user.click(screen.getByRole('menuitem', { name: /저장/ }));
    expect(screen.queryByRole('menu')).toBeNull();
    await user.keyboard('test.txt{Enter}');
    expect(app().session.dirty).toBe(false);
    await user.type(screen.getByRole('textbox'), '!');
    await fileMenu(); await user.click(screen.getByRole('menuitem', { name: /저장/ }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(store.getSnapshot().fileSystem.entries['file-1']).toMatchObject({ content: 'Hello!' });
  });
  it('New respects dirty confirmation, Cancel preserves and discard starts blank', async () => {
    const { user, open, fileMenu, app } = setup(); await open('메모장');
    await user.type(screen.getByRole('textbox'), 'draft');
    await fileMenu(); await user.click(screen.getByRole('menuitem', { name: '새로 만들기' }));
    expect(screen.getByRole('dialog', { name: '문서 교체 확인' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: '취소' }));
    expect(app().session.content).toBe('draft');
    await fileMenu(); await user.click(screen.getByRole('menuitem', { name: '새로 만들기' }));
    await user.click(screen.getByRole('button', { name: '저장 안 함' }));
    expect(app().session).toEqual({ content: '', fileId: null, dirty: false });
    expect(document.activeElement).toBe(screen.getByRole('textbox'));
  });
  it('closes a menu when another window receives focus without changing that window action', async () => {
    const { user, open, fileMenu, store } = setup(); await open('메모장'); await open('파일 탐색기');
    await user.click(screen.getByRole('button', { name: '메모장 notepad-1 표시' }));
    await fileMenu();
    await user.click(within(screen.getByRole('region', { name: '파일 탐색기 explorer-2' })).getByRole('button', { name: '최소화' }));
    expect(screen.queryByRole('menu')).toBeNull();
    expect(store.getSnapshot().windows['window-2']!.minimized).toBe(true);
  });
});

describe('Explorer navigation chrome', () => {
  it('sidebar, Back, Up and breadcrumb navigation preserve history and current indicators', async () => {
    const { user, open } = setup(); await open('파일 탐색기');
    const sidebar = screen.getByRole('navigation', { name: '빠른 탐색' });
    const back = screen.getByRole('button', { name: '뒤로' }) as HTMLButtonElement;
    expect(back.disabled).toBe(true);
    await user.click(within(sidebar).getByRole('button', { name: 'Documents' }));
    expect(within(sidebar).getByRole('button', { name: 'Documents' }).getAttribute('aria-current')).toBe('location');
    expect(screen.getByRole('button', { name: 'Documents로 이동' }).getAttribute('aria-current')).toBe('location');
    await user.click(back); expect(screen.getByRole('heading', { name: 'Desktop/' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: '상위 폴더' }));
    expect(screen.getByRole('heading', { name: '내 컴퓨터/' })).toBeTruthy();
    const items = screen.getByLabelText('폴더 내용');
    await user.click(within(items).getByRole('button', { name: 'Documents' }));
    expect(within(items).getByRole('button', { name: 'Documents' }).getAttribute('aria-pressed')).toBe('true');
    await user.dblClick(within(items).getByRole('button', { name: 'Documents' }));
    await user.click(screen.getByRole('button', { name: '내 컴퓨터로 이동' }));
    expect(screen.getByRole('heading', { name: '내 컴퓨터/' })).toBeTruthy();
    expect((screen.getByRole('button', { name: '상위 폴더' }) as HTMLButtonElement).disabled).toBe(true);
    expect(within(screen.getByLabelText('폴더 내용')).getByRole('button', { name: 'Documents' }).getAttribute('aria-pressed')).toBe('false');
  });
});
