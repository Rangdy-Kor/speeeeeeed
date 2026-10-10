import { createFile, createFileSystem, DOCUMENTS_ID, getFile, listChildren, updateFile } from './filesystem';
import type { FileSystemState } from './filesystem';

export interface WorkArea { width: number; height: number }
export interface WindowBounds { x: number; y: number; width: number; height: number }
export interface WindowState {
  readonly id: string;
  readonly applicationId: string;
  readonly bounds: WindowBounds;
  readonly mode: 'normal' | 'maximized';
  readonly minimized: boolean;
}
export interface DocumentSession { readonly content: string; readonly fileId: string | null; readonly dirty: boolean }
export type DocumentIntent = { kind: 'close' } | { kind: 'newDocument' } | { kind: 'openFile'; fileId: string };
export type NotepadDialog =
  | { kind: 'confirmDocument'; after: DocumentIntent }
  | { kind: 'save'; after: DocumentIntent | null; error: string | null }
  | { kind: 'overwrite'; after: DocumentIntent | null; fileId: string; fileName: string };
export interface NotepadState { readonly id: string; readonly type: 'notepad'; readonly session: DocumentSession; readonly dialog: NotepadDialog | null }
export interface ExplorerState { readonly id: string; readonly type: 'explorer'; readonly directoryId: string; readonly history: readonly string[]; readonly selectedId: string | null }
export type ApplicationState = NotepadState | ExplorerState;
export const APPLICATION_NAMES = { notepad: '메모장', explorer: '파일 탐색기' };
export interface VirtualDesktopState {
  readonly workArea: WorkArea;
  readonly windows: Readonly<Record<string, WindowState>>;
  readonly applications: Readonly<Record<string, ApplicationState>>;
  readonly fileSystem: FileSystemState;
  /** Back to front. Focus is explicit; minimized windows stay in this order. */
  readonly zOrder: readonly string[];
  readonly focusedWindowId: string | null;
  readonly nextId: number;
}
export type DesktopAction =
  | { type: 'openApplication'; application: ApplicationState['type'] }
  | { type: 'openFile'; fileId: string }
  | { type: 'closeWindow' | 'focusWindow' | 'minimizeWindow' | 'maximizeWindow' | 'restoreWindow'; id: string }
  | { type: 'moveWindow'; id: string; x: number; y: number }
  | { type: 'setNotepadText'; applicationId: string; text: string }
  | { type: 'saveDocument' | 'newDocument' | 'cancelDialog'; applicationId: string }
  | { type: 'backExplorer'; applicationId: string }
  | { type: 'submitSave'; applicationId: string; fileName: string }
  | { type: 'confirmDocument'; applicationId: string; choice: 'save' | 'discard' | 'cancel' }
  | { type: 'confirmOverwrite'; applicationId: string; overwrite: boolean }
  | { type: 'navigateExplorer'; applicationId: string; directoryId: string }
  | { type: 'selectExplorerItem'; applicationId: string; entryId: string }
  | { type: 'setWorkArea'; width: number; height: number };

