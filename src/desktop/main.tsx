import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { GAME_TITLE } from '../game/config';
import { createDesktopStore } from './store';
import { VirtualDesktop } from './ui/VirtualDesktop';
import './desktop.css';

document.title = GAME_TITLE;
const store = createDesktopStore();
const root = createRoot(document.querySelector('#app')!);
root.render(<StrictMode><VirtualDesktop store={store} /></StrictMode>);
if (import.meta.hot) import.meta.hot.dispose(() => root.unmount());
