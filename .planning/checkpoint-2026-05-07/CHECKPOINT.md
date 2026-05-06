# Checkpoint — testplan2.md 1차 진행 (2026-05-07)

## 환경 실측

| 기기 | 상태 | 모델 | 비고 |
|------|------|------|------|
| ZY22H9VTQD | ✅ device | motorola_razr_40_ultra | testplan 의 "Galaxy 부모" 자리에 임시 사용 |
| emulator-5554 | ✅ device | sdk_gphone64_x86_64 | 시각 검증 + 스크린샷용 |
| R5CY521CFNZ (Galaxy) | ❌ offline | — | **Phase 3 Case 2 검증 차단** |

## 완료한 항목

### Phase 0-A — Power-off resilience ✅
- `LocationService.uploadLocation()` 성공 시 `last_uploaded_lat/lng/at_ms` 를 SharedPreferences `hyeni_location_prefs` 에 영속화 (LocationService.java:690~)
- 신규 `ShutdownReceiver.java` — `ACTION_SHUTDOWN` + `QUICKBOOT_POWEROFF` 수신 시 마지막 좌표를 `is_final_before_shutdown=true` 로 동기 POST (2s timeout, fire-and-forget)
- AndroidManifest.xml 에 `<receiver android:name=".ShutdownReceiver" priority=1000>` 등록
- 빌드 성공, 회귀 0건

기존 코드 베이스라인 (이번 세션 외 검증):
- 5% 임계 저배터리 60s 폴링 + 강제 location 저장 (LocationService:340~)
- BootReceiver 가 `BOOT_COMPLETED`/`LOCKED_BOOT_COMPLETED`/`MY_PACKAGE_REPLACED` 등 6종 인텐트로 자동 재시작

### Phase 1-A/B/C — Visual integrity baseline ✅
- App.css 에 글로벌 button 시각 무결성 룰 추가:
  - 최소 36px touch target (이미 더 큰 min-height 가진 버튼은 그대로)
  - inline-flex + align/justify center
  - whiteSpace nowrap + ellipsis (잘림 방지)
  - 카드 내부는 wrap 허용 (`.card *`, `[class*="hyeni-v5-event-card"] *`)
  - 4종 컴포넌트 사이즈 자체 관리: `.hyeni-v5-calendar-day`, `.avatar-stepper-slot`, `.hyeni-time-slot`, `.plan-card`
- `viewport-fit=cover` + `env(safe-area-inset-*)` 가 주요 시트/탭바/홈 shell 에 이미 반영 — Razr 폴딩 + 노치 처리 OK

### Final 검증 (단일 기기) ✅ 부분
- React/Vite build 성공 (`dist/index.js 1MB / gzip 302kB`)
- `npx cap copy android` → APK 빌드 → ZY22H9VTQD + emulator 둘 다 설치 성공
- App 자체 logcat: **에러 0, 경고 1**
  - `W/LocationService: Location history RPC failed: 404` ← migration `20260506020000_record_location_history_rows_rpc.sql` 미적용 운영자 작업 대기
- 시스템 noise (`E/LocSvc_*`, `W/AlarmManager`) 는 Qualcomm GNSS 칩셋에서 발신, 우리 앱 무관
- Emulator 첫 화면 (RoleSetupModal) 시각 결함 0건 — 카드 padding/정렬/타이포/곡률 모두 합격
  → `screenshots/cp1-emu.png` 보관

### 회귀 ✅
- 99 files / 655 tests **all pass**
- ESLint/build 경고 없음

## 차단된 항목 (사용자 행동 필요)

### Galaxy 단말 미연결 — 차단되는 testplan 항목
- **Phase 3 Case 2** 다자녀 환경 격리 검증 (부모2/아이2 동시 운영) — 실물 기기 2대 필수
- **Phase 2 E2E 양쪽 흐름** (부모 가입 + 자녀 페어링) — 페어링 코드 발급/입력 동시성

→ 사용자: Galaxy R5CY521CFNZ USB 재연결 + adb authorization 필요.

### 운영자 행동 필요 — testplan 외 항목
- `supabase db push` 적용:
  - `20260506000000_push_notify_cron_schedule.sql`
  - `20260506010000_family_members_fm_upd_policy.sql`
  - `20260506020000_record_location_history_rows_rpc.sql` ← **404 경고 원인**
- Naver OAuth secrets: `supabase secrets set NAVER_CLIENT_ID/SECRET` + `supabase functions deploy naver-auth`
- Google OAuth: GCP 콘솔 + Supabase dashboard 설정

### 사용자 잠금 해제 필요 — Razr UI tour
- 잠금 화면 PIN/패턴이 있어 자동 ADB 만으로는 실기기에서 풀 UI tour 불가능
- Emulator 로 Phase 1 시각 audit 진행 가능 (이미 첫 화면 합격)

## 미완료 — 차단되지 않은 항목

| Phase | 상태 | 이유 |
|-------|------|------|
| Phase 0-B (Boot resume) | 코드 검토 OK, 실기 재부팅 검증 미실행 | Razr 재부팅 + 자동 복귀 측정 필요 |
| Phase 0-C (Play Store policy) | 부분 — 권한·고지 텍스트 점검 미실시 | UI 화면 text 감사 필요 |
| Phase 2 (Onboarding flow) | 미실행 | 잠금 해제된 실기기에서 시나리오 통과 영상/로그 필요 |
| Phase 4 (Monetization/Skeleton) | 미실행 | 페이지 전환 micro-interaction 코드 추가 작업 |

## 현재 커밋 후보

```
android/app/src/main/AndroidManifest.xml      | +12  ← ShutdownReceiver 등록
android/app/src/main/java/.../LocationService.java | +11  ← 마지막 좌표 영속화
android/app/src/main/java/.../ShutdownReceiver.java | +103 (NEW)
src/App.css                                   | +20  ← 버튼 시각 무결성 baseline
.planning/checkpoint-2026-05-07/CHECKPOINT.md | +N (NEW)
.planning/checkpoint-2026-05-07/screenshots/  | +3 PNG
```

## 권장 다음 체크포인트

A. Galaxy 연결 확정 후 Phase 2 + 3 (E2E + Case 2 격리 — 실기 2대)
B. 또는 Phase 4 (Monetization/Skeleton UI) 코드만 — 단일기기 가능
C. 또는 Phase 0-C (Play Store policy 텍스트 감사) — 코드 only

사용자 지시 대기.
