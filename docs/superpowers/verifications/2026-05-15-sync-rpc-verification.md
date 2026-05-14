# sync.js RPC Migration — Manual Verification (2026-05-15)

Test environment: production Supabase (`qzrrscryacxhprnrtpjd`) + Android devices R5CY40EE6QE + ZY22H9VTQD.

## Scenario A — 새 이벤트 추가 (add path, 자녀 1명)

1. [ ] 캘린더 → 날짜 → "+" → 자녀 1명 선택 → 저장.
2. [ ] 다른 디바이스에서 동일 이벤트 표시 확인 (realtime sync 통과).
3. [ ] Dashboard SQL: `SELECT * FROM events WHERE title='<제목>'` — 1행 + `SELECT * FROM events_children WHERE event_id='<id>'` — 1행.

## Scenario B — 기존 이벤트 수정 (edit path, 자녀 변경)

1. [ ] Scenario A 의 이벤트 → 자녀 추가 → 저장.
2. [ ] Dashboard SQL: `events_children WHERE event_id='<id>'` — 2행.
3. [ ] 다시 자녀 1명만 → 저장 → 1행 + 다른 child_id 가 사라졌는지 확인 (delete-then-insert 검증).

## Scenario C — 가족 전체

1. [ ] 새 이벤트 → "가족 전체" 토글 ON → 저장.
2. [ ] Dashboard: `events.is_family_event = true`, `events_children` 행 0개.

## Scenario D — 동시 수정 (concurrent edit safety)

> 현재 caller (App.jsx) 는 add path 만 호출하므로 saveEventWithChildren 실측 OC 는 검증 불가.
> 본 시나리오는 RPC 의 atomicity (LWW) 만 검증한다. OC 자체는 Dashboard SQL Editor 에서 RPC 직접 호출로 별도 검증 (Scenario D-2).

1. [ ] 디바이스 1: 이벤트 X 편집 화면 진입 (별도 updateEvent 경로).
2. [ ] 디바이스 2: 같은 이벤트 X 의 메모 만 수정 후 저장.
3. [ ] 디바이스 1: 자녀 변경만 수정 후 저장.
4. [ ] 결과: **stale priorEventRow upsert 로 메모가 옛 값으로 되돌아가는 일이 없는지** 가 핵심. RPC migration 이전 santa-loop 시나리오는 이 지점에서 데이터 손실 발생 가능했음.

## Scenario D-2 — Optimistic concurrency RPC 직접 검증 (Dashboard)

1. [ ] Dashboard SQL Editor 에서 이벤트 X 의 현재 `updated_at` 확인 — `T0`.
2. [ ] 같은 row 를 `UPDATE events SET updated_at = now() WHERE id = X` 으로 한 번 건드림 → 새 timestamp `T1`.
3. [ ] RPC 직접 호출:
   ```sql
   SELECT public.save_event_with_children(
     (SELECT to_jsonb(events) FROM events WHERE id = X),
     ARRAY[]::uuid[],
     false,
     'T0'::timestamptz  -- stale expected
   );
   ```
4. [ ] 결과: `ERROR: concurrent_modification: events.updated_at moved from T0 to T1` + SQLSTATE 40001. RPC 가 stale write 를 거부.
5. [ ] 동일 호출에서 expected 를 `T1` (현재 값) 으로 바꾸면 성공.

## Scenario E — 권한 거부 (다른 가족 데이터 시도)

1. [ ] (manual) 디바이스 1 의 access token 으로 디바이스 2 의 family_id 를 명시한 이벤트 추가 시도 (PostgREST direct call).
2. [ ] RLS 의 `ev_ins` 정책에 의해 거부 (HTTP 401/403).

## DB sanity

- [ ] `pg_proc` 에 `save_event_with_children(jsonb, uuid[], boolean, timestamptz)` 존재, `prosecdef=false`, `provolatile='v'`.
- [ ] `events_children.event_id → events.id` FK 무결성 통과 (orphan 없음).
