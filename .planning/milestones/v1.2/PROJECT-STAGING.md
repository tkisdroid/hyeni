# PROJECT.md Evolution Note (STAGING) — v1.2 "Sound Around & Consent Port"

> **STATUS: STAGING.** This is a single-section draft that will be merged
> into `.planning/PROJECT.md` at `/gsd-complete-milestone v1.1`, replacing
> the v1.1 "What This Is / Core Value / Requirements / Constraints / Key
> Decisions / Evolution" sections with their v1.2 equivalents (the v1.1
> text is archived to `.planning/milestones/v1.1/PROJECT.md` at the same
> moment).
>
> **Source plan (authoritative):** `C:/Users/A/.claude/plans/hyeni-modular-chipmunk.md`
>
> Do **not** edit the live `.planning/PROJECT.md` based on this file until
> v1.1 is complete. This is a pre-written delta.

---

## What This Is (v1.2 replacement)

혜니캘린더(hyenicalendar.com)는 카카오 OAuth로 로그인한 부모와 익명
페어링된 아이가 일정·메모·위치·SOS("꾹" — *v1.4+ 개선 예정*)·주위소리듣기를
주고받는 가족 안전 앱. v1.0 (28 REQ) 에서 웹·서버 경로를, v1.1 (11 REQ) 에서
Android 네이티브 쉘(APK CI, FGS-microphone, WebView 마이크 권한 게이트, FCM
데이터 깨우기, Play 내부 트랙 제출)을 프로덕션에 deliver. v1.2 는 **실기기에서
주위소리듣기(Ambient Listen / Remote Listen) 가 실제로 작동하도록 전송 계층을
WebRTC 로 교체하고, PIPA + Play family-exception 기준의 동의 프레임워크를
신설하며, 레거시 broadcast 오디오 경로를 제거**한다.

v1.2 총 **5 phase (Phase 9–13), 14 REQ**. v1.1 의 6-8 번호를 이어받는다.

## Core Value (v1.2)

**"아이 단말에서 주위 소리를 안전하게, 안정적으로, 합법적으로 부모가 들을
수 있다."**

v1.1 에서 "켜져 있지 않거나 앱이 닫힌 상태에서도 깨우기·FGS·마이크 권한은
작동한다" 까지 해결됨. v1.2 는 그 위에 얹히는 전송 계층·UX·법적 프레임워크를
완결해, 실기기 two-device 세션이 **30초 이상 오디오 끊김 없이 10회 연속
성공** 하고, **동의 없는 세션은 DB 레벨에서 거부**되며, **세션 중 아이 단말은
빨간 배너 + persistent notification 으로 반드시 노출** 되는 상태를 만든다.

경쟁 앱(FindMyKids) 대비 **더 안전(동의 + 감사)**, **더 원활(WebRTC 직접
피어)**, **더 직관적(명시적 인디케이터)** 이 v1.2 의 UX 목표.

## Requirements (v1.2)

### Validated (at v1.1 close)

- ✓ v1.0 전체 (28 REQ) — `.planning/milestones/v1.0/` 아카이브
- ✓ v1.1 전체 (11 REQ) — `.planning/milestones/v1.1/` 아카이브 (예정, v1.1
  complete 시)
- ✓ SEC-01 (v1.0 재감사 핫픽스) — push-notify sender ∈ family

### Active (v1.2)

**Phase 9 — Signaling Schema & Consent Foundations (parallel ×3, server-only):**

- [ ] **SIG-01** — `webrtc_signaling` 테이블 + family-scoped RLS +
  `(session_id, msg_id)` UNIQUE + Realtime publication + TTL cleanup cron
- [ ] **CONSENT-01** — `family_agreements` 테이블 + RLS + 세션 시작 전
  active-agreement 필수 가드 (trigger or RPC)
- [ ] **FLAG-01** — `feature_flags.remote_listen_v2_enabled` 점진 롤아웃
  게이트, 배포 시 OFF, 수동 검증 후 ON

**Phase 10 — WebRTC Audio Pipeline (solo · sequential):**

