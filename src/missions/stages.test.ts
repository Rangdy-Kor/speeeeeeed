import { describe, expect, it } from 'vitest';
import { GameSession } from '../game/session';
import type { GameInput, InputState } from '../game/mission';
import { ViewportTransform } from '../game/viewport';
import { ButtonStage, createStages, DoubleClickStage, DragStage, NumbersStage, SpaceStage, STAGE_TUNING, WheelStage } from './stages';

const empty: InputState = { keys: new Set(), pointers: new Map() };
const viewport = new ViewportTransform({ left: 0, top: 0, width: 1280, height: 720 }, 1);
const view = () => viewport;
const key = (code: string): GameInput => ({ type: 'keydown', code });
const pointer = (type: 'pointerdown' | 'pointermove' | 'pointerup' | 'pointercancel', x: number, y: number, pointerId = 1): GameInput => ({ type, pointerId, point: { x, y } });

describe('Stage 1: button click and shared interaction hit area', () => {
  it('ignores outside clicks and pointerdown, then accepts a click on the smaller button', () => {
    const stage = new ButtonStage(view);
    stage.start();
    expect(STAGE_TUNING.buttonRadius).toBeLessThan(85);
    expect(stage.isInteractive({ x: 640, y: 360 })).toBe(true);
    expect(stage.isInteractive({ x: 640 + STAGE_TUNING.buttonRadius + 1, y: 360 })).toBe(false);
    stage.handleInput({ type: 'click', point: { x: 0, y: 0 } });
    stage.handleInput(pointer('pointerdown', 640, 360));
    expect(stage.isComplete()).toBe(false);
    stage.handleInput({ type: 'click', point: { x: 640, y: 360 } });
    expect(stage.isComplete()).toBe(true);
  });
});

describe('Stage 2: press with brief fill feedback', () => {
  it('stays empty before Space and only completes after the animation, without holding', () => {
    const stage = new SpaceStage(view);
    stage.start();
    stage.update(2000);
    stage.handleInput(key('Enter'));
    expect(stage.progress).toBe(0);
    expect(stage.isComplete()).toBe(false);
    stage.handleInput(key('Space'));
    expect(stage.isComplete()).toBe(false);
    stage.handleInput({ type: 'keyup', code: 'Space' });
    stage.update(STAGE_TUNING.spaceFillMs - 1);
    expect(stage.progress).toBeGreaterThan(0);
    expect(stage.isComplete()).toBe(false);
    stage.update(1);
    expect(stage.progress).toBe(1);
    expect(stage.isComplete()).toBe(true);
    stage.start();
    expect(stage.progress).toBe(0);
  });
  it('is not activated by an inherited held key or a click', () => {
    const stage = new SpaceStage(view);
    stage.start();
    stage.handleInput({ type: 'click', point: { x: 640, y: 360 } });
    // Session input state alone cannot activate this press action.
    const game = new GameSession([() => stage]);
    game.start(0);
    game.update(500, { keys: new Set(['Space']), pointers: new Map() });
    expect(game.phase).toBe('playing');
    expect(stage.progress).toBe(0);
  });
});

describe('Stage 3: forgiving drag', () => {
  it('ignores the wrong pointer, allows re-grabbing, and accepts approximate overlap', () => {
    const stage = new DragStage(view);
    stage.start();
    expect(stage.isInteractive({ x: 400, y: 360 })).toBe(true);
    expect(stage.isInteractive({ x: 640, y: 360 })).toBe(false);
    stage.handleInput(pointer('pointermove', 880, 360));
    expect(stage.isComplete()).toBe(false);
    stage.handleInput(pointer('pointerdown', 400, 360));
    stage.handleInput(pointer('pointermove', 880, 360, 2));
    expect(stage.isComplete()).toBe(false);
    stage.handleInput(pointer('pointerup', 500, 360));
    expect(stage.isComplete()).toBe(false);
    stage.handleInput(pointer('pointerdown', 500, 360));
    stage.handleInput(pointer('pointermove', 880 - STAGE_TUNING.dragOverlapDistance + 1, 360));
    expect(stage.isComplete()).toBe(true);
  });
  it('cancels the grab without restarting progress or forcing completion', () => {
    const stage = new DragStage(view);
    stage.start();
    stage.handleInput(pointer('pointerdown', 400, 360));
    stage.handleInput(pointer('pointermove', 550, 360));
    stage.handleInput(pointer('pointercancel', 550, 360));
    stage.handleInput(pointer('pointermove', 880, 360));
    expect(stage.isComplete()).toBe(false);
    expect(stage.isInteractive({ x: 550, y: 360 })).toBe(true);
  });
});

