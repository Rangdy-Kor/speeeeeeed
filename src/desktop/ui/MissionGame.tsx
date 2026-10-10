import { useSyncExternalStore } from 'react';
import type { CSSProperties } from 'react';
import { GAME_TITLE } from '../../game/config';
import type { DesktopStore } from '../store';
import type { MissionRuntime } from '../missions/runtime';
import { VirtualDesktop } from './VirtualDesktop';

export const INSTRUCTION_VISIBLE_MS = 800;
export const INSTRUCTION_FADE_MS = 150;

export function MissionGame({ store, runtime }: { store: DesktopStore; runtime: MissionRuntime }) {
  const run = useSyncExternalStore(runtime.subscribe, runtime.getSnapshot);
  const total = runtime.missions.length;
  const current = runtime.missions[run.currentMissionIndex];
  const progress = run.status === 'finished' ? total : Math.min(run.currentMissionIndex + 1, total);
  const start = () => { (document.activeElement as HTMLElement | null)?.blur(); runtime.start(); };
  return <div className="mission-game">
    {/* Remount only for a whole run, clearing transient DOM menus, selection and focus. */}
    <div className="mission-desktop" inert={run.status !== 'running'}><VirtualDesktop key={run.runId} store={store} /></div>
    <div className="game-hud-overlay" style={{ pointerEvents: 'none' }}>
      {run.status !== 'idle' ? <div className="mission-progress" aria-label="미션 진행도">
        <div role="progressbar" aria-label="현재 미션" aria-valuemin={0} aria-valuemax={total} aria-valuenow={progress} className="mission-progress-track"><div style={{ width: `${total ? progress / total * 100 : 0}%` }} /></div>
        <span>{progress} / {total}</span>
      </div> : null}
      {run.status === 'running' && current ? <p key={`${run.runId}-${current.id}`} className="mission-instruction" role="status" style={{ '--instruction-visible': `${INSTRUCTION_VISIBLE_MS}ms`, '--instruction-fade': `${INSTRUCTION_FADE_MS}ms` } as CSSProperties}>{current.instruction}</p> : null}
    </div>
    {run.status !== 'running' ? <div className="game-modal-overlay" role="dialog" aria-modal="true" aria-label={run.status === 'idle' ? '게임 시작' : '미션 완료'}>
      {run.status === 'idle' ? <><h1>{GAME_TITLE}</h1><button autoFocus onClick={start}>시작</button></> : <><h1>완료!</h1><p>{total} / {total}</p><p>{(run.elapsedMs / 1000).toFixed(2)}초</p><button autoFocus onClick={start}>다시 시작</button></>}
    </div> : null}
  </div>;
}
