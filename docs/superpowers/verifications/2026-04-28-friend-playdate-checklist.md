# Friend Playdate — Native Manual Verification Checklist (5 items)

> **Purpose**: Phase 7 verification gate. APK sideload 후 두 가족 실기기에서 5/5 통과해야 main promotion 가능.
>
> **Prerequisites**:
> - APK: PR #5 (`feat/friend-playdate`) APK CI artifact (run 25002581144)
> - 가족 2팀 (각각 부모 + 아이 단말) — 양쪽 모두 `families.playdate_enabled = true`
> - 같은 안전장소 (`saved_places.is_playdate_safe = true`) 같은 `public_place_id` 등록 (kakao_place_id 필수 — HIGH-1 fix 후)
> - 두 아이 모두 단말 GPS ON, 같은 장소 150m 이내
> - 양쪽 부모 단말 FCM 토큰 등록 확인 (`fcm_tokens` 테이블)
>
> **Pass criteria**: 5/5 ✅ + 영상/스크린샷 (PR #5 코멘트 첨부)

---

## 1. Foreground (1)

- [ ] **1.1** 부모 A 단말 앱 foreground 상태에서 아이 B (다른 가족)가 아이 모드에서 "친구랑 놀래요" → 친구 선택 → 시작
  - **기대**: 부모 A 단말에서 즉시 ActivePlaydateCard 표시 + heads-up 알림 ("친구놀이 시작" / 한강공원 — 지민와 함께)
  - **확인**: 알림 채널 = `hyeni_schedule_v5` (일정 채널 재사용, 신규 채널 0 — Spec FP-D14)

## 2. Background (1)

- [ ] **2.1** 부모 B 단말 앱 background 상태 (홈 버튼 눌러서 백그라운드) → playdate_started 푸시 도착
  - **기대**: 헤드업 알림 표시 → 알림 탭 시 MainActivity 진입 + ActivePlaydateCard 표시
  - **확인**: `MyFirebaseMessagingService.onMessageReceived` data-only payload 정상 dispatch (action=playdate_started)

## 3. 종료 + 도즈 (1)

- [ ] **3.1** 부모 A 단말 앱 종료 (강제 swipe-out) + 도즈 모드 진입 (15분 대기 또는 `adb shell dumpsys deviceidle force-idle`)
  - **기대**: 다른 부모/아이가 정지 또는 child_end → playdate_ended 푸시 정상 도착 ("친구놀이 종료" + "한강공원 친구놀이가 종료됐어요")
  - **확인**: stop_reason 한글 매핑 (`parent_end`/`child_end`/`auto_geofence_exit`)

## 4. 통화 deep link (1)

- [ ] **4.1** 부모 단말 ActivePlaydateCard에서 📞 010-XXXX-XXXX 버튼 탭
  - **기대**: 네이티브 dialer 열림 + 번호 자동 채워짐 (한 번 탭이면 통화 가능 상태)
  - **확인**: `tel:` href 디지트 sanitize 정상 (formatPhoneTel 함수)
  - **회귀 점검**: 두 번호(엄마 + 아빠) 모두 표시될 때 각각 독립 동작

## 5. Cron 자동 종료 (1)

- [ ] **5.1** 두 아이 단말 안전장소 떠나서 5분 대기 (또는 Supabase dashboard에서 `playdate_auto_end()` 함수 수동 호출)
  - **기대**: cron `playdate_auto_end` 실행 → 양쪽 부모 단말에 "친구놀이 종료" 푸시 (stop_reason='auto_geofence_exit')
  - **DB 확인**: `SELECT stop_reason FROM friend_playdate_sessions WHERE id = '<sess_id>'` → `auto_geofence_exit`

---

## 회귀 점검 (블로커 아님, 같이 검증 권장)

- [ ] **R.1** force_ring 알람 (긴급 채널) + playdate 알림 (일정 채널) 동시 도착 시 채널/우선순위 분리 정상 — 두 알림 별도 표시
- [ ] **R.2** 일반 일정 알림 + AmbientListenService + LocationService 모두 정상 작동 (회귀 0)
- [ ] **R.3** 카카오 장소 검색으로 등록 안 된 saved_place는 친구놀이 토글이 disabled + "카카오 장소 검색으로 등록된 곳만 지정 가능" 힌트 표시 (HIGH-1 fix 회귀)
- [ ] **R.4** 부모 단말 history에 child_a_id/child_b_id 등 타가족 UUID이 console / state inspector에 노출되지 않음 (HIGH-3 fix 회귀)

---

## 결과 보고

| Category | Pass | Total |
|---|---|---|
| Foreground | _/1 | 1 |
| Background | _/1 | 1 |
| 종료/도즈 | _/1 | 1 |
| 통화 link | _/1 | 1 |
| Cron 종료 | _/1 | 1 |
| **Total** | **_/5** | **5** |

회귀: _/4

**테스트 가족**:
- 가족 A: 부모 단말 ___________ / 아이 단말 ___________
- 가족 B: 부모 단말 ___________ / 아이 단말 ___________

**증거**: <영상/스크린샷 PR #5 코멘트 링크>

---

## 실패 시 디버깅 명령

```bash
# FCM 도착 여부 확인
adb logcat -s MyFirebaseMessagingService:V

# 알림 채널 등록 상태
adb shell dumpsys notification --noredact | grep -A5 hyeni

# Active session DB 확인 (Supabase SQL editor)
SELECT id, family_a_id, family_b_id, started_at, stopped_at, stop_reason
FROM friend_playdate_sessions
WHERE stopped_at IS NULL OR stopped_at > NOW() - INTERVAL '1 hour'
ORDER BY started_at DESC;

# Cron job 실행 확인
SELECT * FROM cron.job_run_details WHERE jobname = 'playdate_auto_end' ORDER BY start_time DESC LIMIT 5;
```

---

*체크리스트 생성: 2026-04-28*
*Plan: docs/superpowers/plans/2026-04-27-friend-playdate.md (Task 7.5)*
*Spec: docs/superpowers/specs/2026-04-27-friend-playdate-design.md*
