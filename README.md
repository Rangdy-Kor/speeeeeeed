# SPEEEEEEED

본편은 Vite + React + TypeScript + DOM 기반 Virtual Desktop Foundation 1입니다. 기존 Vanilla TypeScript + Canvas 2D 프로토타입은 별도 진입점으로 보존합니다. 공식 표기는 `SP` + E 7개 + `D!!!`, 패키지 이름은 `sp` + e 7개 + `d`입니다.

```sh
pnpm dev
pnpm test --run
pnpm build
```

## Virtual Desktop Foundation 1

`/`는 새 데스크톱, `/prototype.html`은 기존 6개 Stage 프로토타입입니다. `vite.config.ts`는 둘 다 빌드하며, 배포에서도 각 HTML 진입점을 독립 실행할 수 있습니다. 서로 다른 CSS와 입력 계층을 사용합니다.

- `src/desktop/domain.ts`: React와 독립적인 immutable 상태·순수 reducer. Window 상태와 Notepad Document Session (`content`, `fileId`, `dirty`), Save/Close dialog lifecycle을 관리합니다.
- `src/desktop/filesystem.ts`: in-memory File/Directory 상태. 기본 Desktop/Documents 폴더와 파일 생성·조회·내용 갱신 API를 제공합니다. 실제 저장 장치·브라우저 persistence는 사용하지 않습니다.
- `src/desktop/store.ts`: snapshot/subscribe/dispatch API. 향후 Mission은 이 결과 상태를 관찰할 수 있습니다. React UI는 `useSyncExternalStore`로 구독합니다.
- `src/desktop/ui/`: 데스크톱·아이콘·작업 표시줄과 창·titlebar·DOM textarea. 사용자 조작을 domain action으로 전달합니다.
- `src/desktop/main.tsx`, `desktop.css`: 본편 진입점과 DOM 레이아웃. CSS grid의 작업 영역을 ResizeObserver로 측정합니다. Canvas 좌표계를 사용하지 않습니다.

메모장과 파일 탐색기 아이콘을 더블 클릭하거나 키보드 Enter로 엽니다. Notepad는 단일 문서/창이며 이미 실행 중이면 해당 창을 표시하고 focus합니다. 닫은 뒤 새로 실행하면 빈 session을 생성합니다. 제목 표시줄을 드래그하고 최소화·최대화·복원·닫기를 사용할 수 있으며 작업 표시줄 버튼으로 최소화된 창을 다시 표시합니다. 최대화는 작업 표시줄을 제외한 영역 전체를 사용합니다. 텍스트와 dirty 상태는 이러한 창 조작에서 보존합니다. Taskbar의 제목은 동일하게 유지하고 active/inactive/minimized 상태는 하단 indicator로 표현합니다. 창 DOM 순서를 고정하고 z-order는 CSS z-index로만 적용하여 비활성 control 클릭이 focus 재배치 중 유실되지 않도록 합니다.

활성 Notepad의 Ctrl+S와 저장 버튼은 같은 `saveDocument` action을 실행합니다. 새 문서 Save dialog는 `새 텍스트 문서.txt` 전체를 선택하여 바로 입력하거나 Enter로 저장할 수 있습니다. Escape는 취소하며 IME 조합 중 Enter는 제출하지 않습니다. Documents에 File을 생성해 session과 연결하고, 재저장은 같은 File의 content를 갱신합니다. 편집 중 내용은 저장된 content와 별개입니다. 중복 이름은 덮어쓰기 확인을 거치고 기존 File ID를 유지합니다.

clean 문서는 바로 닫고, dirty 문서는 저장/저장 안 함/취소 확인을 표시합니다. 새 문서의 저장 후 닫기는 파일명 dialog로 이어지며 성공적으로 저장한 뒤에만 닫습니다. dialog 동안 해당 창의 배경 UI는 inert이고 domain도 편집·중복 Close·창 조작을 차단합니다. 다른 창은 계속 사용할 수 있습니다. Close 시 session/application은 종료하지만 저장된 File은 유지됩니다. 새로고침하면 File System도 초기화됩니다.

