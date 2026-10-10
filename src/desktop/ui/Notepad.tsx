import { useEffect, useRef } from 'react';
import type { NotepadState } from '../domain';
import type { DesktopStore } from '../store';
import { MenuBar } from './MenuBar';

export function Notepad({ application, focused, store }: { application: NotepadState; focused: boolean; store: DesktopStore }) {
  const editor = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (!focused) return;
    const shortcut = (event: KeyboardEvent) => {
      if (!event.ctrlKey || event.altKey || event.key.toLowerCase() !== 's' || event.isComposing) return;
      const state = store.getSnapshot();
      if (state.windows[state.focusedWindowId ?? '']?.applicationId !== application.id) return;
      event.preventDefault();
      store.dispatch({ type: 'saveDocument', applicationId: application.id });
    };
    document.addEventListener('keydown', shortcut);
    return () => document.removeEventListener('keydown', shortcut);
  }, [focused, application.id, store]);
  const action = (type: 'newDocument' | 'saveDocument') => {
    store.dispatch({ type, applicationId: application.id });
    editor.current?.focus({ preventScroll: true });
  };
  return <>
    <MenuBar active={focused && !application.dialog} menus={[
      { label: '파일', items: [{ label: '새로 만들기', action: () => action('newDocument') }, { label: '저장', shortcut: 'Ctrl+S', action: () => action('saveDocument') }] },
      { label: '편집', items: [{ label: '모두 선택', shortcut: 'Ctrl+A', action: () => { editor.current?.focus(); editor.current?.select(); } }] },
    ]} />
    <textarea ref={editor} className="notepad-editor" aria-label="메모장 내용" spellCheck={false} value={application.session.content} onChange={event => store.dispatch({ type: 'setNotepadText', applicationId: application.id, text: event.target.value })} />
  </>;
}
