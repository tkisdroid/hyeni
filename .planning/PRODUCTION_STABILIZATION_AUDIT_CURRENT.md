# 혜니캘린더 프로덕션 안정화 현재 감사

작성 시각: 2026-05-05 KST

## 결론

현재 목표는 아직 완료 상태가 아니다. 2026-05-05 KST에 production main Supabase DB/API timeout은 해소됐고, main RLS 누락을 `20260504010000` migration으로 보정한 뒤 local gates, real Supabase Playwright, main Android remote-listen smoke, Android matrix, main Storage/profile image real Playwright, 실제 remote-listen channel disabled 세션 검증이 통과했다. 다만 명시 요구사항 중 폴더블 접힘 상태는 연결 기기에서 지원되지 않으며, 2026-05-05 KST 사용자 지시에 따라 다음 검증 세션으로 이월한다.

`/goal` 완료 판정은 아래 미검증 항목이 해소되거나 사용자가 목표 범위를 명시적으로 변경한 뒤에만 가능하다.

## 최신 추가 감사: 장소관리/시간 입력/branch DB

2026-05-05 11:35 KST 현재, 사용자가 추가 요청한 장소관리와 시간 입력 시계 아이콘 변경은 코드와 자동 검증에 반영됐다.

- `src/App.jsx`: `AcademyManager`가 학원, 자주가는 장소, 안전장소, 위험장소를 한 화면에서 관리한다. 상단은 `← 뒤로`, 저장은 하단 버튼이다. 일정 등록 위치 선택은 학원과 자주가는 장소를 함께 사용한다.
- `src/App.jsx`, `src/App.css`: 일정 등록/학원 시간 입력의 `input[type=time]`에 `hyeni-time-input`을 적용하고, native picker indicator를 테마색 시계 mask로 표시한다.
- `src/components/multichild/HomeDashboard/ChildSummaryCard.jsx`: 다자녀 홈 카드 위치 표시에서 선행 시/도 및 시 단위 토큰을 제거해 구/동 중심으로 보이게 했다.
- `supabase/migrations/20260505000000_exclude_danger_zones_from_playdate.sql` 및 down migration: 친구놀이 후보 산정에서 위험장소와 겹치는 안전장소/현재 위치를 제외한다.
- Branch DB 검증: with-data preview branch `cryodcviqyyxxovclqou`에 SQL을 적용하고, `output/playdate-danger-zone-branch-check.sql`로 실제 함수 결과를 확인했다. 위험장소 없음은 후보 1명, 상대 위험장소 겹침은 후보 0명, 우리 위험장소 겹침은 `not_in_safe_place`였다. 테스트 데이터 잔여 row는 0개다.
- main DB 상태: 적용 전 `output/main-find-playdate-candidates-before-20260505000000-20260505-113633.json` snapshot을 남긴 뒤 main에 migration SQL을 적용했다. 함수 정의/권한/실제 후보 제외 SQL 검증이 통과했고, 테스트 row 잔여는 0개였다. `supabase migration repair 20260505000000 --status applied --linked --yes` 후 migration list는 `20260505000000 | 20260505000000`이다.
- 최신 검증: `npm run test` 70 files / 322 tests passed, `npm run verify` Vitest 322 passed + Playwright 26 passed / 12 skipped, `npx playwright test --config=playwright.real.config.js` 40 passed, `npm run build` 성공, `npx cap sync android` 성공, Android `assembleDebug` 성공.
- 친구놀이 E2E 상태: `friend-playdate-discover.spec.js` 2건, `friend-playdate-start.spec.js` 1건, `friend-playdate-toggle.spec.js` 1건은 더 이상 `fixme`가 아니며 실제 Playwright에서 통과했다. 전체 verify에서도 친구놀이 mocked E2E가 모두 통과한다.
- 최신 화면 증거: Playwright time input screenshot `test-results/critical-flows-critical-Hy-80d53-tions-remote-audio-and-kkuk-chromium/time-picker-theme.png`; Android Quantum5 screenshot `output/hyeni-quantum5-awake-20260505.png`.
- 최신 Android 상태: `R5CY40EE6QE`와 `R5CY521CFNZ` 모두 APK 설치 성공. `R5CY40EE6QE`는 foreground 앱 화면/FCM token 로그 확인. `R5CY521CFNZ`는 `mWakefulness=Awake`, `mCurrentFocus=com.hyeni.calendar/.MainActivity` 상태로 전환됐고 `output/hyeni-edge-current-20260505.png`에서 실제 앱 홈 화면을 확인했다. 접힘 상태 검증만 사용자 지시에 따라 다음 세션으로 이월한다.
- 2026-05-05 11:57 KST fresh Supabase 상태: `node scripts/production-stabilization-healthcheck.mjs --timeout-ms 12000`는 `output/production-stabilization-healthcheck-2026-05-05T02-57-40-447Z.json/md`를 생성했고 `readyForAndroidSmoke=true`, `diagnosticSummary.boundary=service-ready`다. `npx supabase inspect db blocking --linked -o json`은 blocking row 0개, `npx supabase inspect db long-running-queries --linked -o json`은 Realtime replication query 1건만 반환했다. `npx supabase migration list --linked`에서 신규 migration `20260504010000`, `20260505000000`은 remote 적용 상태다.
- 2026-05-05 11:59 KST network 상태: `cmd connectivity airplane-mode enable`, `cmd wifi set-wifi-enabled disabled`, `svc data disable` 후 matrix `output/remote-listen-matrix-2026-05-05T02-59-28-615Z-global-offline-airplane-mode.md/json`를 생성했다. Samsung child는 Wi-Fi disabled 상태에서도 `networkConnected=true`, `networkValidated=true`를 유지해 기기 전체 오프라인 재현은 실패했다. 앱 단위 네트워크 차단 matrix는 이미 통과 evidence로 유지한다. 복구 후 airplane mode `disabled`, Wi-Fi `enabled/connected`를 확인했다.
- 2026-05-05 12:07 KST 원격청취 준비 표시 수정: 가족 > 아이 연동관리에서 advisory 상태(배터리 최적화, 절전, DND, 무음/진동, 화면 꺼짐/잠금, 폴더블 접힘)를 `원격 청취 준비 부족`으로 표시하지 않고, blocker 상태(마이크 권한, 알림 권한, 연결 알림 채널, 네트워크 끊김)만 `원격 청취 설정 필요`로 표시한다. Advisory-only 상태는 `원격 청취 연결 가능 — 확인:`으로 표시한다. Targeted tests: native/remote-listen Vitest 19 passed, critical remote/family Playwright 2 passed. Fresh gates: `npm run test` 322 passed, `npm run verify` Vitest 322 + Playwright 26 passed / 12 skipped, build/sync/assemble/install on `R5CY40EE6QE` and `R5CY521CFNZ` passed.
- 2026-05-05 12:20 KST 백그라운드 원격청취 추가 검증: `scripts/android-remote-listen-parent-ui-smoke.mjs`에 `--child-background-only`를 추가했다. 이 모드는 자녀 앱을 실행하고 HOME으로 내려 프로세스를 살린 상태에서 원격청취 요청을 보낸다. 첫 시도는 `Remote listen skipped: family mismatch`로 실패했고, WebView가 실제 세션을 로드하며 테스트용 네이티브 prefs를 덮어쓴 것이 원인이었다. 스크립트를 백그라운드 전환 뒤 `LocationService`로 동일 테스트 컨텍스트를 다시 동기화하도록 고친 뒤 `npx vitest run tests/realServicesHardening.test.js` 13 passed. 실제 child `R5CY40EE6QE`와 parent emulator 조합에서 `node scripts/android-remote-listen-parent-ui-smoke.mjs --parent emulator-5554 --child R5CY40EE6QE --readiness-timeout-ms 12000 --child-background-only`가 `childMode=backgrounded`, `success=true`, `sawFcm=true`, `sawActivity=true`, `sawService=true`로 통과했다. 로그 `output/android-parent-ui-remote-listen-2026-05-05T03-19-01-751Z.log`에는 `Remote listen request - launching app`, foreground bridge, native capture, Realtime audio chunk seq=0..24가 기록됐다.