describe('Stage 4: wheel gauge', () => {
  it('adds the same progress in both directions and clamps at full', () => {
    const positive = new WheelStage(view);
    const negative = new WheelStage(view);
    positive.start(); negative.start();
    positive.handleInput({ type: 'wheel', delta: 120 });
    negative.handleInput({ type: 'wheel', delta: -120 });
    expect(positive.progress).toBeGreaterThan(0);
    expect(positive.progress).toBe(negative.progress);
    positive.handleInput({ type: 'wheel', delta: 100_000 });
    expect(positive.progress).toBe(1);
    expect(positive.isComplete()).toBe(true);
  });
  it('slowly decays and never goes below zero', () => {
    const stage = new WheelStage(view);
    stage.start();
    stage.handleInput({ type: 'wheel', delta: 300 });
    const before = stage.progress;
    stage.update(1000);
    expect(stage.progress).toBeCloseTo(before - STAGE_TUNING.wheelDecayPerSecond);
    stage.update(10_000);
    expect(stage.progress).toBe(0);
    expect(stage.isComplete()).toBe(false);
    stage.handleInput({ type: 'wheel', delta: 0 });
    expect(stage.progress).toBe(0);
  });
});

describe('Stage 5: number sequence', () => {
  for (const prefix of ['Digit', 'Numpad']) {
    it(`${prefix} advances exactly one segment per correct next number`, () => {
      const stage = new NumbersStage(view);
      stage.start();
      for (let n = 1; n <= 9; n++) {
        stage.handleInput(key(`${prefix}${n}`));
        expect(stage.completedSteps).toBe(n);
        expect(stage.isComplete()).toBe(n === 9);
      }
    });
  }
  it('allows mixed keyboards and ignores wrong, repeated and unrelated inputs', () => {
    const stage = new NumbersStage(view);
    stage.start();
    for (const code of ['Digit1', 'Numpad2', 'Digit3', 'Digit7', 'Numpad3', 'KeyA', 'Digit0']) stage.handleInput(key(code));
    stage.handleInput({ type: 'keyup', code: 'Digit4' });
    expect(stage.completedSteps).toBe(3);
    stage.handleInput(key('Numpad4'));
    expect(stage.completedSteps).toBe(4);
  });
});

describe('Stage 6: native double click', () => {
  it('accepts dblclick anywhere, without treating two click events as a double click', () => {
    const stage = new DoubleClickStage();
    stage.start();
    stage.handleInput({ type: 'click', point: { x: 10, y: 10 } });
    stage.handleInput({ type: 'click', point: { x: 10, y: 10 } });
    expect(stage.isComplete()).toBe(false);
    stage.handleInput({ type: 'dblclick', point: { x: 1279, y: 719 } });
    expect(stage.isComplete()).toBe(true);
  });
});

describe('six-stage playlist on different viewports', () => {
  for (const [width, height] of [[1920, 1080], [1280, 720], [800, 1200], [390, 844], [2560, 1080]]) {
    it(`${width}×${height}: completes all six stages in order and supports a clean restart`, () => {
      const v = new ViewportTransform({ left: 0, top: 0, width: width!, height: height! }, 2);
      const game = new GameSession(createStages(() => v));
      let now = 0;
      const send = (event: GameInput) => {
        now += 10;
        game.update(now, empty);
        game.handleInput(event, now);
      };
      game.start(now);
      send({ type: 'click', point: { x: v.centerX, y: v.centerY } });
      expect(game.missionNumber).toBe(2);
      send(key('Space'));
      expect(game.missionNumber).toBe(2);
      now += STAGE_TUNING.spaceFillMs;
      game.update(now, empty);
      expect(game.missionNumber).toBe(3);
      const gap = Math.min(STAGE_TUNING.dragMaxSeparation, v.width * STAGE_TUNING.dragWidthFraction);
      send(pointer('pointerdown', v.centerX - gap, v.centerY));
      send(pointer('pointermove', v.centerX + gap - 50, v.centerY));
      expect(game.missionNumber).toBe(4);
      send({ type: 'wheel', delta: -1000 });
      expect(game.missionNumber).toBe(5);
      for (let n = 1; n <= 9; n++) send(key(`${n % 2 ? 'Digit' : 'Numpad'}${n}`));
      expect(game.missionNumber).toBe(6);
      send({ type: 'dblclick', point: { x: 5, y: 5 } });
      expect(game.phase).toBe('clear');
      expect(game.completed).toBe(6);
      expect(game.timings).toHaveLength(6);
      game.start(now);
      expect(game.missionNumber).toBe(1);
      expect(game.phase).toBe('playing');
    });
  }
});
