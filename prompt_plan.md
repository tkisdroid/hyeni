# 구현 계획: 아이 기기 전체 화면켜짐 시간 표시

> 작성: 2026-05-18 · 상태: Phase 1·2 완료 (커밋 26af748, f1c133b) · 결정: 기기 전체 화면켜짐 시간(모든 앱) · Usage Access 권한 사용

## 목표

부모가 보는 "화면 시간"을 **혜니캘린더 앱 사용 시간**이 아니라 **아이 기기가 오늘 켜져 있던 총 시간**(모든 앱 포함)으로 정확히 표시한다.

- 현재 버그: `screenOnMs` 는 `document.visibilityState === "visible"` 기반 — 혜니캘린더 WebView foreground 시간만 측정 (App.jsx `buildPayload`).
- 다른 앱을 주로 쓰는 아이의 경우 실제 화면 사용 대비 크게 과소 표시됨.

## 핵심 설계 결정

- **측정**: Android `UsageStatsManager.queryEvents()` 의 `SCREEN_INTERACTIVE`(15) / `SCREEN_NON_INTERACTIVE`(16) 이벤트를 자정~현재 구간에서 합산 (API 28+).
- **권한**: `PACKAGE_USAGE_STATS` (Usage Access) — 시스템 설정에서 1회 허용. 마찰이 큰 권한이므로 **선택 권한**으로 다루고 미허용 시 graceful degrade.
- **fallback** (권한 미허용 / API < 28): 기존 webview 앱 사용 시간(`screenOnMs`)으로 폴백하고 부모 화면 라벨에 측정 범위를 명시 ("화면 시간 (앱 사용)").
- **payload**: native `device_health` 에 신규 필드 `deviceScreenOnMs` + `deviceScreenOnSource`("usage-stats" | "unavailable"). 부모는 `deviceScreenOnMs` 가 있으면 우선 사용, 없으면 기존 `screenOnMs`.

## Phase 구성 (각 = 1 커밋)

### Phase 1 — 네이티브 측정 ✅ 완료 (커밋 26af748)

- `AndroidManifest.xml` — `PACKAGE_USAGE_STATS` 권한 + `xmlns:tools` 선언.
- `DeviceStatusReporter.java`:
  - `sumScreenOnMs(...)` — 순수 함수. SCREEN_INTERACTIVE↔NON_INTERACTIVE 구간 합산, 자정 이전 켜짐(첫 이벤트 OFF → 자정부터)·현재 켜짐(dangling ON → now)·이벤트 0건+interactive(종일) edge handling, window clamp.
  - `computeTodayScreenOnMs(...)` — 자정~now `queryEvents`, SDK 28+ / `usagePermission=="granted"` 가드. payload 에 `deviceScreenOnMs`(측정불가 시 null) + `deviceScreenOnSource` 추가.
- 테스트: `DeviceStatusReporterTest.java` JUnit 9건 (`gradlew testDebugUnitTest` 통과).

### Phase 2 — Usage Access 권한 플로우 ✅ 완료 (커밋 f1c133b)

- `DeviceStatusReporter.isUsageAccessGranted` — `AppOpsManager` OPSTR_GET_USAGE_STATS 판정. `computeTodayScreenOnMs` 게이트를 heuristic → AppOps 판정으로 교체.
- `NotificationPlugin.openUsageAccessSettings` — `ACTION_USAGE_ACCESS_SETTINGS` 인텐트(폴백 포함). `getDeliveryHealth` 에 `usageAccessGranted` 추가.
- `nativeSetup.js` — `screenTime` 선택 권한 항목(`optional:true`, `target:"usageAccess"`). `pushNotifications.js` `openNativeNotificationSettings` 에 `usageAccess` 분기.
- `ChildPermissionWizard.jsx` — `optional` 항목은 진행률·완료 게이트에서 제외, 목록엔 "선택" 배지로 표시. `App.jsx` `childSafetySetupBlocked`·일괄허용에서 optional 제외.
- 테스트: `nativeSetupSteps.test.js`(3), `ChildPermissionWizard.test.jsx`(4).

### Phase 3 — 부모 표시 + 폴백

- device status 매핑 — `deviceScreenOnMs` 우선, 없으면 `screenOnMs` 폴백 헬퍼 추가.
- `ChildDeviceCard.jsx`, `TodayMultiChildView.jsx`, `ChildDetailScreen.jsx`, `App.jsx` 의 `primaryDeviceScreenLabel`/`primaryDeviceSafetyLabel` — 새 헬퍼 사용.
- 권한 미허용 시 라벨 "화면 시간 (앱 사용)" 또는 "측정하려면 권한 필요" 표기.
- 컴포넌트/유닛 테스트.

## 의존성 그래프

```text
Phase 1 (네이티브 측정) ─→ Phase 3 (부모 표시)
Phase 2 (권한 플로우)   ─┘
```

## 위험

| 위험 | 심각도 | 완화 |
|---|---|---|
| `UsageEvents.SCREEN_*` 는 API 28+ 전용 | Medium | API < 28 은 webview 앱 시간 폴백 |
| Usage Access 권한 마찰 큼 (시스템 설정 진입) | High | 선택 권한 처리, 미허용 시 graceful degrade + 라벨 명시 |
| 자정 rollover / 자정 이전 화면 켜짐 edge case | Medium | Phase 1 에서 명시적 edge handling + 단위 테스트 |
| native `device_health` 와 webview-session 두 소스 우선순위 | Medium | `deviceScreenOnMs` 유무로 분기, 폴백 헬퍼 단일화 |
| 권한 부여돼도 일부 제조사 ROM 에서 SCREEN 이벤트 누락 | Low | source 필드로 신뢰도 표기, 0 이면 폴백 |

## 테스트 전략

- 단위: `computeTodayScreenOnMs` edge case (자정 이전 켜짐 / 현재 켜짐 / 이벤트 0건) — 네이티브 로직은 JS 폴백 헬퍼 위주로 테스트.
- 컴포넌트: 부모 화면 화면시간 라벨 — `deviceScreenOnMs` 우선 / 폴백 / 권한 미허용.
- 게이트: 각 Phase 후 `npm run build` + `npx vitest run` + `gradlew assembleDebug`.

## 복잡도

High. 네이티브 Java + 시스템 권한 플로우 + JS 다층. 신규 추정 1, 수정 6~8 파일. 핵심 리스크는 권한 UX 마찰과 SCREEN 이벤트 edge case.

---

## 이전 계획 (완료)

- **아이 모드 설정 — 변경 요청 모델** (2026-05-18, 커밋 `7e520e9`~`65cffce`) — 자녀 설정 직접 변경 제거 → 메뉴별 부모 변경 요청 + 알림센터 기록. 3 Phase 완료.
- **`family_members.phone` 부모 전화번호 단일 소스 통합** (2026-05-18, 커밋 `02f6216`~`3e56768`) — 부모 전화번호를 `family_members.phone` 단일 소스로 통합. Edge Function `push-notify` v68 배포 완료.
