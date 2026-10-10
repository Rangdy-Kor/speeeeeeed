import { createDesktopState, desktopReducer } from './domain';
import type { DesktopAction, VirtualDesktopState } from './domain';

export function createDesktopStore(initial: VirtualDesktopState = createDesktopState()) {
  let state = initial;
  const listeners = new Set<() => void>();
  return {
    getSnapshot: () => state,
    subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    dispatch: (action: DesktopAction) => {
      const next = desktopReducer(state, action);
      if (next === state) return;
      state = next;
      listeners.forEach(listener => listener());
    },
  };
}
export type DesktopStore = ReturnType<typeof createDesktopStore>;
