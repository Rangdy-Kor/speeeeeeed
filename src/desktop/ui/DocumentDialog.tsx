import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import type { NotepadState } from '../domain';
import type { DesktopStore } from '../store';

export function DocumentDialog({ application, store }: { application: NotepadState; store: DesktopStore }) {
  const [name, setName] = useState('새 텍스트 문서.txt');
  const composing = useRef(false);
  const compositionEnter = useRef(false);
  const surface = useRef<HTMLDivElement>(null);
  const kind = application.dialog!.kind;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    surface.current?.querySelector<HTMLElement>('input, button')?.focus();
    surface.current?.querySelector('input')?.select();
    return () => { if (previous?.isConnected) previous.focus({ preventScroll: true }); };
  }, [kind]);
  const cancel = () => store.dispatch({ type: 'cancelDialog', applicationId: application.id });
  const keyboard = (event: KeyboardEvent<HTMLDivElement>) => {
    compositionEnter.current = event.key === 'Enter' && (composing.current || event.nativeEvent.isComposing || event.keyCode === 229);
    // Preserve the IME commit key; guard implicit form submission separately.
    if (compositionEnter.current) return;
    if (event.nativeEvent.isComposing || composing.current) return;
    if (event.key === 'Escape') { event.preventDefault(); cancel(); }
    if (event.key !== 'Tab') return;
    const controls = [...surface.current!.querySelectorAll<HTMLElement>('input, button')];
    const first = controls[0]!;
    const last = controls.at(-1)!;
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  };
  return <div className="document-dialog-backdrop">
    <div ref={surface} className="document-dialog" role="dialog" aria-label={kind === 'save' ? '문서 저장' : kind === 'overwrite' ? '덮어쓰기 확인' : application.dialog?.kind === 'confirmDocument' && application.dialog.after.kind === 'close' ? '닫기 확인' : '문서 교체 확인'} onKeyDown={keyboard} onKeyUp={() => { compositionEnter.current = false; }} onPointerDown={() => { if (!composing.current) compositionEnter.current = false; }}>
      {kind === 'save' ? <form onSubmit={event => { event.preventDefault(); if (!composing.current && !compositionEnter.current) store.dispatch({ type: 'submitSave', applicationId: application.id, fileName: name }); }}>
        <h2>문서 저장</h2><p>Documents/</p>
        <label>파일 이름<input autoComplete="off" value={name} onChange={event => setName(event.target.value)} onCompositionStart={() => { composing.current = true; }} onCompositionEnd={() => { composing.current = false; }} required /></label>
        {application.dialog?.kind === 'save' && application.dialog.error ? <p role="alert">{application.dialog.error}</p> : null}
        <div className="dialog-actions"><button type="submit">저장</button><button type="button" onClick={cancel}>취소</button></div>
      </form> : kind === 'overwrite' ? <>
        <h2>같은 이름의 파일이 이미 있습니다. 덮어쓰시겠습니까?</h2>
        <div className="dialog-actions"><button onClick={() => store.dispatch({ type: 'confirmOverwrite', applicationId: application.id, overwrite: true })}>덮어쓰기</button><button onClick={() => store.dispatch({ type: 'confirmOverwrite', applicationId: application.id, overwrite: false })}>취소</button></div>
      </> : <>
        <h2>변경 내용을 저장하시겠습니까?</h2>
        <div className="dialog-actions">
          <button onClick={() => store.dispatch({ type: 'confirmDocument', applicationId: application.id, choice: 'save' })}>저장</button>
          <button onClick={() => store.dispatch({ type: 'confirmDocument', applicationId: application.id, choice: 'discard' })}>저장 안 함</button>
          <button onClick={cancel}>취소</button>
        </div>
      </>}
    </div>
  </div>;
}
