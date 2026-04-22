---
slug: kkuk-memo-send-noop
status: diagnosed
trigger: KKUK ('꾹' affection tap) + memo send both report broken in production. Parent-side send is failing. User confirmed symptom is 'button press produces no observable response' and timeline is 'regression — worked before, recently broken'. Scope: KKUK and memo only (SOS is separate and out of scope for this session). KKUK = affection, SOS = emergency — never conflate.
created: 2026-04-22
updated: 2026-04-22
---

# Debug Session: kkuk-memo-send-noop

## Symptoms

- **Expected**: Parent device taps KKUK('꾹') button or sends memo → server-side `push-notify` edge function is called → child device receives FCM data-message and shows notification. Parent UI shows success toast/feedback.
- **Actual**: Button press on parent device produces no observable response. No success toast, no error modal, no apparent state change. Child device receives nothing.
- **Error messages**: Not yet captured (user can live-repro to gather console + network + edge function logs).
- **Timeline**: Regression — 사용자가 "이전엔 잘 될 때도 있었는데 최근 먀춤" 로 보고. 최근 배포/업데이트 이후 깨진 것으로 추정.
- **Reproduction**: User available to test on their own device with DevTools open.

## Relevant project context

- v1.0 에서 KKUK-01..03 + MEMO-01..03 전부 "validated" 처리됨 (.planning/milestones/v1.0/v1.0-MILESTONE-AUDIT.md).
- v1.0 재감사 직후 SEC-01 (push-notify sender-family 검증 누락) 이 발견되어 v1.1 에서 핫픽스로 추가됨. SEC-01 fix 가 sender validation 을 너무 좁게 잡아 legitimate 부모 요청까지 거부하는 regression 가능성 있음 — **1순위 가설**.
- 웹 번들: `index-CIWSG6r3.js` (Vercel live deploy from main).
- Edge function: `push-notify` v34 (ES256 + Idempotency + SEC-01 membership gate).
- Child 단말은 구 APK 로 알려짐 — 수신 문제는 v1.1 Phase 7 APK 재배포로 해결 예정이지만, **본 세션은 송신 고장(부모측 "버튼 눌러도 반응 없음") 에 집중**.

## Scope guardrails

- KKUK 과 memo **모두** 같이 고장 → 공통 코드 경로(예: push-notify edge function, Supabase client, auth session, 공통 버튼 핸들러 베이스) 에 원인이 있을 가능성 높음.
- SOS 는 이 세션과 무관. 건드리지 말 것.
- `src/App.jsx` 분해 금지 (CLAUDE.md). 라인 범위 최소화로 수정.
- 라이브 프로덕션 데이터 `family_id=4c781fb7-677a-45d9-8fd2-74d0083fe9b4` 조심.

## Current Focus

- **hypothesis** (revised 2026-04-22 round 2): KKUK 는 실제로 동작 중이며 초기 보고는 잘못된 일반화였다. 남은 고장은 memo 의 **수신측 UI 렌더링** — 메시지 전송·저장·Realtime 브로드캐스트는 성공하지만, 상대방 화면에서 settled 말풍선 대신 "입력 중단된 타이핑 인디케이터" 같은 잘못된 상태로 표시됨. `src/App.jsx` 메모 목록 렌더링 분기 또는 memo composer state 와 memo list state 가 섞여있을 가능성.
- **test**: (1) `memos` · `memo_replies` 테이블 Realtime 이벤트 로그 검사 (INSERT payload 는 정상인지), (2) 부모 기기와 아이 기기에서 같은 메모 전송 시 둘 다 동일한 ghost 증상인지, 아니면 한쪽만인지, (3) `src/App.jsx` memo 렌더링 컴포넌트 코드 경로 추적 — composer draft state 가 타인 메시지에도 새고 있는지.
- **expecting**: React state 혼선 (예: `typingDraft` 등 로컬 composer state 를 `messages.map()` 에도 섞어 보여주는 버그) 또는 optimistic-update 롤백이 잘못된 상태로 종결되는 버그.
- **next_action**: debugger agent 가 (1) `src/App.jsx` 중 memo 관련 state·렌더링 코드, (2) `src/lib/sync.js` memo Realtime 구독/핸들러, (3) `supabase/migrations/**/*memo*` 테이블 스키마를 crosscheck. 그리고 ai-child-monitor 401 분리 조사(본 세션과 별개).
- **reasoning_checkpoint**: KKUK hypothesis 제거 — Evidence A 에 의해 falsified. Memo 는 transport OK, rendering only.
- **tdd_checkpoint**: n/a