## 성공 기준 감사표

| 요구사항 | 현재 증거 | 판정 |
| --- | --- | --- |
| AGENTS.md 및 planning 문서 기준 작업 | AGENTS.md 지침 준수, `.planning/PROJECT.md`, `.planning/ROADMAP.md`, `.planning/REQUIREMENTS.md`, `.planning/research/SUMMARY.md` 기반 진행 | 통과 |
| 현재 프로젝트 파일/타입/DB/API 확인 후 수정 | `src/App.jsx`, `src/lib/sync.js`, `src/lib/auth.js`, `src/lib/pushNotifications.js`, Android Java, Supabase migrations 확인 후 최소 수정 | 통과 |
| `src/App.jsx` 모놀리스 분해 금지 | 파일 분해 없이 기존 모놀리스 내 수정 | 통과 |
| 앱 전체 기능 인벤토리 | `.planning/PRODUCTION_FEATURE_INVENTORY_CURRENT.md`에 기능별 파일/DB/선택 아이 격리/권한/Realtime/로딩/검증/리스크 매핑 | 통과 |
| prompt-to-artifact 완료 체크리스트 | `.planning/PRODUCTION_STABILIZATION_COMPLETION_CHECKLIST.md`에 명시 요구사항/명령/증거/미완료 항목 매핑 | 통과 |
| DB 변경 migration hygiene | `supabase/migrations/20260504010000_restrict_family_insert_to_parent_auth_providers.sql`, `supabase/migrations/down/20260504010000_restrict_family_insert_to_parent_auth_providers.sql` 작성 | 통과 |
| 기본 테스트 | `npm run test`: latest 70 files, 322 tests passed | 통과 |
| 전체 verify gate | `npm run verify`: latest Vitest 322 passed, mocked Playwright 26 passed / 12 skipped, retry/flaky 없음 | 통과 |
| main Supabase recovery healthcheck | fresh `node scripts/production-stabilization-healthcheck.mjs --timeout-ms 12000`: `output/production-stabilization-healthcheck-2026-05-05T02-57-40-447Z.json/md`, `readyForAndroidSmoke=true`, diagnostic boundary `service-ready` | 통과 |
| Supabase main blocker support brief | `.planning/SUPABASE_MAIN_TIMEOUT_SUPPORT_BRIEF.md`는 historical blocker brief로 보존. 현재는 support/restart 없이 회복 확인 | 해소 |
| production web build | `npm run build` 성공, Vite chunk warning만 존재 | 통과 |
| Capacitor sync | `npx cap sync android` 성공 | 통과 |
| Android build/install/launch/UI smoke | `npm run build`, `npx cap sync android`, `.\gradlew.bat assembleDebug` 성공. `R5CY40EE6QE`, `R5CY521CFNZ`, `emulator-5554` 최신 APK 설치 성공. UI smoke summary latest: `output/android-ui-smoke-summary-2026-05-05T10-54-07.md/json`, wake retry `output/android-ui-smoke-summary-2026-05-05T10-54-45.md/json`; physical screenshot evidence `output/hyeni-quantum5-awake-20260505.png`, `output/hyeni-edge-current-20260505.png`; Edge `mWakefulness=Awake`, `mCurrentFocus=com.hyeni.calendar/.MainActivity` | 통과 |
| main Android bundle 복구 | `.env`, `.env.local` 모두 `https://qzrrscryacxhprnrtpjd.supabase.co`; 물리 자녀 prefs main family/user/URL 복구 확인 | 통과 |
| Android remote-listen smoke 안전 preflight | `scripts/android-remote-listen-parent-ui-smoke.mjs --readiness-timeout-ms 6000`가 기기 prefs 변경 전 Supabase readiness 실패를 감지 | 통과 |
| 다자녀 선택 격리 | selected child 관련 unit/e2e 및 real branch suite 통과. `critical-flows`의 calendar filtering, dashboard target refresh, movement summary 통과 | 강한 자동 검증 통과 |
| 위치 최신화/홈/오늘 동기화 | mocked Playwright에서 child location bootstrap, manual refresh, map refresh 통과 | 자동 검증 통과 |
| 캘린더 하루 이동경로 요약 | `critical-flows.spec.js`: “parent calendar shows the selected child's day movement summary” 통과 | 자동 검증 통과 |
| 프로필/설정 저장 UX | 관련 unit 테스트 및 mocked app flow 통과 | 자동 검증 통과 |
| 테마/아이콘 인지성 | soft brand/theme 관련 테스트 통과 | 자동 검증 통과 |
| 프로필 사진/아바타 fallback | `ChildAvatar` 공용 컴포넌트로 로딩/성공/실패/decorative 상태를 분리. 직접 CSS `child.photo_url` 배경 렌더링 제거. `getMyFamily` signed URL cache 추가. main Storage real Playwright에서 private object signed URL load 및 missing object fallback 통과 | 통과 |
| Playwright 화면 증거 | browser: `test-results/critical-flows-critical-Hy-80d53-tions-remote-audio-and-kkuk-chromium/time-picker-theme.png`; Android smoke: `output/android-parent-ui-smoke-loaded-2026-05-04T21-27-25-355Z.png`, `output/android-parent-ui-remote-listen-modal-2026-05-04T21-27-25-355Z.png`, `output/android-parent-ui-remote-listen-started-2026-05-04T21-27-25-355Z.png`; physical: `output/hyeni-quantum5-awake-20260505.png`, `output/hyeni-edge-current-20260505.png` | 통과 |
| Android 권한/기기 상태 매트릭스 | latest main matrix 및 prior DND/mic denied/notification denied/app network denied/SILENT/fold-support evidence retained. Channel disabled matrix/smoke/restore evidence added. Foldable verification deferred by user. | 부분 통과: fold deferred only |
| 주위소리 실패 원인 진단 필드 | Android native와 부모 UI에 `powerSaveMode`, `backgroundRestricted` 진단을 추가하고 targeted Playwright/native tests 및 Gradle build 통과. Advisory-only 상태는 가족 아이연동관리에서 `원격 청취 연결 가능`으로 표시되도록 추가 검증 | 통과 |
| 주위소리 듣기 Android 정책 준수 | branch pending fallback smoke `output/android-parent-ui-remote-listen-2026-05-04T22-23-15-139Z.log`: Android 14+ FGS 제한 감지, `RemoteListenActivity` foreground bridge 후 `AmbientListenService`, Realtime audio chunks sent 확인 | 통과 |
| 주위소리 듣기 전체 E2E 최신 재검증 | normal main smoke `output/android-parent-ui-remote-listen-2026-05-05T03-11-05-657Z.log`: `success=true`, `sawFcm=true`, `sawActivity=true`, `sawService=true`; background-only smoke `output/android-parent-ui-remote-listen-2026-05-05T03-19-01-751Z.log`: child app launched then HOME/backgrounded, FCM received, `RemoteListenActivity`, `AmbientListenService`, realtime audio chunks seq=0..24 | 통과 |

