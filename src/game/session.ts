import { TIME_LIMIT_MS } from './config';
import type { GameInput, InputState, Mission, MissionFactory } from './mission';

export type GamePhase = 'lobby' | 'playing' | 'clear' | 'time-up';
export interface MissionTiming { number: number; durationMs: number }

/** All timestamps come from the same monotonic clock (performance.now in the browser). */
export class GameSession {
  phase: GamePhase = 'lobby';
  completed = 0;
  elapsedMs = 0;
  missionElapsedMs = 0;
  readonly timings: MissionTiming[] = [];
  private current: Mission | null = null;
  private startedAt = 0;
  private missionStartedAt = 0;
  private lastUpdatedAt = 0;
  private readonly factories: readonly MissionFactory[];
  readonly limitMs: number;

  constructor(factories: readonly MissionFactory[], limitMs = TIME_LIMIT_MS) {
    this.factories = factories;
    this.limitMs = limitMs;
    if (!factories.length) throw new Error('Register at least one mission.');
  }

  get total(): number { return this.factories.length; }
  get mission(): Mission | null { return this.current; }
  get missionNumber(): number { return Math.min(this.completed + 1, this.total); }

  start(now: number): void {
    this.current?.end();
    this.completed = 0;
    this.elapsedMs = 0;
    this.missionElapsedMs = 0;
    this.timings.length = 0;
    this.startedAt = this.lastUpdatedAt = now;
    this.phase = 'playing';
    this.beginMission(now);
  }

  update(now: number, input: InputState): void {
    if (!this.advanceClock(now)) return;
    const deltaMs = Math.max(0, now - this.lastUpdatedAt);
    this.lastUpdatedAt = now;
    this.current?.update(deltaMs, input);
    this.advanceIfComplete(now);
  }

  handleInput(event: GameInput, now: number): void {
    if (!this.advanceClock(now)) return;
    this.current?.handleInput(event);
    this.advanceIfComplete(now);
  }

  dispose(): void {
    this.current?.end();
    this.current = null;
  }

  private advanceClock(now: number): boolean {
    if (this.phase !== 'playing') return false;
    this.elapsedMs = Math.min(this.limitMs, Math.max(this.elapsedMs, now - this.startedAt));
    this.missionElapsedMs = Math.max(0, Math.min(now, this.startedAt + this.limitMs) - this.missionStartedAt);
    if (this.elapsedMs >= this.limitMs) {
      this.phase = 'time-up';
      this.dispose();
      return false;
    }
    return true;
  }

  private beginMission(now: number): void {
    this.missionStartedAt = this.lastUpdatedAt = now;
    this.missionElapsedMs = 0;
    this.current = this.factories[this.completed]!();
    this.current.start();
  }

  private advanceIfComplete(now: number): void {
    if (!this.current?.isComplete()) return;
    this.timings.push({ number: this.completed + 1, durationMs: this.missionElapsedMs });
    this.dispose();
    this.completed++;
    if (this.completed === this.total) this.phase = 'clear';
    else this.beginMission(now);
  }
}