- [ ] **RTC-01** — `src/lib/audio/parentPeer.js` (부모 수신 + ICE 헬스체크)
- [ ] **RTC-02** — `src/lib/audio/childPeer.js` (아이 송신 + JS close
  finalizer)
- [ ] **RTC-03** — `src/lib/audio/signaling.js` (broadcast + DB 백업 하이브리드
  + `msg_id` ACK + 3초 재전송)
- [ ] **RTC-04** — `supabase/functions/issue-turn-credential/index.ts` (TURN
  단기 자격, STUN + TURN 필수)

**Phase 11 — Capacitor Bridge · Consent UX · Legacy Kill (parallel ×3):**

- [ ] **BRIDGE-01** — `AmbientListenPlugin.java` (Capacitor plugin, FGS
  1-session-only guard, JS close 자동 finalizer)
- [ ] **CONSENT-02** — 페어링 직후 full-screen `AgreementModal.jsx` +
  `family_agreements` row + sha256 서명
- [ ] **CONSENT-03** — 아이측 `ChildSessionBanner.jsx` + vibrate +
  `AmbientListenService` persistent notification 동시 게시
- [ ] **LEGACY-KILL-01** — `remote_listen_start/stop/audio_chunk` broadcast
  핸들러 제거 (`src/App.jsx`, `src/lib/sync.js`, `supabase/functions/push-notify/index.ts`).
  `remote_listen_sessions` audit + kill switch 유지

**Phase 12 — APK Rebuild & Play Replacement Submission (solo):**

- [ ] **APK-01** — v1.1 Phase 6 `android-apk.yml` 무변경 재사용으로 서명 AAB
  재빌드, `foregroundServiceType microphone` 확인
- [ ] **APK-02** — Play Console 내부 트랙 업로드, family-exception 카피에
  "WebRTC direct-peer audio, no third-party storage" 추가

**Phase 13 — Two-Device E2E Verification (solo · user-in-loop):**

- [ ] **E2E-01** — 실기기 2대, 30초+ 오디오 끊김 없음 × **10회 연속** PASS
- [ ] **E2E-02** — 4가지 경계 케이스 **4/4 필수** (mic 거부 / 네트워크 끊김 /
  앱 kill wake / 동의 없는 start 차단)

### Out of Scope (v1.3+ 이월)

- **SOS 포트 (FindMyKids SosActivity 이식, `sos_events`, DND-bypass 채널)** —
  **v1.3 "SOS Hardening" 신규 마일스톤** 에서 별도 진행. v1.2 는 SOS 를
  일절 건드리지 않는다. KKUK ≠ SOS 이므로 KKUK 도 동일하게 손대지 않음.
- **KKUK (꾹) affection-tap UX 개선** — v1.4+ 별도 일정.
- **우리아이 카드 → 아이 위치 지도 zoom-in** — 기본 배정 v1.3. v1.2 에서는
  Phase 11 UI 폴리시 예산이 남고 consent/banner 스코프를 침범하지 않을
  때에만 편입. `/gsd-ui-phase 11` 에서 명시적 in/out 판정 기록 필수.
- **`src/App.jsx` decomposition + TypeScript** — 계속 금지 (v1.2 전체
  milestone 스코프 밖, CLAUDE.md 규칙 유지).
- **관측성 (OBS-01..03: Sentry/Log Drain, push delivery dashboard, activity
  metrics)** — 별도 마일스톤.
- **Supabase migration 000002..000005 (미적용 premium gating 영향 분석)** —
  별도 마일스톤.
- **UX-01..03 (Pair QR 재디자인, 역할 전환 UX, 좀비 row 자동 정리)** —
  별도 마일스톤.

## Context (v1.2 entry state)

**v1.1 성과 요약** (v1.1 complete 시점에 기록될 예정):
- Android APK CI 가동, 서명 AAB Play 내부 트랙 배포
- AmbientListenService (FGS-microphone), WebChromeClient 권한 게이트,
  MyFirebaseMessagingService FCM 깨우기 전부 실기기 검증
