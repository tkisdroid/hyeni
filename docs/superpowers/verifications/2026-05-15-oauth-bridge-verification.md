# OAuth Bridge — Manual Verification Checklist (2026-05-15)

Test environment: staging Supabase + Android devices R5CY521CFNZ + ZY22H9VTQD.

## Scenario A — Phone-first user adds Kakao (happy path)

1. [ ] App → "전화번호로 가입" 으로 새 부모 계정 만들기. login_id=`testparent01`, phone=`010-1111-2222`.
2. [ ] Family setup 완료.
3. [ ] Logout.
4. [ ] "카카오로 계속하기" 클릭 → Kakao 로그인.
5. [ ] OAuthBridgeScreen 진입 확인. "이미 가입했어요" → 전화번호 `010-1111-2222` 입력 → OTP 수신 → 입력 → MATCH_CONFIRM 화면 표시.
6. [ ] "카카오 연결하기" 클릭 → linking → done → 홈 진입.
7. [ ] `user_profiles.linked_providers` 에서 row 확인: `{"kakao": {"linkedAt": "..."}}`.
8. [ ] `auth.identities` 에서 kakao identity 의 user_id 가 phone user_id 와 같은지 확인.
9. [ ] 다시 logout 후 카카오 로그인 → OAuthBridgeScreen 안 뜨고 바로 홈 진입.

## Scenario B — Phone-first user adds Google

1-9. [ ] Scenario A 와 동일하되 Google 사용.

## Scenario C — Mismatched phone (no existing account)

1. [ ] Logout.
2. [ ] 새 Kakao 계정으로 로그인 (가입 안 된 카카오).
3. [ ] OAuthBridgeScreen → "이미 가입했어요" → 가입 안 된 전화번호 `010-9999-9999` 입력.
4. [ ] 에러 메시지: "이 전화번호로 가입된 계정이 없어요..." 표시 확인.
5. [ ] "새로 가입할게요" 클릭 → ParentSetup 진입.

## Scenario D — 잘못된 OTP 입력

1. [ ] OAuthBridgeScreen → 가입된 전화번호 입력 → OTP 받기 → 틀린 6자리 입력.
2. [ ] 에러 메시지 표시 확인. "전화번호 다시 입력" 또는 OTP 재입력 가능 확인.

## Scenario E — Edge Function 실패 (network 끊기)

1. [ ] OAuthBridgeScreen → match-confirm 상태까지 진행.
2. [ ] 비행기 모드 ON → "카카오 연결하기" 클릭.
3. [ ] 에러 메시지 표시 + 상태 MATCH_CONFIRM 유지 (LINKING 에 멈춰 있지 않음) 확인.

## Scenario F — 이미 linking 끝난 user 의 second OAuth 로그인

1. [ ] Scenario A 완료 상태.
2. [ ] Logout → 카카오 로그인.
3. [ ] OAuthBridgeScreen 안 뜨고 바로 홈 진입 확인 (`getOAuthUserNeedsBridge` false).

## DB sanity

- [ ] orphan oauth user (`auth.users` 에 phone null + email null + 0 family memberships) 없음.
- [ ] `auth.identities.user_id` 가 모두 `auth.users.id` 와 매핑됨.
- [ ] `user_profiles.linked_providers` JSONB 가 모든 OAuth-linked 사용자에게 존재.

## Logs

- [ ] Edge Function logs: 위 시나리오마다 200/4xx/5xx 적절히 응답.
- [ ] Browser console: error 없음.