`ui/FileExplorer.tsx`는 같은 VFS의 child item을 표시합니다. Explorer의 `directoryId`/`selectedId`는 application navigation state로 분리되어 있습니다. Desktop/Documents 탐색, 상위 폴더 이동, directory double-click 이동, file double-click 열기를 지원합니다. `openFile` action은 Notepad의 fileId/content/dirty를 로드하며 clean session은 즉시 교체합니다. dirty session 교체는 닫기와 동일한 확인 흐름을 사용하며, 저장 완료 후 후속 동작(`close` 또는 `openFile`)을 실행합니다. 취소하면 기존 문서를 유지합니다. 본편 Mission, 파일 이동·이름 변경·삭제·persistence는 아직 구현하지 않습니다.

## 보존된 Canvas Prototype

Virtual Desktop의 시각 계층은 `desktop.css`의 의미별 CSS token(색상·간격·radius·shadow·layer)을 공유합니다. `ui/Icon.tsx`의 작은 SVG set을 Desktop/Taskbar/Window/Explorer에서 재사용하고, neon 창 테두리·개발 watermark·Prototype UI 링크는 제거했습니다. Prototype은 아래 경로로 직접 접근합니다.

Notepad의 파일/편집 메뉴(`ui/MenuBar.tsx`)는 저장·새로 만들기·DOM 전체 선택을 지원합니다. 메뉴는 바깥 pointer 입력과 Escape로 즉시 닫히며 화살표/Enter 키로도 조작합니다. 새로 만들기는 기존 dirty 확인과 저장 흐름을 사용합니다. Explorer는 Back/Up/Breadcrumb, Desktop/Documents Sidebar, Icon Grid로 구성하며 navigation history는 VFS와 별개인 Explorer state에 유지합니다.

`.virtual-os`는 창/Taskbar를 포함하는 독립 stacking context입니다. 향후 HUD는 그 sibling인 `.game-hud-overlay`를 사용하며 `pointer-events: none`으로 desktop 입력을 통과시킵니다. 실제 HUD/Mission/시간 UI는 구현하지 않았고, application action은 애니메이션 완료를 기다리지 않습니다.

기존 Stage 1~6을 연속 플레이하고 Stage 6 완료 시 Clear입니다. 플레이 중 진행도는 현재 Stage 번호 / 최종 목표 50개로 표시됩니다 (`1 / 50` → … → `6 / 50`). 실제 등록 개수는 Clear 판정과 Debug HUD에서만 사용합니다. 기존 60초 제한·Debug HUD·F3·viewport/DPR·테스트도 유지합니다.

- `src/game/session.ts`: 순수 게임 상태·실시간 제한·즉시 미션 전환·미션별 소요 시간 기록. 시간 만료가 완료보다 우선하며, 중단된 탭에서도 제한 시간은 계속 흐릅니다.
- `src/game/mission.ts`: 시작 / 업데이트 / 렌더링 / 입력 / 완료 / 정리 인터페이스. 미션 실패나 페널티는 없습니다.
- `src/game/input.ts`: Pointer Events·캡처·키 상태에 표준 click/dblclick/wheel 전달을 추가했습니다. wheel의 pixel/line/page 단위를 정규화하고 Stage 4에서만 페이지 스크롤을 차단합니다. 키 자동 반복은 전달하지 않습니다. dblclick은 Gameplay 포커스가 있을 때 브라우저 이벤트를 그대로 전달합니다.
- `src/game/viewport.ts`: viewport 크기가 곧 논리 공간 크기입니다. 논리 단위 1 = CSS 픽셀 1이며 X/Y가 같은 배율을 사용합니다. 화면 좌표와 논리 좌표의 정방향·역방향 변환을 함께 관리합니다. 고정 aspect ratio나 Letterbox는 없습니다.
- `src/game/canvas.ts`: DPR backing store, 정수 픽셀 반올림 보정, resize 및 DPR 변경 감지. 렌더링과 포인터 변환이 같은 viewport 모델을 사용합니다.
- `src/game/debug.ts`: 플레이어 Canvas와 분리한 개발 HUD. 전체 시간, 현재 미션, 미션 시간, FPS 표시.
- `src/main.ts`: rAF 루프, Canvas 진행도·짧은 시작 지시, 서로 분리한 HTML 로비·Gameplay·결과 화면. Gameplay Canvas는 테두리 없이 viewport 전체를 채웁니다.
- `src/game/config.ts`: 지시 표시 시간 `MISSION_INSTRUCTION_MS` (850ms), 마지막 페이드 시간 `MISSION_INSTRUCTION_FADE_MS` (180ms).
- `src/missions/stages.ts`: 실제 플레이 목록 Stage 1~6 및 한국어·영어 지시. 현재는 한국어 표시입니다. 작은 버튼 클릭 → 화면 어디서든 표준 더블 클릭 → 느슨한 드래그 → 양방향 휠 게이지 → Digit/Numpad 1~3 순서 → Space 누르기·75ms 채움입니다. Stage 2의 중앙 버튼은 Stage 1과 같은 스타일의 시각적 안내이며, 버튼 밖에서도 dblclick으로 완료됩니다.
- `src/missions/prototypes.ts`: 이전 프로토타입은 기존 회귀 테스트용으로만 유지하고, 실제 플레이에서는 사용하지 않습니다.

