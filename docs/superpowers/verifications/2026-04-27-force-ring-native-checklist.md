# Force Ring — Native Manual Verification Checklist (24 items)

> **Purpose**: Phase 6 verification gate. APK sideload 후 실기기에서 24/24 통과해야 Phase 7 production deploy 가능.
>
> **Prerequisites**:
> - APK: PR #3 CI artifact `hyeni-calendar-apk-1b1ac8e723c79e242d7ef58ce07d9ee16fbb3482` (14.0 MB)
> - 다운로드: `gh run download 24979158258 -D ./build-test/`
> - 부모 단말 1대 (web 또는 Android), 아이 단말 1대 (Android, 페어링 완료)
> - Supabase branch: `feat/force-ring` (마이그레이션 + Edge Function 배포 완료)
> - 가족: 실제 페어링된 family (부모 + 아이)
>
> **Spec reference**: `docs/superpowers/specs/2026-04-27-force-ring-design.md` §11.5
>
> **Pass criteria**: 모든 항목 ✅ + 영상/스크린샷 증거 첨부 권장

---

## 1. 사운드 우회 (4)

각 시나리오에서 부모가 force_ring 트리거 → 아이 단말이 풀볼륨 알람 + 진동 + 풀스크린 표시되는지 확인.

- [ ] **1.1** 무음 모드 (벨소리 OFF) — 알람 풀볼륨으로 울림
- [ ] **1.2** 방해금지 (DND) 일반 모드 — 알람 우회 + 풀볼륨
- [ ] **1.3** DND 우선순위 모드 (지정 연락처만 허용) — 우회되어 풀볼륨
- [ ] **1.4** 미디어 재생 중 (YouTube/음악) — 알람이 미디어 위로 풀볼륨 재생

**증거**: 각 모드의 알림 패널 + force_ring activity 스크린샷, 소리 측정 (선택)

---

## 2. 잠금 화면 (5)

- [ ] **2.1** PIN/패턴 잠금 없음 (Swipe만) — 풀스크린 즉시 표시 + 잠금 dismiss
- [ ] **2.2** PIN/패턴 잠금 있음 — 풀스크린 표시 + 메시지 카드 GONE (PII 보호)
- [ ] **2.3** Sensitive content 블러 (메시지 미표시) 검증 — 부모 메시지가 잠금 화면에 노출 안 됨
- [ ] **2.4** 다른 풀스크린 위 (예: 카메라 앱 실행 중) — force_ring 풀스크린이 위로 takeover
- [ ] **2.5** 화면 OFF 상태 (도즈 진입 직전) — `setTurnScreenOn(true)` 동작, 화면 켜지고 표시

---

## 3. 도즈/배터리 (3)

- [ ] **3.1** 도즈 모드 진입 후 (단말 1시간+ 미사용) → 트리거 → FCM HIGH priority + FGS specialUse로 우회 + 풀스크린
- [ ] **3.2** 배터리 절약 모드 ON → 트리거 → 알람 정상 (FOREGROUND_SERVICE_SPECIAL_USE는 절약 모드 영향 받지 않음)
- [ ] **3.3** "최근 미사용 자동 정리" 시스템 정책 적용된 단말 (Samsung/Xiaomi 사용자 정의) → force_ring 동작 확인 (필요 시 disclosure 추가)

---

## 4. 권한 거부 (3)

- [ ] **4.1** `POST_NOTIFICATIONS` 권한 거부됨 → 부모 단말 trigger → 서버는 성공 응답하지만 아이 단말 화면에 표시 안 됨 → 부모 측 "전달됨" 표시는 OK (FCM ack 받음). graceful degradation 확인.
- [ ] **4.2** `USE_FULL_SCREEN_INTENT` 권한 거부됨 (Android 14+ 사용자 명시 거부) → 풀스크린 안 떠도 알림은 IMPORTANCE_HIGH heads-up + 알람음으로 표시
- [ ] **4.3** 사용자가 force_ring_emergency 알림 채널을 끔 → 아이 단말에 표시 안 됨, 부모는 전달 실패 처리 안 됨 (FCM ack는 받음). 향후 v1.1 클라이언트 채널 상태 sync 후속 (FR-NEXT-05).