## 해소된 blocker 및 최신 증거

0. main Supabase recovery:
   - 최신 healthcheck: `output/production-stabilization-healthcheck-2026-05-05T02-57-40-447Z.json`, `output/production-stabilization-healthcheck-2026-05-05T02-57-40-447Z.md`.
   - 결과: `readyForAndroidSmoke=true`, `diagnosticSummary.boundary=service-ready`, failed critical probes 없음.
   - local gates evidence: `output/supabase-recovery-verification-2026-05-05T01-25-00-901Z.json`; 이후 profile image 변경 후 `npm run test`, `npm run verify`, `npm run build`, `npx cap sync android`, `.\gradlew.bat assembleDebug` 모두 status 0.
   - real Supabase evidence: latest direct `npx playwright test --config=playwright.real.config.js` after `20260505000000` main application passed 40 tests. Earlier recovery runner evidence remains `output/supabase-recovery-verification-2026-05-05T01-26-36-981Z.json`.
   - Android main smoke evidence: `output/supabase-recovery-verification-2026-05-05T01-31-21-686Z.json`; smoke result `success=true`, `sawFcm=true`, `sawActivity=true`, `sawService=true`; log `output/android-parent-ui-remote-listen-2026-05-05T01-31-24-924Z.log`.
   - Android background-only smoke evidence: `node scripts/android-remote-listen-parent-ui-smoke.mjs --parent emulator-5554 --child R5CY40EE6QE --readiness-timeout-ms 12000 --child-background-only`; result `childMode=backgrounded`, `success=true`, `sawFcm=true`, `sawActivity=true`, `sawService=true`; log `output/android-parent-ui-remote-listen-2026-05-05T03-19-01-751Z.log`; screenshots `output/android-parent-ui-remote-listen-started-2026-05-05T03-19-01-751Z.png`, `output/android-child-after-parent-ui-remote-listen-2026-05-05T03-19-01-751Z.png`.
   - Android main pending fallback evidence: `node scripts/android-remote-listen-parent-ui-smoke.mjs --parent emulator-5554 --child R5CY40EE6QE --readiness-timeout-ms 12000 --start-child-service-for-pending-fallback`; log `output/android-parent-ui-remote-listen-2026-05-05T01-34-05-770Z.log`; `Remote listen pending start skipped on Android 14+` then `RemoteListenActivity`, `AmbientListenService`, realtime audio chunks seq=0..24.
   - Android main matrix evidence: `output/supabase-recovery-verification-2026-05-05T01-33-09-348Z.json`, `output/remote-listen-matrix-2026-05-05T01-33-15-999Z.md`.
   - DB RLS correction: pre-change snapshot `output/pg-policies-families-before-20260504010000-2026-05-05T01-13-04-454Z.json`; `supabase/migrations/20260504010000_restrict_family_insert_to_parent_auth_providers.sql` applied to main; `supabase migration repair 20260504010000 --status applied --linked --yes` completed; migration list shows `20260504010000 | 20260504010000`.
   - DB inspect fresh evidence: `npx supabase inspect db blocking --linked -o json` returned no blocking rows. `npx supabase inspect db long-running-queries --linked -o json` returned one Realtime replication query only.
   - The older timeout notes below are retained as historical evidence only.

