# 혜니캘린더 프로덕션 안정화 완료 체크리스트

작성 시각: 2026-05-05 KST

## objective 재정의

혜니캘린더 앱을 production 수준으로 안정화한다. 완료는 단순히 테스트가 통과한 상태가 아니라, 선택 자녀 기준 기능 격리, 실시간 위치/이동경로, 주위소리 듣기, 프로필/테마/이미지 UX, DB/RLS/Realtime, 브라우저/Android/Supabase 실서비스 검증이 모두 실제 evidence로 확인된 상태를 뜻한다.

현재 판정: **부분 미완료 / 접힘 검증 사용자 이월**. production main Supabase timeout은 2026-05-05 KST에 회복됐고, main RLS 누락은 `20260504010000` migration 적용 및 migration repair로 보정했다. local gates, real Supabase Playwright, main Android remote-listen smoke, Android matrix, main Storage/profile image real Playwright, 실제 remote-listen channel disabled 세션 검증은 통과했다. 아직 남은 명시 요구사항은 폴더블 접힘 상태 검증이며, 2026-05-05 KST 사용자 지시에 따라 다음 검증 세션으로 이월한다.

## 2026-05-05 11:35 KST 추가 검증 기록

- 장소 기능 정리 반영: `학원관리` 진입점을 `장소관리`로 통합하고, 학원/자주가는 장소/안전장소/위험장소를 같은 관리 화면에서 다루도록 수정했다. 상단 액션은 `← 뒤로`, 저장은 하단 `장소관리 저장`으로 배치했다.
- 일정 등록 연동 반영: 일정 등록 위치 선택에 학원과 자주가는 장소를 함께 노출하고, 학원 location/emoji 변경도 반복 일정 reconciliation 대상에 포함했다.
- 친구놀이 안전 정책 반영: `find_playdate_candidates`가 우리 가족 또는 상대 가족의 `danger_zones`와 겹치는 안전장소/현재 위치를 후보에서 제외하도록 `20260505000000_exclude_danger_zones_from_playdate.sql` 및 down migration을 추가했다.
- Supabase branch 검증: with-data preview branch `codex-prod-hardening-data-20260504` (`cryodcviqyyxxovclqou`)에 migration SQL을 `db query --linked`로 적용했다. branch 함수 정의에서 `danger_zones`/`other_dz` 조건을 확인했고, `output/playdate-danger-zone-branch-check.sql` 실행 결과는 `baseline_safe_place=1`, `other_family_danger_zone=0`, `own_family_danger_zone=not_in_safe_place`였다. 테스트 row 잔여는 `families_left=0`, `users_left=0`, `places_left=0`으로 확인했다.
- main DB 적용 상태: 적용 전 `output/main-find-playdate-candidates-before-20260505000000-20260505-113633.json` snapshot을 남겼고, main에 migration SQL을 적용한 뒤 함수 정의에서 `danger_zones`/`other_dz` 조건을 확인했다. main에서도 `output/playdate-danger-zone-branch-check.sql` 결과가 `baseline_safe_place=1`, `other_family_danger_zone=0`, `own_family_danger_zone=not_in_safe_place`였고 테스트 row 잔여는 0개였다. `supabase migration repair 20260505000000 --status applied --linked --yes` 후 migration list는 `20260505000000 | 20260505000000`이다.
- 홈 다자녀 위치 표시: `ChildSummaryCard`에서 시/도 및 선행 `*시` 토큰을 제거해 구/동 중심 위치가 보이도록 수정하고 unit test로 검증했다.
- 일정 시간 입력 시계 아이콘: `.hyeni-time-input`과 `::-webkit-calendar-picker-indicator` mask 기반 CSS를 추가해 테마색 시계 아이콘으로 표시되도록 수정했다. Playwright screenshot: `test-results/critical-flows-critical-Hy-80d53-tions-remote-audio-and-kkuk-chromium/time-picker-theme.png`.
- 최신 command evidence: `npm run test` = 70 files / 322 tests passed. `npm run verify` = Vitest 322 passed + Playwright 26 passed / 12 skipped. `npx playwright test --config=playwright.real.config.js` = 40 passed. `npm run build` 성공. `npx cap sync android` 성공. `android .\gradlew.bat assembleDebug` 성공.
- 친구놀이 브라우저 E2E 보강: `friend-playdate-discover.spec.js` 2건, `friend-playdate-start.spec.js` 1건, `friend-playdate-toggle.spec.js` 1건을 `fixme`에서 실제 테스트로 전환했다. Targeted Playwright는 discover/start 3 passed, toggle 2 passed였고, 전체 `npm run verify`에서 친구놀이 mocked E2E가 모두 통과했다.
- 최신 Android evidence: APK `app-debug.apk`를 실제 기기 `R5CY40EE6QE`(태규의 Quantum5), `R5CY521CFNZ`(태규의 Edge)에 설치 성공. `R5CY40EE6QE`는 foreground `MainActivity`, FCM token 등록 로그, 실제 홈 UI screenshot `output/hyeni-quantum5-awake-20260505.png` 확인. `R5CY521CFNZ`는 `mWakefulness=Awake`, `mCurrentFocus=com.hyeni.calendar/.MainActivity` 상태로 전환됐고, 실제 홈 UI screenshot `output/hyeni-edge-current-20260505.png`에서 다자녀 홈/하단 장소관리 메뉴/구·동 중심 위치 표시를 확인했다. 폴더블 접힘 상태만 사용자 지시에 따라 다음 검증 세션으로 남긴다.
- 2026-05-05 11:57 KST fresh Supabase evidence: `node scripts/production-stabilization-healthcheck.mjs --timeout-ms 12000` 결과 `output/production-stabilization-healthcheck-2026-05-05T02-57-40-447Z.json/md`, `readyForAndroidSmoke=true`, `diagnosticSummary.boundary=service-ready`. `npx supabase inspect db blocking --linked -o json`은 blocking row 0개로 정상 응답했고, `npx supabase inspect db long-running-queries --linked -o json`은 Realtime replication query 1건만 반환했다. 신규 migration `20260504010000`, `20260505000000`은 remote migration list에 적용 상태로 남아 있다.
- 2026-05-05 11:59 KST network evidence: `cmd connectivity airplane-mode enable`, `cmd wifi set-wifi-enabled disabled`, `svc data disable` 후 matrix `output/remote-listen-matrix-2026-05-05T02-59-28-615Z-global-offline-airplane-mode.md/json`을 생성하고 즉시 복구했다. Samsung child는 Wi-Fi disabled 상태에서도 connectivity dump/matrix가 `networkConnected=true`, `networkValidated=true`를 유지해 기기 전체 오프라인은 만들지 못했다. 앱 단위 네트워크 차단 evidence(`output/remote-listen-matrix-2026-05-04T22-47-45-428Z.md`)는 유지하며, 복구 후 airplane mode는 `disabled`, Wi-Fi는 `enabled/connected`로 확인했다.
- 2026-05-05 12:07 KST 원격청취 준비 표시 수정: 가족 > 아이 연동관리에서 배터리 최적화, 절전, DND, 무음/진동, 화면 꺼짐/잠금, 폴더블 접힘 같은 advisory 상태를 더 이상 `원격 청취 준비 부족`으로 표시하지 않는다. 마이크 권한, 알림 권한, 연결 알림 채널, 네트워크 끊김만 `설정 필요` blocker로 분류하고, advisory-only 상태는 `원격 청취 연결 가능 — 확인:`으로 표시한다. Targeted tests: `npx vitest run tests/nativeDeliveryHealth.test.js tests/nativeBackgroundCommands.test.js tests/remoteListenWaitingFeedback.test.js` = 19 passed, `npx playwright test tests/e2e/critical-flows.spec.js -g "remote listen|family pairing"` = 2 passed. Fresh gates: `npm run test` = 70 files / 322 tests passed, `npm run verify` = Vitest 322 passed + Playwright 26 passed / 12 skipped. `npm run build`, `npx cap sync android`, `android .\gradlew.bat assembleDebug`, and APK install on `R5CY40EE6QE`/`R5CY521CFNZ` all passed. 새 APK 기준 main remote-listen smoke도 `output/android-parent-ui-remote-listen-2026-05-05T03-11-05-657Z.log`에서 `success=true`, `sawFcm=true`, `sawActivity=true`, `sawService=true`로 통과했다.
- 2026-05-05 12:20 KST background-only 원격청취 검증: `scripts/android-remote-listen-parent-ui-smoke.mjs`에 `--child-background-only`를 추가해 자녀 앱을 직접 실행한 뒤 HOME으로 백그라운드에 둔 상태를 별도 검증한다. 첫 실행은 `Remote listen skipped: family mismatch`로 실패했고, 원인은 WebView가 실제 자녀 세션을 로드하며 스모크용 네이티브 prefs를 덮어쓴 것이었다. 스크립트를 백그라운드 전환 뒤 `LocationService`로 테스트 컨텍스트를 다시 동기화하도록 수정한 후 `npx vitest run tests/realServicesHardening.test.js` = 13 passed. 실제 connected child `R5CY40EE6QE` 재실행은 `node scripts/android-remote-listen-parent-ui-smoke.mjs --parent emulator-5554 --child R5CY40EE6QE --readiness-timeout-ms 12000 --child-background-only`로 통과했고, result는 `childMode=backgrounded`, `success=true`, `sawFcm=true`, `sawActivity=true`, `sawService=true`였다. 로그 `output/android-parent-ui-remote-listen-2026-05-05T03-19-01-751Z.log`에는 `Remote listen request - launching app`, `Remote listen foreground bridge started AmbientListenService`, `Native ambient audio capture started`, `Realtime audio chunk sent seq=0..24`가 같은 requestId로 기록됐다. 부모/자녀 screenshot: `output/android-parent-ui-remote-listen-started-2026-05-05T03-19-01-751Z.png`, `output/android-child-after-parent-ui-remote-listen-2026-05-05T03-19-01-751Z.png`.

