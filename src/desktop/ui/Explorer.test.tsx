// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
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
  const open = (application: '메모장' | '파일 탐색기') => user.dblClick(screen.getByRole('button', { name: `${application} 열기` }));
  const app = () => Object.values(store.getSnapshot().applications).find((app): app is NotepadState => app.type === 'notepad')!;
  const shortcut = () => user.keyboard('{Control>}s{/Control}');
  return { store, user, open, app, shortcut };
}

describe('Notepad keyboard save', () => {
  it('Ctrl+S uses Save action, prevents browser default and selects the default filename', async () => {
    const { open, app } = setup();
    await open('메모장');
    const event = new KeyboardEvent('keydown', { key: 's', ctrlKey: true, bubbles: true, cancelable: true });
    document.activeElement!.dispatchEvent(event);
    // React updates from manually dispatched native events are flushed by a following query wait.
    const input = await screen.findByRole('textbox', { name: '파일 이름' }) as HTMLInputElement;
    expect(event.defaultPrevented).toBe(true);
    expect(app().dialog?.kind).toBe('save');
    expect(input.value).toBe('새 텍스트 문서.txt');
    expect(document.activeElement).toBe(input);
    expect(input.selectionStart).toBe(0);
    expect(input.selectionEnd).toBe(input.value.length);
  });
  it('Enter saves the default name and Ctrl+S updates the same file without a dialog', async () => {
    const { store, user, open, app, shortcut } = setup();
    await open('메모장'); await user.type(screen.getByRole('textbox'), 'Hello');
    await shortcut(); await user.keyboard('{Enter}');
    expect(store.getSnapshot().fileSystem.entries['file-1']).toMatchObject({ name: '새 텍스트 문서.txt', content: 'Hello' });
    await user.type(screen.getByRole('textbox'), '!'); await shortcut();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(app().session).toEqual({ fileId: 'file-1', content: 'Hello!', dirty: false });
    expect(store.getSnapshot().fileSystem.entries['file-1']).toMatchObject({ content: 'Hello!' });
    expect(Object.values(store.getSnapshot().fileSystem.entries).filter(entry => entry.kind === 'file')).toHaveLength(1);
  });
  it('typing replaces the selected default and Escape cancels Save', async () => {
    const { user, open, app, shortcut } = setup();
    await open('메모장'); await shortcut();
    await user.keyboard('test.txt');
    expect((screen.getByRole('textbox', { name: '파일 이름' }) as HTMLInputElement).value).toBe('test.txt');
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(app().session.fileId).toBeNull();
  });
  it('IME composition Enter does not submit; normal Enter after composition saves', async () => {
    const { store, user, open, shortcut } = setup();
    await open('메모장'); await shortcut();
    const input = screen.getByRole('textbox', { name: '파일 이름' });
    fireEvent.compositionStart(input);
    expect(fireEvent.keyDown(input, { key: 'Enter', isComposing: true, keyCode: 229 })).toBe(true);
    fireEvent.submit(input.closest('form')!);
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(store.getSnapshot().fileSystem.entries['file-1']).toBeUndefined();
    fireEvent.compositionEnd(input);
    await user.keyboard('{Enter}');
    expect(store.getSnapshot().fileSystem.entries['file-1']).toBeDefined();
  });
  it('invalid filenames keep Save open and display the domain error', async () => {
    const { user, open, shortcut } = setup();
    await open('메모장'); await shortcut(); await user.keyboard('../bad.txt{Enter}');
    expect(screen.getByRole('alert').textContent).toBe('올바른 파일 이름을 입력하세요.');
    expect(screen.getByRole('dialog')).toBeTruthy();
  });
  it('inactive Notepad does not intercept shortcuts while Explorer is active', async () => {
    const { open, store } = setup();
    await open('메모장'); await open('파일 탐색기');
    const prevented = !fireEvent.keyDown(document.activeElement!, { key: 's', ctrlKey: true });
    expect(prevented).toBe(false);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(store.getSnapshot().focusedWindowId).toBe('window-2');
  });
});

