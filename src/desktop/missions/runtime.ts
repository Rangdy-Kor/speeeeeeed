import type { DesktopStore } from '../store';
import type { DesktopMission, MissionContext } from './definitions';
import { FIRST_BATCH } from './definitions';

export interface MissionRunState {
  readonly status: 'idle' | 'running' | 'finished';
  readonly currentMissionIndex: number;
  readonly completedMissionCount: number;
  readonly startedAt: number | null;
  readonly endedAt: number | null;
  readonly missionStartedAt: number | null;
  readonly elapsedMs: number;
  readonly runId: number;
}

export function createMissionRuntime(desktop: DesktopStore, missions: readonly DesktopMission[] = FIRST_BATCH, now: () => number = () => performance.now()) {
  const listeners = new Set<() => void>();
  const idle = (runId: number): MissionRunState => ({ status: 'idle', currentMissionIndex: 0, completedMissionCount: 0, startedAt: null, endedAt: null, missionStartedAt: null, elapsedMs: 0, runId });
  let state = idle(0);
  let context: MissionContext = { savedFileId: null };
  const notify = () => listeners.forEach(listener => listener());
  const observe = () => {
    if (state.status !== 'running') return;
    const snapshot = desktop.getSnapshot();
    let advanced = false;
    // Evaluate result state immediately; no animation callback controls this loop.
    while (state.currentMissionIndex < missions.length) {
      const mission = missions[state.currentMissionIndex]!;
      if (!mission.isComplete(snapshot, context)) break;
      context = mission.onComplete?.(snapshot, context) ?? context;
      const timestamp = now();
      const completed = state.completedMissionCount + 1;
      const finished = completed === missions.length;
      state = { ...state, currentMissionIndex: completed, completedMissionCount: completed,
        missionStartedAt: timestamp, status: finished ? 'finished' : 'running',
        endedAt: finished ? timestamp : null, elapsedMs: Math.max(0, timestamp - state.startedAt!) };
      advanced = true;
    }
    if (advanced) notify();
  };
  const unsubscribe = desktop.subscribe(observe);
  return {
    missions,
    getSnapshot: () => state,
    subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    start: () => {
      state = idle(state.runId + 1);
      context = { savedFileId: null };
      desktop.dispatch({ type: 'resetDesktop' });
      const timestamp = now();
      state = { ...state, status: missions.length ? 'running' : 'finished', startedAt: timestamp, missionStartedAt: timestamp, endedAt: missions.length ? null : timestamp };
      notify(); observe();
    },
    dispose: () => { unsubscribe(); listeners.clear(); },
  };
}
export type MissionRuntime = ReturnType<typeof createMissionRuntime>;
