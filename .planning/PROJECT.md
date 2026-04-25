# 혜니캘린더 — Native Deploy & Polish (v1.1)

## What This Is

혜니캘린더(hyenicalendar.com)는 카카오 OAuth로 로그인한 부모와 익명 페어링된 아이가 일정·메모·위치·SOS("꾹")·주위소리듣기를 주고받는 가족 안전 앱입니다. v1.0에서 28개의 웹·서버 측 REQ를 해결했고, v1.1은 **Android 실기기에서 Phase 5 RL 경로가 실제로 작동하도록** Android APK를 재빌드·배포하고 몇 가지 폴리싱(PWA 404 수정, 멱등 키 TTL cron)을 마무리합니다.

## Core Value

**아이 단말이 켜져 있지 않거나 앱이 닫힌 상태에서도 SOS("꾹")와 주위소리듣기 같은 안전 기능이 실제 작동한다.** v1.0은 서버 파이프라인을 live로 만들었지만 아이 기기가 아직 구 APK라 FCM 깨우기·네이티브 FGS·마이크 권한 흐름이 끊어져 있음. v1.1 이 이 갭을 닫는다.

## Requirements

### Validated (v1.0 + v1.1 shipped)

**v1.0 (28 REQ + SEC-01 핫픽스)** — `.planning/milestones/v1.0/` 아카이브 참고
- ✓ PUSH-01..04, RT-01..04, PAIR-01..04, RES-01..02, MEMO-01..03, GATE-01..02, RL-01..04, KKUK-01..03, SOS-01
- ✓ SEC-01 (재감사 중 발견 후 핫픽스) — push-notify sender∈family 검증

**v1.1 (8 REQ)** — Phase 5.5 + Phase 6, 2026-04-22 verified
- ✓ MEMO-FIX-01..05 — legacy `public.memos` textarea 경로 제거 + X/Thread 스타일 말풍선 UI (Phase 5.5)
- ✓ CI-01 — `.github/workflows/android-apk.yml` JDK 21 + Android SDK 36 + 서명 APK 8.97MB (Phase 6)
- ✓ PWA-01 — `hyenicalendar.com/manifest.json` HTTP 200 + `application/manifest+json` MIME (Phase 6)
- ✓ IDEMP-TTL-01 — `push_idempotency` 24h 리텐션 pg_cron `cleanup_push_idempotency` hourly (Phase 6)

### Deferred to v1.2+ (NATIVE-*)

v1.1 에서 hold 됨. v1.2 또는 v1.3 milestone 에서 재검토:
- **NATIVE-01** — Android APK 리빌드 + AmbientListenService FGS-microphone + MainActivity onPermissionRequest + JS `mic-permission-denied` 핸들러
- **NATIVE-02** — Google Play Console 내부 테스트 트랙 업로드 + Family-exception 정책 제출
- **NATIVE-03** — 아이 단말 재설치 + end-to-end remote_listen 라이브 검증

> Native 코드는 이미 Phase 5 Stream B 에서 commit 됨. 미진행 = keystore secrets 등록 + Play Console 제출 + 실기기 검증.

### Active (none)

v1.1 종료 (2026-04-25). 다음 milestone 킥오프 시 Active 섹션 갱신.

### Out of Scope (v1.2+ 이월)

- **OBS-01..03** — Sentry/Log Drain, push delivery dashboard, family activity metrics — 관측성 대형 작업, 별도 마일스톤
- **REFACTOR-01..02** — `src/App.jsx` 모듈 분해 + TypeScript 마이그레이션 — 2-3주 범위
- **MEMO-CLEANUP-01** — `memos` 테이블 DROP — v1.0 shadow 30일(2026-05-21) 이후 자동 트리거 가능. 일정 상 v1.2 에 포함
- **SUPA-MIG-01** — 미적용 migrations 000002..000005 behavior-change 검토 — premium gating 영향 분석 필요
- **UX-01..03** — Pair QR 재디자인, 역할 전환 UX, 좀비 row 자동 정리

## Context

