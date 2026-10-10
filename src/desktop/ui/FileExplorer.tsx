import type { ExplorerState } from '../domain';
import { listChildren } from '../filesystem';
import type { FileSystemState } from '../filesystem';
import type { DesktopStore } from '../store';

export function FileExplorer({ application, fileSystem, store }: { application: ExplorerState; fileSystem: FileSystemState; store: DesktopStore }) {
  const directory = fileSystem.entries[application.directoryId];
  const navigate = (directoryId: string) => store.dispatch({ type: 'navigateExplorer', applicationId: application.id, directoryId });
  return <div className="file-explorer">
    <nav className="explorer-navigation" aria-label="폴더 탐색">
      <button onClick={() => navigate('desktop')}>Desktop</button>
      <button onClick={() => navigate('documents')}>Documents</button>
      <button disabled={!directory?.parentId} onClick={() => { if (directory?.parentId) navigate(directory.parentId); }}>상위 폴더</button>
    </nav>
    <h2 className="explorer-location">{directory?.name || '내 컴퓨터'}/</h2>
    <div className="explorer-items" aria-label="폴더 내용">
      {listChildren(fileSystem, application.directoryId).map(entry => <button key={entry.id} className={`explorer-item ${application.selectedId === entry.id ? 'selected' : ''}`} aria-pressed={application.selectedId === entry.id}
        onClick={() => store.dispatch({ type: 'selectExplorerItem', applicationId: application.id, entryId: entry.id })}
        onDoubleClick={() => entry.kind === 'directory' ? navigate(entry.id) : store.dispatch({ type: 'openFile', fileId: entry.id })}>
        <span aria-hidden="true">{entry.kind === 'directory' ? '▰' : '▤'}</span>{entry.name}
      </button>)}
      {listChildren(fileSystem, application.directoryId).length === 0 ? <p>이 폴더는 비어 있습니다.</p> : null}
    </div>
  </div>;
}
