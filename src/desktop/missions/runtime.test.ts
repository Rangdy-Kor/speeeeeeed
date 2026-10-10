import { describe, expect, it } from 'vitest';
import { createMissionRuntime } from './runtime';
import { FIRST_BATCH, currentNotepad } from './definitions';
import { createDesktopStore } from '../store';
import { createFile, createFileSystem, deleteFile, DOCUMENTS_ID, getFile } from '../filesystem';

function setup() {
  const store = createDesktopStore();
  let time = 1000;
  const runtime = createMissionRuntime(store, FIRST_BATCH, () => time);
  const app = () => currentNotepad(store.getSnapshot())!;
  const text = (content: string) => store.dispatch({ type: 'setNotepadText', applicationId: app().id, text: content });
  const select = (start: number, end: number) => store.dispatch({ type: 'setNotepadSelection', applicationId: app().id, start, end });
  const save = () => store.dispatch({ type: 'saveDocument', applicationId: app().id });
  const open = () => store.dispatch({ type: 'openApplication', application: 'notepad' });
  const prepareSave = () => { runtime.start(); open(); text('SPEED'); select(0, 5); text('FASTER'); save(); };
  return { store, runtime, app, text, select, save, open, prepareSave, setTime: (value: number) => { time = value; } };
}

describe('Mission runtime and first batch', () => {
  it('is idle until Start, derives count from definitions and does not complete on raw input', () => {
    const { store, runtime, open } = setup(); open();
    expect(runtime.getSnapshot().status).toBe('idle');
    runtime.start();
    expect(runtime.missions).toHaveLength(10);
    expect(runtime.getSnapshot()).toMatchObject({ status: 'running', currentMissionIndex: 0, startedAt: 1000, completedMissionCount: 0 });
    expect(Object.keys(store.getSnapshot().windows)).toHaveLength(0);
    expect(runtime.missions[0]!.id).toBe('open-notepad');
  });
  it('observes Notepad open and exact case-sensitive SPEED; partial or wrong content stays on Mission 2', () => {
    const { runtime, open, text } = setup(); runtime.start(); open();
    expect(runtime.getSnapshot().currentMissionIndex).toBe(1);
    for (const value of ['S', 'SPEE', 'speed', 'SPEED ']) { text(value); expect(runtime.getSnapshot().currentMissionIndex).toBe(1); }
    text('SPEED'); expect(runtime.getSnapshot().currentMissionIndex).toBe(2);
  });
  it('requires whole selection and preserves the same session/selection when advancing immediately', () => {
    const { store, runtime, open, text, select, app } = setup(); runtime.start(); open(); text('SPEED');
    select(1, 5); expect(runtime.getSnapshot().currentMissionIndex).toBe(2);
    const session = app().session;
    select(0, 5); expect(runtime.getSnapshot().currentMissionIndex).toBe(3);
    expect(app().session).toBe(session);
    expect(app().selection).toEqual({ start: 0, end: 5 });
    expect(store.getSnapshot().focusedWindowId).toBe('window-1');
    text('FASTER'); expect(runtime.getSnapshot().currentMissionIndex).toBe(4);
  });
  it('Mission 5 needs an actual Save dialog and Mission 6 does not finish on filename input alone', () => {
    const { runtime, open, text, select, save, app } = setup(); runtime.start(); open(); text('SPEED'); select(0, 5); text('FASTER');
    expect(runtime.getSnapshot().currentMissionIndex).toBe(4);
    save(); expect(app().dialog?.kind).toBe('save'); expect(runtime.getSnapshot().currentMissionIndex).toBe(5);
  });
  it('Mission 9 ignores deletion of another file and requires the saved target ID', () => {
    const fs = createFileSystem();
    const target = createFile(fs, DOCUMENTS_ID, 'speed.txt', 'FASTER');
    const other = createFile(target.state, DOCUMENTS_ID, 'other.txt', 'other');
    const store = createDesktopStore(); const state = { ...store.getSnapshot(), fileSystem: deleteFile(other.state, other.fileId) };
    const context = { savedFileId: target.fileId };
    expect(FIRST_BATCH[8]!.isComplete(state, context)).toBe(false);
    expect(FIRST_BATCH[8]!.isComplete({ ...state, fileSystem: deleteFile(state.fileSystem, target.fileId) }, context)).toBe(true);
  });
  for (const [name, content, linked, dirty] of [
    ['wrong.txt', 'FASTER', true, false], ['speed.txt', 'SPEED', true, false],
    ['speed.txt', 'FASTER', false, false], ['speed.txt', 'FASTER', true, true],
  ] as const) {
    it(`rejects invalid saved target (${name}, ${content}, linked=${linked}, dirty=${dirty})`, () => {
      const { store, open } = setup(); open();
      const state = store.getSnapshot(); const app = currentNotepad(state)!;
      const created = createFile(state.fileSystem, DOCUMENTS_ID, name, content);
      const snapshot = { ...state, fileSystem: created.state, applications: { ...state.applications, [app.id]: { ...app, session: { content, fileId: linked ? created.fileId : null, dirty } } } };
      expect(FIRST_BATCH[5]!.isComplete(snapshot, { savedFileId: null })).toBe(false);
    });
  }
  it('plays all 10 missions continuously, deletes the tracked file and captures exact elapsed time', () => {
    const { store, runtime, prepareSave, app, setTime } = setup(); prepareSave();
    store.dispatch({ type: 'submitSave', applicationId: app().id, fileName: 'speed.txt' });
    expect(runtime.getSnapshot().currentMissionIndex).toBe(6);
    expect(app().session.dirty).toBe(false);
    store.dispatch({ type: 'closeWindow', id: 'window-1' });
    expect(runtime.getSnapshot().currentMissionIndex).toBe(7);
    store.dispatch({ type: 'openApplication', application: 'explorer' });
    expect(runtime.getSnapshot().currentMissionIndex).toBe(8);
    store.dispatch({ type: 'deleteFile', fileId: 'missing' });
    expect(runtime.getSnapshot().currentMissionIndex).toBe(8);
    store.dispatch({ type: 'deleteFile', fileId: 'file-1' });
    expect(runtime.getSnapshot().currentMissionIndex).toBe(9);
    setTime(9420); store.dispatch({ type: 'closeWindow', id: 'window-2' });
    expect(runtime.getSnapshot()).toMatchObject({ status: 'finished', completedMissionCount: 10, endedAt: 9420, elapsedMs: 8420 });
    setTime(11000); store.dispatch({ type: 'openApplication', application: 'notepad' });
    expect(runtime.getSnapshot().elapsedMs).toBe(8420);
    runtime.dispose();
  });
  it('restart removes files, windows, dialogs, sessions/history and resets index/time while keeping work area', () => {
    const { store, runtime, prepareSave, app, setTime } = setup(); prepareSave();
    store.dispatch({ type: 'submitSave', applicationId: app().id, fileName: 'speed.txt' });
    store.dispatch({ type: 'openApplication', application: 'explorer' });
    store.dispatch({ type: 'navigateExplorer', applicationId: 'explorer-2', directoryId: DOCUMENTS_ID });
    store.dispatch({ type: 'setWorkArea', width: 390, height: 796 });
    setTime(5000); runtime.start();
    expect(runtime.getSnapshot()).toMatchObject({ currentMissionIndex: 0, completedMissionCount: 0, startedAt: 5000, elapsedMs: 0, runId: 2 });
    expect(store.getSnapshot()).toMatchObject({ applications: {}, windows: {}, focusedWindowId: null, workArea: { width: 390, height: 796 } });
    expect(getFile(store.getSnapshot().fileSystem, 'file-1')).toBeUndefined();
  });
  it('supports definition-based totals, immediate already-satisfied advances and empty batches', () => {
    const store = createDesktopStore();
    const runtime = createMissionRuntime(store, [{ id: 'one', instruction: 'One', isComplete: () => true }], () => 10);
    runtime.start(); expect(runtime.getSnapshot().completedMissionCount).toBe(1); expect(runtime.getSnapshot().status).toBe('finished'); runtime.dispose();
    const empty = createMissionRuntime(store, [], () => 10); empty.start();
    expect(empty.getSnapshot()).toMatchObject({ status: 'finished', elapsedMs: 0, endedAt: 10 }); empty.dispose();
  });
  it('restart clears an active dialog and document selection', () => {
    const { runtime, prepareSave, store } = setup(); prepareSave();
    expect(currentNotepad(store.getSnapshot())?.dialog?.kind).toBe('save');
    runtime.start();
    expect(store.getSnapshot().applications).toEqual({});
    store.dispatch({ type: 'openApplication', application: 'notepad' });
    expect(currentNotepad(store.getSnapshot())).toMatchObject({ selection: null, dialog: null, session: { content: '', fileId: null, dirty: false } });
  });
});

