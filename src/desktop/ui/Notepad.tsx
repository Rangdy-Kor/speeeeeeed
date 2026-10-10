import { useEffect } from 'react';
import type { NotepadState } from '../domain';
import type { DesktopStore } from '../store';

export function Notepad({ application, focused, store }: { application: NotepadState; focused: boolean; store: DesktopStore }) {
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
  return <>
    <div className="notepad-toolbar"><button type="button" onClick={() => store.dispatch({ type: 'saveDocument', applicationId: application.id })}>저장</button><span>{application.session.dirty ? '● 변경됨' : ''}</span></div>
    <textarea className="notepad-editor" aria-label="메모장 내용" spellCheck={false} value={application.session.content} onChange={event => store.dispatch({ type: 'setNotepadText', applicationId: application.id, text: event.target.value })} />
  </>;
}
