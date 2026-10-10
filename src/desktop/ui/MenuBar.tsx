import { useEffect, useId, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';

interface MenuItem { label: string; shortcut?: string; action: () => void }
interface Menu { label: string; items: readonly MenuItem[] }

export function MenuBar({ menus, active }: { menus: readonly Menu[]; active: boolean }) {
  const [open, setOpen] = useState<number | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const id = useId();
  const trigger = (index: number) => root.current?.querySelectorAll<HTMLButtonElement>('[data-menu-trigger]')[index];
  useEffect(() => { if (!active) setOpen(null); }, [active]);
  useEffect(() => {
    if (open === null) return;
    const outside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(null); };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [open]);
  useEffect(() => {
    if (open !== null) root.current?.querySelector<HTMLButtonElement>('[role="menu"] button')?.focus();
  }, [open]);
  const keyboard = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape' && open !== null) { event.preventDefault(); event.stopPropagation(); const index = open; setOpen(null); trigger(index)?.focus(); }
    if (open === null) return;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); setOpen((open + (event.key === 'ArrowRight' ? 1 : menus.length - 1)) % menus.length); }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const items = [...root.current!.querySelectorAll<HTMLButtonElement>('[role="menu"] button')];
      const index = items.indexOf(document.activeElement as HTMLButtonElement);
      items[(index + (event.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length]?.focus();
    }
    if (event.key === 'Tab') setOpen(null);
  };
  return <div ref={root} className="app-menu-bar" role="menubar" aria-label="메모장 메뉴" onKeyDown={keyboard}>
    {menus.map((menu, index) => <div className="app-menu" key={menu.label}>
      <button type="button" role="menuitem" data-menu-trigger aria-haspopup="menu" aria-expanded={open === index} aria-controls={`${id}-${index}`} onClick={() => setOpen(open === index ? null : index)} onKeyDown={event => { if (event.key === 'ArrowDown' && open === null) { event.preventDefault(); setOpen(index); } }}>{menu.label}</button>
      {open === index ? <div id={`${id}-${index}`} className="menu-popup" role="menu" aria-label={menu.label}>
        {menu.items.map(item => <button type="button" role="menuitem" key={item.label} onClick={() => { setOpen(null); item.action(); }}><span>{item.label}</span>{item.shortcut ? <kbd>{item.shortcut}</kbd> : null}</button>)}
      </div> : null}
    </div>)}
  </div>;
}
