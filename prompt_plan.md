# 구현 계획: 아이 모드 설정 — 변경 요청 모델

> 작성: 2026-05-18 · 상태: 완료 (2026-05-18, 커밋 7e520e9~65cffce) · 결정: 전부 요청 전용(이름만 직접 변경) / 푸시 + 알림센터 기록(승인·자동적용 없음)

## 목표

자녀 설정 화면의 "부모님께 변경 요청" 버그(가짜 토스트)를 고치고 권한 모델을 재설계한다.
- **이름(별명)**: 자녀가 직접 변경 (`EditFieldModal` + `updateMyProfile` 재사용)
- **테마·캐릭터·소리·진동·마스코트**: 자녀 직접 변경 제거 → 메뉴별 "변경 요청" 전용
- 요청 시 부모에게 실제 푸시(`parent_alert`) + `parent_alerts` 기록(신규 alert_type `child_setting_request`)
- 정보 전달형 — 승인/거부·자동 적용 없음. 실패 시 자녀에게 반말 에러 노출. 메뉴별 60초 쿨다운.

## 확정된 설계 결정

- **요청 전송**: `sendInstantPush({action:"parent_alert", alertType:"child_setting_request", severity:"info"})` + `supabase.rpc("insert_parent_alert", ...)`.
- **마이그레이션 필요 여부**: Phase 0 검증 결과에 따라 분기 (`parent_alerts.alert_type`이 free-text면 불필요, CHECK enum이면 필수).
- **자녀 UI**: 비-이름 Row의 직접 컨트롤 제거 → "변경 요청" 버튼 + `ChildRequestConfirmSheet` 확인 시트.
- **카피 톤**: 자녀 반말 / 부모 푸시·알림 존댓말.
- **이름 편집**: 이름 Row 탭 → `setEditFieldKind("name")` → 기존 `EditFieldModal` 재사용.

## Phase 구성 (각 = 1 커밋)

### Phase 0 — DB 스키마 검증 ✅ 완료 (2026-05-18)

검증 결과 — **DB 마이그레이션 불필요**:
- `parent_alerts.alert_type`: `text NOT NULL`, **CHECK 제약 없음**(free text) → `child_setting_request` 그대로 INSERT 가능.
- `insert_parent_alert`: `SECURITY DEFINER`, 시그니처 `(p_family_id uuid, p_alert_type text, p_title text, p_message text, p_severity text DEFAULT 'info', p_event_id DEFAULT NULL)`. EXECUTE 권한이 `anon`·`authenticated` 모두에 부여됨 → **자녀가 호출 가능**.
- `get_parent_alerts`: `family_id` + `get_my_family_ids()` 멤버십만 검사, **alert_type 필터 없음** → 새 타입이 부모 알림센터에 자동 노출.
- ⚠️ `insert_parent_alert` **오버로드 2개**(`p_event_id text` / `p_event_id uuid`) — event_id 없이 호출 시 모호성 가능. Phase 1에서 `App.jsx:3924`의 기존 호출 패턴을 그대로 복제해 회피할 것.
- `parent_alerts` 컬럼: `id, family_id, alert_type, title, message, severity('info' default), event_id, metadata jsonb, read(false default), created_at`.

→ Phase 1에서 조건부 마이그레이션 단계 **삭제**. 라이브러리 + 테스트만 진행.

### Phase 1 — 요청 전송 라이브러리 ✅ 완료 (커밋 7e520e9)

- 조건부 마이그레이션 단계는 Phase 0 검증 결과 **불필요로 삭제**.
- 신규 `src/lib/childSettingRequest.js` — `SETTING_REQUEST_META`(메뉴별 카피), `sendChildSettingRequest()`, `checkRequestCooldown()`/`markRequestSent()`(메뉴별 60초).
- 신규 단위 테스트 `tests/childSettingRequest.test.js` (13건). ⚠️ 편차: 계획의 `src/lib/__tests__/` 경로는 vitest `include`(`tests/**`) 미수집 → `tests/`로 배치.

### Phase 2 — 자녀 설정 화면 권한 모델 재설계 ✅ 완료 (커밋 b6b05ce)

- 신규 `src/components/childMode/ChildRequestConfirmSheet.jsx` — 메뉴별 요청 확인 시트(토큰 전용 스타일).
- `ChildSettingsScreen.jsx` 재설계 — 테마/캐릭터/소리/마스코트 직접 컨트롤 제거 → "변경 요청" Row, 이름 Row 편집 가능화. props: `onRequestChange(menuKey)`, `onEditName`.
- `App.jsx` 배선 교체 — `handleChildSettingRequest`/`handleConfirmSettingRequest` + 시트 state + `EditFieldModal` 자녀 진입 + back-handler.
- 죽은 코드 정리 — `handleChildEmojiChange` 제거, `childShowMascot` 직접 토글 경로 제거(state·ChildHero 사용처는 보존).
- 컴포넌트 테스트 `ChildSettingsScreen.test.jsx`(재작성)·`ChildRequestConfirmSheet.test.jsx`(신규) 29건. ⚠️ 편차: 게이트(각 Phase 후 vitest 통과) 정합성을 위해 ChildSettingsScreen 테스트 재작성을 Phase 3→Phase 2 커밋으로 이동.