## 미션 추가

`Mission`을 구현하는 클래스를 작성하고 `createStages`의 목록에 `() => new YourMission(viewport)` 팩토리를 등록합니다. viewport getter에서 현재 `width`, `height`, `centerX`, `centerY`를 읽어 배치하세요. 실행마다 새 인스턴스를 만듭니다. `isComplete()`가 true인 순간 현재 미션을 정리하고 다음 미션을 시작합니다. 이벤트를 다음 미션에 재전달하지 않습니다. 상태 및 시간은 Session에서 관리하며 미션은 자신의 완료 조건만 판단합니다. 이벤트·타이머 등을 직접 등록했다면 `end()`에서 정리하세요. 클릭·드래그 대상은 선택적인 `isInteractive(point)`를 구현하면 공통 렌더 루프가 pointer 커서를 적용합니다. 휠 입력을 사용하는 미션은 `usesWheel = true`를 선언합니다.

## 플레이테스트 조절 값

`STAGE_TUNING`에서 버튼 반지름 42px, Space 채움 75ms, 드래그 목표 반지름 58px·허용 중심 거리 72px·배치 간격, 휠 증가량 `1/1200` per pixel·초당 감소량 `0.12`, 게이지 최대 너비를 조절합니다. 숫자 입력·완료 조건·게이지 칸 수는 `NUMBER_STEP_COUNT = 3`을 공유합니다. 지시 표시·페이드는 기존 `src/game/config.ts` 상수를 사용합니다. 잘못된 입력은 진행도를 초기화하거나 시간 페널티를 추가하지 않습니다. 휠 게이지의 자연 감소만 Stage 4 규칙으로 적용합니다.

휠은 기존보다 입력당 증가량을 절반으로 줄여, 감소가 없다면 정규화된 누적 delta 1200이 필요합니다. 합성 입력 기준 120px 펄스를 45ms 간격으로 11회 입력하면 약 495ms에 완료됩니다. 이는 tuning 참고값이며 실제 마우스 플레이 측정값이 아닙니다. 완료 조건은 시간과 무관하게 누적 게이지 100%입니다.

## Debug HUD

개발 서버에서만 기본 활성화됩니다. F3로 별도 개발 오버레이를 즉시 켜고 끕니다. `.env.local`에 `VITE_DEBUG_HUD=false`를 설정하고 서버를 재시작하면 HUD 요소와 F3 리스너를 생성하지 않습니다. 프로덕션 빌드에서도 비활성화됩니다. 플레이어용 Canvas HUD와 결과 화면에는 시간 정보가 없습니다. 완료된 미션별 측정치는 `session.timings`에 보관됩니다.

## 다음 플레이테스트에서 결정할 사항

미션 문법과 다양성, 지시 표시 시간, 터치 목표 크기, 유지 시간, 순서 및 50개 구성 방식을 실제 플레이로 결정합니다. BGM과 60초 종료 동기화, 음원 로딩·사용자 제스처 기반 재생은 이후 단계이며 현재 음악은 없습니다.
