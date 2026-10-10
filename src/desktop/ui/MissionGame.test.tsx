// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createDesktopStore } from '../store';
import { createMissionRuntime } from '../missions/runtime';
import { currentNotepad } from '../missions/definitions';
import { MissionGame } from './MissionGame';

const runtimes: ReturnType<typeof createMissionRuntime>[] = [];
beforeEach(() => {
  vi.stubGlobal('ResizeObserver', class { observe(): void {} disconnect(): void {} });
});
afterEach(() => { cleanup(); runtimes.splice(0).forEach(runtime => runtime.dispose()); vi.unstubAllGlobals(); });
function setup() {
  const store = createDesktopStore(); let time = 1000;
  const runtime = createMissionRuntime(store, undefined, () => time); runtimes.push(runtime);
  const user = userEvent.setup(); render(<MissionGame store={store} runtime={runtime} />);
  const open = (name: string) => user.dblClick(screen.getByRole('button', { name: `${name} 열기` }));
  const begin = async () => { await user.click(screen.getByRole('button', { name: '시작' })); await open('메모장'); };
  return { store, runtime, user, open, begin, setTime: (value: number) => { time = value; } };
}

describe('first mission batch rhythm', () => {
  for (const saveMethod of ['shortcut', 'menu'] as const) {
    it(`plays all ten via ${saveMethod}, preserving selection and filename focus across HUD updates`, async () => {
      const { store, runtime, user, open, begin, setTime } = setup();
      expect(runtime.getSnapshot().status).toBe('idle');
      await begin();
      const editor = screen.getByRole('textbox', { name: '메모장 내용' }) as HTMLTextAreaElement;
      expect(document.activeElement).toBe(editor);
      await user.keyboard('SPEED');
      expect(screen.getByRole('status').textContent).toBe('모두 선택하세요!');
      await user.keyboard('{Control>}a{/Control}');
      expect(runtime.getSnapshot().currentMissionIndex).toBe(3);
      expect(screen.getByRole('textbox', { name: '메모장 내용' })).toBe(editor);
      expect(document.activeElement).toBe(editor);
      expect([editor.selectionStart, editor.selectionEnd]).toEqual([0, 5]);
      await user.keyboard('FASTER');
      expect(editor.value).toBe('FASTER');
      expect(runtime.getSnapshot().currentMissionIndex).toBe(4);
      if (saveMethod === 'shortcut') await user.keyboard('{Control>}s{/Control}');
      else {
        await user.click(screen.getByRole('menuitem', { name: '파일' }));
        await user.click(screen.getByRole('menuitem', { name: /저장/ }));
      }
      expect(runtime.getSnapshot().currentMissionIndex).toBe(5);
      const filename = within(screen.getByRole('dialog', { name: '문서 저장' })).getByRole('textbox') as HTMLInputElement;
      expect(document.activeElement).toBe(filename);
      expect(filename.value).toBe('새 텍스트 문서.txt');
      expect([filename.selectionStart, filename.selectionEnd]).toEqual([0, filename.value.length]);
      await user.keyboard('speed.txt');
      expect(runtime.getSnapshot().currentMissionIndex).toBe(5);
      await user.keyboard('{Enter}');
      expect(runtime.getSnapshot().currentMissionIndex).toBe(6);
      expect(currentNotepad(store.getSnapshot())?.session).toEqual({ fileId: 'file-1', content: 'FASTER', dirty: false });
      await user.click(screen.getByRole('button', { name: '닫기' }));
      expect(screen.queryByRole('dialog')).toBeNull();
      await open('파일 탐색기');
      expect(runtime.getSnapshot().currentMissionIndex).toBe(8);
      fireEvent.keyDown(document.activeElement!, { key: 'Delete' });
      expect(runtime.getSnapshot().currentMissionIndex).toBe(8);
      await user.click(within(screen.getByRole('navigation', { name: '빠른 탐색' })).getByRole('button', { name: 'Documents' }));
      await user.click(screen.getByRole('button', { name: 'speed.txt' }));
      await user.keyboard('{Delete}');
      expect(screen.queryByRole('button', { name: 'speed.txt' })).toBeNull();
      expect(runtime.getSnapshot().currentMissionIndex).toBe(9);
      setTime(9420); await user.click(screen.getByRole('button', { name: '닫기' }));
      expect(screen.getByRole('dialog', { name: '미션 완료' }).textContent).toContain('8.42초');
      expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('10');
      await user.click(screen.getByRole('button', { name: '다시 시작' }));
      expect(runtime.getSnapshot()).toMatchObject({ status: 'running', currentMissionIndex: 0, elapsedMs: 0 });
      expect(store.getSnapshot()).toMatchObject({ windows: {}, applications: {}, focusedWindowId: null });
      expect(store.getSnapshot().fileSystem.entries['file-1']).toBeUndefined();
      expect(screen.queryByRole('dialog')).toBeNull();
    });
  }
  it('raw Ctrl+A or partial selection does not advance; native whole selection does without changing focus', async () => {
    const { user, begin, runtime } = setup(); await begin(); await user.keyboard('SPEED');
    const editor = screen.getByRole('textbox') as HTMLTextAreaElement;
    fireEvent.keyDown(editor, { key: 'a', ctrlKey: true });
    expect(runtime.getSnapshot().currentMissionIndex).toBe(2);
    editor.setSelectionRange(1, 5); fireEvent.select(editor);
    expect(runtime.getSnapshot().currentMissionIndex).toBe(2);
    editor.setSelectionRange(0, 5); fireEvent.select(editor);
    expect(runtime.getSnapshot().currentMissionIndex).toBe(3);
    expect(document.activeElement).toBe(editor);
    expect([editor.selectionStart, editor.selectionEnd]).toEqual([0, 5]);
  });
  it('instruction/progress never capture pointer input and do not delay mission transition', async () => {
    const { begin, runtime } = setup(); await begin();
    const instruction = screen.getByRole('status');
    expect(getComputedStyle(instruction.closest('.game-hud-overlay')!).pointerEvents).toBe('none');
    expect(runtime.getSnapshot().currentMissionIndex).toBe(1);
    expect(screen.getByLabelText('미션 진행도').textContent).toBe('2 / 10');
  });
  it('Ctrl+S in another active app cannot bypass the Notepad Save lifecycle', async () => {
    const { user, begin, open, runtime } = setup(); await begin();
    await user.keyboard('SPEED{Control>}a{/Control}FASTER'); await open('파일 탐색기');
    fireEvent.keyDown(document.activeElement!, { key: 's', ctrlKey: true });
    expect(runtime.getSnapshot().currentMissionIndex).toBe(4);
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

describe('Explorer deletion input', () => {
  it('mouse delete shares the semantic action; directory Delete is ignored', async () => {
    const { store, user, begin, open, runtime } = setup(); await begin();
    await user.keyboard('SPEED{Control>}a{/Control}FASTER{Control>}s{/Control}speed.txt{Enter}');
    await user.click(screen.getByRole('button', { name: '닫기' })); await open('파일 탐색기');
    await user.click(screen.getByRole('button', { name: '상위 폴더' }));
    const items = screen.getByLabelText('폴더 내용');
    await user.click(within(items).getByRole('button', { name: 'Documents' })); await user.keyboard('{Delete}');
    expect(store.getSnapshot().fileSystem.entries.documents?.kind).toBe('directory');
    expect(runtime.getSnapshot().currentMissionIndex).toBe(8);
    await user.dblClick(within(items).getByRole('button', { name: 'Documents' }));
    await user.click(screen.getByRole('button', { name: 'speed.txt' }));
    await user.click(screen.getByRole('button', { name: '삭제' }));
    expect(runtime.getSnapshot().currentMissionIndex).toBe(9);
    expect(store.getSnapshot().fileSystem.entries['file-1']).toBeUndefined();
  });
});
