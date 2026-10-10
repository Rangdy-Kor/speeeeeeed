import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { DesktopStore } from '../store';
import { DesktopWindow } from './DesktopWindow';
import { APPLICATION_NAMES } from '../domain';
import type { ApplicationState } from '../domain';
import { Icon } from './Icon';

export function VirtualDesktop({ store }: { store: DesktopStore }) {
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot);
  const workArea = useRef<HTMLDivElement>(null);
  const [selectedIcon, setSelectedIcon] = useState<ApplicationState['type'] | null>(null);
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
    {/* OS stacking context contains windows/taskbar. Future HUD is a non-blocking sibling overlay. */}
    <div className="virtual-os">
    <div ref={workArea} className="desktop-surface" aria-label="가상 데스크톱" onPointerDown={event => { if (event.target === event.currentTarget) setSelectedIcon(null); }}>
      <div className="desktop-icons">
        {(['notepad', 'explorer'] as const).map(type => <button key={type} className={`desktop-icon ${selectedIcon === type ? 'selected' : ''}`} aria-pressed={selectedIcon === type} onClick={() => setSelectedIcon(type)} onDoubleClick={() => store.dispatch({ type: 'openApplication', application: type })} onKeyDown={event => { if (event.key === 'Enter' && !event.repeat) { event.preventDefault(); store.dispatch({ type: 'openApplication', application: type }); } }} aria-label={`${APPLICATION_NAMES[type]} 열기`} title="더블 클릭하여 열기">
          <Icon name={type} /><span>{APPLICATION_NAMES[type]}</span>
        </button>)}
      </div>
      {Object.values(state.windows).map(window => <DesktopWindow key={window.id} window={window} application={state.applications[window.applicationId]!} fileSystem={state.fileSystem} workArea={state.workArea} focused={state.focusedWindowId === window.id} zIndex={state.zOrder.indexOf(window.id) + 1} store={store} />)}
    </div>
    <nav className="taskbar" aria-label="작업 표시줄">
      <div className="taskbar-windows">
        {Object.values(state.windows).map(window => {
          const app = state.applications[window.applicationId]!;
          const name = APPLICATION_NAMES[app.type];
          return <button key={window.id} className={`taskbar-item ${window.minimized ? 'minimized' : state.focusedWindowId === window.id ? 'active' : 'inactive'}`} aria-label={`${name} ${window.applicationId} 표시`} aria-pressed={state.focusedWindowId === window.id} onClick={() => store.dispatch({ type: 'focusWindow', id: window.id })}><Icon name={app.type} /><span>{name}</span></button>;
        })}
      </div>
    </nav>
    </div>
  </main>;
}
