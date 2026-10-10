import type { NotepadState } from './domain';
import { describe, expect, it } from 'vitest';
import { createFile, createFileSystem, DOCUMENTS_ID, getFile, updateFile } from './filesystem';
import { createDesktopStore } from './store';

function setup() {
  const store = createDesktopStore();
  store.dispatch({ type: 'openApplication', application: 'notepad' });
  const edit = (text: string) => store.dispatch({ type: 'setNotepadText', applicationId: 'notepad-1', text });
  const session = () => (store.getSnapshot().applications['notepad-1'] as NotepadState).session;
  return { store, edit, session };
}
describe('in-memory file system', () => {
  it('has Desktop and Documents directories and creates, queries and updates a file', () => {
    const initial = createFileSystem();
    expect(initial.entries.desktop?.kind).toBe('directory');
    expect(initial.entries.documents?.kind).toBe('directory');
    const created = createFile(initial, DOCUMENTS_ID, 'test.txt', 'hello');
    expect(getFile(created.state, created.fileId)).toMatchObject({ name: 'test.txt', parentId: DOCUMENTS_ID, content: 'hello' });
    const updated = updateFile(created.state, created.fileId, 'world');
    expect(getFile(updated, created.fileId)?.content).toBe('world');
    expect(getFile(created.state, created.fileId)?.content).toBe('hello');
    expect(getFile(initial, DOCUMENTS_ID)).toBeUndefined();
  });
  it('rejects invalid names, non-directory parents and silent duplicate overwrites', () => {
    const fs = createFileSystem();
    expect(() => createFile(fs, 'missing', 'test', '')).toThrow();
    expect(() => createFile(fs, DOCUMENTS_ID, '../test', '')).toThrow();
    const created = createFile(fs, DOCUMENTS_ID, 'test.txt', 'original');
    expect(() => createFile(created.state, DOCUMENTS_ID, 'test.txt', 'replacement')).toThrow();
    expect(getFile(created.state, created.fileId)?.content).toBe('original');
  });
});
describe('document sessions and save', () => {
  it('starts empty and clean, then typing marks the session dirty', () => {
    const { edit, session } = setup();
    expect(session()).toEqual({ content: '', fileId: null, dirty: false });
    edit('hello');
    expect(session()).toEqual({ content: 'hello', fileId: null, dirty: true });
  });
  it('creates a file on Save, links its id and clears dirty; later Save updates that same file', () => {
    const { store, edit, session } = setup();
    edit('hello');
    store.dispatch({ type: 'saveDocument', applicationId: 'notepad-1' });
    expect((store.getSnapshot().applications['notepad-1'] as NotepadState).dialog?.kind).toBe('save');
    store.dispatch({ type: 'submitSave', applicationId: 'notepad-1', fileName: 'test.txt' });
    const fileId = session().fileId!;
    expect(session().dirty).toBe(false);
    expect(getFile(store.getSnapshot().fileSystem, fileId)?.content).toBe('hello');
    edit('edited');
    expect(getFile(store.getSnapshot().fileSystem, fileId)?.content).toBe('hello');
    store.dispatch({ type: 'saveDocument', applicationId: 'notepad-1' });
    expect(session().fileId).toBe(fileId);
    expect(session().dirty).toBe(false);
    expect(getFile(store.getSnapshot().fileSystem, fileId)?.content).toBe('edited');
    expect(Object.values(store.getSnapshot().fileSystem.entries).filter(entry => entry.kind === 'file')).toHaveLength(1);
    expect((store.getSnapshot().applications['notepad-1'] as NotepadState).dialog).toBeNull();
  });
  it('keeps content, dirty and file identity across all window operations', () => {
    const { store, edit, session } = setup();
    edit('draft');
    const expected = session();
    for (const type of ['maximizeWindow', 'restoreWindow', 'minimizeWindow', 'focusWindow'] as const) store.dispatch({ type, id: 'window-1' });
    store.dispatch({ type: 'moveWindow', id: 'window-1', x: 150, y: 150 });
    expect(session()).toEqual(expected);
  });
  it('cancel Save keeps the draft and creates no file', () => {
    const { store, edit, session } = setup();
    edit('draft');
    store.dispatch({ type: 'saveDocument', applicationId: 'notepad-1' });
    store.dispatch({ type: 'cancelDialog', applicationId: 'notepad-1' });
    expect(session().dirty).toBe(true);
    expect(session().fileId).toBeNull();
    expect(Object.keys(store.getSnapshot().fileSystem.entries)).toHaveLength(3);
  });
});
describe('close lifecycle and modal guards', () => {
  it('closes a clean session immediately and removes the application session', () => {
    const { store } = setup();
    store.dispatch({ type: 'closeWindow', id: 'window-1' });
    expect(store.getSnapshot().windows['window-1']).toBeUndefined();
    expect(store.getSnapshot().applications['notepad-1']).toBeUndefined();
  });
  it('dirty close asks confirmation; Cancel preserves the exact draft', () => {
    const { store, edit, session } = setup();
    edit('draft');
    store.dispatch({ type: 'closeWindow', id: 'window-1' });
    expect((store.getSnapshot().applications['notepad-1'] as NotepadState).dialog?.kind).toBe('confirmDocument');
    store.dispatch({ type: 'confirmDocument', applicationId: 'notepad-1', choice: 'cancel' });
    expect(session()).toEqual({ content: 'draft', fileId: null, dirty: true });
    expect((store.getSnapshot().applications['notepad-1'] as NotepadState).dialog).toBeNull();
  });
  it('discard destroys the session and reopening always starts empty', () => {
    const { store, edit } = setup();
    edit('discard me');
    store.dispatch({ type: 'closeWindow', id: 'window-1' });
    store.dispatch({ type: 'confirmDocument', applicationId: 'notepad-1', choice: 'discard' });
    store.dispatch({ type: 'openApplication', application: 'notepad' });
    expect((store.getSnapshot().applications['notepad-2'] as NotepadState).session).toEqual({ content: '', fileId: null, dirty: false });
  });
  it('Save on dirty unsaved Close opens Save dialog and closes only after successful Save', () => {
    const { store, edit } = setup();
    edit('keep me');
    store.dispatch({ type: 'closeWindow', id: 'window-1' });
    store.dispatch({ type: 'confirmDocument', applicationId: 'notepad-1', choice: 'save' });
    expect((store.getSnapshot().applications['notepad-1'] as NotepadState).dialog).toMatchObject({ kind: 'save', after: { kind: 'close' } });
    expect(store.getSnapshot().windows['window-1']).toBeDefined();
    store.dispatch({ type: 'submitSave', applicationId: 'notepad-1', fileName: 'kept.txt' });
    expect(store.getSnapshot().windows['window-1']).toBeUndefined();
    expect(getFile(store.getSnapshot().fileSystem, 'file-1')?.content).toBe('keep me');
    store.dispatch({ type: 'openApplication', application: 'notepad' });
    expect((store.getSnapshot().applications['notepad-2'] as NotepadState).session.content).toBe('');
  });
  it('Save on dirty saved Close updates the existing file and closes without another dialog', () => {
    const { store, edit, session } = setup();
    store.dispatch({ type: 'saveDocument', applicationId: 'notepad-1' });
    store.dispatch({ type: 'submitSave', applicationId: 'notepad-1', fileName: 'existing.txt' });
    const fileId = session().fileId!;
    edit('new text');
    store.dispatch({ type: 'closeWindow', id: 'window-1' });
    store.dispatch({ type: 'confirmDocument', applicationId: 'notepad-1', choice: 'save' });
    expect(store.getSnapshot().windows['window-1']).toBeUndefined();
    expect(getFile(store.getSnapshot().fileSystem, fileId)?.content).toBe('new text');
  });
  it('discarding changes of a saved session leaves file content intact', () => {
    const { store, edit } = setup();
    edit('saved');
    store.dispatch({ type: 'saveDocument', applicationId: 'notepad-1' });
    store.dispatch({ type: 'submitSave', applicationId: 'notepad-1', fileName: 'test.txt' });
    edit('discard');
    store.dispatch({ type: 'closeWindow', id: 'window-1' });
    store.dispatch({ type: 'confirmDocument', applicationId: 'notepad-1', choice: 'discard' });
    expect(getFile(store.getSnapshot().fileSystem, 'file-1')?.content).toBe('saved');
  });
  it('blocks background editing and repeated Close while dialog is open', () => {
    const { store, edit, session } = setup();
    edit('original');
    store.dispatch({ type: 'closeWindow', id: 'window-1' });
    const snapshot = store.getSnapshot();
    edit('blocked');
    store.dispatch({ type: 'closeWindow', id: 'window-1' });
    store.dispatch({ type: 'minimizeWindow', id: 'window-1' });
    expect(store.getSnapshot()).toBe(snapshot);
    expect(session().content).toBe('original');
  });
  it('a failed Save or cancelled Save during Close keeps the window and document', () => {
    const { store, edit } = setup();
    edit('draft');
    store.dispatch({ type: 'closeWindow', id: 'window-1' });
    store.dispatch({ type: 'confirmDocument', applicationId: 'notepad-1', choice: 'save' });
    store.dispatch({ type: 'submitSave', applicationId: 'notepad-1', fileName: ' ' });
    expect((store.getSnapshot().applications['notepad-1'] as NotepadState).dialog).toMatchObject({ kind: 'save', error: expect.any(String) });
    store.dispatch({ type: 'cancelDialog', applicationId: 'notepad-1' });
    expect(store.getSnapshot().windows['window-1']).toBeDefined();
    expect((store.getSnapshot().applications['notepad-1'] as NotepadState).session.dirty).toBe(true);
  });
});