## Evidence

- **Evidence A** (2026-04-22, user live test): KKUK 버튼 정상 작동 확인. "💗 꾹을 보냈어요!" 토스트 출현 + push-notify 호출 + 아이 기기 수신까지 정상. → KKUK hypothesis eliminated.
- **Evidence B** (2026-04-22, user live test): 메모 전송 자체는 작동(전송자 본인 화면에 메시지 남음). 그러나 **수신측 화면에서 "커서 보이면서 입력 중단된 상태" 로 표시**. 사용자는 X(Twitter)/Thread 앱처럼 내가 보낸 메시지 vs 상대가 보낸 메시지가 말풍선으로 깔끔하게 구분되는 UX 를 원함.
- **Evidence C** (2026-04-22, console log): 번들 이름 `index-Cd77NRVw.js` — 조사 시작 시점 기록한 `index-CIWSG6r3.js` 이후 배포됨. 7개 Realtime 구독(events, academies, memos, saved_places, family_subscription, memo_replies, family broadcast) 전부 성공. 로그 제공자는 child-side (joinFamily 로그 존재).
- **Evidence D** (2026-04-22, side finding): `qzrrscryacxhprnrtpjd.supabase.co/functions/v1/ai-child-monitor` 가 **401** 반환. 본 세션과 무관한 별도 버그일 가능성 → 별도 debug 세션/티켓 분리 권고.
- **Evidence E** (2026-04-22, code read — src/App.jsx:2059-2198): `MemoSection` 컴포넌트 분석. UI 는 두 개의 완전히 분리된 입력/상태 계층으로 구성됨: (1) 상단 `<textarea>` — `memoValue` prop (= `memos[dateKey]`, 즉 legacy `public.memos` 테이블에서 온 free-text), (2) 하단 `<input>` — `inputText` 로컬 state. 말풍선 chat area 는 `replies` prop (= `memoReplies` state, `memo_replies` 테이블). composer draft state 가 chat bubble 목록으로 누수되는 React state 혼선은 없음.
- **Evidence F** (2026-04-22, code read — src/App.jsx:4664-4678): `onMemosChange` Realtime 핸들러. `memos` 테이블 INSERT/UPDATE 수신 시 **현재 보고 있는 날짜(`dateKeyRef.current`)의 memo 는 무조건 skip** (`if (newRow.date_key === dateKeyRef.current) return`). 이 skip 이 수신측에서 `memos[dateKey]` 를 갱신하지 않으므로, 상단 textarea 는 수신자가 직접 입력한 텍스트 그대로 남는다. 이것이 "입력 중단된 타이핑 커서" 현상의 원인.
- **Evidence G** (2026-04-22, code read — src/App.jsx:6797-6803): 송신 경로. `onReplySubmit` → (1) optimistic insert `{ id:"temp-...", ... }` → `setMemoReplies`, (2) `sendMemo()` → (3) `.then(() => fetchMemoReplies(...).then(setMemoReplies))`. 즉 송신 성공 후 서버 상태로 전체 교체 (optimistic ID 포함). 이 fetch-replace 패턴은 송신측에서는 정상 작동. 문제는 수신측임.
- **Evidence H** (2026-04-22, code read — src/App.jsx:4740-4747): `onMemoRepliesChange` 수신 핸들러. `memo_replies` INSERT 이벤트 수신 시 `user_id === authUser?.id` 이면 early return (자기 echo 방지). 수신자는 타인 메시지이므로 통과하여 `setMemoReplies(prev => [...prev, newRow])` 추가. 이 경로는 올바름 — `memo_replies` 채팅 버블은 정상 수신됨.
- **Evidence I** (2026-04-22, code read — src/App.jsx:2088-2143 + 6740-6784): "입력 중단된 커서처럼 보이는" 현상의 정확한 진단: 상단 textarea (= legacy memo / `public.memos`) 가 수신측에서 비어있지 않을 경우 그것이 그대로 노출된다. `onMemosChange` skip 로직은 수신자도 "현재 보고 있는 날짜" 이기 때문에 항상 skip. 따라서 수신자가 이전에 자신이 입력하다 지운 텍스트, 또는 직전 fetch 결과(= 송신자가 upsert 한 content)가 textarea 에 남아 있어 커서처럼 보임. 이는 legacy `memos` 테이블 WRITE 경로(`upsertMemo`)가 Phase 4 이후에도 `onMemoSend`/`onMemoBlur` 에서 여전히 호출되기 때문 (src/App.jsx:6758, 6774). 
- **Evidence J** (2026-04-22, side finding confirmed): `ai-child-monitor` 401 은 `src/App.jsx:5519-5535` `analyzeMemoSentiment()` 함수에서 호출. `AI_MONITOR_URL` 상수가 해당 edge function URL 을 가리킴. child-side 에서 메모 sentiment 분석 시 인증 헤더 문제. 본 세션 범위 외 — 별도 처리 권고.