describe('normal VFS deletion', () => {
  it('deletes files immutably but never directories, root or missing IDs', () => {
    const initial = createFileSystem(); const created = createFile(initial, DOCUMENTS_ID, 'test.txt', 'hello');
    const removed = deleteFile(created.state, created.fileId);
    expect(getFile(removed, created.fileId)).toBeUndefined(); expect(getFile(created.state, created.fileId)).toBeDefined();
    for (const id of ['root', 'desktop', DOCUMENTS_ID, 'missing']) expect(deleteFile(removed, id)).toBe(removed);
  });
  it('clears Explorer selection and detaches an open document without losing its text', () => {
    const { store, prepareSave, app } = setup(); prepareSave();
    store.dispatch({ type: 'submitSave', applicationId: app().id, fileName: 'speed.txt' });
    store.dispatch({ type: 'openApplication', application: 'explorer' });
    store.dispatch({ type: 'navigateExplorer', applicationId: 'explorer-2', directoryId: DOCUMENTS_ID });
    store.dispatch({ type: 'selectExplorerItem', applicationId: 'explorer-2', entryId: 'file-1' });
    store.dispatch({ type: 'deleteFile', fileId: 'file-1' });
    expect(app().session).toEqual({ content: 'FASTER', fileId: null, dirty: true });
    expect(store.getSnapshot().applications['explorer-2']).toMatchObject({ selectedId: null });
  });
});
