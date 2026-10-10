import type { ExplorerState } from '../domain';
import { listChildren } from '../filesystem';
import type { FileEntry, FileSystemState } from '../filesystem';
import type { DesktopStore } from '../store';
import { Icon } from './Icon';

export function FileExplorer({ application, fileSystem, store }: { application: ExplorerState; fileSystem: FileSystemState; store: DesktopStore }) {
  const directory = fileSystem.entries[application.directoryId];
  const children = listChildren(fileSystem, application.directoryId);
  const ancestors: FileEntry[] = [];
  let entry: FileEntry | undefined = directory;
  while (entry) {
    ancestors.unshift(entry);
    entry = entry.parentId ? fileSystem.entries[entry.parentId] : undefined;
  }
  const navigate = (directoryId: string) => store.dispatch({ type: 'navigateExplorer', applicationId: application.id, directoryId });
  return <div className="file-explorer">
    <nav className="explorer-navigation" aria-label="폴더 탐색">
      <button className="icon-button" aria-label="뒤로" disabled={application.history.length === 0} onClick={() => store.dispatch({ type: 'backExplorer', applicationId: application.id })}><Icon name="back" /></button>
      <button className="icon-button" aria-label="상위 폴더" disabled={!directory?.parentId} onClick={() => { if (directory?.parentId) navigate(directory.parentId); }}><Icon name="up" /></button>
      <nav className="explorer-breadcrumb" aria-label="현재 위치">
        {ancestors.map((item, index) => <span key={item.id}>
          {index > 0 ? <Icon name="chevron" /> : null}
          <button aria-label={`${item.name || '내 컴퓨터'}로 이동`} aria-current={item.id === application.directoryId ? 'location' : undefined} onClick={() => navigate(item.id)}>{item.name || '내 컴퓨터'}</button>
        </span>)}
      </nav>
    </nav>
    <h2 className="sr-only">{directory?.name || '내 컴퓨터'}/</h2>
    <div className="explorer-body">
      <nav className="explorer-sidebar" aria-label="빠른 탐색">
        <span className="sidebar-label">폴더</span>
        {(['desktop', 'documents'] as const).map(id => <button key={id} aria-current={application.directoryId === id ? 'location' : undefined} onClick={() => navigate(id)}><Icon name={id === 'desktop' ? 'desktop' : 'folder'} /><span>{fileSystem.entries[id]!.name}</span></button>)}
      </nav>
    <div className="explorer-items" aria-label="폴더 내용">
      {children.map(entry => <button key={entry.id} className={`explorer-item ${application.selectedId === entry.id ? 'selected' : ''}`} aria-pressed={application.selectedId === entry.id}
        onClick={() => store.dispatch({ type: 'selectExplorerItem', applicationId: application.id, entryId: entry.id })}
        onDoubleClick={() => entry.kind === 'directory' ? navigate(entry.id) : store.dispatch({ type: 'openFile', fileId: entry.id })}>
        <Icon name={entry.kind === 'directory' ? 'folder' : 'file'} /><span>{entry.name}</span>
      </button>)}
      {children.length === 0 ? <p className="explorer-empty">이 폴더는 비어 있습니다.</p> : null}
    </div>
    </div>
  </div>;
}
