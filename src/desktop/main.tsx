import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { GAME_TITLE } from '../game/config';
import { createDesktopStore } from './store';
import { MissionGame } from './ui/MissionGame';
import { createMissionRuntime } from './missions/runtime';
import './desktop.css';

document.title = GAME_TITLE;
const store = createDesktopStore();
const runtime = createMissionRuntime(store);
const root = createRoot(document.querySelector('#app')!);
root.render(<StrictMode><MissionGame store={store} runtime={runtime} /></StrictMode>);
if (import.meta.hot) import.meta.hot.dispose(() => { root.unmount(); runtime.dispose(); });