## prompt-to-artifact checklist

| 요구사항 | 산출물/증거 | 판정 | 남은 작업 |
| --- | --- | --- | --- |
| AGENTS.md, `.planning/PROJECT.md`, `.planning/ROADMAP.md`, `.planning/REQUIREMENTS.md`, `.planning/research/SUMMARY.md` 선확인 | `.planning/PRODUCTION_STABILIZATION_AUDIT_CURRENT.md` 성공 기준 감사표 | 통과 | 없음 |
| 기능 인벤토리 작성 | `.planning/PRODUCTION_FEATURE_INVENTORY_CURRENT.md` | 통과 | main 회복 후 evidence 갱신 |
| 관련 파일 확인: `package.json`, Supabase config/migrations, `src/App.jsx`, `src/lib/auth.js`, `src/lib/sync.js`, `src/lib/pushNotifications.js`, Android native | 감사 문서와 기능 인벤토리의 파일 매핑 | 통과 | 없음 |
| `src/App.jsx` 모놀리스 분해 금지 | 기존 모놀리스 유지, 외부 공용 컴포넌트는 아바타 표시용으로만 추가 | 통과 | 없음 |
| 다자녀별 DB/기능 격리 | `tests/selectedChildIsolation.test.js`, mocked critical flows, real Supabase suite 40 passed 중 child privacy/color/event/subscription cases | 통과 | 없음 |
| 자녀 전환 stale state/구독/요청 상태 방어 | mocked Playwright 및 real Supabase suite 통과 | 통과 | 없음 |
| RLS/DB 레벨 격리 | pre-policy snapshot `output/pg-policies-families-before-20260504010000-2026-05-05T01-13-04-454Z.json`; main `fam_ins` tightened; real RLS tests passed | 통과 | 없음 |
| 위치 실시간 반영 | critical-flow child location bootstrap/manual refresh/map refresh | 자동 검증 통과 | main Android 위치 upload/realtime 확인 |
| 홈/오늘/위치 source 동기화 | `src/lib/sync.js`, critical-flow 검증 | 자동 검증 통과 | main realtime 재확인 |
| 캘린더 하루 이동경로 요약 | `src/lib/locationTrailDisplay.js`, `tests/locationDaySummary.test.js`, `tests/e2e/critical-flows.spec.js` | 자동 검증 통과 | main `location_history` 실데이터 조회 |
| 이동경로 날짜/자녀 격리 | selected child/user/date bounds tests | 자동 검증 통과 | main real data A/B evidence |
| 주위소리 선택 자녀 타겟팅 | `buildSelectedChildCommandPayload`, `targetUserId`, native target guard tests | 통과 | main FCM path 재확인 |
| 주위소리 Android 정책 준수 | `output/android-parent-ui-remote-listen-2026-05-04T22-23-15-139Z.log`: foreground bridge, `AmbientListenService`, audio chunks | branch pending fallback 통과 | production main FCM/full E2E |
| 주위소리 FCM secret 없는 환경 fallback | `push-notify` VAPID guard, branch pending fallback smoke, main normal/background FCM smoke | 통과 | 없음 |
| 주위소리 상태별 실패 원인 UI | `powerSaveMode`, `backgroundRestricted`, `remoteListenChannelImportance`, `remoteListenChannelBlocked`, mocked Playwright failure reason test, prior Android state matrix, latest main matrix, 실제 channel disabled smoke | 부분 통과 | 폴더블 접힘은 사용자 지시에 따라 다음 세션 이월 |
| 프로필/설정 저장 UX | `tests/familyMemberProfileTheme.test.js`, profile RPC/migration | 자동 검증 통과 | main DB 저장 실검증 |
| 테마 색상 즉시 반영/재실행 유지 | `src/lib/theme.js`, `tests/softBrandVisualSystem.test.js` | 자동 검증 통과 | Android/main screenshot 재확인 |
| 아이콘/테마/상태 인지성 | soft brand visual tests, CSS/token changes | 자동 검증 통과 | 수동 디자인 review 잔여 |
| 프로필 사진 성능/fallback | `ChildAvatar.jsx`, `tests/unit/ChildAvatar.test.jsx`, `tests/unit/ChildSummaryCard.test.jsx`, `tests/unit/PerChildToggle.test.jsx`, `tests/e2e/profile-image-real.spec.js`; main Storage object 정상 signed URL load 및 missing object fallback 통과 | 통과 | 느린 네트워크 수동 체감 확인 |
| DB 최적화/RLS/Realtime/publication | main healthcheck service-ready, real Supabase suite 40 passed, RLS policy verified, profile image private Storage path/signed URL real test passed, `20260505000000` main migration history aligned | 통과 | 없음 |
| `npm run test` | latest: 70 files, 322 tests passed | 통과 | 변경 시 재실행 |
| `npm run verify` | latest: Vitest 322 passed, mocked Playwright 26 passed / 12 skipped, retry/flaky 없음 | 통과 | 변경 시 재실행 |
| Playwright 화면 확인 | mocked Playwright 26 passed, targeted family remote-listen readiness test passed, real Supabase Playwright 40 passed, Android screenshots in `output/` | 통과 | 없음 |
| Supabase branch 또는 안전 테스트 데이터 검증 | with-data branch function + Android pending fallback smoke | 통과 | main promotion/production validation |
| Android 연결 기기 빌드/설치/실행/UI smoke | latest APK install success on `R5CY40EE6QE`, `R5CY521CFNZ`, `emulator-5554`; `output/android-ui-smoke-summary-2026-05-05T10-54-07.md/json`; retry after wake `output/android-ui-smoke-summary-2026-05-05T10-54-45.md/json`; app visible on `R5CY40EE6QE` and emulator, plus direct Edge confirmation `output/hyeni-edge-current-20260505.png` with `mWakefulness=Awake` and `mCurrentFocus=com.hyeni.calendar/.MainActivity` | 통과 | 폴더블 접힘은 다음 세션 |
| main production healthcheck | fresh `output/production-stabilization-healthcheck-2026-05-05T02-57-40-447Z.json/md`: `readyForAndroidSmoke=true`, boundary `service-ready` | 통과 | 없음 |
| Supabase main timeout support brief | `.planning/SUPABASE_MAIN_TIMEOUT_SUPPORT_BRIEF.md`; historical blocker brief 보존 | 해소 | support ticket/restart 불필요 |
| Supabase support bundle | `npm run support:bundle`; `output/supabase-main-timeout-support-bundle-2026-05-04T23-53-09-941Z.zip`; sidecar `output/supabase-main-timeout-support-bundle-2026-05-04T23-53-09-941Z.zip.sha256`; zip manifest `support-bundle-manifest.json`; expected `sourceFileCount=15`, `bundleEntryCount=16`; includes latest remote-listen matrix JSON/MD | 작성 완료 | 운영자 업로드 |
| Supabase recovery verification runbook | `.planning/SUPABASE_RECOVERY_VERIFICATION_RUNBOOK.md`; gated runner `scripts/supabase-recovery-verification.mjs`; npm script `verify:recovery` | 작성 완료 | support/restart 후 실행 |
| Supabase recovery runner current evidence | local `output/supabase-recovery-verification-2026-05-05T01-25-00-901Z.json`; real `output/supabase-recovery-verification-2026-05-05T01-26-36-981Z.json`; Android smoke `output/supabase-recovery-verification-2026-05-05T01-22-33-917Z.json`; matrix `output/supabase-recovery-verification-2026-05-05T01-24-18-496Z.json` | 통과 | 없음 |