export function createDesktopState(width = 1280, height = 672): VirtualDesktopState {
  return { workArea: { width, height }, windows: {}, applications: {}, fileSystem: createFileSystem(), zOrder: [], focusedWindowId: null, nextId: 1 };
}
const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
function fit(bounds: WindowBounds, area: WorkArea): WindowBounds {
  const width = Math.min(bounds.width, area.width);
  const height = Math.min(bounds.height, area.height);
  return { width, height, x: clamp(bounds.x, 0, area.width - width), y: clamp(bounds.y, 0, area.height - height) };
}
export function getWindowBounds(window: WindowState, area: WorkArea): WindowBounds {
  return window.mode === 'maximized' ? { x: 0, y: 0, ...area } : window.bounds;
}
function frontmost(state: VirtualDesktopState): string | null {
  return [...state.zOrder].reverse().find(id => !state.windows[id]?.minimized) ?? null;
}
function focus(state: VirtualDesktopState, window: WindowState): VirtualDesktopState {
  return { ...state, windows: { ...state.windows, [window.id]: { ...window, minimized: false } }, focusedWindowId: window.id, zOrder: [...state.zOrder.filter(id => id !== window.id), window.id] };
}
function setApp(state: VirtualDesktopState, app: ApplicationState): VirtualDesktopState {
  return { ...state, applications: { ...state.applications, [app.id]: app } };
}
function removeWindow(state: VirtualDesktopState, window: WindowState): VirtualDesktopState {
  const windows = { ...state.windows };
  const applications = { ...state.applications };
  delete windows[window.id];
  delete applications[window.applicationId];
  const next = { ...state, windows, applications, zOrder: state.zOrder.filter(id => id !== window.id) };
  return { ...next, focusedWindowId: state.focusedWindowId === window.id ? frontmost(next) : state.focusedWindowId };
}
function finishDocument(state: VirtualDesktopState, app: NotepadState, after: DocumentIntent | null): VirtualDesktopState {
  const window = Object.values(state.windows).find(win => win.applicationId === app.id);
  if (after?.kind === 'close') return window ? removeWindow(state, window) : state;
  if (after?.kind === 'newDocument') {
    const next = setApp(state, { ...app, session: { content: '', fileId: null, dirty: false }, dialog: null });
    return window ? focus(next, window) : next;
  }
  if (after?.kind === 'openFile') {
    const file = getFile(state.fileSystem, after.fileId);
    if (!file) return setApp(state, { ...app, dialog: null });
    const next = setApp(state, { ...app, session: { fileId: file.id, content: file.content, dirty: false }, dialog: null });
    return window ? focus(next, window) : next;
  }
  return state;
}
function save(state: VirtualDesktopState, app: NotepadState, after: DocumentIntent | null): VirtualDesktopState {
  if (!app.session.fileId) return setApp(state, { ...app, dialog: { kind: 'save', after, error: null } });
  const fileSystem = updateFile(state.fileSystem, app.session.fileId, app.session.content);
  const next = setApp({ ...state, fileSystem }, { ...app, session: { ...app.session, dirty: false }, dialog: null });
  return finishDocument(next, next.applications[app.id] as NotepadState, after);
}
function openApplication(state: VirtualDesktopState, type: ApplicationState['type']): VirtualDesktopState {
  const existing = Object.values(state.applications).find(app => app.type === type);
  if (existing) return focus(state, Object.values(state.windows).find(win => win.applicationId === existing.id)!);
  const id = `window-${state.nextId}`;
  const app: ApplicationState = type === 'notepad'
    ? { id: `notepad-${state.nextId}`, type, session: { content: '', fileId: null, dirty: false }, dialog: null }
    : { id: `explorer-${state.nextId}`, type, directoryId: 'desktop', history: [], selectedId: null };
  const offset = (state.zOrder.length % 5) * 28;
  const window: WindowState = { id, applicationId: app.id, minimized: false, mode: 'normal', bounds: fit({ x: 100 + offset, y: 72 + offset, width: 540, height: 380 }, state.workArea) };
  return focus({ ...state, applications: { ...state.applications, [app.id]: app }, nextId: state.nextId + 1 }, window);
}

