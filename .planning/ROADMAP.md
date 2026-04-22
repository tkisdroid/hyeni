# Roadmap: 혜니캘린더 v1.1 — Native Deploy & Polish

## Overview

v1.0에서 웹·서버 경로(28 REQ + SEC-01 핫픽스)를 프로덕션에 배포 완료. v1.1은 **Android 실기기에서 Phase 5 RL(주위소리듣기)가 실제 작동**하도록 APK 리빌드·Play 배포·live 검증을 완료하고, 몇 가지 서버측 폴리싱(GitHub Actions CI, PWA manifest, 멱등키 cron)을 추가한다. 3 phase, 6 REQ.

> v1.0 아카이브: `.planning/milestones/v1.0/ROADMAP.md`

## Phases

**Phase Numbering:**
- Integer phases (6, 7, 8): v1.1 신규 작업 (v1.0 이 1-5 사용)
- Decimal phases (X.Y): Reserved for urgent insertions via `/gsd-insert-phase`

- [ ] **Phase 5.5: Memo UX Cleanup** — legacy `public.memos` textarea 경로 제거 + X/Thread 스타일 말풍선 UI + MEMO-CLEANUP-01 조기 완료 (debug session kkuk-memo-send-noop 에서 확인된 수신측 ghost 렌더링 버그 수정)
- [ ] **Phase 6: Infrastructure & Polish** — GitHub Actions CI + PWA manifest + push_idempotency TTL cron (parallel ×3, 서버만)
- [ ] **Phase 7: Android Native Build & Submit** — APK 리빌드 + FGS · mic permission 핸들러 완성 + Play 내부 테스트 트랙 업로드 (solo, Android native)
- [ ] **Phase 8: End-to-End Verification** — 아이 단말 재설치 + remote_listen 라이브 검증 (solo, 사용자 참여 필요)

## Phase Details

### Phase 5.5: Memo UX Cleanup (INSERTED 2026-04-22)
**Goal**: Production 에서 재현되는 memo 수신측 "ghost typing cursor" 버그 제거 + X/Thread 스타일 말풍선 UI 승격 + MEMO-CLEANUP-01 조기 완료. v1.1 Phase 6 에 착수하기 전 선행.
**Depends on**: Nothing (debug session kkuk-memo-send-noop diagnosed)
**Requirements**: MEMO-FIX-01, MEMO-FIX-02, MEMO-FIX-03, MEMO-FIX-04, MEMO-FIX-05
**Success Criteria**:
  1. `grep -rn "upsertMemo" src/` = 0 호출처 (legacy write-path 제거).
  2. 두 기기 라이브 세션에서 메모 송수신 즉시 반영, ghost textarea 잔상 부재.
  3. X/Thread 벤치마크 수준 bubble UI (sender-right / receiver-left, timestamp, grouping, date separator, avatars/initials).
  4. `npm run test` + `npm run test:e2e` 전부 통과, `tests/e2e/memo-bubbles.spec.js` 신설.
  5. `/codex review` 가 최종 diff 에 pass 판정.
**Plans**: TBD
**Research required**: No (UI 레이어만, 기존 `memo_replies` 경로 재사용)
**Out of Scope**: ai-child-monitor 401, SOS/KKUK, 알림 경로

Plans:
- [ ] 5.5-01: TBD — UI-SPEC + legacy write-path 제거 + bubble UI 구현
- [ ] 5.5-02: TBD — regression test + codex review + deploy

### Phase 6: Infrastructure & Polish
**Goal**: Phase 7(Android 빌드)과 일반 운영을 위한 기반을 동시 해결. 세 스트림 disjoint, 전부 server-only, 병렬 가능.
**Depends on**: Nothing (v1.0 아카이브 + SEC-01 이미 live)
**Requirements**: CI-01, PWA-01, IDEMP-TTL-01
**Success Criteria**:
  1. `main` push 시 GitHub Actions 가 APK 아티팩트 빌드 성공 (`.github/workflows/android-apk.yml`), Actions Artifacts 에서 다운로드 가능 (CI-01).
  2. `curl -I https://hyenicalendar.com/manifest.json` 이 200 반환, 브라우저 콘솔 `Manifest fetch ... 403` 경고 소멸 (PWA-01).
  3. `public.push_idempotency` row 수가 24시간 이후 자동 감소. pg_cron `cleanup_idempotency` job 등록 확인 + 48h 이후 DB에서 0 row (IDEMP-TTL-01).
**Plans**: TBD
**Research required**: No (전부 표준 패턴 — GitHub Actions Android 빌드, Vercel rewrites, pg_cron)

Plans:
- [ ] 06-01: TBD — Stream A (CI-01)
- [ ] 06-02: TBD — Stream B (PWA-01)
- [ ] 06-03: TBD — Stream C (IDEMP-TTL-01)