1. main Supabase REST table probe:
   - `family_members?select=id&limit=1` anon/service request 모두 `AbortError`.

2. main Supabase Edge Function probe:
   - `/functions/v1/push-notify` request `AbortError`.

3. main Supabase Auth Admin probe:
   - `/auth/v1/admin/users?per_page=1` request `AbortError`.

4. main Postgres 직접 연결 historical failure:
   - `npx supabase inspect db blocking --linked`
   - `npx supabase inspect db long-running-queries --linked`
   - 당시 둘 다 `failed to receive message (timeout: context deadline exceeded)`.
   - `Test-NetConnection aws-1-ap-northeast-2.pooler.supabase.com -Port 6543`: `TcpTestSucceeded=True`.
   - historical 결론: 로컬 네트워크에서 pooler TCP 포트는 열리지만, DB 프로토콜 응답이 돌아오지 않았다.
   - 현재 상태: 2026-05-05 11:57 KST fresh run에서 `blocking`/`long-running-queries` 모두 remote DB에 연결해 응답했다. 현 시점 blocker가 아니다.

5. Supabase management metadata:
   - `npx supabase projects list -o json`에서 main project status는 `ACTIVE_HEALTHY`.
   - `npx supabase network-restrictions get --project-ref qzrrscryacxhprnrtpjd -o json --experimental`: DB Allowed IPv4 `0.0.0.0/0`, IPv6 `::/0`, restrictions applied `true`.
   - `npx supabase postgres-config get --project-ref qzrrscryacxhprnrtpjd -o json --experimental`: `{}`.
   - `npx supabase functions list --project-ref qzrrscryacxhprnrtpjd -o json`: management API read succeeds; `push-notify` is `ACTIVE`, `verify_jwt=false`, `version=61`.
   - `npx supabase network-bans get --project-ref qzrrscryacxhprnrtpjd -o json --experimental`: 522 (`unexpected list bans status 522`), so ban-list evidence could not be retrieved.
   - `npx supabase ssl-enforcement get --project-ref qzrrscryacxhprnrtpjd -o json --experimental`: 500 with `errorEventId=d8ad675f42174d86bd2df55e7c04cd4a`, so SSL enforcement status could not be retrieved via CLI.
   - Supabase 공식 status API evidence `output/supabase-status-summary-2026-05-04T23-08-09-002Z.json`: `status.indicator=none`, unresolved incidents `0`, API Gateway/ap-northeast-2/Auth/Connection Pooler/Database/Edge Functions/Management API/Realtime/Storage 모두 `operational`.
   - historical note: 당시 실제 DB/API 실행 경로는 timeout이라 management 상태만으로 완료 판단 불가였다. 현재는 healthcheck와 DB inspect가 응답한다.

