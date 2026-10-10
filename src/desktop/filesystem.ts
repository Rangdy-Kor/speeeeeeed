export const DOCUMENTS_ID = 'documents';
export interface VirtualFile { readonly kind: 'file'; readonly id: string; readonly name: string; readonly parentId: string; readonly content: string }
export interface VirtualDirectory { readonly kind: 'directory'; readonly id: string; readonly name: string; readonly parentId: string | null }
export type FileEntry = VirtualFile | VirtualDirectory;
export interface FileSystemState { readonly entries: Readonly<Record<string, FileEntry>>; readonly nextId: number }
export function createFileSystem(): FileSystemState {
  return { nextId: 1, entries: {
    root: { kind: 'directory', id: 'root', name: '', parentId: null },
    desktop: { kind: 'directory', id: 'desktop', name: 'Desktop', parentId: 'root' },
    documents: { kind: 'directory', id: DOCUMENTS_ID, name: 'Documents', parentId: 'root' },
  } };
}
export function getFile(state: FileSystemState, id: string): VirtualFile | undefined {
  const entry = state.entries[id];
  return entry?.kind === 'file' ? entry : undefined;
}
export function listChildren(state: FileSystemState, parentId: string): FileEntry[] {
  return Object.values(state.entries).filter(entry => entry.parentId === parentId);
}
export function createFile(state: FileSystemState, parentId: string, name: string, content: string): { state: FileSystemState; fileId: string } {
  name = name.trim();
  if (state.entries[parentId]?.kind !== 'directory') throw new Error('저장 폴더가 없습니다.');
  if (!name || name === '.' || name === '..' || /[\\/]/.test(name)) throw new Error('올바른 파일 이름을 입력하세요.');
  if (Object.values(state.entries).some(entry => entry.parentId === parentId && entry.name === name)) throw new Error('같은 이름의 파일이 있습니다. 다른 이름을 입력하세요.');
  const fileId = `file-${state.nextId}`;
  return { fileId, state: { nextId: state.nextId + 1, entries: { ...state.entries, [fileId]: { kind: 'file', id: fileId, name, parentId, content } } } };
}
export function updateFile(state: FileSystemState, id: string, content: string): FileSystemState {
  const file = getFile(state, id);
  if (!file) throw new Error('파일을 찾을 수 없습니다.');
  return { ...state, entries: { ...state.entries, [id]: { ...file, content } } };
}