## explicit command checklist

| command | latest evidence | result |
| --- | --- | --- |
| `npm run test` | latest: 70 files, 322 tests passed | pass |
| `npm run verify` | latest: Vitest 322 passed, Playwright 26 passed / 12 skipped, no flaky retry | pass |
| `npm run build` | latest main env build passed after remote-listen readiness display changes; Vite chunk warnings only | pass |
| `npx cap sync android` | latest sync copied web assets to Android after remote-listen readiness display changes | pass |
| `.\gradlew.bat assembleDebug` | latest BUILD SUCCESSFUL after remote-listen readiness display changes and Capacitor sync | pass |
| APK install on connected devices | latest `adb install -r android/app/build/outputs/apk/debug/app-debug.apk` returned `Success` for `R5CY40EE6QE`, `R5CY521CFNZ` after remote-listen readiness display changes | pass |
| Android launch smoke on connected devices | `adb shell am start -n com.hyeni.calendar/.MainActivity` returned start intent for `R5CY40EE6QE`, `R5CY521CFNZ`, `emulator-5554`; `pidof com.hyeni.calendar` returned `6353`, `21171`, `24182`; `R5CY521CFNZ` and `emulator-5554` current focus is `MainActivity`; `R5CY40EE6QE` focused app is `MainActivity` with current window `NotificationShade` due locked/shade state | pass/current-state |
| Android UI screenshot/XML smoke | Latest summary evidence: `output/android-ui-smoke-summary-2026-05-05T10-54-07.md/json` and retry `output/android-ui-smoke-summary-2026-05-05T10-54-45.md/json`. Direct physical screenshots now include `output/hyeni-quantum5-awake-20260505.png` and `output/hyeni-edge-current-20260505.png`; Edge focus/power check shows `mCurrentFocus=com.hyeni.calendar/.MainActivity`, `mWakefulness=Awake`. | pass/current-state |
| `node scripts/summarize-android-ui-smoke.mjs --prefix 2026-05-05T00-00-android-ui-smoke-` | `output/android-ui-smoke-summary-2026-05-05T00-00.md`, `output/android-ui-smoke-summary-2026-05-05T00-00.json`; raw XML text is not copied into summary | pass |
| `npx playwright test --config=playwright.real.config.js tests/e2e/profile-image-real.spec.js` | real main Supabase Storage: uploaded private `child-photos` object path, verified signed URL image `loaded`; set missing object path, verified fallback/no `img`; latest run 1 passed | pass |
| `npx playwright test --config=playwright.real.config.js` | latest direct run after `20260505000000` main application: 40 passed | pass |
| main Android remote-listen smoke | latest normal smoke after remote-listen readiness display changes: `output/android-parent-ui-remote-listen-2026-05-05T03-11-05-657Z.log`; latest background-only smoke after direct child app launch/HOME: `output/android-parent-ui-remote-listen-2026-05-05T03-19-01-751Z.log`; both `success=true`, `sawFcm=true`, `sawActivity=true`, `sawService=true`. Earlier recovery evidence remains `output/supabase-recovery-verification-2026-05-05T01-31-21-686Z.json`. | pass |
| main Android backgrounded child remote-listen smoke | `node scripts/android-remote-listen-parent-ui-smoke.mjs --parent emulator-5554 --child R5CY40EE6QE --readiness-timeout-ms 12000 --child-background-only`; result `childMode=backgrounded`, `success=true`, `sawFcm=true`, `sawActivity=true`, `sawService=true`; log `output/android-parent-ui-remote-listen-2026-05-05T03-19-01-751Z.log`; screenshots `output/android-parent-ui-remote-listen-started-2026-05-05T03-19-01-751Z.png`, `output/android-child-after-parent-ui-remote-listen-2026-05-05T03-19-01-751Z.png` | pass |
| main Android pending fallback smoke | `node scripts/android-remote-listen-parent-ui-smoke.mjs --parent emulator-5554 --child R5CY40EE6QE --readiness-timeout-ms 12000 --start-child-service-for-pending-fallback`; log `output/android-parent-ui-remote-listen-2026-05-05T01-34-05-770Z.log`; Android 14+ pending FGS skip then foreground bridge/audio chunks | pass |
| main Android remote-listen matrix | `output/supabase-recovery-verification-2026-05-05T01-33-09-348Z.json`; `output/remote-listen-matrix-2026-05-05T01-33-15-999Z.md` | pass |
| main RLS migration application | `output/pg-policies-families-before-20260504010000-2026-05-05T01-13-04-454Z.json`; `supabase migration repair 20260504010000 --status applied --linked --yes`; migration list shows `20260504010000 | 20260504010000` | pass |
| `node scripts/android-remote-listen-matrix.mjs --require-two --parent emulator-5554 --child R5CY40EE6QE --scenario locked-screen-off-channel-ok` | latest normal/channel `output/remote-listen-matrix-2026-05-04T23-45-27-574Z-locked-screen-off-channel-ok.md`; child locked/screen off, `ringer_mode=VIBRATE (dumpsys.audio)`, remote-listen channels present and `blocked:false` | pass |
| child mic denied matrix | `output/remote-listen-matrix-2026-05-04T22-38-29-227Z.md`; `RECORD_AUDIO granted=false`; restored after test | pass |
| child notification denied matrix | `output/remote-listen-matrix-2026-05-04T22-38-38-548Z.md`; `POST_NOTIFICATIONS granted=false`; restored after test | pass |
| child DND matrix | `output/remote-listen-matrix-2026-05-04T22-38-03-648Z.md`; `zen_mode=1`; restored to `zen_mode=0` after test | pass |
| remote-listen notification channel evidence | `output/remote-listen-matrix-2026-05-04T23-45-27-574Z-locked-screen-off-channel-ok.md`; child `hyeni_remote_listen_v2` present importance 4 `blocked:false`, `ambient_listen_fgs` present importance 2 `blocked:false` while child screen locked/off | pass/current-state |
| actual remote-listen channel disabled toggle/session | Settings channel screen opened via `android.settings.CHANNEL_NOTIFICATION_SETTINGS`; XML evidence `output/channel-settings-off-R5CY40EE6QE.xml` shows `알림 허용` checked false and blocked copy. Matrix `output/remote-listen-matrix-2026-05-05T01-57-39-312Z-channel-disabled.md` shows `hyeni_remote_listen_v2 importance:0 blocked:true`. Actual smoke `output/android-parent-ui-remote-listen-2026-05-05T01-57-48-658Z.log` produced `sawFcm=true`, `sawActivity=false`, `sawService=false`. Restore XML `output/channel-settings-restored-R5CY40EE6QE.xml`; restore matrix `output/remote-listen-matrix-2026-05-05T01-59-48-990Z-channel-restored.md` shows `importance:4 blocked:false`; post-restore smoke `output/android-parent-ui-remote-listen-2026-05-05T01-59-56-796Z.log` success with audio chunks | pass |
| native remote-listen channel diagnostic fields | `DeviceStatusReporter.java`, `NotificationPlugin.java`, `tests/nativeDeliveryHealth.test.js`; `remoteListenChannelImportance`, `remoteListenChannelBlocked` | pass |
| child global offline attempts | prior `output/remote-listen-matrix-2026-05-04T22-39-03-027Z.md`, `output/remote-listen-matrix-2026-05-04T22-46-55-504Z.md`; fresh `output/remote-listen-matrix-2026-05-05T02-59-28-615Z-global-offline-airplane-mode.md/json`. Samsung child retained `networkConnected=true`, `networkValidated=true` despite airplane mode + Wi-Fi/data disable; restored to airplane mode disabled and Wi-Fi connected. App-level network deny evidence remains `output/remote-listen-matrix-2026-05-04T22-47-45-428Z.md`. | app-level network failure verified; full-device offline not reproducible on connected child |
| child app networking denied matrix | `output/remote-listen-matrix-2026-05-04T22-47-45-428Z.md`; child `packageNetworking: chain3Enabled=true, packageAllowed=false`, restored to `chain:disabled`, package `allow` | pass |
| child SILENT matrix | `output/remote-listen-matrix-2026-05-04T22-49-47-632Z.md`; child `ringer_mode=SILENT (dumpsys.audio)`, restored to `VIBRATE` | pass |
| fold support evidence | `output/remote-listen-matrix-2026-05-04T22-51-38-899Z.md`; parent/child `deviceState current=0`, supported `0`, names `DEFAULT`, `mIsLidOpen=null`, `supportsFoldStates=false` | not applicable on connected devices |
| fresh fold override check | 2026-05-05 KST direct adb check on `R5CY40EE6QE`, `R5CY521CFNZ`, `emulator-5554`: `cmd device_state print-states` shows only `DeviceState{identifier=0, name='DEFAULT'}` and `dumpsys device_state` shows `mIsLidOpen=null`; emulator override `cmd device_state state 1` returned `Error: Requested state: 1 is not supported.` then reset/print-state stayed `0` | not applicable on connected devices |
| foldable AVD path for next session | SDK device profiles include `pixel_9_pro_fold`, `pixel_fold`, `6.7in Foldable`, `7.6in Foldable`, `8in Foldable`; installed system image is `system-images;android-36.1;google_apis_playstore;x86_64`. User said on 2026-05-05 KST that fold verification will be done next time. | deferred by user |
| `node scripts/production-stabilization-healthcheck.mjs --timeout-ms 12000` | fresh `output/production-stabilization-healthcheck-2026-05-05T02-57-40-447Z.json/md`; `readyForAndroidSmoke=true`, diagnostic boundary `service-ready`; Auth/REST/Function critical probes pass | pass |
| `node scripts/supabase-recovery-verification.mjs --timeout-ms 12000` / `npm run verify:recovery -- --timeout-ms 12000` | latest gated runs executed local, real Playwright, Android smoke, and Android matrix successfully | pass |
| `npx supabase inspect db blocking --linked -o json` | fresh run connected to remote DB and returned no blocking rows | pass |
| `npx supabase inspect db long-running-queries --linked -o json` | fresh run connected to remote DB and returned one Realtime replication query, no app query blocker | pass/current-state |
| `npx supabase network-restrictions get --project-ref qzrrscryacxhprnrtpjd -o json --experimental` | IPv4 `0.0.0.0/0`, IPv6 `::/0`, restrictions applied `true` | pass/read-only |
| `npx supabase functions list --project-ref qzrrscryacxhprnrtpjd -o json` | management API read succeeds; `push-notify` `ACTIVE`, `verify_jwt=false`, `version=61` | pass/read-only |
| `npx supabase network-bans get --project-ref qzrrscryacxhprnrtpjd -o json --experimental` | failed with status 522 (`unexpected list bans status 522`) | inconclusive/support-evidence |
| `npx supabase ssl-enforcement get --project-ref qzrrscryacxhprnrtpjd -o json --experimental` | failed with HTTP 500, `errorEventId=d8ad675f42174d86bd2df55e7c04cd4a` | inconclusive/support-evidence |
| official Supabase status API | `output/supabase-status-summary-2026-05-04T23-08-09-002Z.json`; All Systems Operational, unresolved incidents 0, relevant components operational | pass/read-only |
| `Test-NetConnection aws-1-ap-northeast-2.pooler.supabase.com -Port 6543` | `TcpTestSucceeded=True` | pass/read-only |
| `node scripts/android-remote-listen-parent-ui-smoke.mjs ... --start-child-service-for-pending-fallback` on branch | `success=true`, `sawActivity=true`, `sawService=true` | pass for branch fallback |
| `node scripts/android-remote-listen-parent-ui-smoke.mjs ...` on main | latest main normal smoke evidence `output/android-parent-ui-remote-listen-2026-05-05T03-11-05-657Z.log` with `sawFcm=true`, `sawActivity=true`, `sawService=true`; latest `--child-background-only` evidence `output/android-parent-ui-remote-listen-2026-05-05T03-19-01-751Z.log` with `childMode=backgrounded`, `sawFcm=true`, `sawActivity=true`, `sawService=true`; fresh healthcheck remains service-ready | pass |