6. with-data branch:
   - branch Auth/REST는 정상이고 `push-notify`는 VAPID guard 수정 후 500에서 벗어났다.
   - branch에는 FCM secret이 없어 `sawFcm=false`가 정상이며, pending fallback 경로로 주위소리 E2E를 검증했다.
   - 로컬 `.env`, `.env.local`에는 branch에 설정할 FCM/VAPID secret 값이 없다.

7. physical child branch pending fallback:
   - `output/branch-pending-remote-listen-2026-05-04T21-43-42-692Z.log`
   - `LocationService`가 pending notification polling 중 `java.net.SocketTimeoutException: timeout`.

8. historical main healthcheck failure:
   - 명령: `node scripts/production-stabilization-healthcheck.mjs --timeout-ms 12000`
   - 당시 결과: `readyForAndroidSmoke=false`
   - 최신 파일: `output/production-stabilization-healthcheck-2026-05-04T23-53-09-941Z.json`, `output/production-stabilization-healthcheck-2026-05-04T23-53-09-941Z.md`
   - recovery runner evidence: `output/supabase-recovery-verification-2026-05-04T23-52-31-469Z.json`; healthcheck false에서 후속 browser/Android gate를 실행하지 않고 중단.
   - diagnostic boundary: `api-key-db-dependent-path-timeout`.
   - `auth-gateway-no-key`: 401 in 94ms.
   - `rest-gateway-no-key`: 401 in 41ms.
   - `realtime-gateway`: 403 in 2261ms.
   - `auth-health`, `rest-family-members-service`, `push-notify-reachable`: 모두 12초 후 `AbortError`.
   - operator action: Supabase support ticket 또는 live project restart는 운영자 승인 후 진행. healthcheck green 전 Android smoke 금지.
   - `Test-NetConnection qzrrscryacxhprnrtpjd.supabase.co -Port 443`: `TcpTestSucceeded=True`.
   - historical 결론: 네트워크/TLS gateway 자체가 아니라 API key validation/DB 의존 경로가 막혀 있었다.
   - 현재 상태: fresh `output/production-stabilization-healthcheck-2026-05-05T02-57-40-447Z.json/md`에서 `readyForAndroidSmoke=true`, boundary `service-ready`다.

9. Android smoke preflight:
   - 명령: `node scripts/android-remote-listen-parent-ui-smoke.mjs --parent emulator-5554 --child R5CY40EE6QE --readiness-timeout-ms 6000`
   - 결과: `Supabase is not ready for Android remote-listen smoke`
   - 파일: `output/android-parent-ui-remote-listen-readiness-2026-05-04T22-27-05-059Z.json`
   - Auth health, REST service query, push-notify reachable probe가 모두 `AbortError`.
   - preflight가 `readPrefs(childDevice)`보다 먼저 실행되도록 고정되어, Supabase 장애 중에는 자녀 기기 prefs를 변경하지 않는다.
   - 재확인: 물리 자녀 prefs는 main family/user/URL 및 `serviceEnabled=true` 상태 유지.

