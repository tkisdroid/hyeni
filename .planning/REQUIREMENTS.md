# Requirements: 혜니캘린더 v1.1 — Native Deploy & Polish

**Defined:** 2026-04-22
**Core Value:** 아이 단말이 켜져 있지 않거나 앱이 닫힌 상태에서도 SOS·주위소리듣기가 실제 동작한다.

> v1.0 아카이브: `.planning/milestones/v1.0/REQUIREMENTS.md` (28 REQ 전부 closed, SEC-01 핫픽스 포함)

## v1.1 Requirements (Closed 2026-04-25)

v1.1 은 8 REQ 로 종료 (Phase 5.5 의 5개 + Phase 6 의 3개). Native deploy 작업 (NATIVE-01/02/03) 은 v1.2+ 로 이월.

### Phase 5.5: Memo UX Cleanup ✅

- [x] **MEMO-FIX-01..05**: legacy `public.memos` textarea 경로 제거 + X/Thread 스타일 말풍선 UI + ghost typing cursor 버그 제거 (2026-04-22 verified, 2-device live smoke PASS)

### Phase 6: Server & Infra Polish ✅

- [x] **CI-01**: `.github/workflows/android-apk.yml` — JDK 21 + Android SDK 36 + signed APK artifact 8.97MB. main push 트리거 자동. 5 iterative fixes 후 green at `df656b9` (2026-04-22 verified).
- [x] **PWA-01**: `hyenicalendar.com/manifest.json` → HTTP 200 + `application/manifest+json` MIME (2026-04-22 verified, Vercel rewrites 적용).
- [x] **IDEMP-TTL-01**: `public.push_idempotency` 24h 리텐션 cron (`cleanup_push_idempotency` job, hourly). Supabase MCP 적용 commit `4c62f53` (2026-04-22 verified).

### Deferred to v1.2+ (NATIVE-*)

다음은 v1.1 에서 hold 됨. v1.2 또는 v1.3 milestone 에서 재검토:

- **NATIVE-01**: Android APK 리빌드 + AmbientListenService FGS-microphone + MainActivity onPermissionRequest 수정 + JS `mic-permission-denied` 핸들러
- **NATIVE-02**: Google Play Console 내부 테스트 트랙 업로드 + Family-exception 정책 제출
- **NATIVE-03**: 아이 단말 재설치 + end-to-end remote_listen 라이브 검증

> Native 코드는 이미 Phase 5 Stream B 에서 commit 됨 (`android/app/src/main/java/com/hyeni/calendar/AmbientListenService.java`, `MainActivity.java`). 미진행 작업은 keystore secrets 등록 + Play Console 제출 + 실기기 검증.

## v1.2+ Backlog

### Observability

- **OBS-01**: Sentry 또는 Supabase Log Drain — Edge Function · 클라이언트 에러 telemetry
- **OBS-02**: 푸시 전달 성공률·평균 레이턴시 대시보드 (Realtime / FCM / Web Push)
- **OBS-03**: 가족별 활동 메트릭 (꾹 빈도, 메모 주고받음, 위치 업데이트)

### Code Hygiene

- **REFACTOR-01**: `src/App.jsx` 6877줄 모듈 분해
- **REFACTOR-02**: TypeScript 마이그레이션 로드맵

### Legacy Cleanup

- **MEMO-CLEANUP-01**: `public.memos` 테이블 DROP + 클라이언트 legacy 호출 제거 (2026-05-21 shadow 만료 이후)

### Schema Review

- **SUPA-MIG-01**: migrations 000002..000005 적용 검토 (academies active_slot, soft-lock triggers, premium-RLS tightening)

### UX Polish

- **UX-01**: Pair QR 재디자인 + 공유 링크 방식
- **UX-02**: 역할 전환 공식 UX (부모가 아이 계정 만들기)
- **UX-03**: 좀비 row 자동 정리 주기

## Out of Scope (v1.1)

| Feature | Reason |
|---------|--------|
| OBS-* | 별도 마일스톤 (v1.2) — scope 분리 |
| REFACTOR-* | 2-3주 대형 리팩터 — 별도 마일스톤 |
| `memos` DROP | 30일 shadow 미만료 |
| SUPA-MIG-01 검토 | behavior-change 리스크, 별도 discovery |
| iOS 빌드 | Android + 웹 우선 |
| 새 푸시 채널 (SMS·Kakao) | v2+ |
| AI 음성 파싱 개선 | 현행 유지 |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| MEMO-FIX-01..05 | Phase 5.5 | ✅ Complete (2026-04-22) |
| CI-01 | Phase 6 | ✅ Complete (2026-04-22) |
| PWA-01 | Phase 6 | ✅ Complete (2026-04-22) |
| IDEMP-TTL-01 | Phase 6 | ✅ Complete (2026-04-22) |
| NATIVE-01 | (deferred) | ⏸ v1.2+ |
| NATIVE-02 | (deferred) | ⏸ v1.2+ |
| NATIVE-03 | (deferred) | ⏸ v1.2+ |

**Coverage:**
- v1.1 closed requirements: **8** (Phase 5.5: MEMO-FIX-01..05 · Phase 6: CI-01/PWA-01/IDEMP-TTL-01)
- Deferred: 3 (NATIVE-01/02/03)

---
*Requirements defined: 2026-04-22*
*Closed: 2026-04-25 (v1.1 1차 마무리, NATIVE-* 이월)*
*v1.0 archive: `.planning/milestones/v1.0/REQUIREMENTS.md`*
