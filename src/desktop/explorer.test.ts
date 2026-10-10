import { describe, expect, it } from 'vitest';
import { createFile, DOCUMENTS_ID, getFile, listChildren } from './filesystem';
import type { ExplorerState, NotepadState } from './domain';
import { createDesktopState } from './domain';
import { createDesktopStore } from './store';

function setup() {
  let state = createDesktopState();
  const a = createFile(state.fileSystem, DOCUMENTS_ID, 'a.txt', 'A');
  const b = createFile(a.state, DOCUMENTS_ID, 'b.txt', 'B');
  state = { ...state, fileSystem: b.state };
  const store = createDesktopStore(state);
  const app = () => Object.values(store.getSnapshot().applications).find((app): app is NotepadState => app.type === 'notepad')!;
  const edit = (text: string) => store.dispatch({ type: 'setNotepadText', applicationId: app().id, text });
  return { store, app, edit, first: a.fileId, second: b.fileId };
}

describe('Explorer and shared file system', () => {
  it('starts on Desktop, navigates directories, selects only a child and clears selection on navigation', () => {
    const { store, first } = setup();
    store.dispatch({ type: 'openApplication', application: 'explorer' });
    const explorer = () => store.getSnapshot().applications['explorer-1'] as ExplorerState;
    expect(explorer().directoryId).toBe('desktop');
    store.dispatch({ type: 'selectExplorerItem', applicationId: explorer().id, entryId: first });
    expect(explorer().selectedId).toBeNull();
    store.dispatch({ type: 'navigateExplorer', applicationId: explorer().id, directoryId: DOCUMENTS_ID });
    expect(listChildren(store.getSnapshot().fileSystem, explorer().directoryId).map(entry => entry.name)).toEqual(['a.txt', 'b.txt']);
    store.dispatch({ type: 'selectExplorerItem', applicationId: explorer().id, entryId: first });
    expect(explorer().selectedId).toBe(first);
    store.dispatch({ type: 'navigateExplorer', applicationId: explorer().id, directoryId: 'root' });
    expect(explorer().selectedId).toBeNull();
    expect(listChildren(store.getSnapshot().fileSystem, 'root').map(entry => entry.name)).toEqual(['Desktop', 'Documents']);
  });
  it('ignores nonexistent files and invalid navigation targets', () => {
    const { store, first } = setup();
    store.dispatch({ type: 'openFile', fileId: 'missing' });
    expect(Object.keys(store.getSnapshot().windows)).toHaveLength(0);
    store.dispatch({ type: 'openApplication', application: 'explorer' });
    const snapshot = store.getSnapshot();
    store.dispatch({ type: 'navigateExplorer', applicationId: 'explorer-1', directoryId: first });
    expect(store.getSnapshot()).toBe(snapshot);
  });
  it('opens a file into a clean connected session and reuses the single Notepad window', () => {
    const { store, app, first, second } = setup();
    store.dispatch({ type: 'openFile', fileId: first });
    expect(app().session).toEqual({ fileId: first, content: 'A', dirty: false });
    store.dispatch({ type: 'openApplication', application: 'notepad' });
    store.dispatch({ type: 'openFile', fileId: second });
    expect(Object.keys(store.getSnapshot().windows)).toHaveLength(1);
    expect(app().session).toEqual({ fileId: second, content: 'B', dirty: false });
  });
  it('replaces a clean minimized session and restores/focuses Notepad without changing Explorer navigation', () => {
    const { store, app, first, second } = setup();
    store.dispatch({ type: 'openFile', fileId: first });
    store.dispatch({ type: 'minimizeWindow', id: 'window-1' });
    store.dispatch({ type: 'openApplication', application: 'explorer' });
    store.dispatch({ type: 'navigateExplorer', applicationId: 'explorer-2', directoryId: DOCUMENTS_ID });
    store.dispatch({ type: 'openFile', fileId: second });
    expect(store.getSnapshot().focusedWindowId).toBe('window-1');
    expect(store.getSnapshot().windows['window-1']!.minimized).toBe(false);
    expect(app().session.fileId).toBe(second);
    expect((store.getSnapshot().applications['explorer-2'] as ExplorerState).directoryId).toBe(DOCUMENTS_ID);
  });
  for (const choice of ['cancel', 'discard', 'save'] as const) {
    it(`dirty saved replacement handles ${choice} without losing the wrong document`, () => {
      const { store, app, edit, first, second } = setup();
      store.dispatch({ type: 'openFile', fileId: first });
      edit('edited A');
      store.dispatch({ type: 'openFile', fileId: second });
      expect(app().dialog).toEqual({ kind: 'confirmDocument', after: { kind: 'openFile', fileId: second } });
      store.dispatch({ type: 'confirmDocument', applicationId: app().id, choice });
      expect(app().session).toEqual(choice === 'cancel' ? { fileId: first, content: 'edited A', dirty: true } : { fileId: second, content: 'B', dirty: false });
      expect(getFile(store.getSnapshot().fileSystem, first)?.content).toBe(choice === 'save' ? 'edited A' : 'A');
      expect(app().dialog).toBeNull();
    });
  }
  it('saves an unsaved draft before loading the pending file', () => {
    const { store, app, edit, second } = setup();
    store.dispatch({ type: 'openApplication', application: 'notepad' });
    edit('draft');
    store.dispatch({ type: 'openFile', fileId: second });
    store.dispatch({ type: 'confirmDocument', applicationId: app().id, choice: 'save' });
    expect(app().dialog).toMatchObject({ kind: 'save', after: { kind: 'openFile', fileId: second } });
    store.dispatch({ type: 'submitSave', applicationId: app().id, fileName: 'draft.txt' });
    expect(getFile(store.getSnapshot().fileSystem, 'file-3')?.content).toBe('draft');
    expect(app().session).toEqual({ fileId: second, content: 'B', dirty: false });
  });
  it('cancelling Save aborts a pending replacement and keeps the original draft', () => {
    const { store, app, edit, second } = setup();
    store.dispatch({ type: 'openApplication', application: 'notepad' }); edit('draft');
    store.dispatch({ type: 'openFile', fileId: second });
    store.dispatch({ type: 'confirmDocument', applicationId: app().id, choice: 'save' });
    store.dispatch({ type: 'cancelDialog', applicationId: app().id });
    expect(app().session).toEqual({ content: 'draft', fileId: null, dirty: true });
    expect(app().dialog).toBeNull();
  });
  it('keeps the original pending replacement when another file is requested during a dialog', () => {
    const { store, app, edit, first, second } = setup();
    store.dispatch({ type: 'openApplication', application: 'notepad' }); edit('draft');
    store.dispatch({ type: 'openFile', fileId: second });
    store.dispatch({ type: 'openFile', fileId: first });
    expect(app().dialog).toMatchObject({ after: { kind: 'openFile', fileId: second } });
  });
  it('saving changes updates the shared file while Explorer observes the same identity', () => {
    const { store, app, edit, first } = setup();
    store.dispatch({ type: 'openApplication', application: 'explorer' });
    store.dispatch({ type: 'navigateExplorer', applicationId: 'explorer-1', directoryId: DOCUMENTS_ID });
    store.dispatch({ type: 'openFile', fileId: first }); edit('updated');
    store.dispatch({ type: 'saveDocument', applicationId: app().id });
    expect(listChildren(store.getSnapshot().fileSystem, DOCUMENTS_ID).find(entry => entry.id === first)).toMatchObject({ content: 'updated' });
    expect(app().session.dirty).toBe(false);
  });
});