10. 주위소리 상태별 진단 보강:
   - native payload: `NotificationPlugin.java`, `DeviceStatusReporter.java`가 `powerSaveMode`, `backgroundRestricted`를 보고한다.
   - parent UI: `REMOTE_LISTEN_HEALTH_STEPS`가 "절전 모드 켜짐", "백그라운드 제한"을 표시한다.
   - targeted tests: `npx vitest run tests/nativeDeliveryHealth.test.js`, `npx playwright test tests/e2e/critical-flows.spec.js -g "parent remote listen distinguishes child device failure reasons"` 통과.
   - matrix collector: `scripts/android-remote-listen-matrix.mjs`가 Samsung `settings system mode_ringer=null` 상태에서도 `dumpsys audio`의 Ringer mode를 fallback으로 기록하고, `dumpsys notification --noredact`에서 remote-listen channel importance/blocked/deleted 상태를 기록하며, `cmd connectivity get-package-networking-enabled`로 앱 단위 네트워크 deny 상태를 기록하고, `cmd device_state`/`dumpsys device_state`로 fold 지원 여부를 기록하도록 보강됨. `tests/androidRemoteListenMatrixScript.test.js`는 실패 확인 후 통과.
   - full verify: latest `npm run verify` 통과. Vitest 322 passed, mocked Playwright 26 passed / 12 skipped, retry/flaky 없음.
   - build: `npm run build`, `npx cap sync android`, `.\gradlew.bat assembleDebug` 통과.
   - install: 최신 debug APK를 `R5CY40EE6QE`, `R5CY521CFNZ`, `emulator-5554`에 설치 완료.
   - package verification: `R5CY40EE6QE` `versionName=1.1`, `versionCode=2`, `lastUpdateTime=2026-05-05 09:56:22`; `R5CY521CFNZ` `versionName=1.1`, `versionCode=2`, `lastUpdateTime=2026-05-05 09:56:22`; `emulator-5554` `versionName=1.1`, `versionCode=2`, `lastUpdateTime=2026-05-05 00:56:21`.
   - launch smoke: `adb shell am start -n com.hyeni.calendar/.MainActivity` 실행 후 `pidof com.hyeni.calendar` 확인. `R5CY40EE6QE` pid `6353`, focused app `com.hyeni.calendar/.MainActivity` while current window is `NotificationShade`; `R5CY521CFNZ` pid `21171`, current focus `com.hyeni.calendar/com.hyeni.calendar.MainActivity`; `emulator-5554` pid `24182`, current focus `com.hyeni.calendar/com.hyeni.calendar.MainActivity`.
   - UI smoke evidence: screenshots/XML captured at `output/2026-05-05T10-54-07-android-ui-smoke-*` and summarized by `output/android-ui-smoke-summary-2026-05-05T10-54-07.md/json`; wake retry `output/android-ui-smoke-summary-2026-05-05T10-54-45.md/json` shows `R5CY40EE6QE` visible. 추가 직접 확인에서 `R5CY521CFNZ`는 `mWakefulness=Awake`, `mCurrentFocus=com.hyeni.calendar/.MainActivity`였고, screenshot `output/hyeni-edge-current-20260505.png`에 다자녀 홈/장소관리 하단 탭/구·동 중심 위치 표시가 렌더링됐다.
   - latest normal/channel matrix: `output/remote-listen-matrix-2026-05-04T23-45-27-574Z-locked-screen-off-channel-ok.md`; scenario `locked-screen-off-channel-ok`; child `RECORD_AUDIO=true`, `POST_NOTIFICATIONS=true`, `FOREGROUND_SERVICE_MICROPHONE=true`, `zen_mode=0`, `ringer_mode=VIBRATE (dumpsys.audio)`, locked/screen off, network validated, battery optimization not exempted, `hyeni_remote_listen_v2` importance 4 `blocked:false`, `ambient_listen_fgs` importance 2 `blocked:false`.
   - fold-support evidence: `output/remote-listen-matrix-2026-05-04T22-51-38-899Z.md` and latest matrix both show parent/child `deviceState current=0`, supported `0`, names `DEFAULT`, `mIsLidOpen=null`, `supportsFoldStates=false`. Connected devices do not support fold/closed state, so fold closure cannot be actually verified with current hardware.
   - fresh fold override check: direct `adb shell cmd device_state print-states` on `R5CY40EE6QE`, `R5CY521CFNZ`, and `emulator-5554` reports only `DeviceState{identifier=0, name='DEFAULT'}`. `dumpsys device_state` on all three reports `mIsLidOpen=null`. `adb -s emulator-5554 shell cmd device_state state 1` returns `Error: Requested state: 1 is not supported.`, and reset leaves `print-state=0`. This confirms there is no fold/closed state available to verify on the connected hardware/current emulator.
   - next foldable path: local SDK includes foldable AVD profiles `pixel_9_pro_fold`, `pixel_fold`, `6.7in Foldable`, `7.6in Foldable`, and `8in Foldable`; installed system image is `system-images;android-36.1;google_apis_playstore;x86_64`. User explicitly deferred fold verification to the next session on 2026-05-05 KST.
   - channel-disabled evidence: `R5CY40EE6QE` Android Settings channel detail opened via `android.settings.CHANNEL_NOTIFICATION_SETTINGS`. `output/channel-settings-off-R5CY40EE6QE.xml` shows `알림 허용` switch `checked=false` and "이 카테고리의 알림이 차단된 상태입니다." Matrix `output/remote-listen-matrix-2026-05-05T01-57-39-312Z-channel-disabled.md` shows child `hyeni_remote_listen_v2` `importance:0`, `blocked:true`. Actual remote-listen smoke while disabled produced `output/android-parent-ui-remote-listen-2026-05-05T01-57-48-658Z.log` with `sawFcm=true`, `sawActivity=false`, `sawService=false`, confirming the failure mode. Channel restored via the same Settings screen; `output/channel-settings-restored-R5CY40EE6QE.xml` shows switch `checked=true`; `output/remote-listen-matrix-2026-05-05T01-59-48-990Z-channel-restored.md` shows `importance:4`, `blocked:false`; post-restore smoke `output/android-parent-ui-remote-listen-2026-05-05T01-59-56-796Z.log` succeeded with `sawFcm=true`, `sawActivity=true`, `sawService=true` and realtime audio chunks.
   - DND matrix: `output/remote-listen-matrix-2026-05-04T22-38-03-648Z.md`; child `zen_mode=1`, `ringer_mode=VIBRATE (dumpsys.audio)`. Test restored `zen_mode=0` and policy access `null`.
   - mic denied matrix: `output/remote-listen-matrix-2026-05-04T22-38-29-227Z.md`; child `RECORD_AUDIO granted=false`, appop `RECORD_AUDIO: ignore`. Test restored `RECORD_AUDIO granted=true`, appop allow.
   - notification denied matrix: `output/remote-listen-matrix-2026-05-04T22-38-38-548Z.md`; child `POST_NOTIFICATIONS granted=false`, appop `POST_NOTIFICATION: ignore`. Test restored `POST_NOTIFICATIONS granted=true`, appop allow.
   - app networking denied matrix: `output/remote-listen-matrix-2026-05-04T22-47-45-428Z.md`; child `packageNetworking: chain3Enabled=true`, `packageAllowed=false`, raw `com.hyeni.calendar:deny`. Test restored `chain:disabled`, `com.hyeni.calendar:allow`.
   - SILENT matrix: `output/remote-listen-matrix-2026-05-04T22-49-47-632Z.md`; child `ringer_mode=SILENT (dumpsys.audio)`. Test restored `ringer_mode=VIBRATE`.
   - global offline attempts: prior `output/remote-listen-matrix-2026-05-04T22-39-03-027Z.md`, `output/remote-listen-matrix-2026-05-04T22-46-55-504Z.md`, and fresh `output/remote-listen-matrix-2026-05-05T02-59-28-615Z-global-offline-airplane-mode.md/json` still showed child `networkConnected=true`, `networkValidated=true` after airplane mode + Wi-Fi/data disable. Full-device offline is not counted as verified on the connected Samsung child, but app-level network deny is verified. After the fresh attempt, airplane mode was restored to `disabled` and Wi-Fi was `enabled/connected`.

