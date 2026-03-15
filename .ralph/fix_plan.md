# Ralph Fix Plan

## High Priority
- [ ] 부모 폰에서 등록한 일정이 아이 폰에 실시간 반영
- [ ] 부모는 카카오 소셜 로그인, 아이는 로그인 없이 페어링 코드로 연결
- [ ] 오프라인 시 읽기 캐시(localStorage)로 마지막 동기화된 일정 열람 가능
- [ ] Click "부모" role → Kakao OAuth via `supabase.auth.signInWithOAuth({ provider: 'kakao' })`
- [ ] Supabase redirects to Kakao → user authorizes → redirects back to app
- [ ] On success → check if `families` row exists for this user
- [ ] If not → INSERT into `families` with generated pair_code + INSERT into `family_members` with role='parent'
- [ ] Show pair_code for sharing with child
- [ ] Click "아이" role → `supabase.auth.signInAnonymously()` 자동 호출
- [ ] Enter pair_code → query `families` where pair_code matches (via RPC function with rate limiting)
- [ ] INSERT into `family_members` with role='child', family_id from matched family
- [ ] Subscribe to realtime events for that family_id
- [ ] Upload them to Supabase (bulk INSERT)
- [ ] Clear old localStorage keys
- [ ] Switch to new sync-based flow


## Medium Priority


## Low Priority


## Completed
- [x] Project enabled for Ralph

## Notes
- Focus on MVP functionality first
- Ensure each feature is properly tested
- Update this file after each major milestone