### Phase 7: Android Native Build & Submit
**Goal**: Capacitor 8 기반 Android APK 를 v1.0 + SEC-01 최신 HEAD 로 리빌드 후 Play Console 내부 테스트 트랙 업로드. Phase 5 Stream B 에서 authored 됐지만 deploy 안 된 native 레이어(`AmbientListenService.java` FGS-microphone + WebView `onPermissionRequest` 수정)를 실기기에서 작동하도록 마무리.
**Depends on**: Phase 6 (CI-01 이 안정되면 빌드 iterate 빠름)
**Requirements**: NATIVE-01, NATIVE-02
**Success Criteria**:
  1. GitHub Actions 로 빌드된 `app-release.apk` (서명됨) 가 로컬 다운로드 가능하고 `aapt dump badging app-release.apk` 에서 `foregroundServiceType microphone` 포함 + `package: name='com.hyeni.calendar' versionCode=X` 신규 (NATIVE-01).
  2. `MainActivity.java` 의 `WebChromeClient.onPermissionRequest` 가 auto-grant 없이 runtime permission 체크 후 grant/deny 분기. deny 시 WebView 에 `mic-permission-denied` 이벤트 발송 (NATIVE-01).
  3. `App.jsx` 에 `window.addEventListener('mic-permission-denied', ...)` 핸들러가 아이 단말에서 토스트/모달로 재요청 UI 표시 (NATIVE-01).
  4. Google Play Console → Internal testing 에 AAB 업로드 완료, "Policy: Spyware/Stalkerware exception" family-app 카테고리 제출 copy 완성 (NATIVE-02).
  5. 최소 1명의 internal test tester (`energetk@naver.com` 또는 추가 계정) 초대 완료, 자동 설치 확인.
**Plans**: TBD
**Research required**: Yes — `/gsd-research-phase` for Capacitor 8 FGS-microphone patterns (Android 14 API 34 변경점) + Play Console 제출 가이드

Plans:
- [ ] 07-01: TBD — Native rebuild + WebView mic permission flow
- [ ] 07-02: TBD — AAB signing + Play Console upload + copy

### Phase 8: End-to-End Verification
**Goal**: 실제 아이 단말에 새 APK 설치 후 부모 → 아이 remote_listen 전체 흐름 live 검증. v1.0 에서 "human_needed" 로 분류된 항목 + v1.1 NATIVE-03 을 동시 해결.
**Depends on**: Phase 7
**Requirements**: NATIVE-03
**Success Criteria** (사용자가 실기기에서 관찰):
  1. 아이 단말에 새 APK 설치 + 로그인 성공 (realtime WebSocket 연결, `family_members` row 확인).
  2. 부모가 주위소리듣기 트리거 → 15초 이내 아이 단말 앱 깨어남 (백그라운드 → 포그라운드 또는 silent FCM via FGS).
  3. 아이 화면에 빨간 배너 `🎤 부모님이 주위 소리를 듣고 있어요` 표시 + Android persistent notification `주변 소리 연결 중`.
  4. getUserMedia 마이크 권한 프롬프트 → 허용 → `audio_chunk` broadcast 시작 → 부모 기기에서 실제 오디오 재생 (5+ 초 연속).
  5. 부모가 중단 버튼 누름 또는 타임아웃 → `remote_listen_sessions` 테이블에 `started_at, ended_at, duration_ms, end_reason='user_stopped'` 채워진 row 1개 존재.
  6. (선택) 마이크 거부 시: `mic-permission-denied` JS 이벤트 → UI 피드백 → 세션 `end_reason='permission_denied'` 기록.
  7. 세션 종료 후 아이 측 배너 + persistent notification 자동 소멸.
**Plans**: TBD
**Research required**: No (검증 단계, 기존 구현 확인용)

Plans:
- [ ] 08-01: TBD — live smoke + DB evidence capture

## Milestone Lifecycle

Phase 8 성공 = v1.1 완료 조건. 이후:
1. `/gsd-audit-milestone` 실행 → 11/11 REQ 검증 (5.5: MEMO-FIX-01..05 · 6: CI-01/PWA-01/IDEMP-TTL-01 · 7: NATIVE-01/02 · 8: NATIVE-03)
2. `/gsd-complete-milestone v1.1` → `.planning/milestones/v1.1/` 아카이브
3. v1.2 마일스톤 킥오프 제안 (OBS-01..03 + 선택적 UX-01..03 — MEMO-CLEANUP-01 은 Phase 5.5 에서 조기 완료)

## Progress

**Execution Order:** 5.5 → 6 → 7 → 8 (순차, Phase 6 만 내부 parallel). Phase 5.5 는 2026-04-22 긴급 삽입.

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 5.5. Memo UX Cleanup (INSERTED) | 2/2 | ✅ Verified (live smoke PASS) | 2026-04-22 |
| 6. Infrastructure & Polish | 0/3 | Ready to plan | - |
| 7. Android Native Build & Submit | 0/2 | Not started | - |
| 8. End-to-End Verification | 0/1 | Not started | - |

---

*Roadmap defined: 2026-04-22*
*v1.0 archive: `.planning/milestones/v1.0/`*