11. 프로필 사진/아바타 fallback 및 Storage 보강:
   - 공용 컴포넌트: `src/components/multichild/HomeDashboard/ChildAvatar.jsx`.
   - 적용 화면: `ChildSummaryCard`, `TodayMultiChildView`, `PerChildToggle`, `src/App.jsx` 내 연동 관리/위치/빠른 전환/대시보드 아바타.
   - 동작: 사진 URL이 있어도 로딩 중에는 이름/이모티콘 fallback을 유지하고, `load` 성공 후에만 이미지를 표시한다. `error` 발생 시 이미지를 제거하고 색상 기반 fallback으로 복구한다.
   - Storage 저장 흐름: 새 업로드는 private bucket public URL 저장 대신 object path를 저장한다. post-family direct preview는 signed URL을 사용한다. `getMyFamily`는 동일 path signed URL을 TTL 내 cache해 반복 Storage signing fetch를 줄인다.
   - accessibility fix: 버튼 내부 아바타는 `decorative` 모드로 버튼 이름을 오염시키지 않는다. 이 회귀는 `tests/unit/ChildAvatar.test.jsx`와 `critical-flows` 이동경로 E2E로 검증했다.
   - targeted tests: `npx vitest run tests/authFamilyRole.test.js tests/familyMemberProfileTheme.test.js tests/unit/PhotoUpload.test.jsx tests/unit/ChildAvatar.test.jsx tests/unit/ChildSummaryCard.test.jsx tests/unit/PerChildToggle.test.jsx` 통과.
   - real Storage evidence: `npx playwright test --config=playwright.real.config.js tests/e2e/profile-image-real.spec.js` 통과. 실제 main Supabase Storage에 private `child-photos` object path를 올려 signed URL image `loaded` 상태를 확인하고, 없는 object path는 fallback/no `img` 상태를 확인했다.
   - full tests: latest `npm run test` 통과. 70 files, 322 tests passed.
   - build/Android: `npm run build`, `npx cap sync android`, `.\gradlew.bat assembleDebug`, 세 연결 대상 APK 설치 통과.

