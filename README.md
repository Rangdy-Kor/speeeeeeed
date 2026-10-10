# SPEEEEEEED!!!

Vite + Vanilla TypeScript + Canvas 2D 프로토타입. 공식 표기는 `SP` + E 7개 + `D!!!`, 패키지 이름은 `sp` + e 7개 + `d`입니다.

```sh
pnpm dev
pnpm test --run
pnpm build
```

현재는 3개 미션을 모두 완료하면 Clear입니다. 플레이 중 진행도는 현재 미션 번호 / 최종 목표 50개로 표시됩니다 (`1 / 50` → `2 / 50` → `3 / 50`). 실제 등록 개수는 Clear 판정과 Debug HUD에서만 사용합니다.

- `src/game/session.ts`: 순수 게임 상태·실시간 제한·즉시 미션 전환·미션별 소요 시간 기록. 시간 만료가 완료보다 우선하며, 중단된 탭에서도 제한 시간은 계속 흐릅니다.
- `src/game/mission.ts`: 시작 / 업데이트 / 렌더링 / 입력 / 완료 / 정리 인터페이스. 미션 실패나 페널티는 없습니다.
- `src/game/input.ts`: Pointer Events, 캡처, 키 상태, 포커스 상실 시 입력 정리. 입력 전까지 흐른 시간을 먼저 업데이트하므로 유지 입력에 누르기 전 시간이 포함되지 않습니다.
- `src/game/viewport.ts`: viewport 크기가 곧 논리 공간 크기입니다. 논리 단위 1 = CSS 픽셀 1이며 X/Y가 같은 배율을 사용합니다. 화면 좌표와 논리 좌표의 정방향·역방향 변환을 함께 관리합니다. 고정 aspect ratio나 Letterbox는 없습니다.
- `src/game/canvas.ts`: DPR backing store, 정수 픽셀 반올림 보정, resize 및 DPR 변경 감지. 렌더링과 포인터 변환이 같은 viewport 모델을 사용합니다.
- `src/game/debug.ts`: 플레이어 Canvas와 분리한 개발 HUD. 전체 시간, 현재 미션, 미션 시간, FPS 표시.
- `src/main.ts`: rAF 루프, Canvas 진행도·짧은 시작 지시, 서로 분리한 HTML 로비·Gameplay·결과 화면. Gameplay Canvas는 테두리 없이 viewport 전체를 채웁니다.
- `src/game/config.ts`: 지시 표시 시간 `MISSION_INSTRUCTION_MS` (850ms), 마지막 페이드 시간 `MISSION_INSTRUCTION_FADE_MS` (180ms).
- `src/missions/prototypes.ts`: 클릭 / 원 드래그 / 700ms 유지 입력 검증용 미션.

## 미션 추가

`Mission`을 구현하는 클래스를 작성하고 `createPrototypeMissions`의 목록에 `() => new YourMission(viewport)` 팩토리를 등록합니다. viewport getter에서 현재 `width`, `height`, `centerX`, `centerY`를 읽어 배치하세요. 실행마다 새 인스턴스를 만듭니다. `isComplete()`가 true인 순간 현재 미션을 정리하고 다음 미션을 시작합니다. 이벤트를 다음 미션에 재전달하지 않습니다. 상태 및 시간은 Session에서 관리하며 미션은 자신의 완료 조건만 판단합니다. 이벤트·타이머 등을 직접 등록했다면 `end()`에서 정리하세요. `prototypeMissions`는 기존 단위 테스트용 1280×720 기본 목록입니다.

## Debug HUD

개발 서버에서만 기본 활성화됩니다. F3로 별도 개발 오버레이를 즉시 켜고 끕니다. `.env.local`에 `VITE_DEBUG_HUD=false`를 설정하고 서버를 재시작하면 HUD 요소와 F3 리스너를 생성하지 않습니다. 프로덕션 빌드에서도 비활성화됩니다. 플레이어용 Canvas HUD와 결과 화면에는 시간 정보가 없습니다. 완료된 미션별 측정치는 `session.timings`에 보관됩니다.

## 다음 플레이테스트에서 결정할 사항

미션 문법과 다양성, 지시 표시 시간, 터치 목표 크기, 유지 시간, 순서 및 50개 구성 방식을 실제 플레이로 결정합니다. BGM과 60초 종료 동기화, 음원 로딩·사용자 제스처 기반 재생은 이후 단계이며 현재 음악은 없습니다.
