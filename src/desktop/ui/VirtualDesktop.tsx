import { useEffect, useRef, useSyncExternalStore } from 'react';
import { GAME_TITLE } from '../../game/config';
import type { DesktopStore } from '../store';
import { DesktopWindow } from './DesktopWindow';
import { APPLICATION_NAMES } from '../domain';

export function VirtualDesktop({ store }: { store: DesktopStore }) {
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot);
  const workArea = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const surface = workArea.current!;
    const measure = () => {
      const rect = surface.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) store.dispatch({ type: 'setWorkArea', width: rect.width, height: rect.height });
    };
    const observer = new ResizeObserver(measure);
    observer.observe(surface);
    measure();
    return () => observer.disconnect();
  }, [store]);
  return <main className="virtual-desktop">
    <div ref={workArea} className="desktop-surface" aria-label="가상 데스크톱">
      <div className="desktop-icons">
        <button className="desktop-icon" onDoubleClick={() => store.dispatch({ type: 'openApplication', application: 'notepad' })} onKeyDown={event => { if (event.key === 'Enter' && !event.repeat) { event.preventDefault(); store.dispatch({ type: 'openApplication', application: 'notepad' }); } }} aria-label="메모장 열기" title="더블 클릭하여 열기">
          <span className="notepad-icon" aria-hidden="true">▤</span><span>메모장</span>
        </button>
        <button className="desktop-icon" onDoubleClick={() => store.dispatch({ type: 'openApplication', application: 'explorer' })} onKeyDown={event => { if (event.key === 'Enter' && !event.repeat) { event.preventDefault(); store.dispatch({ type: 'openApplication', application: 'explorer' }); } }} aria-label="파일 탐색기 열기" title="더블 클릭하여 열기">
          <span className="notepad-icon" aria-hidden="true">▰</span><span>파일 탐색기</span>
        </button>
      </div>
      <div className="wallpaper-mark" aria-hidden="true"><strong>{GAME_TITLE}</strong><span>VIRTUAL DESKTOP · FOUNDATION 1</span></div>
      {Object.values(state.windows).map(window => <DesktopWindow key={window.id} window={window} application={state.applications[window.applicationId]!} fileSystem={state.fileSystem} workArea={state.workArea} focused={state.focusedWindowId === window.id} zIndex={state.zOrder.indexOf(window.id) + 1} store={store} />)}
    </div>
    <nav className="taskbar" aria-label="작업 표시줄">
      <span className="taskbar-brand">SP<span>!!!</span></span>
      <div className="taskbar-windows">
        {Object.values(state.windows).map(window => {
          const app = state.applications[window.applicationId]!;
          const name = APPLICATION_NAMES[app.type];
          return <button key={window.id} className={`taskbar-item ${window.minimized ? 'minimized' : state.focusedWindowId === window.id ? 'active' : 'inactive'}`} aria-label={`${name} ${window.applicationId} 표시`} aria-pressed={state.focusedWindowId === window.id} onClick={() => store.dispatch({ type: 'focusWindow', id: window.id })}>{app.type === 'notepad' ? '▤' : '▰'} {name}</button>;
        })}
      </div>
      <a className="prototype-link" href="/prototype.html">Prototype ↗</a>
    </nav>
  </main>;
}