12. `push-notify` VAPID/fallback 보강:
   - root cause: branch `push-notify`는 VAPID secret이 없을 때 모듈 초기화에서 Web Push 설정이 실패해 pending fallback까지 도달하지 못했다.
   - 수정: `webPushConfigured` guard를 추가해 VAPID가 없으면 Web Push만 건너뛰고 FCM/pending notification 처리를 계속한다.
   - branch 배포: `npx supabase functions deploy push-notify --project-ref cryodcviqyyxxovclqou --no-verify-jwt` 성공.
   - main 배포: `npx supabase functions deploy push-notify --project-ref qzrrscryacxhprnrtpjd --no-verify-jwt` 성공.
   - function 단독 검증: branch parent JWT `remote_listen` 호출 200, `pending_notifications` 1건 생성, `delivery_status`는 `webSent=0`, `fcmSent=0`, `recipients=1`.
   - tests: `npx vitest run tests/nativeBackgroundCommands.test.js`, `npx vitest run tests/realServicesHardening.test.js`, `npm run test`, `npm run verify` 통과.

13. branch Android pending fallback smoke:
   - branch readiness: `output/android-parent-ui-remote-listen-readiness-2026-05-04T22-23-15-139Z.json` 통과.
   - command: branch env로 빌드/설치 후 `node scripts/android-remote-listen-parent-ui-smoke.mjs --parent emulator-5554 --child R5CY40EE6QE --readiness-timeout-ms 8000 --start-child-service-for-pending-fallback`.
   - result: `success=true`, `sawFcm=false`, `sawActivity=true`, `sawService=true`.
   - log: `output/android-parent-ui-remote-listen-2026-05-04T22-23-15-139Z.log`.
   - evidence: `Remote listen pending start skipped on Android 14+`, `RemoteListenActivity`, `Native ambient audio capture started`, `Realtime audio chunk sent seq=0..43`.
   - screenshots: `output/android-parent-ui-smoke-loaded-2026-05-04T22-23-15-139Z.png`, `output/android-parent-ui-remote-listen-modal-2026-05-04T22-23-15-139Z.png`, `output/android-parent-ui-remote-listen-started-2026-05-04T22-23-15-139Z.png`, `output/android-child-after-parent-ui-remote-listen-2026-05-04T22-23-15-139Z.png`.
   - cleanup: 자녀 prefs는 main family/user/URL 및 `serviceEnabled=true`로 복구 확인. 이후 main env로 다시 `npm run build`, `npx cap sync android`, `.\gradlew.bat assembleDebug`, 두 기기 APK 재설치 완료.

## 남은 체크리스트

1. main Supabase DB/API timeout 해소 확인:
   - `/rest/v1/family_members?select=id&limit=1`
   - `/auth/v1/admin/users?per_page=1`
   - `/functions/v1/push-notify`
   - `npx supabase inspect db blocking --linked`
   - `node scripts/production-stabilization-healthcheck.mjs --timeout-ms 12000`
   - 현재 상태: 2026-05-05 11:57 KST 기준 해소 확인 완료. support ticket/restart는 불필요하다.

2. branch E2E를 쓰려면 branch에 production과 동등한 FCM/VAPID secrets를 설정한다. secret 값은 현재 로컬 파일에 없으므로 운영자가 Supabase dashboard/secret source에서 제공해야 한다.

3. timeout 해소 후 실행:
   - `npm run test`
   - `npm run verify`
   - `npx playwright test --config=playwright.real.config.js`
   - `node scripts/android-remote-listen-parent-ui-smoke.mjs --parent emulator-5554 --child R5CY40EE6QE`
   - `node scripts/android-remote-listen-matrix.mjs --require-two --parent emulator-5554 --child R5CY40EE6QE`
   - 현재 상태: 위 gate들은 이미 최신 evidence로 통과했다. 이후 앱 코드/DB가 변경되면 재실행한다.

4. 주위소리 듣기 상태별 수동/자동 검증:
   - 통과 evidence 있음: 정상 권한, 마이크 권한 없음, 알림 권한 없음, 기기 잠금/화면 꺼짐, DND, 진동 모드, SILENT 모드, 배터리 최적화 미예외, 앱 단위 네트워크 차단.
   - 현재 기기에서 불가: 폴더블 접힘 또는 접힘 유사 상태. `device_state`가 DEFAULT만 지원한다.
   - 다음 세션 경로: 실제 폴더블 기기 또는 local SDK의 foldable AVD profile(`pixel_fold`/`pixel_9_pro_fold` 등)로 접힘 상태를 만든 뒤 동일 matrix/smoke를 실행한다.
   - 남음: 폴더블 접힘 실제 기기 또는 foldable AVD 세션.

## 완료 판정 보류 사유

테스트와 빌드는 통과했고 channel disabled 세션까지 실제 검증했지만, `/goal`의 명시 요구사항인 "주위소리 듣기는 실제 아이 기기와 부모 기기 조합으로 상태별 확인" 중 폴더블 접힘 상태는 현재 연결 기기에서 지원되지 않으며 사용자가 다음 검증 세션으로 이월했다. 따라서 "검증되지 않은 항목이 남아 있으면 완료라고 말하지 않는다" 조건 때문에 아직 완료 처리하지 않는다.