/** Pure result-state actions. Future missions can inspect snapshots without reading DOM/input. */
export function desktopReducer(state: VirtualDesktopState, action: DesktopAction): VirtualDesktopState {
  if (action.type === 'setWorkArea') {
    const workArea = { width: Math.max(1, action.width), height: Math.max(1, action.height) };
    if (workArea.width === state.workArea.width && workArea.height === state.workArea.height) return state;
    return { ...state, workArea, windows: Object.fromEntries(Object.entries(state.windows).map(([id, win]) => [id, { ...win, bounds: fit(win.bounds, workArea) }])) };
  }
  if (action.type === 'openApplication') {
    return openApplication(state, action.application);
  }
  if (action.type === 'openFile') {
    if (!getFile(state.fileSystem, action.fileId)) return state;
    const next = openApplication(state, 'notepad');
    const app = Object.values(next.applications).find((app): app is NotepadState => app.type === 'notepad')!;
    if (app.dialog) return next;
    const after: DocumentIntent = { kind: 'openFile', fileId: action.fileId };
    return app.session.dirty ? setApp(next, { ...app, dialog: { kind: 'confirmDocument', after } }) : finishDocument(next, app, after);
  }
  if ('applicationId' in action) {
    const app = state.applications[action.applicationId];
    if (!app) return state;
    if (app.type === 'explorer') {
      if (action.type === 'backExplorer') {
        const directoryId = app.history.at(-1);
        return directoryId ? setApp(state, { ...app, directoryId, history: app.history.slice(0, -1), selectedId: null }) : state;
      }
      if (action.type === 'navigateExplorer' && state.fileSystem.entries[action.directoryId]?.kind === 'directory' && action.directoryId !== app.directoryId) return setApp(state, { ...app, directoryId: action.directoryId, history: [...app.history, app.directoryId], selectedId: null });
      if (action.type === 'selectExplorerItem' && state.fileSystem.entries[action.entryId]?.parentId === app.directoryId) return setApp(state, { ...app, selectedId: action.entryId });
      return state;
    }
    if (action.type === 'setNotepadText') {
      if (app.dialog || app.session.content === action.text) return state;
      return setApp(state, { ...app, session: { ...app.session, content: action.text, dirty: true } });
    }
    if (action.type === 'cancelDialog') return setApp(state, { ...app, dialog: app.dialog?.kind === 'overwrite' ? { kind: 'save', after: app.dialog.after, error: null } : null });
    if (action.type === 'saveDocument') return app.dialog ? state : save(state, app, null);
    if (action.type === 'newDocument') {
      if (app.dialog) return state;
      const after: DocumentIntent = { kind: 'newDocument' };
      return app.session.dirty ? setApp(state, { ...app, dialog: { kind: 'confirmDocument', after } }) : finishDocument(state, app, after);
    }
    if (action.type === 'confirmDocument') {
      if (app.dialog?.kind !== 'confirmDocument') return state;
      if (action.choice === 'cancel') return setApp(state, { ...app, dialog: null });
      if (action.choice === 'save') return save(state, app, app.dialog.after);
      return finishDocument(setApp(state, { ...app, dialog: null }), app, app.dialog.after);
    }
    if (action.type === 'confirmOverwrite') {
      if (app.dialog?.kind !== 'overwrite') return state;
      if (!action.overwrite) return setApp(state, { ...app, dialog: { kind: 'save', after: app.dialog.after, error: null } });
      const fileSystem = updateFile(state.fileSystem, app.dialog.fileId, app.session.content);
      const saved: NotepadState = { ...app, session: { ...app.session, fileId: app.dialog.fileId, dirty: false }, dialog: null };
      return finishDocument(setApp({ ...state, fileSystem }, saved), saved, app.dialog.after);
    }
    if (action.type === 'submitSave') {
      if (app.dialog?.kind !== 'save') return state;
      const collision = listChildren(state.fileSystem, DOCUMENTS_ID).find(entry => entry.name === action.fileName.trim());
      if (collision?.kind === 'file') return setApp(state, { ...app, dialog: { kind: 'overwrite', fileId: collision.id, fileName: collision.name, after: app.dialog.after } });
      try {
        const created = createFile(state.fileSystem, DOCUMENTS_ID, action.fileName, app.session.content);
        const saved: NotepadState = { ...app, session: { ...app.session, fileId: created.fileId, dirty: false }, dialog: null };
        return finishDocument(setApp({ ...state, fileSystem: created.state }, saved), saved, app.dialog.after);
      } catch (error) {
        return setApp(state, { ...app, dialog: { ...app.dialog, error: error instanceof Error ? error.message : '저장할 수 없습니다.' } });
      }
    }
    return state;
  }
  const window = state.windows[action.id];
  if (!window) return state;
  if (action.type === 'closeWindow') {
    const app = state.applications[window.applicationId]!;
    if (app.type === 'explorer') return removeWindow(state, window);
    if (app.dialog) return state;
    return app.session.dirty ? setApp(focus(state, window), { ...app, dialog: { kind: 'confirmDocument', after: { kind: 'close' } } }) : removeWindow(state, window);
  }
  if (action.type === 'focusWindow') return focus(state, window);
  const application = state.applications[window.applicationId];
  if (application?.type === 'notepad' && application.dialog) return state;
  if (action.type === 'minimizeWindow') {
    const next = { ...state, windows: { ...state.windows, [window.id]: { ...window, minimized: true } } };
    return { ...next, focusedWindowId: state.focusedWindowId === window.id ? frontmost(next) : state.focusedWindowId };
  }
  if (action.type === 'maximizeWindow') return focus(state, { ...window, mode: 'maximized' });
  if (action.type === 'restoreWindow') return focus(state, { ...window, mode: 'normal' });
  if (action.type !== 'moveWindow' || window.mode !== 'normal' || window.minimized) return state;
  return { ...state, windows: { ...state.windows, [window.id]: { ...window, bounds: fit({ ...window.bounds, x: action.x, y: action.y }, state.workArea) } } };
}