## historical timeout boundary

The Supabase timeout notes below are historical evidence from the outage window. Fresh checks on 2026-05-05 11:57 KST show `production-stabilization-healthcheck` is service-ready and DB inspect commands respond.

At the time, it was not a local app build failure:

- main `auth-gateway-no-key` returns 401 quickly.
- main `rest-gateway-no-key` returns 401 quickly.
- main realtime gateway returns 403 quickly.
- main Storage status returns 200 in direct probes.
- main project metadata and official Supabase status API report healthy/operational state.
- main DB network restrictions allow all IPv4/IPv6 CIDRs.
- main Postgres pooler TCP port is reachable from this machine.
- with-data branch Auth/REST works.
- with-data branch `push-notify` works after VAPID guard and records `pending_notifications`.

Blocking path:

- main `auth-health` with anon key times out.
- main REST table probe with service role times out.
- main `push-notify` authenticated probe times out.
- direct main Postgres inspect times out after connecting to `aws-1-ap-northeast-2.pooler.supabase.com`.

Historical boundary decision:

- This was not actionable as a local app-code fix during the outage.
- The production healthcheck is now green, so this is no longer a current completion blocker.
- Operator-facing brief remains available at `.planning/SUPABASE_MAIN_TIMEOUT_SUPPORT_BRIEF.md` for historical support context.

## no-complete decision

Do **not** call `update_goal(status="complete")` until all of these are true:

1. main `production-stabilization-healthcheck` returns `readyForAndroidSmoke=true`. Current status: satisfied by `output/production-stabilization-healthcheck-2026-05-05T02-57-40-447Z.json/md`.
2. main Android parent/child `android-remote-listen-parent-ui-smoke` passes without branch fallback-only assumptions. Current status: satisfied by main smoke evidence already listed above.
3. real Supabase Playwright suite is rerun against main or an approved production-equivalent branch. Current status: satisfied, latest direct run after `20260505000000` main application passed 40 tests.
4. Android state matrix covers the remaining verifiable states. Actual remote-listen channel disabled has been verified through Android Settings UI toggle, matrix, failed smoke, restore matrix, and post-restore successful smoke. Foldable closed/folded validation is deferred by user to the next verification session and is the remaining no-complete condition.
5. main DB/RLS/Realtime verified with evidence, and no remaining unverified Storage/profile image failure mode is listed as a completion blocker. Current status: satisfied except for the user-deferred foldable state outside DB/Storage scope.
