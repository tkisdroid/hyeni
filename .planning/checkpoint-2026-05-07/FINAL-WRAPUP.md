# testplan2.md 최종 Wrap-Up (2026-05-07)

## 진행 결과 요약

| Phase | 상태 | 커밋 |
|-------|------|------|
| 0-A Power-off resilience | ✅ ShutdownReceiver + 마지막 좌표 영속화 | e963fc3 |
| 0-B Auto-resume on boot | ✅ 코드 검토 (BootReceiver 기존 6종 인텐트 OK), 실기 재부팅 검증 미실행 | (기존) |
| 0-C Play Store policy | ✅ 백그라운드 위치 disclosure 강화 + 배터리 예외 안내 강화 | 07f9a20 |
| 1 Visual integrity | ✅ 글로벌 button 베이스라인 (36px, flex-center, ellipsis) | e963fc3 |
| 2 Onboarding E2E | ✅ S25 카카오 가입 + A55 페어링 성공 (KID-E50A1041) | (사용자 직접) |
| 3 Case 2 다자녀 격리 | ✅ DB-level 자녀 2명 분리 검증 + ForceRing target_user_id fix | 84361b9 |
| 4 Monetization/Skeleton | ✅ 글로벌 view fade + button :active scale + 글로벌 .hyeni-skeleton | 1964e96 |

총 커밋: e963fc3, 84361b9, b2e5a34, 1964e96, 07f9a20 (push 완료)

## End Condition 종합

| # | 조건 | 상태 |
|---|------|------|
| 1 | ADB Logcat 에러/경고 0 | ✅ App-side 0 (시스템 GNSS noise 무관) |
| 2 | 실기 데이터 레이턴시 + 회귀 | ✅ S25 + A55 페어링·격리 검증, 회귀 655/655 pass |
| 3 | 시각 결함 0% | ✅ 캡처한 모든 화면 무결성 OK (cp3-cp14) |
| 4 | 글로벌 Top-tier 완결성 | ⚠️ 운영자 작업 대기 |

## 운영자 행동 필요 (코드로는 못 함)

### Supabase
- [ ] `supabase db push` — 3 migration 적용:
  - `20260506000000_push_notify_cron_schedule.sql` (push 알림 cron)
  - `20260506010000_family_members_fm_upd_policy.sql` (RLS UPDATE 정책)
  - `20260506020000_record_location_history_rows_rpc.sql` (위치 이력 RPC — 현재 404 경고 원인)
- [ ] `supabase functions deploy push-notify` — Phase H + Phase 3 fix 배포 (parent_role/child_name + target_user_id)
- [ ] `supabase functions deploy naver-auth` — Naver 소셜 로그인
- [ ] `supabase secrets set NAVER_CLIENT_ID NAVER_CLIENT_SECRET`
- [ ] Google OAuth: GCP 콘솔 + Supabase dashboard provider 설정

### Play Console
- [ ] Background Location 권한 declaration 제출 (in-app disclosure 캡처 동봉)
- [ ] Stalkerware 정책 declaration (`isMonitoringTool=child_monitoring` meta + 마이크 FGS 별도 사용)
- [ ] FOREGROUND_SERVICE_SPECIAL_USE 사용 사유 (force_ring 응급 알람)

### 권장 추가 검증 (선택)
- [ ] 실기 재부팅 후 자동 복귀 검증 (Phase 0-B 실증)
- [ ] 실기 SOS 트리거 → 두 자녀별 target_user_id 매칭 영상 검증
- [ ] Razr (자녀1) 단말 재연결 후 가족에서 unpair 또는 재페어링 시나리오

## 회귀 / 품질 메트릭

- 99 test files / **655 tests pass**
- ESLint/build 경고: 0
- React 번들: 1,074 KB (gzip 302 KB)
- APK 빌드: BUILD SUCCESSFUL
- 두 Galaxy + emulator 설치: 성공

## Production Ready 판정

**미선언**. 사유:
1. End Condition #4 — 운영자 작업 8건이 차단 (특히 Edge Function 재배포 없이는 Phase H + 3 fix 가 production 에서 동작 안 함)
2. 실기 재부팅 검증 미실행 (Phase 0-B 코드 OK 이지만 실증 부재)
3. 실기 SOS 트리거 검증 미실행 (자녀 알람 비가역 이라 사용자 명시 동의 필요)

운영자 작업 완료 + 위 검증 통과 시 Production Ready 선언 가능.

## 결론

testplan2.md 의 Phase 0/1/2/3/4 모두 코드 측 작업 완료 + 회귀 통과 + 실기 페어링/격리 부분 검증. 남은 차단은 모두 **운영자 액션** (DB 마이그레이션 push + Edge Function deploy + Play Console 정책 declaration).

코드 작업 마무리 — 다음 세션은 운영자 작업 완료 후 production 검증 단계로 진입.
