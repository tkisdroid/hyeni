# Phase 5: UX & Safety Hardening - Context

**Gathered:** 2026-04-21
**Status:** Ready for planning
**Mode:** `--auto` single-pass

<domain>
## Phase Boundary

**3 parallel streams, 10 REQs:**

- **Stream A (P2-7)**: GATE-01, GATE-02 — 아이가 페어링 전에는 "부모 코드 연결" 단일 화면만. `src/App.jsx` gating.
- **Stream B (P2-8)**: RL-01..04 — 주위소리듣기 책임성·투명성. `remote_listen_sessions` 테이블 + 아이 측 지속 인디케이터 + Android WebView 자동 승인 제거 + cleanup.
- **Stream C (P2-9 + SOS-01)**: KKUK-01..03 + SOS-01 — 꾹 press-hold + dedup_key + 서버 쿨다운 + `sos_events` 불변 감사 로그.

파일 스트림별 disjoint — 병렬 가능. Stream B는 Android 네이티브 터치 포함.

</domain>

<decisions>
## Implementation Decisions

### Stream A — GATE-01/02

**D-A01:** `src/App.jsx` 에서 **아이 역할 + `familyInfo === null`** 상태 조건부 early-return:
```jsx
if (myRole === 'child' && !familyInfo) {
  return <ChildPairInput .../>;  // 기존 컴포넌트 사용
}
```
위치: main App render 시작부 (~L5700 근처 RoleSetupModal 분기 근처). ChildPairInput은 이미 존재.

**D-A02:** GATE-02 — `familyInfo` 가 null이 되면(예: unpair) 자동으로 게이트 화면으로 복귀. 위 early-return이 자연스럽게 처리.

**D-A03:** 아이 세션 초기 로드 시 "오늘의 메모"·"꾹" 등 UI 렌더 자체를 안 함 → realtime subscribe 도 안 함. 기존 hooks 정리 필요.

### Stream B — RL-01..04 + Play Store compliance

**D-B01:** `remote_listen_sessions` 테이블 생성 (MCP apply_migration):
```sql
CREATE TABLE IF NOT EXISTS public.remote_listen_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  initiator_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  child_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  duration_ms integer,
  end_reason text,  -- 'timeout', 'user_stopped', 'error', 'permission_denied'
  created_at timestamptz DEFAULT now()
);
CREATE INDEX ON public.remote_listen_sessions (family_id, started_at DESC);
ALTER TABLE public.remote_listen_sessions ENABLE ROW LEVEL SECURITY;
-- Insert: only family members
-- Select: only family members
CREATE POLICY rls_remote_listen_select ON public.remote_listen_sessions
  FOR SELECT TO authenticated USING (
    family_id IN (SELECT family_id FROM public.family_members WHERE user_id = auth.uid())
  );
CREATE POLICY rls_remote_listen_insert ON public.remote_listen_sessions
  FOR INSERT TO authenticated WITH CHECK (
    family_id IN (SELECT family_id FROM public.family_members WHERE user_id = auth.uid())
  );
-- No UPDATE/DELETE policies (service_role only, via implicit bypass)
```

**D-B02:** `src/App.jsx` `startRemoteAudioCapture` 시작 시 INSERT INTO remote_listen_sessions, stop 시 UPDATE ended_at/duration_ms/end_reason.

**D-B03:** 아이 측 **지속 인디케이터** — 현재 무표시 → 풀스크린 오버레이 또는 상단 고정 배너 + 진동. `App.jsx` 의 `onRemoteListenStart` 에서 `setShowListeningIndicator(true)` state, `onRemoteListenStop`에서 false. 인디케이터 UI: 빨간 배너 "부모님이 주위 소리를 듣고 있어요 · 세션 종료 시 자동으로 사라집니다" + 진동 `navigator.vibrate(200)`.

**D-B04:** **Android WebView 자동 승인 제거** — `android/app/src/main/java/com/hyeni/calendar/MainActivity.java` L39-49의 `WebChromeClient.onPermissionRequest.grant(request.getResources())` 제거. 대신:
- 세션별 명시 동의: `@capacitor/core` `Permissions.query` + native prompt → 승인 후 `.grant()`, 거부 시 `.deny()` + 세션 종료 + error 이벤트 parent에 broadcast
- **honor-legacy-consent**: localStorage `hasGrantedAmbientListen` 이 true면 첫 prompt 자동 승인(기존 사용자 UX 보존). Phase 5에선 이 플래그 추가 + 전환기 동작만 구현.

**D-B05:** **cleanup (RL-04)** — `stopRemoteAudioCapture` 호출 실패·앱 크래시 대비:
- `beforeunload` listener: 스트림 열려있으면 강제 stop + `end_reason='page_unload'` UPDATE
- 40초 타임아웃: 플랜 기본 session 35초 + buffer 5초 내 종료 안 되면 강제 stop

**D-B06:** **Play Store compliance — 지속 Android 알림 + FGS type** — Android 네이티브 변경 필수:
- `AndroidManifest.xml`: `<service android:name="...AmbientListenService" android:foregroundServiceType="microphone" />` 추가
- Service 구현: `setOngoing(true) + setCategory(CATEGORY_SERVICE)` 지속 알림, 세션 간 live
- 클라이언트(JS)에서 `Capacitor` bridge 통해 service start/stop 호출
- **범위 제한**: 이 phase에서는 **스펙만** (코드 예시 포함), 실제 Android 네이티브 빌드 + APK 업로드는 **스킵**. 이유: CI 없이 로컬 APK 빌드 실패 가능성 + 기존 사용자 업그레이드 영향. Service 클래스 파일만 authoring, `AndroidManifest.xml` 선언 업데이트, bridge JS 호출 지점 주석 처리로 문서화.

