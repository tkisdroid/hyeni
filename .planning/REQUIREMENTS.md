# Requirements: 혜니캘린더 v1.1 — Native Deploy & Polish

**Defined:** 2026-04-22
**Core Value:** 아이 단말이 켜져 있지 않거나 앱이 닫힌 상태에서도 SOS·주위소리듣기가 실제 동작한다.

> v1.0 아카이브: `.planning/milestones/v1.0/REQUIREMENTS.md` (28 REQ 전부 closed, SEC-01 핫픽스 포함)

## v1.1 Requirements (6)

모든 REQ는 Playwright real-services 또는 Android 실기기 smoke 를 통해 검증. Supabase branch 미사용(MCP 직배포 유지).

### Android Native Deploy (P0 — v1.0 deferred)

- [ ] **NATIVE-01**: Android APK 리빌드로 Capacitor 8 `assets/public` 에 최신 `dist/` 번들 포함 + `AmbientListenService` FGS 서비스가 `foregroundServiceType="microphone"` 으로 작동 + `MainActivity.java` 의 WebView `onPermissionRequest` 가 auto-grant 제거 + JS 측에 `window.addEventListener('mic-permission-denied', ...)` 핸들러 존재해 아이 단말에 "마이크 권한이 필요해요" UI 표시.
- [ ] **NATIVE-02**: Google Play Console 내부 테스트 트랙에 APK 또는 AAB 업로드. Family-exception 카테고리 설명(`가족 안전 앱 — 부모-자녀 명시 동의 하에 주위 소리 듣기 기능 제공, persistent notification 표시`) 제출 양식 완료.
- [ ] **NATIVE-03**: 아이 단말(1대 이상) 재설치 후 end-to-end 라이브 검증:
  - [ ] 부모가 주위소리듣기 트리거 → `push-notify` 200 + 아이 단말 FCM 수신
  - [ ] 아이 단말 앱 깨어나기 (백그라운드→포그라운드 또는 native FGS 시작)
  - [ ] 아이 화면에 빨간 배너 `🎤 부모님이 주위 소리를 듣고 있어요`
  - [ ] Persistent 알림 `주변 소리 연결 중` 표시 (AmbientListenService)
  - [ ] `getUserMedia({audio:true})` 권한 프롬프트 후 스트림 캡처
  - [ ] `audio_chunk` broadcast → 부모 기기에서 실제 오디오 재생
  - [ ] `remote_listen_sessions` 테이블에 started_at + ended_at + duration_ms + end_reason 채워진 row 1개 생성

### Server & Infra Polish (P1)

- [ ] **CI-01**: `.github/workflows/android-apk.yml` 작성 — JDK 17 + Android SDK 34 + `npm ci` + `npm run build` + `npx cap sync android` + `./gradlew assembleRelease` + APK artifact 업로드. main push 트리거. 첫 run 5-10분, 이후 2-3분.
- [ ] **PWA-01**: `hyenicalendar.com/manifest.json` → HTTP 200 응답. Vercel output configuration 또는 `public/manifest.json` 위치 수정. 브라우저 콘솔 `Manifest fetch ... 403` 경고 소멸.
- [ ] **IDEMP-TTL-01**: `public.push_idempotency` 테이블에 24시간 이상 경과한 row 자동 삭제. 구현: (a) pg_cron extension + `cron.schedule('cleanup_idempotency', '0 * * * *', 'DELETE FROM push_idempotency WHERE created_at < now() - interval 24 hours')` — 매시간 실행. 또는 (b) Supabase Edge Function scheduled. (a) 권장.

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
| CI-01 | Phase 6 | Pending |
| PWA-01 | Phase 6 | Pending |
| IDEMP-TTL-01 | Phase 6 | Pending |
| NATIVE-01 | Phase 7 | Pending |
| NATIVE-02 | Phase 7 | Pending |
| NATIVE-03 | Phase 8 | Pending |

**Coverage:**
- v1.1 requirements: **6 total**
- Mapped to phases: 6
- Unmapped: 0

**Phase 번호 규약**: v1.0 이 1-5 사용. v1.1 은 6-8 이어감.

---
*Requirements defined: 2026-04-22*
*v1.0 archive: `.planning/milestones/v1.0/REQUIREMENTS.md`*