- PWA manifest 200, push_idempotency 24h TTL cron, Memo UX X/Thread 말풍선
- v1.1 E2E 는 **의도적으로 오디오 흐름 제외** (Success Criteria 축소) —
  v1.2 Phase 13 에서 오디오 흐름 full E2E

**v1.2 진입 환경:**
- v1.1 인프라(FGS, 권한 게이트, FCM 깨우기, APK CI, Play 트랙) 전부
  재사용, 전송 방식과 무관한 기반.
- v1.2 실패 원인 분석 (2026-04-22) 에서 **단일 하위 계층이 아닌 네 곳 중첩**
  으로 확정:
  1. 전송 계층 (Supabase broadcast 오디오 chunk) → WebRTC 로 교체 (Phase 10)
  2. getUserMedia 브리지 → Capacitor 플러그인 + finalizer (BRIDGE-01)
  3. 동의/법적 프레임워크 완전 부재 → `family_agreements` + 모달 + 서명
     (Phase 9, Phase 11)
  4. 부모 권한 모델 미형식화 → 세션 가드 + flag + legacy kill (Phase 9,
     Phase 11)
- 사용자 2026-04-22 결정: **안정적 작동 최우선** — Phase 기본값을 "simple"
  에서 "robust" 로 고정 (Stability-First Decisions 7개, ROADMAP-STAGING.md
  참고).

## Constraints (v1.2 — 대부분 v1.1 상속)

- **Tech stack 변경 없음:** React 19.2 · Vite 7 · Capacitor 8.2 · Supabase ·
  Qonversion · Playwright · Deno 2 · `@supabase/supabase-js@2.99.1`.
- **새 npm dep 0개.** WebRTC = 브라우저 빌트인. Supabase JS 기존 버전 유지.
  TypeScript 미도입.
- **`src/App.jsx` decomposition 금지.** v1.2 의 교체는 **최소 라인 범위
  치환만** 허용 — 지정된 라인 범위:
  - `src/App.jsx:159, 319-361, 2502-2509, 3988, 4750-4810`
  - `src/lib/sync.js:561, 700-707`
  - `supabase/functions/push-notify/index.ts:175-189, 313, 405-406`
  - `android/.../MainActivity.java:33`
- **VAPID 키 회전 금지** (v1.0 D-A03 유지).
- **Supabase MCP 직배포 유지** (CONSENT-01, SIG-01, FLAG-01 migration).
- **Google Play 정책:** family-exception + stalkerware 경계. AmbientListenService
  persistent notification + non-stealth 빨간 배너 + 동의 프레임워크 신설로
  보강.
- **PIPA <14:** `family_agreements.legal_rep_user_id` 필수 +
  `agreement_version` + `signature_sha256`.
- **SEC-01 유지:** push-notify sender ∈ family membership gate, Phase 11
  회귀 체크.
- **Supabase Realtime 7-sub-per-table 제약:** per-session 시그널링 채널은
  기존 family 채널과 별개, 한도 내.
- **TURN 비밀번호 하드코드 금지:** edge function 이 1시간 단기 자격만 발급.
- **Codex review 게이트:** 매 phase 완료 및 `src/lib/audio/**`,
  `supabase/migrations/**`, `supabase/functions/**`, `android/**` 관련 커밋
  시 `/codex review` PASS 필수. Model = config default `gpt-5.4`
  (feedback\_codex\_model).
- **Phase 9 (스키마) · Phase 11 (법적 문구) discuss 는 `--auto` 금지.**
  사용자 확인 필수.

