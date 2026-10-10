import type { GameSession } from './session';

export class DebugHud {
  private readonly element: HTMLElement | null;
  private lastPaint = -Infinity;
  private fps = 0;
  private readonly abort = new AbortController();
  constructor(parent: HTMLElement, enabled: boolean) {
    this.element = enabled ? document.createElement('aside') : null;
    if (this.element) {
      this.element.className = 'debug-hud';
      this.element.setAttribute('aria-label', '개발용 Debug HUD');
      parent.append(this.element);
      window.addEventListener('keydown', event => {
        if (event.code !== 'F3') return;
        event.preventDefault();
        if (!event.repeat && this.element) {
          this.element.hidden = !this.element.hidden;
          this.lastPaint = -Infinity;
        }
      }, { signal: this.abort.signal });
    }
  }
  update(session: GameSession, now: number, frameMs: number): void {
    if (!this.element) return;
    if (frameMs > 0) this.fps = this.fps * 0.9 + 1000 / frameMs * 0.1;
    if (now - this.lastPaint < 100) return;
    this.lastPaint = now;
    this.element.textContent = `DEBUG · ${session.phase}\n전체 ${(session.elapsedMs / 1000).toFixed(2)} s / 60 s\n미션 ${session.missionNumber} / ${session.total} · ${(session.missionElapsedMs / 1000).toFixed(2)} s\nFPS ${Math.round(this.fps)}`;
  }
  dispose(): void { this.abort.abort(); this.element?.remove(); }
}