---

## 5. 동시성 (3)

- [ ] **5.1** 부모가 즉시 정지 ("그만 울릴께요") → 아이 단말에서 알람 즉시 중단 + "부모님이 알람을 종료했어요" Toast + 1.5초 후 finish
- [ ] **5.2** 14.9초 시점 아이 ack → 정지 + 부모 단말 "확인됨" Realtime 업데이트 + response time 14초 표시
- [ ] **5.3** 부모 trigger 후 즉시 두 번째 trigger 시도 → 423 `force_ring_already_active` + UI 차단 (서버 unique index 보장)

---

## 6. Android 버전 매트릭스 (4)

각 API 레벨에서 1번 풀스크린 + 1번 ack 확인.

- [ ] **6.1** API 24 (Android 7.0 Nougat) — minSdk fallback 동작 확인 (legacy notification + WAKE_LOCK)
- [ ] **6.2** API 28 (Android 9 Pie) — Notification Channel 정상, vibration 정상
- [ ] **6.3** API 33 (Android 13 Tiramisu) — POST_NOTIFICATIONS 런타임 권한 + RECEIVER_NOT_EXPORTED 분기 동작
- [ ] **6.4** API 34 (Android 14 UpsideDownCake) — `FOREGROUND_SERVICE_SPECIAL_USE` 타입 정상 (가장 중요한 케이스)

**참고**: 단말 부족 시 Android Studio 에뮬레이터로 보완 가능.

---

## 7. 종합 (2)

- [ ] **7.1** **15초 자동 종료**: trigger 후 ack/정지 없이 방치 → 정확히 15초에 service 자동 종료, audit `stop_reason='auto_timeout'` 기록 확인 (Supabase dashboard에서 `force_ring_events` 행 SELECT)
- [ ] **7.2** **Reminder 5분 (Phase 7 prerequisite)**: trigger 후 ack 없이 5분 대기 → reminder push 수신 → `reminder_sent_at` 컬럼 업데이트 (Phase 7 reminder cron 활성화 후 검증; pg_net + vault 필요)

---

## 회귀 점검 (Phase 1-5 산출물이 깨지지 않았는지)

- [ ] **R.1** 일반 push notification (일정 알림 등) 정상 동작 — `MyFirebaseMessagingService` 분기 추가가 기존 `request_location` / `request_device_status` 등을 깨지 않았는지
- [ ] **R.2** AmbientListenService (마이크 FGS) + LocationService (location FGS) 동시 + ForceRingService specialUse FGS 동시 실행 가능 (FGS 3종 공존)
- [ ] **R.3** 부모 web 앱 ForceRingPanel 렌더 + quota 표시 정상

---

## 결과 보고 형식

검증 완료 후 다음을 PR #3 코멘트로 작성:

```markdown
## Native Manual Verification Result

| Category | Pass | Total |
|---|---|---|
| 사운드 우회 | _/4 | 4 |
| 잠금 화면 | _/5 | 5 |
| 도즈/배터리 | _/3 | 3 |
| 권한 거부 | _/3 | 3 |
| 동시성 | _/3 | 3 |
| Android 버전 | _/4 | 4 |
| 종합 | _/2 | 2 |
| **Total** | **_/24** | **24** |

회귀 점검: _/3 통과

**테스트 단말**:
- 부모: <model + Android 버전>
- 아이: <model + Android 버전>

**증거**: <영상/스크린샷 첨부>

**Issues**: <발견된 문제 + GitHub issue 링크>
```

---

*체크리스트 생성: 2026-04-27 · Phase 6 verification gate*
