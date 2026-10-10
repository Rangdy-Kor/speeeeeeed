import type { ReactNode } from 'react';

export type IconName = 'notepad' | 'explorer' | 'folder' | 'file' | 'desktop' | 'back' | 'up' | 'chevron' | 'minimize' | 'maximize' | 'restore' | 'close';
const shapes: Record<IconName, ReactNode> = {
  notepad: <><rect x="5" y="3" width="14" height="18" rx="2" /><path d="M9 3v18M12 8h4m-4 4h4m-4 4h4" /></>,
  explorer: <><path d="M3 7V5a2 2 0 0 1 2-2h5l2 3h7a2 2 0 0 1 2 2v2" /><rect x="3" y="9" width="18" height="12" rx="2" /><path d="M7 13h10m-10 4h6" /></>,
  folder: <path d="M3 7V5a2 2 0 0 1 2-2h5l2 3h7a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" />,
  file: <><path d="M6 3h8l4 4v14H6V3Zm8 0v5h4" /><path d="M9 12h6m-6 4h6" /></>,
  desktop: <><rect x="3" y="4" width="18" height="13" rx="2" /><path d="M12 17v4m-5 0h10" /></>,
  back: <path d="m14 5-7 7 7 7M7 12h14" />,
  up: <path d="m5 10 7-7 7 7M12 3v18" />,
  chevron: <path d="m9 6 6 6-6 6" />,
  minimize: <path d="M5 17h14" />,
  maximize: <rect x="5" y="5" width="14" height="14" rx="1" />,
  restore: <><path d="M9 5V3h12v12h-2" /><rect x="3" y="9" width="12" height="12" rx="1" /></>,
  close: <path d="m6 6 12 12M18 6 6 18" />,
};

export function Icon({ name, className = '' }: { name: IconName; className?: string }) {
  return <svg className={`icon icon-${name} ${className}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{shapes[name]}</svg>;
}
