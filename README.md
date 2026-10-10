# SPEEEEEEED!!!

Vite + Vanilla TypeScript + Canvas 2D 프로토타입. 공식 표기는 `SP` + E 7개 + `D!!!`, 패키지 이름은 `sp` + e 7개 + `d`입니다.

```sh
pnpm dev
pnpm test --run
pnpm build
```

현재는 정식 Stage 1~6을 연속 플레이하고 Stage 6 완료 시 Clear입니다. 플레이 중 진행도는 현재 Stage 번호 / 최종 목표 50개로 표시됩니다 (`1 / 50` → … → `6 / 50`). 실제 등록 개수는 Clear 판정과 Debug HUD에서만 사용합니다.

- `src/game/session.ts`: 순수 게임 상태·실시간 제한·즉시 미션 전환·미션별 소요 시간 기록. 시간 만료가 완료보다 우선하며, 중단된 탭에서도 제한 시간은 계속 흐릅니다.
- `src/game/mission.ts`: 시작 / 업데이트 / 렌더링 / 입력 / 완료 / 정리 인터페이스. 미션 실패나 페널티는 없습니다.
- `src/game/input.ts`: Pointer Events·캡처·키 상태에 표준 click/dblclick/wheel 전달을 추가했습니다. wheel의 pixel/line/page 단위를 정규화하고 Stage 3에서만 페이지 스크롤을 차단합니다. 키 자동 반복은 전달하지 않습니다. dblclick은 Gameplay 포커스가 있을 때 브라우저 이벤트를 그대로 전달합니다.
- `src/game/viewport.ts`: viewport 크기가 곧 논리 공간 크기입니다. 논리 단위 1 = CSS 픽셀 1이며 X/Y가 같은 배율을 사용합니다. 화면 좌표와 논리 좌표의 정방향·역방향 변환을 함께 관리합니다. 고정 aspect ratio나 Letterbox는 없습니다.
- `src/game/canvas.ts`: DPR backing store, 정수 픽셀 반올림 보정, resize 및 DPR 변경 감지. 렌더링과 포인터 변환이 같은 viewport 모델을 사용합니다.
- `src/game/debug.ts`: 플레이어 Canvas와 분리한 개발 HUD. 전체 시간, 현재 미션, 미션 시간, FPS 표시.
- `src/main.ts`: rAF 루프, Canvas 진행도·짧은 시작 지시, 서로 분리한 HTML 로비·Gameplay·결과 화면. Gameplay Canvas는 테두리 없이 viewport 전체를 채웁니다.
- `src/game/config.ts`: 지시 표시 시간 `MISSION_INSTRUCTION_MS` (850ms), 마지막 페이드 시간 `MISSION_INSTRUCTION_FADE_MS` (180ms).
- `src/missions/stages.ts`: 실제 플레이 목록 Stage 1~6 및 한국어·영어 지시. 현재는 한국어 표시입니다. 작은 버튼 클릭 → 느슨한 드래그 → 양방향 휠 게이지 → Space 누르기·75ms 채움 → Digit/Numpad 1~6 순서 → 화면 어디서든 표준 더블 클릭입니다. Stage 6의 중앙 버튼은 Stage 1과 같은 스타일의 시각적 안내이며, 버튼 밖에서도 dblclick으로 완료됩니다.
- `src/missions/prototypes.ts`: 이전 프로토타입은 기존 회귀 테스트용으로만 유지하고, 실제 플레이에서는 사용하지 않습니다.

## 미션 추가

`Mission`을 구현하는 클래스를 작성하고 `createStages`의 목록에 `() => new YourMission(viewport)` 팩토리를 등록합니다. viewport getter에서 현재 `width`, `height`, `centerX`, `centerY`를 읽어 배치하세요. 실행마다 새 인스턴스를 만듭니다. `isComplete()`가 true인 순간 현재 미션을 정리하고 다음 미션을 시작합니다. 이벤트를 다음 미션에 재전달하지 않습니다. 상태 및 시간은 Session에서 관리하며 미션은 자신의 완료 조건만 판단합니다. 이벤트·타이머 등을 직접 등록했다면 `end()`에서 정리하세요. 클릭·드래그 대상은 선택적인 `isInteractive(point)`를 구현하면 공통 렌더 루프가 pointer 커서를 적용합니다. 휠 입력을 사용하는 미션은 `usesWheel = true`를 선언합니다.

## 플레이테스트 조절 값

`STAGE_TUNING`에서 버튼 반지름 42px, Space 채움 75ms, 드래그 목표 반지름 58px·허용 중심 거리 72px·배치 간격, 휠 증가량 `1/600` per pixel·초당 감소량 `0.12`, 게이지 최대 너비를 조절합니다. 숫자 입력·완료 조건·게이지 칸 수는 `NUMBER_STEP_COUNT = 6`을 공유합니다. 지시 표시·페이드는 기존 `src/game/config.ts` 상수를 사용합니다. 잘못된 입력은 진행도를 초기화하거나 시간 페널티를 추가하지 않습니다. 휠 게이지의 자연 감소만 Stage 3 규칙으로 적용합니다.

## Debug HUD

개발 서버에서만 기본 활성화됩니다. F3로 별도 개발 오버레이를 즉시 켜고 끕니다. `.env.local`에 `VITE_DEBUG_HUD=false`를 설정하고 서버를 재시작하면 HUD 요소와 F3 리스너를 생성하지 않습니다. 프로덕션 빌드에서도 비활성화됩니다. 플레이어용 Canvas HUD와 결과 화면에는 시간 정보가 없습니다. 완료된 미션별 측정치는 `session.timings`에 보관됩니다.

## 다음 플레이테스트에서 결정할 사항

미션 문법과 다양성, 지시 표시 시간, 터치 목표 크기, 유지 시간, 순서 및 50개 구성 방식을 실제 플레이로 결정합니다. BGM과 60초 종료 동기화, 음원 로딩·사용자 제스처 기반 재생은 이후 단계이며 현재 음악은 없습니다.