describe('filename collision', () => {
  it('asks before overwrite, creates no duplicate and cancel keeps the saved file untouched', () => {
    const { store, app, edit, first } = setup();
    store.dispatch({ type: 'openApplication', application: 'notepad' }); edit('replacement');
    store.dispatch({ type: 'saveDocument', applicationId: app().id });
    store.dispatch({ type: 'submitSave', applicationId: app().id, fileName: ' a.txt ' });
    expect(app().dialog).toMatchObject({ kind: 'overwrite', fileId: first });
    expect(listChildren(store.getSnapshot().fileSystem, DOCUMENTS_ID)).toHaveLength(2);
    expect(getFile(store.getSnapshot().fileSystem, first)?.content).toBe('A');
    store.dispatch({ type: 'confirmOverwrite', applicationId: app().id, overwrite: false });
    expect(app().dialog?.kind).toBe('save');
    expect(app().session.dirty).toBe(true);
  });
  it('overwrite updates the existing file, links the session and clears dirty', () => {
    const { store, app, edit, first } = setup();
    store.dispatch({ type: 'openApplication', application: 'notepad' }); edit('replacement');
    store.dispatch({ type: 'saveDocument', applicationId: app().id });
    store.dispatch({ type: 'submitSave', applicationId: app().id, fileName: 'a.txt' });
    store.dispatch({ type: 'confirmOverwrite', applicationId: app().id, overwrite: true });
    expect(app().session).toEqual({ fileId: first, content: 'replacement', dirty: false });
    expect(app().dialog).toBeNull();
    expect(getFile(store.getSnapshot().fileSystem, first)?.content).toBe('replacement');
    expect(listChildren(store.getSnapshot().fileSystem, DOCUMENTS_ID)).toHaveLength(2);
  });
  for (const intent of ['close', 'openFile'] as const) {
    it(`retains ${intent} continuation across Save and overwrite dialogs`, () => {
      const { store, app, edit, first, second } = setup();
      store.dispatch({ type: 'openApplication', application: 'notepad' }); edit('replacement');
      if (intent === 'close') store.dispatch({ type: 'closeWindow', id: 'window-1' });
      else store.dispatch({ type: 'openFile', fileId: second });
      store.dispatch({ type: 'confirmDocument', applicationId: app().id, choice: 'save' });
      store.dispatch({ type: 'submitSave', applicationId: app().id, fileName: 'a.txt' });
      store.dispatch({ type: 'confirmOverwrite', applicationId: app().id, overwrite: true });
      expect(getFile(store.getSnapshot().fileSystem, first)?.content).toBe('replacement');
      if (intent === 'close') expect(store.getSnapshot().windows['window-1']).toBeUndefined();
      else expect(app().session).toEqual({ fileId: second, content: 'B', dirty: false });
    });
  }
});
