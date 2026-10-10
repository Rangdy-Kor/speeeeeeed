export const GAME_TITLE = `SP${'E'.repeat(7)}D!!!`;
export const WIDTH = 1280;
export const HEIGHT = 720;
export const TIME_LIMIT_MS = 60_000;
export const FINAL_MISSION_COUNT = 50;
export const MISSION_INSTRUCTION_MS = 850;
export const MISSION_INSTRUCTION_FADE_MS = 180;
// VITE_DEBUG_HUD=false removes the development-only time display.
export const DEBUG_HUD = import.meta.env.DEV && import.meta.env.VITE_DEBUG_HUD !== 'false';
