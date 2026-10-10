import { describe, expect, it } from 'vitest';
import type { ExplorerState, NotepadState } from './domain';
import { createDesktopStore } from './store';
import { getFile } from './filesystem';

describe('New document reuses the document lifecycle', () => {
  function setup() {
    const store = createDesktopStore();
    store.dispatch({ type: 'openApplication', application: 'notepad' });
    const app = () => store.getSnapshot().applications['notepad-1'] as NotepadState;
    const edit = () => store.dispatch({ type: 'setNotepadText', applicationId: app().id, text: 'draft' });
    const createNew = () => store.dispatch({ type: 'newDocument', applicationId: app().id });
    return { store, app, edit, createNew };
  }
  it('replaces a clean saved session with an empty session and preserves the file/window', () => {
    const { store, app, edit, createNew } = setup(); edit();
    store.dispatch({ type: 'saveDocument', applicationId: app().id });
    store.dispatch({ type: 'submitSave', applicationId: app().id, fileName: 'saved.txt' });
    createNew();
    expect(app().session).toEqual({ content: '', fileId: null, dirty: false });
    expect(getFile(store.getSnapshot().fileSystem, 'file-1')?.content).toBe('draft');
    expect(Object.keys(store.getSnapshot().windows)).toEqual(['window-1']);
  });
  for (const choice of ['cancel', 'discard', 'save'] as const) {
    it(`handles dirty New ${choice} with the existing confirmation flow`, () => {
      const { store, app, edit, createNew } = setup(); edit(); createNew();
      expect(app().dialog).toEqual({ kind: 'confirmDocument', after: { kind: 'newDocument' } });
      store.dispatch({ type: 'confirmDocument', applicationId: app().id, choice });
      if (choice === 'save') {
        expect(app().dialog).toMatchObject({ kind: 'save', after: { kind: 'newDocument' } });
        store.dispatch({ type: 'submitSave', applicationId: app().id, fileName: 'draft.txt' });
        expect(getFile(store.getSnapshot().fileSystem, 'file-1')?.content).toBe('draft');
      }
      expect(app().session).toEqual(choice === 'cancel' ? { content: 'draft', fileId: null, dirty: true } : { content: '', fileId: null, dirty: false });
    });
  }
  it('saves an existing dirty file before New without a filename dialog', () => {
    const { store, app, createNew } = setup();
    store.dispatch({ type: 'saveDocument', applicationId: app().id });
    store.dispatch({ type: 'submitSave', applicationId: app().id, fileName: 'saved.txt' });
    store.dispatch({ type: 'setNotepadText', applicationId: app().id, text: 'edited' });
    createNew(); store.dispatch({ type: 'confirmDocument', applicationId: app().id, choice: 'save' });
    expect(getFile(store.getSnapshot().fileSystem, 'file-1')?.content).toBe('edited');
    expect(app().session).toEqual({ content: '', fileId: null, dirty: false });
    expect(app().dialog).toBeNull();
  });
  it('cancel Save aborts New and preserves the draft', () => {
    const { store, app, edit, createNew } = setup(); edit(); createNew();
    store.dispatch({ type: 'confirmDocument', applicationId: app().id, choice: 'save' });
    store.dispatch({ type: 'cancelDialog', applicationId: app().id });
    expect(app().session.content).toBe('draft');
    expect(app().session.dirty).toBe(true);
  });
});

describe('Explorer navigation history is independent of VFS', () => {
  it('records navigation once, Back pops history and clears selection without changing VFS', () => {
    const store = createDesktopStore(); store.dispatch({ type: 'openApplication', application: 'explorer' });
    const fs = store.getSnapshot().fileSystem;
    const app = () => store.getSnapshot().applications['explorer-1'] as ExplorerState;
    store.dispatch({ type: 'navigateExplorer', applicationId: app().id, directoryId: 'root' });
    store.dispatch({ type: 'selectExplorerItem', applicationId: app().id, entryId: 'documents' });
    store.dispatch({ type: 'navigateExplorer', applicationId: app().id, directoryId: 'documents' });
    store.dispatch({ type: 'navigateExplorer', applicationId: app().id, directoryId: 'documents' });
    expect(app().history).toEqual(['desktop', 'root']);
    store.dispatch({ type: 'backExplorer', applicationId: app().id });
    expect(app()).toMatchObject({ directoryId: 'root', history: ['desktop'], selectedId: null });
    store.dispatch({ type: 'backExplorer', applicationId: app().id });
    expect(app().directoryId).toBe('desktop');
    const snapshot = store.getSnapshot();
    store.dispatch({ type: 'backExplorer', applicationId: app().id });
    expect(store.getSnapshot()).toBe(snapshot);
    expect(store.getSnapshot().fileSystem).toBe(fs);
  });
});