### Phase 3 — 부모 알림센터 표시 ✅ 완료 (커밋 65cffce)

- `AlertCenterPopup.jsx` `TYPE_META`에 `child_setting_request` 추가("요청" 라벨).
- `AlertPanel`(활동 알림 상세) — `severity` 기반 렌더라 변경 불필요(확인 완료).
- 컴포넌트 테스트 `AlertCenterPopup.test.jsx` 2건.

## 의존성 그래프

```
Phase 0 (DB 검증) ─→ Phase 1 (마이그레이션 + 라이브러리)
                       └─→ Phase 2 (자녀 화면 재설계) ─→ Phase 3 (알림센터 + 테스트)
```

## 위험

| 위험 | 심각도 | 완화 |
|---|---|---|
| `insert_parent_alert` 자녀 익명 user 호출 불가 (RLS/권한) | High | Phase 0 확인, 불가 시 권한 마이그레이션 추가 |
| `alert_type` CHECK enum이라 새 값 거부 | Medium | Phase 0 제약 조회, CHECK면 마이그레이션 필수 |
| `get_parent_alerts`가 alert_type 화이트리스트 필터 → 새 알림 누락 | Medium | Phase 0 RPC 정의 확인 |
| `childShowMascot`/`handleChildEmojiChange` 타 사용처 무단 제거 회귀 | Medium | 제거 전 전체 참조 grep |
| props 인터페이스 변경으로 기존 테스트 깨짐 | Low | Phase 3에서 테스트 동기 수정 |
| 푸시 성공·RPC 실패 부분 실패 | Medium | RPC 성공을 기록의 진실원으로, RPC 실패만 자녀 에러 노출 |
| prod 마이그레이션 직접 적용 | Medium | 멱등 작성 + down 파일 + 사용자 승인 후 MCP apply |

## 테스트 전략

- 단위: `childSettingRequest` — 정상 전송·입력 검증·RPC 실패 throw·푸시 실패 허용·쿨다운.
- 컴포넌트: `ChildSettingsScreen` 콜백·직접 컨트롤 부재, `ChildRequestConfirmSheet` 확인/취소.
- 회귀: 부모측 `editFieldKind` 이름/전화 모달·테마·`parentAlerts` 흐름 무변경.
- 게이트: 각 Phase 후 `npm run build` + `npx vitest run`.

## 복잡도

Medium. 신규 2~3 + 수정 3 파일. 핵심 리스크는 prod-only DB 스키마(`parent_alerts`/`insert_parent_alert`) 미확인 — Phase 0 검증이 후속 정확성을 좌우.

## 성공 기준

- [ ] 자녀가 이름 직접 변경 성공 (`family_members.name` + auth metadata 반영)
- [ ] 테마/캐릭터/소리/마스코트 직접 변경 UI 부재
- [ ] 메뉴 "변경 요청" → 부모 푸시 도착 + `parent_alerts` `child_setting_request` 행 기록
- [ ] 부모 알림센터에 어느 메뉴 요청인지 존댓말 표시, 승인/거부 버튼 없음
- [ ] 요청 실패 시 자녀 반말 에러 토스트 (silent failure 없음)
- [ ] 동일 메뉴 60초 쿨다운 차단
- [ ] 부모측 기존 흐름 무회귀, `npm run build` 0 error, `npx vitest run` 통과
- [ ] 각 Phase = 1 커밋

---

## 이전 계획

# 구현 계획: `family_members.phone`를 부모 전화번호 단일 소스로 통합

> 작성: 2026-05-17 · 상태: 완료 (2026-05-18, 커밋 02f6216~3e56768)

부모 전화번호를 `family_members.phone` 단일 소스로 통합하고 두 다운스트림(자녀 `ChildCallCard`, 친구놀이 부모 연락처)을 연결.

- Phase 1 — `family_members.gender` 마이그레이션 + 백필 (`728e8dc`)
- Phase 2 — `get_active_playdate_session` RPC를 `family_members` 집계로 전환 (`5b85dd3`)
- Phase 3 — `push-notify` `handlePlaydateStarted` 전환 (`77682c5`)
- Phase 4 — 클라이언트 `selectParentContacts` + ChildCallCard `others` (`0c82043`)
- Phase 5 — `family_members` Realtime 구독 (`dffef7c`)
- 잔여 정리 — `families.*_phone` DROP + auth.js 정리 + PhoneSettingsModal 삭제 (`3e56768`)

모든 Phase 구현·검증·배포 완료. Edge Function `push-notify` version 68 배포됨.
