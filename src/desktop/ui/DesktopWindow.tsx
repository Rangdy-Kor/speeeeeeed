import { useEffect, useRef } from 'react';
import type { PointerEvent } from 'react';
import { APPLICATION_NAMES, getWindowBounds } from '../domain';
import type { ApplicationState, WindowState, WorkArea } from '../domain';
import type { FileSystemState } from '../filesystem';
import type { DesktopStore } from '../store';
import { DocumentDialog } from './DocumentDialog';
import { FileExplorer } from './FileExplorer';
import { Notepad } from './Notepad';
import { Icon } from './Icon';

interface Props { window: WindowState; application: ApplicationState; fileSystem: FileSystemState; workArea: WorkArea; focused: boolean; zIndex: number; store: DesktopStore }
export function DesktopWindow({ window, application, fileSystem, workArea, focused, zIndex, store }: Props) {
  const surface = useRef<HTMLDivElement>(null);
  const drag = useRef<{ pointerId: number; offsetX: number; offsetY: number } | null>(null);
  const bounds = getWindowBounds(window, workArea);
  const dialog = application.type === 'notepad' ? application.dialog : null;
  const name = APPLICATION_NAMES[application.type];
  useEffect(() => {
    if (focused && !window.minimized && !surface.current?.contains(document.activeElement)) {
      const target = dialog ? '[role="dialog"] input, [role="dialog"] button' : application.type === 'notepad' ? 'textarea' : '.explorer-navigation button:not(:disabled)';
      surface.current?.querySelector<HTMLElement>(target)?.focus({ preventScroll: true });
    }
  }, [focused, window.minimized, dialog, application.type]);
  useEffect(() => { drag.current = null; }, [workArea.width, workArea.height, window.mode, window.minimized]);
  const beginDrag = (event: PointerEvent<HTMLElement>) => {
    if (event.button !== 0 || (event.target as HTMLElement).closest('button') || window.mode !== 'normal') return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { pointerId: event.pointerId, offsetX: event.clientX - bounds.x, offsetY: event.clientY - bounds.y };
  };
  const move = (event: PointerEvent<HTMLElement>) => {
    if (!drag.current || drag.current.pointerId !== event.pointerId) return;
    store.dispatch({ type: 'moveWindow', id: window.id, x: event.clientX - drag.current.offsetX, y: event.clientY - drag.current.offsetY });
  };
  const focusContent = (target: EventTarget) => {
    if (!focused && !(target as Element).closest('.window-controls')) store.dispatch({ type: 'focusWindow', id: window.id });
  };
  return <section ref={surface} className={`desktop-window ${focused ? 'is-focused' : ''}`} style={{ left: bounds.x, top: bounds.y, width: bounds.width, height: bounds.height, zIndex }} hidden={window.minimized} aria-label={`${name} ${application.id}`} onPointerDownCapture={event => focusContent(event.target)} onFocusCapture={event => focusContent(event.target)}>
    <div className="window-content" inert={dialog !== null}>
    <header className={`window-titlebar ${window.mode}`} onPointerDown={beginDrag} onPointerMove={move} onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }} onLostPointerCapture={() => { drag.current = null; }}>
      <span className="window-title"><Icon name={application.type} />{name}</span>
      <div className="window-controls">
        <button aria-label="최소화" onClick={() => store.dispatch({ type: 'minimizeWindow', id: window.id })}><Icon name="minimize" /></button>
        <button aria-label={window.mode === 'maximized' ? '이전 크기로 복원' : '최대화'} onClick={() => store.dispatch({ type: window.mode === 'maximized' ? 'restoreWindow' : 'maximizeWindow', id: window.id })}><Icon name={window.mode === 'maximized' ? 'restore' : 'maximize'} /></button>
        <button className="close-window" aria-label="닫기" onClick={() => store.dispatch({ type: 'closeWindow', id: window.id })}><Icon name="close" /></button>
      </div>
    </header>
    {application.type === 'notepad' ? <Notepad application={application} focused={focused && !window.minimized} store={store} /> : <FileExplorer application={application} fileSystem={fileSystem} store={store} />}
    </div>
    {application.type === 'notepad' && dialog ? <DocumentDialog application={application} store={store} /> : null}
  </section>;
}
