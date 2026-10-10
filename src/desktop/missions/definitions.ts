import type { NotepadState, VirtualDesktopState } from '../domain';
import { DOCUMENTS_ID, getFile } from '../filesystem';

export interface MissionContext { readonly savedFileId: string | null }
export interface DesktopMission {
  readonly id: string;
  readonly instruction: string;
  readonly isComplete: (state: VirtualDesktopState, context: MissionContext) => boolean;
  readonly onComplete?: (state: VirtualDesktopState, context: MissionContext) => MissionContext;
}
export function currentNotepad(state: VirtualDesktopState): NotepadState | undefined {
  return Object.values(state.applications).find((app): app is NotepadState => app.type === 'notepad' && Object.values(state.windows).some(window => window.applicationId === app.id));
}
function explorerOpen(state: VirtualDesktopState): boolean {
  return Object.values(state.windows).some(window => state.applications[window.applicationId]?.type === 'explorer');
}
function savedTarget(state: VirtualDesktopState) {
  const app = currentNotepad(state);
  const file = app?.session.fileId ? getFile(state.fileSystem, app.session.fileId) : undefined;
  return file?.parentId === DOCUMENTS_ID && file.name === 'speed.txt' && file.content === 'FASTER' && !app?.session.dirty ? file : undefined;
}

export const FIRST_BATCH: readonly DesktopMission[] = [
  { id: 'open-notepad', instruction: '메모장을 여세요!', isComplete: state => !!currentNotepad(state) },
  { id: 'type-speed', instruction: '“SPEED”를 입력하세요!', isComplete: state => currentNotepad(state)?.session.content === 'SPEED' },
  { id: 'select-all', instruction: '모두 선택하세요!', isComplete: state => {
    const app = currentNotepad(state);
    return !!app && !app.dialog && state.windows[state.focusedWindowId ?? '']?.applicationId === app.id
      && app.session.content.length > 0 && app.selection?.start === 0 && app.selection.end === app.session.content.length;
  } },
  { id: 'type-faster', instruction: '“FASTER”로 바꾸세요!', isComplete: state => currentNotepad(state)?.session.content === 'FASTER' },
  { id: 'request-save', instruction: '저장하세요!', isComplete: state => currentNotepad(state)?.dialog?.kind === 'save' },
  { id: 'save-speed', instruction: '“speed.txt”로 저장하세요!', isComplete: state => !!savedTarget(state), onComplete: state => ({ savedFileId: savedTarget(state)!.id }) },
  { id: 'close-notepad', instruction: '메모장을 닫으세요!', isComplete: state => !currentNotepad(state) },
  { id: 'open-explorer', instruction: '파일 탐색기를 여세요!', isComplete: explorerOpen },
  { id: 'delete-speed', instruction: '“speed.txt”를 삭제하세요!', isComplete: (state, context) => !!context.savedFileId && !state.fileSystem.entries[context.savedFileId] },
  { id: 'close-explorer', instruction: '파일 탐색기를 닫으세요!', isComplete: state => !explorerOpen(state) },
];