describe('Explorer DOM and application integration', () => {
  it('opens on Desktop, navigates Documents and directories by double click', async () => {
    const { user, open } = setup();
    await open('파일 탐색기');
    expect(screen.getByRole('heading', { name: 'Desktop/' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Documents' }));
    expect(screen.getByRole('heading', { name: 'Documents/' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: '상위 폴더' }));
    const items = screen.getByLabelText('폴더 내용');
    await user.dblClick(within(items).getByRole('button', { name: 'Desktop' }));
    expect(screen.getByRole('heading', { name: 'Desktop/' })).toBeTruthy();
  });
  it('shows a newly saved shared file immediately; opens its content and updates the same file via Ctrl+S', async () => {
    const { store, user, open, app, shortcut } = setup();
    await open('파일 탐색기');
    await user.click(screen.getByRole('button', { name: 'Documents' }));
    await open('메모장');
    await user.type(screen.getByRole('textbox'), 'Hello'); await shortcut(); await user.keyboard('test.txt{Enter}');
    const item = screen.getByRole('button', { name: 'test.txt' });
    expect(item).toBeTruthy();
    await user.click(within(screen.getByRole('region', { name: '메모장 notepad-2' })).getByRole('button', { name: '닫기' }));
    await user.click(item);
    expect(item.getAttribute('aria-pressed')).toBe('true');
    expect(screen.queryByRole('textbox')).toBeNull();
    await user.dblClick(item);
    expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe('Hello');
    expect(app().session).toEqual({ fileId: 'file-1', content: 'Hello', dirty: false });
    await user.type(screen.getByRole('textbox'), ' updated'); await shortcut();
    expect(store.getSnapshot().fileSystem.entries['file-1']).toMatchObject({ content: 'Hello updated' });
    expect(app().session.dirty).toBe(false);
    expect(screen.getAllByRole('button', { name: 'test.txt' })).toHaveLength(1);
  });
  it('prompts before replacing a dirty session; Cancel preserves it and discard loads the target', async () => {
    const { user, open, app, shortcut } = setup();
    await open('메모장'); await user.type(screen.getByRole('textbox'), 'saved');
    await shortcut(); await user.keyboard('test.txt{Enter}');
    await user.click(screen.getByRole('button', { name: '닫기' }));
    await open('메모장'); await user.type(screen.getByRole('textbox'), 'draft');
    await open('파일 탐색기'); await user.click(screen.getByRole('button', { name: 'Documents' }));
    await user.dblClick(screen.getByRole('button', { name: 'test.txt' }));
    expect(screen.getByRole('dialog', { name: '문서 교체 확인' })).toBeTruthy();
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: '취소' }));
    expect(app().session.content).toBe('draft');
    await user.dblClick(screen.getByRole('button', { name: 'test.txt' }));
    await user.click(screen.getByRole('button', { name: '저장 안 함' }));
    expect(app().session).toEqual({ fileId: 'file-1', content: 'saved', dirty: false });
  });
  it('asks overwrite confirmation and updates the existing file without a duplicate', async () => {
    const { store, user, open, app, shortcut } = setup();
    await open('메모장'); await user.type(screen.getByRole('textbox'), 'original');
    await shortcut(); await user.keyboard('test.txt{Enter}');
    await user.click(screen.getByRole('button', { name: '닫기' }));
    await open('메모장'); await user.type(screen.getByRole('textbox'), 'replacement');
    await shortcut(); await user.keyboard('test.txt{Enter}');
    expect(screen.getByRole('dialog', { name: '덮어쓰기 확인' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: '덮어쓰기' }));
    expect(app().session).toEqual({ fileId: 'file-1', content: 'replacement', dirty: false });
    expect(store.getSnapshot().fileSystem.entries['file-1']).toMatchObject({ content: 'replacement' });
    expect(Object.values(store.getSnapshot().fileSystem.entries).filter(entry => entry.kind === 'file')).toHaveLength(1);
  });
});