**D-B07:** **remote feature flag** (kill switch) — `family_subscription.remote_listen_enabled boolean DEFAULT true` 컬럼 추가. `startRemoteAudioCapture` 시작 전 조회, false면 시작 거부 + 에러 broadcast. 긴급 disable 경로.

### Stream C — KKUK + SOS-01

**D-C01:** **press-hold 500~1000ms** — `src/App.jsx` 꾹 버튼 (L6145-6151):
```jsx
const [holdStart, setHoldStart] = useState(0);
const handleDown = () => setHoldStart(Date.now());
const handleUp = () => {
  const duration = Date.now() - holdStart;
  if (duration >= 500 && duration <= 2000) sendKkuk();
  setHoldStart(0);
};
<button onMouseDown={handleDown} onMouseUp={handleUp} onTouchStart={handleDown} onTouchEnd={handleUp}>💗 꾹</button>
```

**D-C02:** **dedup_key in payload + LRU 수신 측** — `sendKkuk` 페이로드에 `dedup_key: crypto.randomUUID()` 추가. `onKkuk` 수신 시:
```js
const recentKkuks = useRef(new Map()); // key → timestamp
const onKkuk = (payload) => {
  if (!payload.dedup_key) return displayKkuk(payload);  // legacy fallback
  const key = payload.dedup_key;
  if (recentKkuks.current.has(key)) return; // duplicate
  recentKkuks.current.set(key, Date.now());
  // prune entries > 60s old
  for (const [k, t] of recentKkuks.current) {
    if (Date.now() - t > 60_000) recentKkuks.current.delete(k);
  }
  displayKkuk(payload);
};
```

**D-C03:** **서버사이드 쿨다운 RPC** — `public.kkuk_check_cooldown(sender uuid) returns boolean`:
```sql
CREATE OR REPLACE FUNCTION public.kkuk_check_cooldown(p_sender uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE v_last timestamptz;
BEGIN
  SELECT MAX(triggered_at) INTO v_last FROM public.sos_events
    WHERE sender_user_id = p_sender AND triggered_at > now() - interval '5 seconds';
  RETURN v_last IS NULL;
END;
$$;
```
클라이언트: `sendKkuk` 전에 `supabase.rpc('kkuk_check_cooldown', { p_sender: authUser.id })` → false면 무음 fail.

**D-C04:** **`sos_events` 감사 로그 테이블 (SOS-01)**:
```sql
CREATE TABLE IF NOT EXISTS public.sos_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  sender_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  receiver_user_ids uuid[] DEFAULT '{}',
  triggered_at timestamptz NOT NULL DEFAULT now(),
  delivery_status jsonb DEFAULT '{}'::jsonb,
  client_request_hash text,  -- dedup_key
  created_at timestamptz DEFAULT now()
);
CREATE INDEX ON public.sos_events (family_id, triggered_at DESC);
CREATE INDEX ON public.sos_events (sender_user_id, triggered_at DESC);
ALTER TABLE public.sos_events ENABLE ROW LEVEL SECURITY;
-- Insert-only for authenticated, UPDATE/DELETE forbidden
CREATE POLICY sos_events_select ON public.sos_events FOR SELECT TO authenticated USING (
  family_id IN (SELECT family_id FROM family_members WHERE user_id = auth.uid())
);
CREATE POLICY sos_events_insert ON public.sos_events FOR INSERT TO authenticated WITH CHECK (
  family_id IN (SELECT family_id FROM family_members WHERE user_id = auth.uid())
  AND sender_user_id = auth.uid()  -- 발신자 본인만 INSERT
);
-- No UPDATE/DELETE policies → immutable for non-service_role
```

**D-C05:** `sendKkuk` 이 성공 시 `sos_events` INSERT:
- `sender_user_id = auth.uid()`
- `receiver_user_ids` = 가족의 parent 멤버 user_ids (fetch from family_members)
- `client_request_hash = dedup_key`
- `delivery_status` = `{realtime: 'sent'}` (초기), 실제 수신자 ack은 scope 외

</decisions>

<canonical_refs>
- `.planning/research/SUMMARY.md` §"Phase 5" (3 streams)
- `.planning/research/STACK.md` §KKUK/RL
- `.planning/research/FEATURES.md` §"P2-8 Remote Listen — Google Play stalkerware policy"
- `.planning/research/PITFALLS.md` §"P2-8 / P2-9"
- `src/App.jsx` — kkuk button (L6145-6151), sendKkuk (L4603-4657), onKkuk (L4482-4491), startRemoteAudioCapture (L301-346), onRemoteListenStart (L4503-4508), role gate (L5706-5711)
- `android/app/src/main/java/com/hyeni/calendar/MainActivity.java` L39-49 WebChromeClient
- `android/app/src/main/AndroidManifest.xml` — FGS service declaration
- Phase 2 Plan 02-05 `PairingModal` — GATE-02 연결
</canonical_refs>

<deferred>
- 실제 Android APK 빌드 + Play Store 업로드 (FGS type 적용) — 네이티브 변경만 authored, 배포는 v1.1
- Telemetry dashboard for sos_events (sos frequency, delivery success rate) — v2 OBS
- Per-user rate limit for remote_listen_sessions — v1.1
- Cross-family remote-listen prevention at RPC level (RLS already covers this) — fine
</deferred>

---

*Phase: 05-ux-safety-hardening*
*Context gathered: 2026-04-21*