**v1.0 성과 요약** (2026-04-21 하루 작업):
- Supabase DB: 7개 migration + 3 RPC + 3 RLS 정책 tightening 전부 live
- Edge Function `push-notify` v34 (ES256 + Idempotency + SEC-01 membership gate)
- Vercel 프론트엔드 `index-CIWSG6r3.js` 배포 (Phase 2-5 클라이언트 코드 12/12 시그니처)
- Git: 80+ 커밋 on origin/main, 태그 `v1.0` + `push-notify-baseline-20260421`
- 감사: `tech_debt` → `passed-with-v1.1-deferrals`

**v1.1 동기**:
- v1.0 재감사 중 확인: 아이 단말 구 APK (Phase 2-5 클라이언트 코드 없음) → FCM 깨우기·remote_listen 깨짐
- Core value (SOS 안전 기능) 실기기에서 동작 필수

**환경 결정**:
- 빌드: GitHub Actions CI (이 PC에 Android Studio 없음 — TK PC 의존 제거)
- DB: Supabase MCP apply_migration 직배포 유지 (v1.0 Phase 1 precedent)
- 웹: Vercel auto-deploy from main 유지
- Edge Function: `npx supabase functions deploy push-notify --no-verify-jwt` 유지

**v1.1 전제조건**:
- Supabase CLI 2.93.0 devDep 설치됨
- `.env.local` SUPABASE_ACCESS_TOKEN + SUPABASE_DB_PASSWORD
- `supabase link --project-ref qzrrscryacxhprnrtpjd` 완료
- `v1.0` + `push-notify-baseline-20260421` 태그 origin에

## Constraints

- **Tech stack 변경 없음**: React 19.2 + Vite 7 + Capacitor 8.2 + Supabase + Qonversion + Playwright
- **Live production data**: MCP 직배포 + paired down migration 유지
- **`src/App.jsx` decomposition**: 계속 금지 (v1.2+ REFACTOR-01 스코프)
- **VAPID 키 회전 금지**: v1.0 D-A03 유지 (기존 push_subscriptions 무효화 방지)
- **새 npm deps 최소화**: NATIVE-01 에서만 `@capacitor/permissions` 정도 허용
- **1회 APK 배포로 3 P0 REQ 전부 검증 가능**하도록: 아이 단말 재설치 부담 최소화
- **Android 최소 API 레벨**: Phase 5 Stream B에서 authored된 FGS-microphone (Android 14, API 34). 최소 API 24 유지하되 FGS 처리는 API ≥ 34 분기
- **Google Play 정책**: Family-exception 유지 (stalkerware 카테고리에 분류되지 않도록 persistent notification + non-stealth 인디케이터 명시)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| v1.1 스코프 = Lean (6 REQs) | 당장 실기기 작동 확보가 최우선. 관측성·리팩터는 별도 마일스톤 | — Pending |
| GitHub Actions CI로 빌드 | 이 PC에 Android Studio 없음 + 앞으로 매 PR마다 APK 자동 생성 | — Pending |
| Supabase MCP 직배포 유지 | v1.0에서 안정성 검증됨. $25/월 절약 | ✓ Good (v1.0 precedent) |
| NATIVE-01 은 CI-01 먼저 성공 후 실행 | CI workflow가 안정되면 NATIVE-01 iterate가 빠름 | — Pending |
| Play Store 내부 테스트 트랙 먼저 | 프로덕션 영향 없이 가족 구성원만 테스트 가능 | — Pending |
| `memos` DROP 은 v1.2로 연기 | v1.0 shadow 30일(2026-05-21) 미도래 | ✓ Good (Phase 4 D-01 준수) |

## Evolution

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions

**After v1.1 milestone** (via `/gsd-complete-milestone`):
1. 6개 Active REQ 전부 Validated 로 이동
2. v1.2 스코프 제안 (우선순위 점검)
3. `memos` DROP 트리거 일정 확인 (2026-05-21 이후)

---
*Last updated: 2026-04-25 after v1.1 1차 마무리 (NATIVE-* 이월)*