## Eliminated hypotheses

- **H1 (KKUK send broken)**: 사용자 A 테스트에서 KKUK 토스트·전송·수신 전부 확인. Rejected.
- **H2 (SEC-01 regression blocking all push-notify)**: KKUK 가 push-notify 경로를 정상 통과하므로 SEC-01 가드가 legitimate 부모 요청을 거부하는 건 아님. Rejected.
- **H3 (common transport-path failure in KKUK+memo)**: 둘이 별개 이슈임이 확정. Rejected as a unified cause.

## Resolution

root_cause: |
  MemoSection 의 상단 `<textarea>` 는 legacy `public.memos` 테이블의 `content` 를 `memoValue` prop 으로 받아 렌더링한다.
  송신자가 `onMemoSend` / `onMemoBlur` 를 호출하면 `upsertMemo(familyId, dateKey, text)` 로 해당 텍스트가 `public.memos` 에 기록된다.
  수신자 쪽 `onMemosChange` Realtime 핸들러(App.jsx:4671)는 현재 보고 있는 날짜(`dateKeyRef.current`)와 일치하면 무조건 state 업데이트를 skip 한다.
  결과적으로 수신자의 `memos[dateKey]` 는 수신자 자신이 이전에 입력하다 남긴 텍스트(또는 30초 polling 으로 가져온 송신자 텍스트)가 그대로 textarea 에 표시된다.
  이것이 상대방 화면에서 "커서가 보이는 채로 입력 중단된 것처럼" 보이는 원인이다.
  채팅 버블(`memo_replies`) 경로는 정상이다 — 문제는 오직 legacy textarea(상단 메모 영역)에만 해당한다.

fix: |
  (아직 미적용 — read-only investigation round)
  최소 수정 방향:
  (A) onMemosChange 의 skip 조건(App.jsx:4671)을 제거하거나, 자신의 user_id 로 작성한 row 만 skip 하도록 조건을 좁힌다. OR
  (B) Phase 4 완료 기준에 맞게 legacy textarea(onMemoSend/onMemoBlur → upsertMemo) 전송 경로를 완전히 제거하고, 상단 textarea 를 read-only 로 바꾸거나 숨긴다. memo_replies 채팅 버블만 남기는 것이 사용자 요구(X/Thread 스타일 UX)와도 일치한다.

verification: (pending)
files_changed: []
