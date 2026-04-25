# Roadmap: 혜니캘린더 v1.1 — Native Deploy & Polish (CLOSED 2026-04-25)

## Overview

v1.0에서 웹·서버 경로(28 REQ + SEC-01 핫픽스)를 프로덕션에 배포 완료. v1.1은 **메모 UX 정리(Phase 5.5)** 와 **서버·인프라 폴리싱(Phase 6)** 으로 1차 마무리. Android native deploy(NATIVE-01/02/03) 는 진행 안 함 — 별도 milestone (v1.2 또는 v1.3) 으로 이월. 2 phase, 8 REQ closed (5.5: MEMO-FIX-01..05, 6: CI-01/PWA-01/IDEMP-TTL-01).

> v1.0 아카이브: `.planning/milestones/v1.0/ROADMAP.md`
> v1.1 종료 결정 (2026-04-25): Native deploy 작업 hold, 앱 현재 상태(웹 + CI 인프라)로 1차 마무리.

## Phases

- [x] **Phase 5.5: Memo UX Cleanup** ✅ — legacy `public.memos` textarea 경로 제거 + X/Thread 스타일 말풍선 UI + MEMO-CLEANUP-01 조기 완료 (2026-04-22 verified)
- [x] **Phase 6: Infrastructure & Polish** ✅ — GitHub Actions CI + PWA manifest + push_idempotency TTL cron (2026-04-22 verified)

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

## Deferred to v1.2+

다음 작업은 v1.1 에서 hold 됨 — v1.2 또는 v1.3 milestone 에서 재검토:

- **NATIVE-01/02/03** (Android APK 리빌드 + Play Console 내부 테스트 + live verification) — Phase 5 Stream B 에서 authored 된 native 레이어(`AmbientListenService.java` FGS-microphone + `MainActivity.java` `onPermissionRequest`) 는 코드 commit 됨. 단, GitHub Actions keystore secrets 등록 + Play Console 제출 + 아이 단말 재설치 검증은 미진행.
- 이전 작업 자료: `.planning/milestones/v1.0/phases/` 의 Phase 5 Stream B SUMMARY 참고. Play Console disclosure draft 는 git history 의 `07-android-native-build-submit/07-PLAY-CONSOLE-CHECKLIST.md` 에서 복원 가능.

## Milestone Lifecycle

v1.1 종료 (2026-04-25) — 8 REQ closed (Phase 5.5 + Phase 6). Native deploy 작업 (NATIVE-01/02/03) hold.

이후:
1. v1.2 milestone 킥오프 시 NATIVE-* 재포함 여부 결정
2. v1.2 staging 자료: `.planning/milestones/v1.2/` (PROJECT/REQUIREMENTS/ROADMAP-STAGING.md)

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 5.5. Memo UX Cleanup (INSERTED) | 2/2 | ✅ Verified (live smoke PASS) | 2026-04-22 |
| 6. Infrastructure & Polish | 3/3 | ✅ Verified (CI green + manifest 200 + cron active) | 2026-04-22 |

---

*Roadmap defined: 2026-04-22*
*Roadmap closed: 2026-04-25 (v1.1 1차 마무리, NATIVE-* 이월)*
*v1.0 archive: `.planning/milestones/v1.0/`*
