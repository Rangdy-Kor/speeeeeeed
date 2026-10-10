import { describe, expect, it } from 'vitest';
import { GAME_TITLE } from './config';
import type { GameInput, InputState, Mission } from './mission';
import { GameSession } from './session';
import { prototypeMissions } from '../missions/prototypes';

const emptyInput: InputState = { keys: new Set(), pointers: new Map() };
const press: GameInput = { type: 'keydown', code: 'Space' };
class TestMission implements Mission {
  instruction = '누르세요!';
  complete = false;
  ended = false;
  start(): void { this.complete = false; }
  update(): void {}
  render(): void {}
  handleInput(event: GameInput): void { if (event.type === 'keydown') this.complete = true; }
  isComplete(): boolean { return this.complete; }
  end(): void { this.ended = true; }
}

describe('GameSession', () => {
  it('uses exactly seven Es in the official title', () => {
    expect(GAME_TITLE).toBe(`SP${'E'.repeat(7)}D!!!`);
  });
  it('transitions immediately, records time, and clears after the registered playlist', () => {
    const first = new TestMission();
    const second = new TestMission();
    const game = new GameSession([() => first, () => second]);
    game.start(100);
    game.handleInput(press, 350);
    expect(first.ended).toBe(true);
    expect(game.mission).toBe(second);
    expect(game.completed).toBe(1);
    expect(game.missionElapsedMs).toBe(0);
    game.handleInput(press, 800);
    expect(game.phase).toBe('clear');
    expect(game.elapsedMs).toBe(700);
    expect(game.timings).toEqual([{ number: 1, durationMs: 250 }, { number: 2, durationMs: 450 }]);
    expect(second.ended).toBe(true);
    game.update(90_000, emptyInput);
    expect(game.elapsedMs).toBe(700);
  });
  it('counts real time across a long frame gap and rejects input at the deadline', () => {
    const mission = new TestMission();
    const game = new GameSession([() => mission]);
    game.start(500);
    game.update(30_500, emptyInput);
    expect(game.elapsedMs).toBe(30_000);
    game.handleInput(press, 60_500);
    expect(game.phase).toBe('time-up');
    expect(game.completed).toBe(0);
    expect(game.elapsedMs).toBe(60_000);
    expect(mission.ended).toBe(true);
  });
  it('accepts completion just before the deadline', () => {
    const game = new GameSession([() => new TestMission()]);
    game.start(0);
    game.handleInput(press, 59_999);
    expect(game.phase).toBe('clear');
  });
  it('ends on the clock before an update can complete a mission', () => {
    const mission = new TestMission();
    mission.update = () => { mission.complete = true; };
    const game = new GameSession([() => mission]);
    game.start(0);
    game.update(60_001, emptyInput);
    expect(game.phase).toBe('time-up');
    expect(mission.complete).toBe(false);
    expect(game.timings).toEqual([]);
  });
  it('adds no time penalty for irrelevant input', () => {
    const game = new GameSession(prototypeMissions);
    game.start(100);
    for (let i = 1; i <= 10; i++) {
      game.handleInput({ type: 'pointerdown', pointerId: 1, point: { x: 0, y: 0 } }, 100 + i * 10);
    }
    expect(game.completed).toBe(0);
    expect(game.elapsedMs).toBe(100);
    expect(game.phase).toBe('playing');
  });
  it('restarts with fresh missions and clean timing', () => {
    const game = new GameSession([() => new TestMission()]);
    game.start(0);
    const previous = game.mission;
    game.handleInput(press, 100);
    game.start(200);
    expect(game.mission).not.toBe(previous);
    expect(game.phase).toBe('playing');
    expect(game.timings).toEqual([]);
    expect(game.completed).toBe(0);
    expect(game.elapsedMs).toBe(0);
  });
});

describe('prototype mission behavior', () => {
  const pointer = (type: 'pointerdown' | 'pointermove' | 'pointerup', x: number, y: number): GameInput => ({ type, pointerId: 1, point: { x, y } });
  it('ignores missed clicks and completes only on the target', () => {
    const mission = prototypeMissions[0]!();
    mission.start();
    mission.handleInput(pointer('pointerdown', 0, 0));
    expect(mission.isComplete()).toBe(false);
    mission.handleInput(pointer('pointerdown', 640, 390));
    expect(mission.isComplete()).toBe(true);
  });
  it('allows re-grabbing after an unfinished drag and completes on arrival', () => {
    const mission = prototypeMissions[1]!();
    mission.start();
    mission.handleInput(pointer('pointerdown', 400, 390));
    mission.handleInput(pointer('pointerup', 600, 390));
    expect(mission.isComplete()).toBe(false);
    mission.handleInput(pointer('pointerdown', 600, 390));
    mission.handleInput(pointer('pointermove', 880, 390));
    expect(mission.isComplete()).toBe(true);
  });
  it('requires a fresh continuous hold and supports keyboard and touch', () => {
    const mission = prototypeMissions[2]!();
    const held: InputState = { keys: new Set(['Space']), pointers: new Map() };
    mission.start();
    mission.update(900, held);
    expect(mission.isComplete()).toBe(false);
    mission.handleInput(press);
    mission.update(400, held);
    mission.update(20, emptyInput);
    mission.handleInput(press);
    mission.update(400, held);
    expect(mission.isComplete()).toBe(false);
    mission.update(300, held);
    expect(mission.isComplete()).toBe(true);
    mission.start();
    mission.handleInput(pointer('pointerdown', 640, 390));
    mission.update(700, { keys: new Set(), pointers: new Map([[1, { x: 640, y: 390 }]]) });
    expect(mission.isComplete()).toBe(true);
  });
});