## Key Decisions (v1.2, LOCKED 2026-04-22)

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| v1.1 종료 후 **신규 v1.2 마일스톤 신설** (v1.1 내부 확장 아님) | v1.1 Phase 8 E2E 를 오디오 제외로 축소 합의했고, 전송 교체·동의·레거시 제거가 독립 deliverable 가치 | — Pending (staging) |
| **WebRTC peer-to-peer + Supabase Realtime broadcast 시그널링 + 기존 FCM 깨우기** | 오디오 chunk broadcast 는 저지연에 부적합. 시그널링은 세션당 <20 메시지로 broadcast 한도 내. 신규 Firebase 제품 / npm dep 도입 불필요 | — Pending |
| **Legacy broadcast 오디오 경로 즉시 교체** (병행 기간 없음) | 이중 운영 리스크 + 진단 혼선 회피. `remote_listen_sessions` audit row 와 v1.0 kill switch 는 유지 | — Pending |
| **동의 범위 = 페어링 일회 동의서 + 아이측 세션 시각 알림** | PIPA + Play family-exception 충족 최소한 + 경쟁앱보다 투명 | — Pending |
| **Stability-First over Simplicity** (7개 결정 LOCKED) | 사용자 "안정적 작동 최우선" 명시. table-backed signaling, TURN 선제 포함, ACK/재전송, 5s grace, FGS finalizer, E2E-02 DoD 필수, feature flag 점진 롤아웃 | — Pending |
| **SOS 는 v1.3 별도 마일스톤** (v1.2 와 분리) | v1.2 안정성 담보에 집중. SOS 는 findmykids SosActivity 수준의 별도 스코프 | — Pending (future) |
| **KKUK vs SOS 코드 통합 금지** | 정서 기능 ≠ 위급 기능. 버튼·채널·audit·UI 전부 분리 유지 | ✓ Policy (carried forward) |
| **Child 카드 → 위치 지도 zoom-in 기본 배정 v1.3** | v1.2 Phase 11 예산이 허용하고 consent 스코프를 침범하지 않을 때만 편입 가능. UI-SPEC 에서 explicit in/out 판정 | — Pending (open question) |
| **App.jsx decomposition 계속 금지** (v1.2 범위 밖) | 6877-line 모놀리스 리팩터는 별도 마일스톤. v1.2 는 지정 라인 치환만 | ✓ Policy |
| **Codex review per phase + 민감 커밋** (`gpt-5.4` config default) | 라이브 프로덕션 + stalkerware 경계 기능의 안전장치 | ✓ Policy |

## Evolution

**After each phase transition** (via `/gsd-transition`):

1. Requirement invalidated? → Out of Scope with reason
2. Requirement validated? → Validated with phase reference
3. New requirement emerged? → Add to Active (respect 14-REQ boundary; beyond
   = defer to v1.3+)
4. Decision to log? → Add to Key Decisions
5. **Codex review PASS recorded** in phase SUMMARY/REVIEW; no phase advance
   without it

**After v1.2 milestone** (via `/gsd-complete-milestone v1.2`):

1. 14 Active REQ 전부 Validated 로 이동
2. v1.3 "SOS Hardening" 마일스톤 kickoff 제안
   (`project_findmykids_sos_port_scope`):
   - `SosOverlayActivity` (부모 잠금화면 위 full-screen 경보)
   - SOS 트리거 시 `getCurrentPosition` + `sos_events.payload.location`
   - DND-bypass NotificationChannel
   - 아이측 SOS 전용 큰 빨간 버튼 (KKUK 와 시각적 명확 분리)
3. v1.3 에 "우리아이 카드 → 위치 지도 zoom-in" 편입 여부 결정
   (`project_child_location_zoom_on_card_click`) — v1.2 Phase 11 에서
   처리되지 않았다면 v1.3 첫 배정.
4. `memos` DROP 트리거 일정 확인 (v1.0 shadow 30일, 2026-05-21 이후 —
   v1.2 완료 시점과 맞물릴 가능성; v1.3 에 MEMO-CLEANUP-01-STYLE DROP task
   편입 검토).
5. v1.4+ 로 밀린 항목: KKUK UX 개선, OBS-01..03 관측성, UX-01..03,
   App.jsx decomposition.

---

*Staging draft: 2026-04-22. Source: `C:/Users/A/.claude/plans/hyeni-modular-chipmunk.md`. Merge into `.planning/PROJECT.md` on `/gsd-complete-milestone v1.1`.*
