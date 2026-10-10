import "./style.css";
import { GameCanvas } from "./game/canvas";
import {
  DEBUG_HUD,
  FINAL_MISSION_COUNT,
  GAME_TITLE,
  MISSION_INSTRUCTION_FADE_MS,
  MISSION_INSTRUCTION_MS,
} from "./game/config";
import { DebugHud } from "./game/debug";
import { InputController } from "./game/input";
import { GameSession } from "./game/session";
import type { Mission } from "./game/mission";
import { createStages } from "./missions/stages";

document.title = GAME_TITLE;
const app = document.querySelector<HTMLDivElement>("#app")!;
app.innerHTML = `
  <main>
    <section class="screen lobby" aria-labelledby="game-title">
      <p class="eyebrow">60초. 오직 행동.</p>
      <h1 id="game-title"></h1>
      <p class="description">생각은 짧게, 움직임은 빠르게.</p>
      <button type="button" class="start">시작 →</button>
      <p class="controls">마우스 · 키보드 · 휠</p>
    </section>
    <section class="gameplay" aria-label="게임" hidden>
      <canvas tabindex="0" aria-label="게임 플레이 영역. 클릭, 더블 클릭, 드래그, 휠, 숫자 1부터 3, 스페이스."></canvas>
    </section>
    <section class="screen result" aria-labelledby="result-title" aria-live="polite" hidden>
      <h1 id="result-title"></h1>
      <p class="description"></p>
      <button type="button" class="restart">다시 시작 →</button>
    </section>
  </main>`;
app.querySelector("#game-title")!.textContent = GAME_TITLE;
const lobby = app.querySelector<HTMLElement>(".lobby")!;
const gameplay = app.querySelector<HTMLElement>(".gameplay")!;
const result = app.querySelector<HTMLElement>(".result")!;
const heading = result.querySelector("h1")!;
const description = result.querySelector(".description")!;
const restart = result.querySelector("button")!;
const canvas = new GameCanvas(app.querySelector("canvas")!);
const session = new GameSession(createStages(() => canvas.viewport));
let inputMission: Mission | null = null;
const input: InputController = new InputController(
  canvas,
  (now) => {
    inputMission = session.mission;
    canvas.refresh();
    session.update(now, input);
  },
  (event, now) => {
    // An update may finish an animated stage; its triggering event stays in that stage.
    if (inputMission === session.mission) session.handleInput(event, now);
  },
  () => session.phase === "playing",
  () => session.mission?.usesWheel === true,
);
const debug = new DebugHud(app, DEBUG_HUD);
function syncScreen(): void {
  lobby.hidden = session.phase !== "lobby";
  gameplay.hidden = session.phase !== "playing";
  result.hidden = session.phase !== "clear" && session.phase !== "time-up";
  if (!result.hidden) {
    heading.textContent = session.phase === "clear" ? "CLEAR!!!" : "TIME UP";
    description.textContent = `${session.completed} / ${FINAL_MISSION_COUNT}`;
    restart.focus({ preventScroll: true });
  }
}
function start(): void {
  input.clear();
  // Measure the visible Canvas before the first mission computes its placement.
  gameplay.hidden = false;
  canvas.refresh();
  session.start(performance.now());
  syncScreen();
  canvas.element.focus({ preventScroll: true });
}
app.querySelector(".start")!.addEventListener("click", start);
restart.addEventListener("click", start);

let previousPhase = session.phase;
let previousFrame = performance.now();
let frameId = 0;
function frame(now: number): void {
  canvas.refresh();
  session.update(now, input);
  const ctx = canvas.beginFrame();
  if (session.phase === "playing") {
    session.mission?.render(ctx);
    ctx.fillStyle = "#f5f7ff";
    ctx.font = "600 24px system-ui";
    ctx.textAlign = "right";
    ctx.fillText(
      `${session.missionNumber} / ${FINAL_MISSION_COUNT}`,
      canvas.viewport.width - 36,
      48,
    );
    const messageAge = session.missionElapsedMs;
    if (messageAge < MISSION_INSTRUCTION_MS) {
      ctx.save();
      ctx.globalAlpha = Math.min(
        1,
        (MISSION_INSTRUCTION_MS - messageAge) / MISSION_INSTRUCTION_FADE_MS,
      );
      ctx.font = "bold 44px system-ui";
      const instructionWidth = ctx.measureText(
        session.mission!.instruction,
      ).width;
      const fontSize = Math.min(
        44,
        (44 * Math.max(1, canvas.viewport.width - 48)) /
          Math.max(1, instructionWidth),
      );
      ctx.font = `bold ${fontSize}px system-ui`;
      ctx.textAlign = "center";
      ctx.fillText(
        session.mission!.instruction,
        canvas.viewport.centerX,
        Math.min(170, canvas.viewport.height * 0.24),
      );
      ctx.restore();
    }
  }
  canvas.element.style.cursor =
    session.phase === "playing" &&
    input.hoverPoint &&
    session.mission?.isInteractive?.(input.hoverPoint)
      ? "pointer"
      : "default";
  if (session.phase !== previousPhase) {
    syncScreen();
    previousPhase = session.phase;
  }
  debug.update(session, now, now - previousFrame);
  previousFrame = now;
  frameId = requestAnimationFrame(frame);
}
frameId = requestAnimationFrame(frame);
if (import.meta.hot)
  import.meta.hot.dispose(() => {
    cancelAnimationFrame(frameId);
    input.dispose();
    session.dispose();
    canvas.dispose();
    debug.dispose();
  });
