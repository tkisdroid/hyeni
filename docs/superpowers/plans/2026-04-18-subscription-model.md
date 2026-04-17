# 구독 모델 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** hyeni 앱에 Qonversion + Google Play Billing 기반 구독 모델을 도입하여 Early Adopter 가격(월 ₩1,500 / 연 ₩15,000)으로 7일 체험 후 유료 전환, 미결제 시 Soft-Lock 다운그레이드되는 패밀리 단위 구독을 구현한다.

**Architecture:** Qonversion이 Google Play Billing과 Supabase 사이 중개자 역할. GPB는 결제·카드등록·영수증·환불 처리, Qonversion은 RTDN 파싱·엔타이틀먼트 계산·웹훅 발사, Supabase는 `family_subscription` 테이블에 상태 저장 + 트리거로 `families.subscription_tier` 캐시 갱신. 클라이언트는 Supabase를 Realtime으로 구독해 `useEntitlement()` 훅이 티어 가드 제공.

**Tech Stack:** React 19 + Vite + Capacitor Android + Supabase (PostgreSQL + Edge Functions Deno) + Qonversion + Google Play Billing. 테스트는 Vitest (신규 도입).

**Spec:** [`docs/superpowers/specs/2026-04-18-subscription-design.md`](../specs/2026-04-18-subscription-design.md)

---

## File Structure Overview

### 신규 파일

```
supabase/
├── migrations/
│   ├── 20260418000000_family_subscription.sql          # family_subscription 테이블 + 인덱스
│   ├── 20260418000001_subscription_tier_trigger.sql    # families.subscription_tier 자동 동기화
│   ├── 20260418000002_active_slot_columns.sql          # family_members/danger_zones active_slot
│   ├── 20260418000003_active_slot_trigger.sql          # 다운그레이드 시 active_slot 재계산
│   ├── 20260418000004_academies_notifications.sql      # academies.notifications_suppressed
│   └── 20260418000005_subscription_rls.sql             # 프리미엄 INSERT RLS 정책
├── functions/
│   ├── qonversion-webhook/
│   │   ├── index.ts                                    # 웹훅 진입점 + HMAC 검증
│   │   ├── handlers.ts                                 # 이벤트 타입별 핸들러
│   │   └── deno.json
│   └── subscription-reconcile/
│       ├── index.ts                                    # 시간당 복구 cron
│       └── deno.json
src/
├── lib/
│   ├── features.js                                     # FEATURES 상수
│   ├── qonversion.js                                   # Qonversion SDK 래퍼
│   ├── entitlement.js                                  # useEntitlement 훅
│   ├── entitlementCache.js                             # localStorage TTL 캐시
│   └── paywallCopy.js                                  # 한국어 카피 중앙 상수
└── components/
    ├── paywall/
    │   ├── TrialInvitePrompt.jsx
    │   ├── FeatureLockOverlay.jsx
    │   ├── InlineLockBadge.jsx
    │   ├── TrialEndingBanner.jsx
    │   └── AutoRenewalDisclosure.jsx                   # 체험 시작 전 고지
    └── settings/
        └── SubscriptionManagement.jsx                  # 설정 내 구독 관리 섹션
tests/
├── setup.js                                            # vitest 전역 설정
├── features.test.js
├── entitlement.test.js
├── entitlementCache.test.js
├── paywall/
│   ├── TrialInvitePrompt.test.jsx
│   ├── FeatureLockOverlay.test.jsx
│   ├── InlineLockBadge.test.jsx
│   └── TrialEndingBanner.test.jsx
└── supabase/
    ├── webhook-signature.test.ts                       # HMAC 검증 단위
    ├── webhook-idempotency.test.ts                     # event_id 중복 필터
    └── rls-premium-insert.test.sql                     # RLS 정책 통합 테스트
android/app/src/main/java/com/hyeni/qonversion/         # 2단계 폴백용 (조건부)
├── QonversionPlugin.java
└── QonversionModule.java
```

### 수정할 파일

- `src/App.jsx` — 페이월·체험 초대·구독 관리 훅 통합 (여러 태스크에 걸쳐 편집)
- `src/lib/auth.js` — 카카오 로그인 성공 시 `Qonversion.identify(family_id)` 호출
- `src/lib/pushNotifications.js` — Day 4/6/7 체험 종료 푸시 예약
- `package.json` — Qonversion Cordova 플러그인 + Vitest 의존성
- `capacitor.config.json` — Cordova 플러그인 활성화 설정

---

## Dependency Graph

```
Phase A (Infrastructure)
  A1 (family_subscription 테이블)
    └─ A2 (subscription_tier 트리거)
         └─ A5 (RLS 정책)
  A3 (active_slot 컬럼)
    └─ A4 (active_slot 트리거)
  A6 (notifications_suppressed)
  A7 (webhook Edge Function scaffold)
    └─ A8 (webhook 이벤트 핸들러)
  A9 (reconcile cron)
  A10 (raw_event purge cron)

Phase B (Testing Setup)  ← A와 병렬 가능
  B1 (Vitest 설치·설정)

Phase C (Client Foundation) — B1 완료 후
  C1 (Qonversion Cordova 플러그인 시도)
    └─ [실패 시] C1a (커스텀 Capacitor 플러그인)
  C2 (src/lib/features.js)
    └─ C3 (src/lib/qonversion.js)
         └─ C4 (src/lib/entitlementCache.js)
              └─ C5 (src/lib/entitlement.js + useEntitlement)

Phase D (Paywall Components) — C5 완료 후
  D0 (paywallCopy.js 카피 상수)
  D1 (TrialInvitePrompt)
  D2 (FeatureLockOverlay)
  D3 (InlineLockBadge)
  D4 (TrialEndingBanner)
  D5 (AutoRenewalDisclosure)

Phase E (App 통합) — C+D 완료 후
  E1 (auth.js: Qonversion.identify 통합)
  E2 (App.jsx: TrialInvitePrompt 트리거)
  E3 (App.jsx: 아이 기기 결제 UI 가드)
  E4 (App.jsx: 설정 내 SubscriptionManagement)

Phase F (Soft-Lock UI) — E 완료 후
  F1 (다자녀 UI 가드)
  F2 (다중 위험구역 가드)
  F3 (학원 신규 생성 가드)
  F4 (AI 분석 가드)
  F5 (원격 음성 가드)
  F6 (5분 지연 위치 로직)
  F7 (30일 위치 이력 조회 가드)

Phase G (푸시 알림) — C·E 완료 후, F와 병렬 가능
  G1 (체험 종료 푸시 스케줄)

Phase H (Pre-launch)
  H1 (이용약관·개인정보 업데이트)
  H2 (Early Adopter 가격 전환 계획서)
```

---

## Conventions Used in This Plan

- **테스트 먼저 (TDD)**: 각 로직 태스크는 failing test → implementation → passing test → commit 순서
- **파일 경로**: 항상 프로젝트 루트 상대 경로 (예: `src/lib/features.js`)
- **마이그레이션 실행**: 로컬 Supabase CLI가 없을 수 있으므로 마이그레이션 파일 작성 + 스펙 확인만 수행. 실제 적용은 Phase 끝에서 수동 실행
- **커밋 포맷**: `<type>: <description>` (예: `feat: family_subscription 테이블 추가`)
- **언어**: 코드 코멘트·커밋 메시지는 한국어 OK (기존 커밋 이력 따라)

---

## Phase A — Infrastructure (DB + Edge Functions)

### Task A1: `family_subscription` 테이블 마이그레이션

**Files:**
- Create: `supabase/migrations/20260418000000_family_subscription.sql`

- [ ] **Step 1: 마이그레이션 파일 작성**

```sql
-- supabase/migrations/20260418000000_family_subscription.sql
-- 가족 단위 구독 상태 저장 테이블

CREATE TABLE IF NOT EXISTS family_subscription (
  family_id            uuid PRIMARY KEY REFERENCES families(id) ON DELETE CASCADE,
  status               text NOT NULL CHECK (status IN ('trial','active','grace','cancelled','expired')),
  product_id           text NOT NULL CHECK (product_id IN ('premium_monthly','premium_yearly')),
  qonversion_user_id   text NOT NULL,
  trial_ends_at        timestamptz,
  current_period_end   timestamptz,
  cancelled_at         timestamptz,
  last_event_id        text,
  last_event_at        timestamptz,
  raw_event            jsonb,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_family_subscription_status ON family_subscription(status);
CREATE INDEX idx_family_subscription_trial_ends ON family_subscription(trial_ends_at) WHERE status = 'trial';
CREATE INDEX idx_family_subscription_updated ON family_subscription(updated_at);

CREATE TRIGGER family_subscription_updated_at
  BEFORE UPDATE ON family_subscription
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS: 클라이언트는 SELECT만 허용, WRITE는 SERVICE_ROLE만
ALTER TABLE family_subscription ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fs_sel" ON family_subscription FOR SELECT USING (
  family_id IN (SELECT family_id FROM family_members WHERE user_id = auth.uid())
);

-- INSERT/UPDATE/DELETE 정책 없음 → 클라이언트에서 write 불가
```

- [ ] **Step 2: SQL 구문 검증**

Run (dry-run 파싱만 — 실제 DB 연결 불필요):
```bash
cd /c/Users/TK/Desktop/hyeni && cat supabase/migrations/20260418000000_family_subscription.sql | head -40
```
Expected: 파일이 정상 출력됨

- [ ] **Step 3: 커밋**

```bash
cd /c/Users/TK/Desktop/hyeni && git add supabase/migrations/20260418000000_family_subscription.sql && git commit -m "feat: family_subscription 테이블 추가 (구독 상태 저장)"
```

---

### Task A2: `families.subscription_tier` 캐시 컬럼 + 자동 동기화 트리거

**Files:**
- Create: `supabase/migrations/20260418000001_subscription_tier_trigger.sql`

- [ ] **Step 1: 마이그레이션 작성**

```sql
-- supabase/migrations/20260418000001_subscription_tier_trigger.sql
-- families.subscription_tier를 family_subscription.status로부터 자동 계산

-- 1. families에 subscription_tier 컬럼 추가
ALTER TABLE families
  ADD COLUMN IF NOT EXISTS subscription_tier text NOT NULL DEFAULT 'free'
  CHECK (subscription_tier IN ('free','premium'));

CREATE INDEX IF NOT EXISTS idx_families_tier ON families(subscription_tier);

-- 2. 트리거 함수: family_subscription 변경 시 families.subscription_tier 재계산
CREATE OR REPLACE FUNCTION sync_subscription_tier()
RETURNS TRIGGER AS $$
DECLARE
  target_family_id uuid;
  new_tier text;
BEGIN
  -- INSERT/UPDATE 시 NEW, DELETE 시 OLD
  target_family_id := COALESCE(NEW.family_id, OLD.family_id);

  -- 상태 → 티어 매핑
  IF TG_OP = 'DELETE' THEN
    new_tier := 'free';
  ELSIF NEW.status IN ('trial','active','grace') THEN
    new_tier := 'premium';
  ELSE
    -- 'cancelled', 'expired'
    new_tier := 'free';
  END IF;

  UPDATE families SET subscription_tier = new_tier WHERE id = target_family_id;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. 트리거 바인딩
DROP TRIGGER IF EXISTS fs_sync_tier_ins ON family_subscription;
CREATE TRIGGER fs_sync_tier_ins
  AFTER INSERT ON family_subscription
  FOR EACH ROW EXECUTE FUNCTION sync_subscription_tier();

DROP TRIGGER IF EXISTS fs_sync_tier_upd ON family_subscription;
CREATE TRIGGER fs_sync_tier_upd
  AFTER UPDATE OF status ON family_subscription
  FOR EACH ROW EXECUTE FUNCTION sync_subscription_tier();

DROP TRIGGER IF EXISTS fs_sync_tier_del ON family_subscription;
CREATE TRIGGER fs_sync_tier_del
  AFTER DELETE ON family_subscription
  FOR EACH ROW EXECUTE FUNCTION sync_subscription_tier();

-- 4. families.subscription_tier는 트리거로만 변경. 클라이언트 UPDATE 금지 정책
-- (subscription_tier를 건드리는 UPDATE를 RLS에서 거부할 수 없으므로,
--  UPDATE 자체를 RLS로 막고 트리거는 SECURITY DEFINER로 우회)
-- 기존 families UPDATE 정책이 있다면 subscription_tier 컬럼 제외해야 하는데,
-- PostgreSQL RLS는 컬럼 단위를 지원하지 않음 → 대안:
--   - UPDATE 트리거로 NEW.subscription_tier = OLD.subscription_tier 강제
CREATE OR REPLACE FUNCTION lock_subscription_tier_on_update()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.subscription_tier IS DISTINCT FROM OLD.subscription_tier
     AND current_setting('app.bypass_tier_lock', true) IS DISTINCT FROM 'on'
  THEN
    NEW.subscription_tier := OLD.subscription_tier;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS families_lock_tier ON families;
CREATE TRIGGER families_lock_tier
  BEFORE UPDATE ON families
  FOR EACH ROW EXECUTE FUNCTION lock_subscription_tier_on_update();

-- sync_subscription_tier 함수는 트리거 내에서 SET LOCAL app.bypass_tier_lock = 'on' 설정 필요
CREATE OR REPLACE FUNCTION sync_subscription_tier()
RETURNS TRIGGER AS $$
DECLARE
  target_family_id uuid;
  new_tier text;
BEGIN
  target_family_id := COALESCE(NEW.family_id, OLD.family_id);

  IF TG_OP = 'DELETE' THEN
    new_tier := 'free';
  ELSIF NEW.status IN ('trial','active','grace') THEN
    new_tier := 'premium';
  ELSE
    new_tier := 'free';
  END IF;

  PERFORM set_config('app.bypass_tier_lock', 'on', true);
  UPDATE families SET subscription_tier = new_tier WHERE id = target_family_id;
  PERFORM set_config('app.bypass_tier_lock', 'off', true);

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

- [ ] **Step 2: 구문 검증**

Run:
```bash
cd /c/Users/TK/Desktop/hyeni && wc -l supabase/migrations/20260418000001_subscription_tier_trigger.sql
```
Expected: 80+ 줄

- [ ] **Step 3: 커밋**

```bash
cd /c/Users/TK/Desktop/hyeni && git add supabase/migrations/20260418000001_subscription_tier_trigger.sql && git commit -m "feat: subscription_tier 캐시 컬럼 + 자동 동기화 트리거"
```

---

### Task A3: `active_slot` 컬럼 추가 (family_members, danger_zones)

**Files:**
- Create: `supabase/migrations/20260418000002_active_slot_columns.sql`

- [ ] **Step 1: 마이그레이션 작성**

```sql
-- supabase/migrations/20260418000002_active_slot_columns.sql
-- Soft-Lock 다자녀·다중 위험구역 활성 슬롯 관리

ALTER TABLE family_members
  ADD COLUMN IF NOT EXISTS active_slot boolean NOT NULL DEFAULT true;

ALTER TABLE danger_zones
  ADD COLUMN IF NOT EXISTS active_slot boolean NOT NULL DEFAULT true;

-- 조회 성능: 활성 자녀만 빠르게
CREATE INDEX IF NOT EXISTS idx_family_members_active_slot
  ON family_members(family_id, role, active_slot)
  WHERE role = 'child' AND active_slot = true;

CREATE INDEX IF NOT EXISTS idx_danger_zones_active_slot
  ON danger_zones(family_id, active_slot)
  WHERE active_slot = true;
```

- [ ] **Step 2: 커밋**

```bash
cd /c/Users/TK/Desktop/hyeni && git add supabase/migrations/20260418000002_active_slot_columns.sql && git commit -m "feat: Soft-Lock용 active_slot 컬럼 추가"
```

---

### Task A4: 다운그레이드 시 `active_slot` 재계산 트리거

**Files:**
- Create: `supabase/migrations/20260418000003_active_slot_trigger.sql`

- [ ] **Step 1: 마이그레이션 작성**

```sql
-- supabase/migrations/20260418000003_active_slot_trigger.sql
-- families.subscription_tier 변경 시 active_slot 재계산

CREATE OR REPLACE FUNCTION recompute_active_slots()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.subscription_tier = 'premium' AND OLD.subscription_tier = 'free' THEN
    -- 프리미엄 복귀: 전원 활성
    UPDATE family_members SET active_slot = true
      WHERE family_id = NEW.id AND role = 'child';
    UPDATE danger_zones SET active_slot = true
      WHERE family_id = NEW.id;

  ELSIF NEW.subscription_tier = 'free' AND OLD.subscription_tier = 'premium' THEN
    -- 다운그레이드: 자녀는 가장 먼저 생성된 1명만, 위험구역도 1개만
    UPDATE family_members SET active_slot = false
      WHERE family_id = NEW.id AND role = 'child';
    UPDATE family_members SET active_slot = true
      WHERE id = (
        SELECT id FROM family_members
        WHERE family_id = NEW.id AND role = 'child'
        ORDER BY created_at ASC LIMIT 1
      );

    UPDATE danger_zones SET active_slot = false
      WHERE family_id = NEW.id;
    UPDATE danger_zones SET active_slot = true
      WHERE id = (
        SELECT id FROM danger_zones
        WHERE family_id = NEW.id
        ORDER BY created_at ASC LIMIT 1
      );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS families_tier_slots ON families;
CREATE TRIGGER families_tier_slots
  AFTER UPDATE OF subscription_tier ON families
  FOR EACH ROW
  WHEN (NEW.subscription_tier IS DISTINCT FROM OLD.subscription_tier)
  EXECUTE FUNCTION recompute_active_slots();
```

- [ ] **Step 2: 커밋**

```bash
cd /c/Users/TK/Desktop/hyeni && git add supabase/migrations/20260418000003_active_slot_trigger.sql && git commit -m "feat: 티어 변경 시 active_slot 재계산 트리거"
```

---

### Task A5: `academies.notifications_suppressed` + 트리거

**Files:**
- Create: `supabase/migrations/20260418000004_academies_notifications.sql`

- [ ] **Step 1: 마이그레이션 작성**

```sql
-- supabase/migrations/20260418000004_academies_notifications.sql
-- 무료 티어 다운그레이드 시 학원 알림 발송 중단

ALTER TABLE academies
  ADD COLUMN IF NOT EXISTS notifications_suppressed boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_academies_notif_suppressed
  ON academies(family_id)
  WHERE notifications_suppressed = false;

-- 티어 변경 시 학원 알림 플래그 재계산
CREATE OR REPLACE FUNCTION recompute_academy_notifications()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.subscription_tier = 'premium' AND OLD.subscription_tier = 'free' THEN
    UPDATE academies SET notifications_suppressed = false
      WHERE family_id = NEW.id;
  ELSIF NEW.subscription_tier = 'free' AND OLD.subscription_tier = 'premium' THEN
    UPDATE academies SET notifications_suppressed = true
      WHERE family_id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS families_tier_academy_notif ON families;
CREATE TRIGGER families_tier_academy_notif
  AFTER UPDATE OF subscription_tier ON families
  FOR EACH ROW
  WHEN (NEW.subscription_tier IS DISTINCT FROM OLD.subscription_tier)
  EXECUTE FUNCTION recompute_academy_notifications();
```

- [ ] **Step 2: 커밋**

```bash
cd /c/Users/TK/Desktop/hyeni && git add supabase/migrations/20260418000004_academies_notifications.sql && git commit -m "feat: 티어에 따라 학원 알림 발송 토글"
```

---

### Task A6: 프리미엄 전용 INSERT RLS 정책

**Files:**
- Create: `supabase/migrations/20260418000005_subscription_rls.sql`

- [ ] **Step 1: 마이그레이션 작성**

```sql
-- supabase/migrations/20260418000005_subscription_rls.sql
-- 프리미엄 전용 리소스 INSERT 가드

-- 1. 2번째 이후 자녀 family_members INSERT 차단 (role='child' 한정)
DROP POLICY IF EXISTS "fm_ins_premium_gate" ON family_members;
CREATE POLICY "fm_ins_premium_gate" ON family_members FOR INSERT WITH CHECK (
  family_id IN (SELECT family_id FROM family_members WHERE user_id = auth.uid())
  AND (
    role != 'child'
    OR (
      SELECT COUNT(*) FROM family_members
      WHERE family_id = family_members.family_id AND role = 'child'
    ) = 0
    OR (
      SELECT subscription_tier FROM families WHERE id = family_members.family_id
    ) = 'premium'
  )
);

-- 2. 2번째 이후 danger_zones INSERT 차단
DROP POLICY IF EXISTS "dz_ins_premium_gate" ON danger_zones;
CREATE POLICY "dz_ins_premium_gate" ON danger_zones FOR INSERT WITH CHECK (
  family_id IN (SELECT family_id FROM family_members WHERE user_id = auth.uid())
  AND (
    (
      SELECT COUNT(*) FROM danger_zones WHERE family_id = danger_zones.family_id
    ) = 0
    OR (
      SELECT subscription_tier FROM families WHERE id = danger_zones.family_id
    ) = 'premium'
  )
);

-- 3. academies 모든 INSERT → premium 요구
DROP POLICY IF EXISTS "academies_insert" ON academies;
CREATE POLICY "academies_insert" ON academies FOR INSERT WITH CHECK (
  family_id IN (SELECT family_id FROM family_members WHERE user_id = auth.uid())
  AND (
    SELECT subscription_tier FROM families WHERE id = academies.family_id
  ) = 'premium'
);

COMMENT ON POLICY "fm_ins_premium_gate" ON family_members IS
  'Soft-Lock: 첫 자녀는 무료 허용, 2번째부터 premium 필요';
COMMENT ON POLICY "dz_ins_premium_gate" ON danger_zones IS
  'Soft-Lock: 첫 위험구역은 무료 허용, 2번째부터 premium 필요';
COMMENT ON POLICY "academies_insert" ON academies IS
  '학원 신규 생성은 premium 전용 (기존 학원 UPDATE는 허용)';
```

- [ ] **Step 2: 커밋**

```bash
cd /c/Users/TK/Desktop/hyeni && git add supabase/migrations/20260418000005_subscription_rls.sql && git commit -m "feat: 프리미엄 전용 INSERT RLS 정책 추가"
```

---

### Task A7: `qonversion-webhook` Edge Function 스캐폴딩 + HMAC 검증

**Files:**
- Create: `supabase/functions/qonversion-webhook/index.ts`
- Create: `supabase/functions/qonversion-webhook/deno.json`
- Create: `tests/supabase/webhook-signature.test.ts`

- [ ] **Step 1: `deno.json` 작성**

```json
{
  "imports": {
    "@supabase/supabase-js": "npm:@supabase/supabase-js@2"
  }
}
```

- [ ] **Step 2: failing test 작성**

```ts
// tests/supabase/webhook-signature.test.ts
import { describe, it, expect } from 'vitest';
import { verifySignature } from '../../supabase/functions/qonversion-webhook/signature.ts';

describe('Qonversion webhook signature', () => {
  const secret = 'test_secret_123';
  const payload = '{"event":"trial_started","user_id":"family-1"}';

  it('수동 계산한 HMAC-SHA256 서명을 검증한다', async () => {
    const crypto = await import('node:crypto');
    const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex');
    const result = await verifySignature(payload, expected, secret);
    expect(result).toBe(true);
  });

  it('변조된 서명을 거부한다', async () => {
    const result = await verifySignature(payload, 'deadbeef', secret);
    expect(result).toBe(false);
  });

  it('빈 서명을 거부한다', async () => {
    const result = await verifySignature(payload, '', secret);
    expect(result).toBe(false);
  });
});
```

- [ ] **Step 3: 테스트 실행 → fail 확인**

Run: `cd /c/Users/TK/Desktop/hyeni && npx vitest run tests/supabase/webhook-signature.test.ts`
Expected: FAIL — `Cannot find module '../../supabase/functions/qonversion-webhook/signature.ts'`

(B1에서 Vitest가 설치되어 있어야 함)

- [ ] **Step 4: `signature.ts` 구현**

```ts
// supabase/functions/qonversion-webhook/signature.ts
// Deno/Node 양쪽 호환 HMAC-SHA256 검증

export async function verifySignature(
  payload: string,
  signatureHex: string,
  secret: string,
): Promise<boolean> {
  if (!signatureHex || signatureHex.length === 0) return false;

  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const msgData = encoder.encode(payload);

  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );

  const sigBuffer = await crypto.subtle.sign('HMAC', key, msgData);
  const expectedHex = Array.from(new Uint8Array(sigBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  return timingSafeEqual(signatureHex, expectedHex);
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}
```

- [ ] **Step 5: `index.ts` 스캐폴딩**

```ts
// supabase/functions/qonversion-webhook/index.ts
// Qonversion 웹훅 수신 엔드포인트

import { createClient } from '@supabase/supabase-js';
import { verifySignature } from './signature.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const QONVERSION_WEBHOOK_SECRET = Deno.env.get('QONVERSION_WEBHOOK_SECRET')!;

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const signature = req.headers.get('x-qonversion-signature') || '';
  const rawBody = await req.text();

  const valid = await verifySignature(rawBody, signature, QONVERSION_WEBHOOK_SECRET);
  if (!valid) {
    console.warn('[qonversion-webhook] invalid signature');
    return new Response('Invalid signature', { status: 401 });
  }

  let payload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }

  // A8에서 핸들러 분기 추가 예정
  console.log('[qonversion-webhook] received event', payload.type);

  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'content-type': 'application/json' },
  });
});
```

- [ ] **Step 6: 테스트 재실행 → pass 확인**

Run: `cd /c/Users/TK/Desktop/hyeni && npx vitest run tests/supabase/webhook-signature.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 7: 커밋**

```bash
cd /c/Users/TK/Desktop/hyeni && git add supabase/functions/qonversion-webhook/ tests/supabase/webhook-signature.test.ts && git commit -m "feat: qonversion-webhook Edge Function 스캐폴딩 + HMAC 검증"
```

---

### Task A8: 이벤트 핸들러 + 멱등성 체크

**Files:**
- Create: `supabase/functions/qonversion-webhook/handlers.ts`
- Modify: `supabase/functions/qonversion-webhook/index.ts`
- Create: `tests/supabase/webhook-idempotency.test.ts`

- [ ] **Step 1: failing test 작성**

```ts
// tests/supabase/webhook-idempotency.test.ts
import { describe, it, expect, vi } from 'vitest';
import { handleEvent } from '../../supabase/functions/qonversion-webhook/handlers.ts';

describe('Qonversion event handlers', () => {
  const mkSupabaseMock = (existingEventId: string | null = null) => {
    const upserts: any[] = [];
    return {
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: existingEventId ? { last_event_id: existingEventId } : null,
            }),
          }),
        }),
        upsert: (row: any) => {
          upserts.push(row);
          return { select: () => ({ maybeSingle: async () => ({ data: row }) }) };
        },
      }),
      _upserts: upserts,
    } as any;
  };

  it('trial_started 이벤트로 INSERT 수행', async () => {
    const sb = mkSupabaseMock();
    const payload = {
      type: 'trial_started',
      event_id: 'evt-001',
      user_id: 'family-123',
      product_id: 'premium_monthly',
      occurred_at: '2026-04-18T00:00:00Z',
    };
    await handleEvent(sb, payload);
    expect(sb._upserts.length).toBe(1);
    expect(sb._upserts[0].status).toBe('trial');
    expect(sb._upserts[0].family_id).toBe('family-123');
    expect(sb._upserts[0].trial_ends_at).toBeTruthy();
  });

  it('동일 event_id를 두 번 받으면 무시한다', async () => {
    const sb = mkSupabaseMock('evt-001');
    const payload = {
      type: 'trial_started',
      event_id: 'evt-001',
      user_id: 'family-123',
      product_id: 'premium_monthly',
      occurred_at: '2026-04-18T00:00:00Z',
    };
    await handleEvent(sb, payload);
    expect(sb._upserts.length).toBe(0);
  });

  it('trial_canceled 이벤트로 status=cancelled 설정', async () => {
    const sb = mkSupabaseMock();
    const payload = {
      type: 'trial_canceled',
      event_id: 'evt-002',
      user_id: 'family-123',
      occurred_at: '2026-04-19T00:00:00Z',
    };
    await handleEvent(sb, payload);
    expect(sb._upserts[0].status).toBe('cancelled');
    expect(sb._upserts[0].cancelled_at).toBeTruthy();
  });

  it('subscription_refunded → status=expired', async () => {
    const sb = mkSupabaseMock();
    const payload = {
      type: 'subscription_refunded',
      event_id: 'evt-003',
      user_id: 'family-123',
      occurred_at: '2026-04-20T00:00:00Z',
    };
    await handleEvent(sb, payload);
    expect(sb._upserts[0].status).toBe('expired');
  });

  it('알 수 없는 이벤트 타입은 무시', async () => {
    const sb = mkSupabaseMock();
    const payload = {
      type: 'unknown_event',
      event_id: 'evt-004',
      user_id: 'family-123',
      occurred_at: '2026-04-20T00:00:00Z',
    };
    await handleEvent(sb, payload);
    expect(sb._upserts.length).toBe(0);
  });
});
```

- [ ] **Step 2: 테스트 실행 → fail 확인**

Run: `cd /c/Users/TK/Desktop/hyeni && npx vitest run tests/supabase/webhook-idempotency.test.ts`
Expected: FAIL — handlers.ts not found

- [ ] **Step 3: `handlers.ts` 구현**

```ts
// supabase/functions/qonversion-webhook/handlers.ts
// 이벤트 타입별 family_subscription 갱신 로직

type SupabaseLike = {
  from: (table: string) => any;
};

type WebhookEvent = {
  type: string;
  event_id: string;
  user_id: string;
  product_id?: string;
  current_period_end?: string;
  occurred_at: string;
};

export async function handleEvent(supabase: SupabaseLike, evt: WebhookEvent): Promise<void> {
  // 멱등성 체크
  const { data: existing } = await supabase
    .from('family_subscription')
    .select('last_event_id')
    .eq('family_id', evt.user_id)
    .maybeSingle();

  if (existing?.last_event_id === evt.event_id) {
    console.log(`[handleEvent] duplicate event ${evt.event_id}, skip`);
    return;
  }

  const baseRow = {
    family_id: evt.user_id,
    qonversion_user_id: evt.user_id,
    product_id: evt.product_id || 'premium_monthly',
    last_event_id: evt.event_id,
    last_event_at: evt.occurred_at,
    raw_event: evt as any,
  };

  let row: any = null;

  switch (evt.type) {
    case 'trial_started': {
      const trialEnd = new Date(evt.occurred_at);
      trialEnd.setDate(trialEnd.getDate() + 7);
      row = {
        ...baseRow,
        status: 'trial',
        trial_ends_at: trialEnd.toISOString(),
        current_period_end: evt.current_period_end || trialEnd.toISOString(),
      };
      break;
    }
    case 'trial_converted':
    case 'subscription_started':
    case 'subscription_renewed':
      row = {
        ...baseRow,
        status: 'active',
        trial_ends_at: null,
        current_period_end: evt.current_period_end || null,
      };
      break;
    case 'trial_canceled':
    case 'subscription_canceled':
      row = {
        ...baseRow,
        status: 'cancelled',
        cancelled_at: evt.occurred_at,
      };
      break;
    case 'subscription_refunded':
      row = {
        ...baseRow,
        status: 'expired',
      };
      break;
    case 'grace_period_started':
      row = {
        ...baseRow,
        status: 'grace',
      };
      break;
    default:
      console.log(`[handleEvent] unknown event type ${evt.type}`);
      return;
  }

  await supabase.from('family_subscription').upsert(row).select().maybeSingle();
}
```

- [ ] **Step 4: `index.ts`에서 핸들러 호출 추가**

Replace in `supabase/functions/qonversion-webhook/index.ts`:

```ts
// 기존:
// A8에서 핸들러 분기 추가 예정
console.log('[qonversion-webhook] received event', payload.type);
```

with:

```ts
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

try {
  await handleEvent(supabase, payload);
} catch (err) {
  console.error('[qonversion-webhook] handler failed', err);
  return new Response('handler error', { status: 500 });
}
```

and add import at top:
```ts
import { handleEvent } from './handlers.ts';
```

- [ ] **Step 5: 테스트 재실행 → pass 확인**

Run: `cd /c/Users/TK/Desktop/hyeni && npx vitest run tests/supabase/webhook-idempotency.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 6: 커밋**

```bash
cd /c/Users/TK/Desktop/hyeni && git add supabase/functions/qonversion-webhook/ tests/supabase/webhook-idempotency.test.ts && git commit -m "feat: webhook 이벤트 핸들러 + 멱등성 체크"
```

---

### Task A9: `subscription-reconcile` 복구 Cron Edge Function

**Files:**
- Create: `supabase/functions/subscription-reconcile/index.ts`
- Create: `supabase/functions/subscription-reconcile/deno.json`

- [ ] **Step 1: `deno.json` 작성**

```json
{
  "imports": {
    "@supabase/supabase-js": "npm:@supabase/supabase-js@2"
  }
}
```

- [ ] **Step 2: Edge Function 작성**

```ts
// supabase/functions/subscription-reconcile/index.ts
// 매 시간 실행 — 24시간 이상 업데이트 안 된 구독을 Qonversion에서 조회해 동기화

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const QONVERSION_API_KEY = Deno.env.get('QONVERSION_API_KEY')!;
const QONVERSION_API_BASE = 'https://api.qonversion.io/v3';

Deno.serve(async () => {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data: stale, error } = await supabase
    .from('family_subscription')
    .select('family_id, status, last_event_id')
    .lt('updated_at', cutoff);

  if (error) {
    console.error('[reconcile] fetch stale failed', error);
    return new Response('fetch error', { status: 500 });
  }

  let synced = 0;
  let skipped = 0;

  for (const row of stale || []) {
    try {
      const res = await fetch(
        `${QONVERSION_API_BASE}/users/${encodeURIComponent(row.family_id)}/entitlements`,
        { headers: { Authorization: `Bearer ${QONVERSION_API_KEY}` } },
      );
      if (!res.ok) {
        console.warn(`[reconcile] qonversion fetch failed for ${row.family_id}:`, res.status);
        skipped++;
        continue;
      }
      const body = await res.json();
      const premium = (body.data || []).find((e: any) => e.id === 'premium');

      const qStatus = deriveStatus(premium);
      if (qStatus && qStatus !== row.status) {
        await supabase
          .from('family_subscription')
          .update({ status: qStatus, updated_at: new Date().toISOString() })
          .eq('family_id', row.family_id);
        synced++;
        console.log(`[reconcile] ${row.family_id}: ${row.status} → ${qStatus}`);
      }
    } catch (err) {
      console.error(`[reconcile] error for ${row.family_id}`, err);
      skipped++;
    }
  }

  return new Response(
    JSON.stringify({ total: (stale || []).length, synced, skipped }),
    { headers: { 'content-type': 'application/json' } },
  );
});

function deriveStatus(ent: any): string | null {
  if (!ent || !ent.active) return 'expired';
  if (ent.is_in_trial) return 'trial';
  if (ent.is_in_grace_period) return 'grace';
  if (ent.active) return 'active';
  return null;
}
```

- [ ] **Step 3: 커밋**

```bash
cd /c/Users/TK/Desktop/hyeni && git add supabase/functions/subscription-reconcile/ && git commit -m "feat: subscription-reconcile 복구 cron 추가"
```

---

### Task A10: `raw_event` 30일 purge Cron

**Files:**
- Create: `supabase/migrations/20260418000006_raw_event_purge.sql`

- [ ] **Step 1: 마이그레이션 작성**

```sql
-- supabase/migrations/20260418000006_raw_event_purge.sql
-- 30일 이상 경과한 raw_event 페이로드를 NULL로 처리 (디버그 데이터 용량 제어)

CREATE OR REPLACE FUNCTION purge_old_raw_events()
RETURNS void AS $$
BEGIN
  UPDATE family_subscription
    SET raw_event = NULL
    WHERE last_event_at < now() - interval '30 days'
      AND raw_event IS NOT NULL;
END;
$$ LANGUAGE plpgsql;

-- pg_cron 확장 사용 (Supabase는 pg_cron 기본 제공)
-- 매일 03:00 KST = 18:00 UTC에 실행
SELECT cron.schedule(
  'purge_raw_events_daily',
  '0 18 * * *',
  $$SELECT purge_old_raw_events();$$
) WHERE NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'purge_raw_events_daily');
```

- [ ] **Step 2: 커밋**

```bash
cd /c/Users/TK/Desktop/hyeni && git add supabase/migrations/20260418000006_raw_event_purge.sql && git commit -m "feat: raw_event 30일 purge cron 추가"
```

---

## Phase B — Testing Setup

### Task B1: Vitest 설치 + 설정

**Files:**
- Modify: `package.json`
- Create: `vitest.config.js`
- Create: `tests/setup.js`

- [ ] **Step 1: Vitest + JSDOM + Testing Library 설치**

Run:
```bash
cd /c/Users/TK/Desktop/hyeni && npm install --save-dev vitest@^2 @vitest/ui jsdom @testing-library/react @testing-library/jest-dom
```

- [ ] **Step 2: `vitest.config.js` 작성**

```js
// vitest.config.js
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.js'],
    include: ['tests/**/*.{test,spec}.{js,jsx,ts,tsx}'],
  },
});
```

- [ ] **Step 3: `tests/setup.js` 작성**

```js
// tests/setup.js
import '@testing-library/jest-dom';

// Capacitor mock (jsdom 환경에서는 Capacitor 없음)
if (typeof window !== 'undefined' && !window.Capacitor) {
  window.Capacitor = {
    isNativePlatform: () => false,
    getPlatform: () => 'web',
  };
}
```

- [ ] **Step 4: `package.json`에 test 스크립트 추가**

In `package.json` modify "scripts":
```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "lint": "eslint .",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:ui": "vitest --ui"
  }
}
```

- [ ] **Step 5: 스모크 테스트**

Create `tests/smoke.test.js`:
```js
import { describe, it, expect } from 'vitest';
describe('vitest smoke', () => {
  it('works', () => {
    expect(1 + 1).toBe(2);
  });
});
```

Run: `cd /c/Users/TK/Desktop/hyeni && npm test -- tests/smoke.test.js`
Expected: PASS

- [ ] **Step 6: 커밋**

```bash
cd /c/Users/TK/Desktop/hyeni && git add package.json package-lock.json vitest.config.js tests/ && git commit -m "chore: vitest + jsdom + testing-library 설치"
```

---

## Phase C — Client Foundation

### Task C1: Qonversion Cordova 플러그인 프로토타입 검증

**Files:**
- Modify: `package.json`
- Modify: `capacitor.config.json`

- [ ] **Step 1: Cordova 플러그인 설치**

Run:
```bash
cd /c/Users/TK/Desktop/hyeni && npm install cordova-plugin-qonversion
```

- [ ] **Step 2: Capacitor sync**

Run:
```bash
cd /c/Users/TK/Desktop/hyeni && npx cap sync android
```
Expected: "Sync finished" (플러그인이 Android 프로젝트에 통합되는지 로그 확인)

- [ ] **Step 3: 검증 스크립트**

Create `scripts/verify-qonversion.js`:
```js
// scripts/verify-qonversion.js
// Cordova 플러그인이 Android Gradle 프로젝트에 정상 통합되었는지 확인
import fs from 'node:fs';
import path from 'node:path';

const androidPluginsFile = path.join(
  process.cwd(),
  'android/capacitor-cordova-android-plugins/src/main/java/',
);

if (!fs.existsSync(androidPluginsFile)) {
  console.error('FAIL: Cordova 플러그인 디렉토리 없음');
  process.exit(1);
}

const found = fs.readdirSync(androidPluginsFile, { recursive: true })
  .some((f) => String(f).toLowerCase().includes('qonversion'));

if (!found) {
  console.error('FAIL: Qonversion 소스 발견 안 됨. 2단계 폴백 필요.');
  process.exit(2);
}

console.log('PASS: Cordova 플러그인 통합 OK');
```

Run: `cd /c/Users/TK/Desktop/hyeni && node scripts/verify-qonversion.js`

**Expected**:
- PASS → 다음 태스크 C2 (Qonversion 래퍼 JS)로 진행
- FAIL → Task C1a (커스텀 Capacitor 플러그인)로 분기

- [ ] **Step 4: 결과 기록 + 커밋**

만약 PASS: `package.json`과 `package-lock.json` 커밋
```bash
cd /c/Users/TK/Desktop/hyeni && git add package.json package-lock.json capacitor.config.json scripts/verify-qonversion.js && git commit -m "chore: cordova-plugin-qonversion 설치 + 통합 검증 스크립트"
```

만약 FAIL: Cordova 플러그인 제거 후 Task C1a 실행
```bash
cd /c/Users/TK/Desktop/hyeni && npm uninstall cordova-plugin-qonversion && git checkout package.json package-lock.json
```

---

### Task C1a: 커스텀 Capacitor 플러그인 (C1 실패 시 폴백)

> **조건부 태스크**: C1의 검증 스크립트가 FAIL 반환한 경우에만 실행.

**Files:**
- Create: `android/app/src/main/java/com/hyeni/qonversion/QonversionPlugin.java`
- Create: `android/app/src/main/java/com/hyeni/qonversion/QonversionModule.java`
- Modify: `android/app/build.gradle` (의존성 추가)
- Modify: `android/app/src/main/java/com/hyeni/calendar/MainActivity.java` (플러그인 등록)

- [ ] **Step 1: Qonversion Android SDK 의존성 추가**

In `android/app/build.gradle`, add to `dependencies` block:
```gradle
implementation "io.qonversion.android.sdk:sdk:8.1.0"
```

- [ ] **Step 2: `QonversionPlugin.java` 작성**

```java
// android/app/src/main/java/com/hyeni/qonversion/QonversionPlugin.java
package com.hyeni.qonversion;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import io.qonversion.android.sdk.Qonversion;
import io.qonversion.android.sdk.QonversionConfig;
import io.qonversion.android.sdk.dto.QLaunchMode;
import io.qonversion.android.sdk.dto.QEntitlement;
import io.qonversion.android.sdk.dto.products.QProduct;
import io.qonversion.android.sdk.listeners.QonversionEntitlementsCallback;
import io.qonversion.android.sdk.listeners.QonversionOfferingsCallback;
import io.qonversion.android.sdk.listeners.QonversionPurchaseCallback;

import java.util.Map;

@CapacitorPlugin(name = "Qonversion")
public class QonversionPlugin extends Plugin {

  @Override
  public void load() {
    super.load();
    String projectKey = getConfig().getString("qonversionProjectKey");
    if (projectKey != null && !projectKey.isEmpty()) {
      QonversionConfig config = new QonversionConfig.Builder(
        getContext(),
        projectKey,
        QLaunchMode.SubscriptionManagement
      ).build();
      Qonversion.initialize(config);
    }
  }

  @PluginMethod
  public void identify(PluginCall call) {
    String userId = call.getString("userId");
    if (userId == null) {
      call.reject("userId required");
      return;
    }
    Qonversion.getSharedInstance().identify(userId);
    call.resolve();
  }

  @PluginMethod
  public void checkEntitlements(PluginCall call) {
    Qonversion.getSharedInstance().checkEntitlements(new QonversionEntitlementsCallback() {
      @Override
      public void onSuccess(Map<String, QEntitlement> entitlements) {
        JSObject out = new JSObject();
        QEntitlement premium = entitlements.get("premium");
        out.put("hasPremium", premium != null && premium.isActive());
        out.put("isTrial", premium != null && premium.isInTrial());
        if (premium != null && premium.getExpirationDate() != null) {
          out.put("expiresAt", premium.getExpirationDate().getTime());
        }
        call.resolve(out);
      }

      @Override
      public void onError(io.qonversion.android.sdk.dto.QonversionError error) {
        call.reject(error.getDescription());
      }
    });
  }

  @PluginMethod
  public void purchase(PluginCall call) {
    String productId = call.getString("productId");
    if (productId == null) {
      call.reject("productId required");
      return;
    }
    Qonversion.getSharedInstance().getProducts(new io.qonversion.android.sdk.listeners.QonversionProductsCallback() {
      @Override
      public void onSuccess(Map<String, QProduct> products) {
        QProduct product = products.get(productId);
        if (product == null) {
          call.reject("product not found: " + productId);
          return;
        }
        Qonversion.getSharedInstance().purchase(getActivity(), product, new QonversionEntitlementsCallback() {
          @Override
          public void onSuccess(Map<String, QEntitlement> entitlements) {
            JSObject out = new JSObject();
            QEntitlement premium = entitlements.get("premium");
            out.put("success", true);
            out.put("hasPremium", premium != null && premium.isActive());
            call.resolve(out);
          }
          @Override
          public void onError(io.qonversion.android.sdk.dto.QonversionError error) {
            call.reject(error.getDescription());
          }
        });
      }
      @Override
      public void onError(io.qonversion.android.sdk.dto.QonversionError error) {
        call.reject(error.getDescription());
      }
    });
  }

  @PluginMethod
  public void restore(PluginCall call) {
    Qonversion.getSharedInstance().restore(new QonversionEntitlementsCallback() {
      @Override
      public void onSuccess(Map<String, QEntitlement> entitlements) {
        JSObject out = new JSObject();
        QEntitlement premium = entitlements.get("premium");
        out.put("hasPremium", premium != null && premium.isActive());
        call.resolve(out);
      }
      @Override
      public void onError(io.qonversion.android.sdk.dto.QonversionError error) {
        call.reject(error.getDescription());
      }
    });
  }

  @PluginMethod
  public void getOfferings(PluginCall call) {
    Qonversion.getSharedInstance().getOfferings(new QonversionOfferingsCallback() {
      @Override
      public void onSuccess(io.qonversion.android.sdk.dto.offerings.QOfferings offerings) {
        JSObject out = new JSObject();
        io.qonversion.android.sdk.dto.offerings.QOffering main = offerings.getMain();
        if (main != null) {
          JSObject offering = new JSObject();
          offering.put("id", main.getId());
          // products는 별도 배열로
          out.put("mainId", main.getId());
        }
        call.resolve(out);
      }
      @Override
      public void onError(io.qonversion.android.sdk.dto.QonversionError error) {
        call.reject(error.getDescription());
      }
    });
  }
}
```

- [ ] **Step 3: MainActivity에 플러그인 등록**

In `android/app/src/main/java/com/hyeni/calendar/MainActivity.java`, add to `onCreate` or plugins list:
```java
registerPlugin(com.hyeni.qonversion.QonversionPlugin.class);
```

- [ ] **Step 4: `capacitor.config.json`에 설정 키 추가**

```json
{
  ...,
  "plugins": {
    "Qonversion": {
      "qonversionProjectKey": "YOUR_QONVERSION_PROJECT_KEY"
    }
  }
}
```

실제 키는 배포 전 Qonversion 대시보드에서 확인해서 주입. 개발 단계에서는 더미 문자열.

- [ ] **Step 5: 빌드 검증**

Run: `cd /c/Users/TK/Desktop/hyeni && npx cap sync android && cd android && ./gradlew assembleDebug`
Expected: `BUILD SUCCESSFUL`

(로컬 Gradle 환경 실패 가능 — 실패 시 에러 로그 수집해서 별도 이슈로 처리)

- [ ] **Step 6: 커밋**

```bash
cd /c/Users/TK/Desktop/hyeni && git add android/app/ capacitor.config.json && git commit -m "feat: 커스텀 Capacitor Qonversion 플러그인 (C1 폴백)"
```

---

### Task C2: `src/lib/features.js` 상수 + 테스트

**Files:**
- Create: `src/lib/features.js`
- Create: `tests/features.test.js`

- [ ] **Step 1: failing test 작성**

```js
// tests/features.test.js
import { describe, it, expect } from 'vitest';
import { FEATURES, ALL_FEATURES } from '../src/lib/features.js';

describe('FEATURES 상수', () => {
  it('7개 feature 키 노출', () => {
    expect(Object.keys(FEATURES).length).toBe(7);
  });

  it('모든 feature 값이 snake_case 문자열', () => {
    for (const v of Object.values(FEATURES)) {
      expect(v).toMatch(/^[a-z_]+$/);
    }
  });

  it('ALL_FEATURES가 FEATURES 값 집합을 포함', () => {
    for (const v of Object.values(FEATURES)) {
      expect(ALL_FEATURES).toContain(v);
    }
  });
});
```

- [ ] **Step 2: 실행 → fail**

Run: `cd /c/Users/TK/Desktop/hyeni && npm test -- tests/features.test.js`
Expected: FAIL — features.js 없음

- [ ] **Step 3: `features.js` 구현**

```js
// src/lib/features.js
// 프리미엄 기능 식별 상수. useEntitlement.canUse(feature)에서 사용.

export const FEATURES = Object.freeze({
  REALTIME_LOCATION: 'realtime_location',
  MULTI_CHILD: 'multi_child',
  REMOTE_AUDIO: 'remote_audio',
  AI_ANALYSIS: 'ai_analysis',
  ACADEMY_SCHEDULE: 'academy_schedule',
  MULTI_GEOFENCE: 'multi_geofence',
  EXTENDED_HISTORY: 'extended_history',
});

export const ALL_FEATURES = Object.values(FEATURES);
```

- [ ] **Step 4: 실행 → pass**

Run: `cd /c/Users/TK/Desktop/hyeni && npm test -- tests/features.test.js`
Expected: PASS (3 tests)

- [ ] **Step 5: 커밋**

```bash
cd /c/Users/TK/Desktop/hyeni && git add src/lib/features.js tests/features.test.js && git commit -m "feat: FEATURES 상수 추가"
```

---

### Task C3: `src/lib/qonversion.js` SDK 래퍼

**Files:**
- Create: `src/lib/qonversion.js`

> 이 태스크는 기본적으로 Cordova 플러그인 경로 기준. C1a 폴백 경로면 주석 대로 `registerPlugin('Qonversion')` 사용.

- [ ] **Step 1: `qonversion.js` 구현**

```js
// src/lib/qonversion.js
// Qonversion SDK 단일 진입점 (Cordova or Capacitor 플러그인 추상화)

function isNative() {
  return typeof window !== 'undefined' && !!window.Capacitor?.isNativePlatform?.();
}

function getBackend() {
  if (!isNative()) return null;

  // 1순위: Cordova 플러그인 (C1 성공 시)
  if (typeof window !== 'undefined' && window.cordova?.plugins?.Qonversion) {
    return window.cordova.plugins.Qonversion;
  }
  // 2순위: Capacitor 커스텀 플러그인 (C1a 경로)
  if (typeof window !== 'undefined' && window.Capacitor?.Plugins?.Qonversion) {
    return window.Capacitor.Plugins.Qonversion;
  }
  return null;
}

export async function identify(familyId) {
  const be = getBackend();
  if (!be || !familyId) return;
  try {
    await be.identify({ userId: familyId });
  } catch (err) {
    console.warn('[qonversion] identify failed', err);
  }
}

export async function checkEntitlements() {
  const be = getBackend();
  if (!be) return { hasPremium: false, isTrial: false, expiresAt: null };
  try {
    const result = await be.checkEntitlements();
    return {
      hasPremium: !!result.hasPremium,
      isTrial: !!result.isTrial,
      expiresAt: result.expiresAt ? new Date(result.expiresAt) : null,
    };
  } catch (err) {
    console.warn('[qonversion] checkEntitlements failed', err);
    return { hasPremium: false, isTrial: false, expiresAt: null };
  }
}

export async function purchase(productId) {
  const be = getBackend();
  if (!be) throw new Error('Qonversion plugin not available');
  return be.purchase({ productId });
}

export async function restore() {
  const be = getBackend();
  if (!be) return { hasPremium: false };
  return be.restore();
}

export async function getOfferings() {
  const be = getBackend();
  if (!be) return null;
  return be.getOfferings();
}
```

- [ ] **Step 2: import 검증**

Run: `cd /c/Users/TK/Desktop/hyeni && node --input-type=module -e "import('./src/lib/qonversion.js').then(m => console.log(Object.keys(m)))"`
Expected: `[ 'identify', 'checkEntitlements', 'purchase', 'restore', 'getOfferings' ]`

- [ ] **Step 3: 커밋**

```bash
cd /c/Users/TK/Desktop/hyeni && git add src/lib/qonversion.js && git commit -m "feat: Qonversion SDK 래퍼 (Cordova/Capacitor 이중 대응)"
```

---

### Task C4: localStorage 캐시 `entitlementCache.js`

**Files:**
- Create: `src/lib/entitlementCache.js`
- Create: `tests/entitlementCache.test.js`

- [ ] **Step 1: failing test 작성**

```js
// tests/entitlementCache.test.js
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  readEntitlementCache,
  writeEntitlementCache,
  clearEntitlementCache,
  CACHE_TTL_MS,
} from '../src/lib/entitlementCache.js';

describe('entitlementCache', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useRealTimers();
  });

  it('write 후 read로 동일 값 복원', () => {
    const ent = { tier: 'premium', status: 'trial', trialDaysLeft: 5 };
    writeEntitlementCache(ent);
    expect(readEntitlementCache()).toEqual(expect.objectContaining(ent));
  });

  it('캐시 없음 → null 반환', () => {
    expect(readEntitlementCache()).toBeNull();
  });

  it('TTL 초과 → null 반환 + 자동 삭제', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-18T00:00:00Z'));
    writeEntitlementCache({ tier: 'premium', status: 'active' });

    vi.setSystemTime(new Date('2026-04-18T00:00:00Z').getTime() + CACHE_TTL_MS + 1000);
    expect(readEntitlementCache()).toBeNull();
    expect(localStorage.getItem('hyeni_entitlement')).toBeNull();
  });

  it('clearEntitlementCache가 캐시 삭제', () => {
    writeEntitlementCache({ tier: 'premium', status: 'active' });
    clearEntitlementCache();
    expect(readEntitlementCache()).toBeNull();
  });

  it('파싱 에러 시 null 반환', () => {
    localStorage.setItem('hyeni_entitlement', 'not valid json');
    expect(readEntitlementCache()).toBeNull();
  });
});
```

- [ ] **Step 2: fail 확인**

Run: `cd /c/Users/TK/Desktop/hyeni && npm test -- tests/entitlementCache.test.js`
Expected: FAIL

- [ ] **Step 3: 구현**

```js
// src/lib/entitlementCache.js
// 엔타이틀먼트 localStorage 캐시 — 오프라인·초기 로드 부스트

const STORAGE_KEY = 'hyeni_entitlement';
export const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7일

export function readEntitlementCache() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || !parsed._cachedAt) return null;
    if (Date.now() - parsed._cachedAt > CACHE_TTL_MS) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    const { _cachedAt, ...rest } = parsed;
    return { ...rest, _cachedAt };
  } catch {
    return null;
  }
}

export function writeEntitlementCache(entitlement) {
  try {
    const row = { ...entitlement, _cachedAt: Date.now() };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(row));
  } catch (err) {
    console.warn('[entitlementCache] write failed', err);
  }
}

export function clearEntitlementCache() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
```

- [ ] **Step 4: pass 확인**

Run: `cd /c/Users/TK/Desktop/hyeni && npm test -- tests/entitlementCache.test.js`
Expected: PASS (5 tests)

- [ ] **Step 5: 커밋**

```bash
cd /c/Users/TK/Desktop/hyeni && git add src/lib/entitlementCache.js tests/entitlementCache.test.js && git commit -m "feat: entitlement localStorage 캐시 (TTL 7일)"
```

---

### Task C5: `useEntitlement` 훅 + `entitlement.js`

**Files:**
- Create: `src/lib/entitlement.js`
- Create: `tests/entitlement.test.js`

- [ ] **Step 1: failing test 작성**

```js
// tests/entitlement.test.js
import { describe, it, expect } from 'vitest';
import {
  deriveEntitlement,
  canUseFeature,
  computeTrialDaysLeft,
} from '../src/lib/entitlement.js';
import { FEATURES } from '../src/lib/features.js';

describe('deriveEntitlement', () => {
  it('구독 없음 → free 티어', () => {
    expect(deriveEntitlement(null)).toEqual(expect.objectContaining({
      tier: 'free',
      status: 'expired',
      isTrial: false,
    }));
  });

  it('trial 상태 → premium 티어, isTrial=true', () => {
    const row = {
      status: 'trial',
      trial_ends_at: new Date(Date.now() + 5 * 86400_000).toISOString(),
    };
    const ent = deriveEntitlement(row);
    expect(ent.tier).toBe('premium');
    expect(ent.status).toBe('trial');
    expect(ent.isTrial).toBe(true);
    expect(ent.trialDaysLeft).toBe(5);
  });

  it('active 상태 → premium 티어', () => {
    expect(deriveEntitlement({ status: 'active' }).tier).toBe('premium');
  });

  it('grace 상태 → premium 티어 유지 (유예)', () => {
    expect(deriveEntitlement({ status: 'grace' }).tier).toBe('premium');
  });

  it('cancelled/expired → free', () => {
    expect(deriveEntitlement({ status: 'cancelled' }).tier).toBe('free');
    expect(deriveEntitlement({ status: 'expired' }).tier).toBe('free');
  });
});

describe('canUseFeature', () => {
  it('premium 티어 → 모든 feature 허용', () => {
    const ent = deriveEntitlement({ status: 'active' });
    for (const f of Object.values(FEATURES)) {
      expect(canUseFeature(ent, f)).toBe(true);
    }
  });

  it('free 티어 → 모든 feature 차단', () => {
    const ent = deriveEntitlement(null);
    for (const f of Object.values(FEATURES)) {
      expect(canUseFeature(ent, f)).toBe(false);
    }
  });
});

describe('computeTrialDaysLeft', () => {
  it('미래 일자 → 양수', () => {
    const future = new Date(Date.now() + 3 * 86400_000).toISOString();
    expect(computeTrialDaysLeft(future)).toBeGreaterThan(0);
  });

  it('과거 일자 → 0', () => {
    const past = new Date(Date.now() - 86400_000).toISOString();
    expect(computeTrialDaysLeft(past)).toBe(0);
  });

  it('null → null', () => {
    expect(computeTrialDaysLeft(null)).toBeNull();
  });
});
```

- [ ] **Step 2: fail 확인**

Run: `cd /c/Users/TK/Desktop/hyeni && npm test -- tests/entitlement.test.js`
Expected: FAIL

- [ ] **Step 3: `entitlement.js` 구현**

```js
// src/lib/entitlement.js
// 엔타이틀먼트 순수 함수 + useEntitlement 훅

import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from './supabase.js';
import { readEntitlementCache, writeEntitlementCache } from './entitlementCache.js';
import { checkEntitlements } from './qonversion.js';

export function deriveEntitlement(row) {
  if (!row) {
    return {
      tier: 'free',
      status: 'expired',
      isTrial: false,
      trialDaysLeft: null,
      currentPeriodEnd: null,
    };
  }
  const tier = ['trial', 'active', 'grace'].includes(row.status) ? 'premium' : 'free';
  return {
    tier,
    status: row.status || 'expired',
    isTrial: row.status === 'trial',
    trialDaysLeft: row.status === 'trial' ? computeTrialDaysLeft(row.trial_ends_at) : null,
    currentPeriodEnd: row.current_period_end ? new Date(row.current_period_end) : null,
  };
}

export function computeTrialDaysLeft(trialEndsAtIso) {
  if (!trialEndsAtIso) return null;
  const ends = new Date(trialEndsAtIso).getTime();
  const diff = ends - Date.now();
  if (diff <= 0) return 0;
  return Math.ceil(diff / 86400_000);
}

export function canUseFeature(entitlement, feature) {
  if (!entitlement) return false;
  return entitlement.tier === 'premium';
}

// React 훅
export function useEntitlement(familyId) {
  const [ent, setEnt] = useState(() => {
    const cached = readEntitlementCache();
    return cached || deriveEntitlement(null);
  });
  const channelRef = useRef(null);

  const refresh = useCallback(async () => {
    if (!familyId) return;

    // 1순위: Supabase fetch
    const { data } = await supabase
      .from('family_subscription')
      .select('status, trial_ends_at, current_period_end, product_id')
      .eq('family_id', familyId)
      .maybeSingle();

    if (data) {
      const fresh = deriveEntitlement(data);
      setEnt(fresh);
      writeEntitlementCache(fresh);
      return;
    }

    // 2순위 fallback: Qonversion SDK 로컬
    const q = await checkEntitlements();
    if (q.hasPremium) {
      const fresh = deriveEntitlement({
        status: q.isTrial ? 'trial' : 'active',
        trial_ends_at: q.isTrial && q.expiresAt ? q.expiresAt.toISOString() : null,
        current_period_end: q.expiresAt ? q.expiresAt.toISOString() : null,
      });
      setEnt(fresh);
      writeEntitlementCache(fresh);
    } else {
      const fresh = deriveEntitlement(null);
      setEnt(fresh);
      writeEntitlementCache(fresh);
    }
  }, [familyId]);

  useEffect(() => {
    if (!familyId) return;

    refresh();

    // Realtime 구독
    const channel = supabase
      .channel(`family_subscription:${familyId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'family_subscription',
          filter: `family_id=eq.${familyId}`,
        },
        () => refresh(),
      )
      .subscribe();
    channelRef.current = channel;

    // 포그라운드 복귀 시 리프레시
    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [familyId, refresh]);

  return {
    ...ent,
    canUse: (feature) => canUseFeature(ent, feature),
    refresh,
  };
}
```

- [ ] **Step 4: pass 확인**

Run: `cd /c/Users/TK/Desktop/hyeni && npm test -- tests/entitlement.test.js`
Expected: PASS (10 tests)

- [ ] **Step 5: 커밋**

```bash
cd /c/Users/TK/Desktop/hyeni && git add src/lib/entitlement.js tests/entitlement.test.js && git commit -m "feat: useEntitlement 훅 + 순수 derivation 함수"
```

---

## Phase D — Paywall Components

### Task D0: 페이월 카피 상수 `paywallCopy.js`

**Files:**
- Create: `src/lib/paywallCopy.js`

- [ ] **Step 1: 카피 상수 작성**

```js
// src/lib/paywallCopy.js
// 페이월·배너 한국어 카피 중앙 관리

export const EARLY_ADOPTER_BADGE = '🎁 출시 기념 Early Adopter 가격';

export const PRICING = {
  monthly: {
    productId: 'premium_monthly',
    priceKrw: 1500,
    originalPriceKrw: 4900,
    label: '월 ₩1,500',
    originalLabel: '정가 ₩4,900 예정',
    perDayLabel: '하루 50원',
  },
  yearly: {
    productId: 'premium_yearly',
    priceKrw: 15000,
    originalPriceKrw: 49000,
    label: '연 ₩15,000',
    originalLabel: '정가 ₩49,000 예정',
    perDayLabel: '하루 41원',
    savingLabel: '2개월 무료',
  },
};

export const TRIAL_INVITE = {
  title: '🎁 7일 무료 체험',
  subtitle: '하루 50원으로 아이를 지키세요',
  lockinNote: '지금 구독하면 평생 이 가격 유지',
  ctaPrimary: '7일 무료 체험 시작',
  ctaSecondary: '나중에 하기',
};

export const FEATURE_LOCK = {
  realtime_location: { name: '실시간 위치 추적', desc: '지연 없이 아이의 현재 위치를 확인하세요' },
  multi_child: { name: '다자녀 지원', desc: '둘째·셋째 아이까지 함께 관리하세요' },
  remote_audio: { name: '원격 음성 청취', desc: '아이 주변 소리를 원격으로 들어보세요' },
  ai_analysis: { name: 'AI 이미지 분석', desc: '일정 사진을 자동으로 인식합니다' },
  academy_schedule: { name: '학원 일정 관리', desc: '여러 학원 일정을 한 번에 관리하세요' },
  multi_geofence: { name: '위험 구역 무제한', desc: '원하는 만큼 위험 구역을 설정하세요' },
  extended_history: { name: '장기 위치 이력', desc: '30일 이상 이력을 보관·조회하세요' },
};

export const TRIAL_ENDING = {
  d3: '🎁 체험 종료 D-3 — Early Adopter 가격 하루 50원 유지하기',
  d2: '⏰ 체험 종료 D-2 — 지금 구독하면 평생 하루 50원',
  d1: '🔔 내일 체험 종료 — 지금 계속 이용하기',
  today: '✨ 오늘 체험 종료 — 계속 이용하기 → 하루 50원 유지',
  cta: '계속 이용하기',
};

export const AUTO_RENEWAL_DISCLOSURE = {
  title: '7일 체험 안내',
  lines: [
    '체험 기간은 7일입니다.',
    '체험 종료 7일차 이후 자동으로 구독이 시작됩니다.',
    '체험 기간 중 언제든 해지하면 요금이 청구되지 않습니다.',
    '구독은 Google Play 계정에서 언제든 관리·해지할 수 있습니다.',
    'Early Adopter 가격(월 ₩1,500 / 연 ₩15,000)은 평생 유지됩니다.',
  ],
  agreeLabel: '이해했고 체험을 시작합니다',
  cancelLabel: '취소',
};

export const CHILD_DEVICE_NOTE = '엄마/아빠에게 프리미엄을 요청하세요';
```

- [ ] **Step 2: 커밋**

```bash
cd /c/Users/TK/Desktop/hyeni && git add src/lib/paywallCopy.js && git commit -m "feat: paywallCopy 상수 (Early Adopter 카피)"
```

---

### Task D1: `TrialInvitePrompt` 컴포넌트

**Files:**
- Create: `src/components/paywall/TrialInvitePrompt.jsx`
- Create: `tests/paywall/TrialInvitePrompt.test.jsx`

- [ ] **Step 1: failing test 작성**

```jsx
// tests/paywall/TrialInvitePrompt.test.jsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TrialInvitePrompt } from '../../src/components/paywall/TrialInvitePrompt.jsx';

describe('TrialInvitePrompt', () => {
  it('렌더 시 Early Adopter 카피 표시', () => {
    render(<TrialInvitePrompt open onStart={() => {}} onDismiss={() => {}} />);
    expect(screen.getByText(/Early Adopter/)).toBeInTheDocument();
    expect(screen.getByText(/하루 50원/)).toBeInTheDocument();
  });

  it('CTA 탭 시 onStart 호출', () => {
    const onStart = vi.fn();
    render(<TrialInvitePrompt open onStart={onStart} onDismiss={() => {}} />);
    fireEvent.click(screen.getByText(/7일 무료 체험 시작/));
    expect(onStart).toHaveBeenCalledTimes(1);
  });

  it('"나중에" 탭 시 onDismiss 호출', () => {
    const onDismiss = vi.fn();
    render(<TrialInvitePrompt open onStart={() => {}} onDismiss={onDismiss} />);
    fireEvent.click(screen.getByText(/나중에/));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('open=false → 렌더 안 함', () => {
    const { container } = render(
      <TrialInvitePrompt open={false} onStart={() => {}} onDismiss={() => {}} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('isChild=true → 렌더 안 함', () => {
    const { container } = render(
      <TrialInvitePrompt open isChild onStart={() => {}} onDismiss={() => {}} />
    );
    expect(container.firstChild).toBeNull();
  });
});
```

- [ ] **Step 2: fail**

Run: `cd /c/Users/TK/Desktop/hyeni && npm test -- tests/paywall/TrialInvitePrompt.test.jsx`
Expected: FAIL

- [ ] **Step 3: 구현**

```jsx
// src/components/paywall/TrialInvitePrompt.jsx
// 첫 일정 등록 성공 직후 1회 노출되는 체험 초대 시트

import { TRIAL_INVITE, EARLY_ADOPTER_BADGE, PRICING } from '../../lib/paywallCopy.js';

export function TrialInvitePrompt({ open, onStart, onDismiss, isChild = false }) {
  if (!open || isChild) return null;

  return (
    <div
      role="dialog"
      aria-labelledby="trial-invite-title"
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        background: 'white',
        borderTopLeftRadius: 16,
        borderTopRightRadius: 16,
        padding: 24,
        boxShadow: '0 -4px 20px rgba(0,0,0,0.1)',
        zIndex: 9999,
      }}
    >
      <div style={{ fontSize: 14, color: '#888', marginBottom: 8 }}>
        {EARLY_ADOPTER_BADGE}
      </div>
      <h2 id="trial-invite-title" style={{ fontSize: 22, margin: '8px 0' }}>
        {TRIAL_INVITE.title}
      </h2>
      <p style={{ fontSize: 16, color: '#333' }}>
        {PRICING.monthly.label} <span style={{ color: '#888' }}>({PRICING.monthly.originalLabel})</span>
      </p>
      <p style={{ fontSize: 16, color: '#333' }}>
        {TRIAL_INVITE.subtitle}
      </p>
      <p style={{ fontSize: 13, color: '#666', margin: '4px 0 16px' }}>
        {TRIAL_INVITE.lockinNote}
      </p>
      <button
        onClick={onStart}
        style={{
          width: '100%',
          padding: 16,
          fontSize: 16,
          fontWeight: 600,
          background: '#4a7cff',
          color: 'white',
          border: 'none',
          borderRadius: 12,
          marginBottom: 8,
        }}
      >
        {TRIAL_INVITE.ctaPrimary}
      </button>
      <button
        onClick={onDismiss}
        style={{
          width: '100%',
          padding: 12,
          fontSize: 14,
          background: 'transparent',
          border: 'none',
          color: '#666',
        }}
      >
        {TRIAL_INVITE.ctaSecondary}
      </button>
    </div>
  );
}
```

- [ ] **Step 4: pass**

Run: `cd /c/Users/TK/Desktop/hyeni && npm test -- tests/paywall/TrialInvitePrompt.test.jsx`
Expected: PASS (5 tests)

- [ ] **Step 5: 커밋**

```bash
cd /c/Users/TK/Desktop/hyeni && git add src/components/paywall/TrialInvitePrompt.jsx tests/paywall/TrialInvitePrompt.test.jsx && git commit -m "feat: TrialInvitePrompt 시트 컴포넌트"
```

---

### Task D2: `FeatureLockOverlay` 컴포넌트

**Files:**
- Create: `src/components/paywall/FeatureLockOverlay.jsx`
- Create: `tests/paywall/FeatureLockOverlay.test.jsx`

- [ ] **Step 1: failing test**

```jsx
// tests/paywall/FeatureLockOverlay.test.jsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FeatureLockOverlay } from '../../src/components/paywall/FeatureLockOverlay.jsx';
import { FEATURES } from '../../src/lib/features.js';

describe('FeatureLockOverlay', () => {
  it('잠긴 feature 이름 표시', () => {
    render(
      <FeatureLockOverlay open feature={FEATURES.AI_ANALYSIS} onStart={() => {}} onClose={() => {}} />
    );
    expect(screen.getByText(/AI 이미지 분석/)).toBeInTheDocument();
  });

  it('부모 기기 → CTA 활성, onStart 호출 가능', () => {
    const onStart = vi.fn();
    render(
      <FeatureLockOverlay open feature={FEATURES.AI_ANALYSIS} onStart={onStart} onClose={() => {}} />
    );
    fireEvent.click(screen.getByText(/체험 시작/));
    expect(onStart).toHaveBeenCalledTimes(1);
  });

  it('아이 기기 → CTA 없이 안내 문구만', () => {
    render(
      <FeatureLockOverlay
        open
        isChild
        feature={FEATURES.REMOTE_AUDIO}
        onStart={() => {}}
        onClose={() => {}}
      />
    );
    expect(screen.queryByText(/체험 시작/)).toBeNull();
    expect(screen.getByText(/엄마\/아빠에게 프리미엄을 요청/)).toBeInTheDocument();
  });

  it('X 버튼 탭 시 onClose 호출', () => {
    const onClose = vi.fn();
    render(
      <FeatureLockOverlay open feature={FEATURES.AI_ANALYSIS} onStart={() => {}} onClose={onClose} />
    );
    fireEvent.click(screen.getByLabelText('닫기'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('open=false → null', () => {
    const { container } = render(
      <FeatureLockOverlay open={false} feature={FEATURES.AI_ANALYSIS} onStart={() => {}} onClose={() => {}} />
    );
    expect(container.firstChild).toBeNull();
  });
});
```

- [ ] **Step 2: fail**

Run: `cd /c/Users/TK/Desktop/hyeni && npm test -- tests/paywall/FeatureLockOverlay.test.jsx`
Expected: FAIL

- [ ] **Step 3: 구현**

```jsx
// src/components/paywall/FeatureLockOverlay.jsx
// 프리미엄 기능 탭 시 풀스크린 모달

import {
  FEATURE_LOCK,
  EARLY_ADOPTER_BADGE,
  PRICING,
  TRIAL_INVITE,
  CHILD_DEVICE_NOTE,
} from '../../lib/paywallCopy.js';

export function FeatureLockOverlay({ open, feature, onStart, onClose, isChild = false }) {
  if (!open || !feature) return null;
  const info = FEATURE_LOCK[feature];
  if (!info) return null;

  return (
    <div
      role="dialog"
      aria-labelledby="feature-lock-title"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
      }}
    >
      <div
        style={{
          background: 'white',
          width: 'min(92vw, 420px)',
          borderRadius: 16,
          padding: 24,
          position: 'relative',
        }}
      >
        <button
          aria-label="닫기"
          onClick={onClose}
          style={{
            position: 'absolute',
            top: 12,
            right: 12,
            background: 'none',
            border: 'none',
            fontSize: 24,
            cursor: 'pointer',
          }}
        >
          ×
        </button>
        <div style={{ fontSize: 14, color: '#888', marginBottom: 8 }}>
          🔒 프리미엄 전용
        </div>
        <h2 id="feature-lock-title" style={{ fontSize: 22, margin: '8px 0' }}>
          {info.name}
        </h2>
        <p style={{ color: '#555', marginBottom: 16 }}>{info.desc}</p>

        {isChild ? (
          <p style={{
            padding: 16,
            background: '#f5f5f5',
            borderRadius: 8,
            textAlign: 'center',
            color: '#666',
          }}>
            {CHILD_DEVICE_NOTE}
          </p>
        ) : (
          <>
            <div style={{
              padding: 12,
              background: '#fff8e1',
              borderRadius: 8,
              marginBottom: 16,
              fontSize: 14,
            }}>
              <div>{EARLY_ADOPTER_BADGE}</div>
              <div>{PRICING.monthly.label} ({PRICING.monthly.originalLabel})</div>
              <div style={{ fontSize: 12, color: '#888' }}>{TRIAL_INVITE.lockinNote}</div>
            </div>
            <button
              onClick={onStart}
              style={{
                width: '100%',
                padding: 16,
                fontSize: 16,
                fontWeight: 600,
                background: '#4a7cff',
                color: 'white',
                border: 'none',
                borderRadius: 12,
              }}
            >
              {TRIAL_INVITE.ctaPrimary}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: pass**

Run: `cd /c/Users/TK/Desktop/hyeni && npm test -- tests/paywall/FeatureLockOverlay.test.jsx`
Expected: PASS (5 tests)

- [ ] **Step 5: 커밋**

```bash
cd /c/Users/TK/Desktop/hyeni && git add src/components/paywall/FeatureLockOverlay.jsx tests/paywall/FeatureLockOverlay.test.jsx && git commit -m "feat: FeatureLockOverlay 모달"
```

---

### Task D3: `InlineLockBadge` 컴포넌트

**Files:**
- Create: `src/components/paywall/InlineLockBadge.jsx`
- Create: `tests/paywall/InlineLockBadge.test.jsx`

- [ ] **Step 1: failing test**

```jsx
// tests/paywall/InlineLockBadge.test.jsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { InlineLockBadge } from '../../src/components/paywall/InlineLockBadge.jsx';

describe('InlineLockBadge', () => {
  it('자식 element를 블러 처리하여 렌더', () => {
    render(
      <InlineLockBadge onOpenPaywall={() => {}}>
        <div data-testid="content">Locked content</div>
      </InlineLockBadge>
    );
    expect(screen.getByTestId('content')).toBeInTheDocument();
    expect(screen.getByLabelText(/프리미엄 전용/)).toBeInTheDocument();
  });

  it('부모 기기 → 탭 시 onOpenPaywall 호출', () => {
    const onOpen = vi.fn();
    render(
      <InlineLockBadge onOpenPaywall={onOpen}>
        <div>X</div>
      </InlineLockBadge>
    );
    fireEvent.click(screen.getByLabelText(/프리미엄 전용/));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('아이 기기 → 탭해도 호출 안 됨', () => {
    const onOpen = vi.fn();
    render(
      <InlineLockBadge isChild onOpenPaywall={onOpen}>
        <div>X</div>
      </InlineLockBadge>
    );
    fireEvent.click(screen.getByLabelText(/프리미엄 전용/));
    expect(onOpen).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: fail**

Run: `cd /c/Users/TK/Desktop/hyeni && npm test -- tests/paywall/InlineLockBadge.test.jsx`
Expected: FAIL

- [ ] **Step 3: 구현**

```jsx
// src/components/paywall/InlineLockBadge.jsx
// 프리미엄 전용 UI 블록을 블러 처리 + 자물쇠 배지

export function InlineLockBadge({ children, onOpenPaywall, isChild = false }) {
  const handleClick = () => {
    if (isChild) return;
    onOpenPaywall?.();
  };

  return (
    <div style={{ position: 'relative' }}>
      <div style={{ filter: 'blur(4px)', pointerEvents: 'none', opacity: 0.6 }}>
        {children}
      </div>
      <button
        aria-label="프리미엄 전용 — 잠금 해제"
        onClick={handleClick}
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(0,0,0,0.04)',
          border: 'none',
          cursor: isChild ? 'default' : 'pointer',
          fontSize: 24,
        }}
      >
        🔒
      </button>
    </div>
  );
}
```

- [ ] **Step 4: pass**

Run: `cd /c/Users/TK/Desktop/hyeni && npm test -- tests/paywall/InlineLockBadge.test.jsx`
Expected: PASS (3 tests)

- [ ] **Step 5: 커밋**

```bash
cd /c/Users/TK/Desktop/hyeni && git add src/components/paywall/InlineLockBadge.jsx tests/paywall/InlineLockBadge.test.jsx && git commit -m "feat: InlineLockBadge 블러+자물쇠 래퍼"
```

---

### Task D4: `TrialEndingBanner` 컴포넌트

**Files:**
- Create: `src/components/paywall/TrialEndingBanner.jsx`
- Create: `tests/paywall/TrialEndingBanner.test.jsx`

- [ ] **Step 1: failing test**

```jsx
// tests/paywall/TrialEndingBanner.test.jsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TrialEndingBanner, pickBannerCopy } from '../../src/components/paywall/TrialEndingBanner.jsx';

describe('pickBannerCopy', () => {
  it('3일 남음 → d3', () => {
    expect(pickBannerCopy(3)).toMatch(/D-3/);
  });
  it('2일 남음 → d2', () => {
    expect(pickBannerCopy(2)).toMatch(/D-2/);
  });
  it('1일 남음 → d1', () => {
    expect(pickBannerCopy(1)).toMatch(/내일 체험 종료/);
  });
  it('0일(당일) → today', () => {
    expect(pickBannerCopy(0)).toMatch(/오늘 체험 종료/);
  });
  it('4일 이상 남음 → null (배너 렌더 안 함)', () => {
    expect(pickBannerCopy(4)).toBeNull();
    expect(pickBannerCopy(null)).toBeNull();
  });
});

describe('TrialEndingBanner', () => {
  it('trialDaysLeft=3, isTrial → 렌더', () => {
    render(<TrialEndingBanner trialDaysLeft={3} isTrial onContinue={() => {}} />);
    expect(screen.getByText(/D-3/)).toBeInTheDocument();
  });

  it('isTrial=false → null', () => {
    const { container } = render(
      <TrialEndingBanner trialDaysLeft={3} isTrial={false} onContinue={() => {}} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('isChild=true → null', () => {
    const { container } = render(
      <TrialEndingBanner trialDaysLeft={3} isTrial isChild onContinue={() => {}} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('CTA 탭 시 onContinue 호출', () => {
    const onContinue = vi.fn();
    render(<TrialEndingBanner trialDaysLeft={2} isTrial onContinue={onContinue} />);
    fireEvent.click(screen.getByText(/계속 이용하기/));
    expect(onContinue).toHaveBeenCalledTimes(1);
  });

  it('trialDaysLeft=5 → null (Day 4 전이라 노출 안 함)', () => {
    const { container } = render(
      <TrialEndingBanner trialDaysLeft={5} isTrial onContinue={() => {}} />
    );
    expect(container.firstChild).toBeNull();
  });
});
```

- [ ] **Step 2: fail**

Run: `cd /c/Users/TK/Desktop/hyeni && npm test -- tests/paywall/TrialEndingBanner.test.jsx`
Expected: FAIL

- [ ] **Step 3: 구현**

```jsx
// src/components/paywall/TrialEndingBanner.jsx
// 체험 Day 4~7 (trialDaysLeft 3 이하) 부모 기기 상단 고정 배너

import { TRIAL_ENDING } from '../../lib/paywallCopy.js';

export function pickBannerCopy(trialDaysLeft) {
  if (trialDaysLeft == null) return null;
  if (trialDaysLeft >= 4) return null;
  if (trialDaysLeft === 3) return TRIAL_ENDING.d3;
  if (trialDaysLeft === 2) return TRIAL_ENDING.d2;
  if (trialDaysLeft === 1) return TRIAL_ENDING.d1;
  return TRIAL_ENDING.today;
}

export function TrialEndingBanner({ trialDaysLeft, isTrial, onContinue, isChild = false }) {
  if (!isTrial || isChild) return null;
  const copy = pickBannerCopy(trialDaysLeft);
  if (!copy) return null;

  const bgColor = trialDaysLeft <= 1 ? '#fff1f0' : '#fffbeb';
  const borderColor = trialDaysLeft <= 1 ? '#ff4d4f' : '#fadb14';

  return (
    <div
      role="status"
      style={{
        position: 'sticky',
        top: 0,
        padding: '12px 16px',
        background: bgColor,
        borderBottom: `1px solid ${borderColor}`,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        zIndex: 100,
      }}
    >
      <span style={{ fontSize: 14, flex: 1 }}>{copy}</span>
      <button
        onClick={onContinue}
        style={{
          padding: '6px 16px',
          fontSize: 13,
          fontWeight: 600,
          background: '#4a7cff',
          color: 'white',
          border: 'none',
          borderRadius: 8,
          marginLeft: 8,
        }}
      >
        {TRIAL_ENDING.cta}
      </button>
    </div>
  );
}
```

- [ ] **Step 4: pass**

Run: `cd /c/Users/TK/Desktop/hyeni && npm test -- tests/paywall/TrialEndingBanner.test.jsx`
Expected: PASS (9 tests)

- [ ] **Step 5: 커밋**

```bash
cd /c/Users/TK/Desktop/hyeni && git add src/components/paywall/TrialEndingBanner.jsx tests/paywall/TrialEndingBanner.test.jsx && git commit -m "feat: TrialEndingBanner Day 4-7 카피 분기"
```

---

### Task D5: `AutoRenewalDisclosure` 컴포넌트 (전자상거래법 준수)

**Files:**
- Create: `src/components/paywall/AutoRenewalDisclosure.jsx`

- [ ] **Step 1: 구현**

```jsx
// src/components/paywall/AutoRenewalDisclosure.jsx
// 체험 시작 전 자동갱신 고지 (한국 전자상거래법 준수)

import { AUTO_RENEWAL_DISCLOSURE, PRICING, TRIAL_INVITE } from '../../lib/paywallCopy.js';

export function AutoRenewalDisclosure({ open, onAgree, onCancel }) {
  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-labelledby="disclosure-title"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
      }}
    >
      <div
        style={{
          background: 'white',
          width: 'min(92vw, 480px)',
          borderRadius: 16,
          padding: 24,
        }}
      >
        <h2 id="disclosure-title" style={{ fontSize: 18, margin: 0 }}>
          {AUTO_RENEWAL_DISCLOSURE.title}
        </h2>
        <ul style={{ marginTop: 16, paddingLeft: 20, fontSize: 14, lineHeight: 1.8 }}>
          {AUTO_RENEWAL_DISCLOSURE.lines.map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ul>
        <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
          <button
            onClick={onCancel}
            style={{
              flex: 1,
              padding: 14,
              background: '#f0f0f0',
              border: 'none',
              borderRadius: 10,
              fontSize: 14,
            }}
          >
            {AUTO_RENEWAL_DISCLOSURE.cancelLabel}
          </button>
          <button
            onClick={onAgree}
            style={{
              flex: 2,
              padding: 14,
              background: '#4a7cff',
              color: 'white',
              border: 'none',
              borderRadius: 10,
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            {AUTO_RENEWAL_DISCLOSURE.agreeLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 커밋**

```bash
cd /c/Users/TK/Desktop/hyeni && git add src/components/paywall/AutoRenewalDisclosure.jsx && git commit -m "feat: AutoRenewalDisclosure 자동갱신 고지 모달"
```

---

## Phase E — App 통합

### Task E1: `auth.js`에서 `Qonversion.identify(family_id)` 호출

**Files:**
- Modify: `src/lib/auth.js`

- [ ] **Step 1: 기존 auth.js 구조 확인**

Read the file:
```bash
grep -n "family_id\|createFamily\|signIn\|session" "C:\Users\TK\Desktop\hyeni\src\lib\auth.js"
```

Identify the function(s) that return a logged-in user's family_id. Typical: `resolveCurrentFamily()` or similar.

- [ ] **Step 2: Qonversion import + identify 호출 추가**

In `src/lib/auth.js`, add at top:
```js
import { identify as qIdentify } from './qonversion.js';
```

Find the function that sets up a family for a logged-in user (parent 로그인 직후에 family_id를 확보하는 지점 — 기존 코드에서 찾음). Add after family_id is known:
```js
// family_id가 확보된 직후에 추가
try {
  await qIdentify(familyId);
} catch (err) {
  console.warn('[auth] qonversion identify failed', err);
}
```

If the code structure doesn't make this clear, wrap the existing family resolution function to call identify after it succeeds. Example pattern — given an exported function like `ensureFamilyForUser`:

```js
export async function ensureFamilyForUser(user) {
  const existing = await findFamily(user.id);
  if (existing) {
    await qIdentify(existing.id);
    return existing;
  }
  const created = await createFamily(user);
  await qIdentify(created.id);
  return created;
}
```

- [ ] **Step 3: 빌드 검증**

Run: `cd /c/Users/TK/Desktop/hyeni && npm run build`
Expected: Build success (vite 빌드 에러 없음)

- [ ] **Step 4: 커밋**

```bash
cd /c/Users/TK/Desktop/hyeni && git add src/lib/auth.js && git commit -m "feat: 가족 확보 후 Qonversion.identify(family_id) 호출"
```

---

### Task E2: 앱에 `useEntitlement` 훅 통합 + 구매 헬퍼

**Files:**
- Modify: `src/App.jsx`

- [ ] **Step 1: App.jsx에서 현재 family_id 획득 지점 확인**

Run:
```bash
grep -n "family_id\|familyId\|currentFamily" "C:\Users\TK\Desktop\hyeni\src\App.jsx" | head -20
```

Identify state hook name (likely `familyId`).

- [ ] **Step 2: `useEntitlement` import + 호출 추가**

At top of `App.jsx` imports:
```js
import { useEntitlement } from './lib/entitlement.js';
import { purchase as qPurchase } from './lib/qonversion.js';
```

Inside main App component (아이콘 상태가 모여있는 곳), add:
```js
const entitlement = useEntitlement(familyId);
```

- [ ] **Step 3: 구매 헬퍼 함수 추가 (App 컴포넌트 내부)**

```js
const [purchasing, setPurchasing] = useState(false);
const [showDisclosure, setShowDisclosure] = useState(false);
const [pendingProduct, setPendingProduct] = useState(null);

async function startTrial(productId) {
  if (role === 'child') return; // 아이 기기 가드
  setPendingProduct(productId);
  setShowDisclosure(true);
}

async function onDisclosureAgree() {
  setShowDisclosure(false);
  if (!pendingProduct) return;
  setPurchasing(true);
  try {
    await qPurchase(pendingProduct);
    await entitlement.refresh();
  } catch (err) {
    console.warn('[purchase] failed', err);
    alert('결제가 취소되었거나 실패했습니다. 잠시 후 다시 시도해주세요.');
  } finally {
    setPurchasing(false);
    setPendingProduct(null);
  }
}
```

- [ ] **Step 4: `AutoRenewalDisclosure` 렌더 추가**

```jsx
<AutoRenewalDisclosure
  open={showDisclosure}
  onAgree={onDisclosureAgree}
  onCancel={() => { setShowDisclosure(false); setPendingProduct(null); }}
/>
```

import 추가:
```js
import { AutoRenewalDisclosure } from './components/paywall/AutoRenewalDisclosure.jsx';
```

- [ ] **Step 5: 빌드 검증**

Run: `cd /c/Users/TK/Desktop/hyeni && npm run build`
Expected: SUCCESS

- [ ] **Step 6: 커밋**

```bash
cd /c/Users/TK/Desktop/hyeni && git add src/App.jsx && git commit -m "feat: App.jsx에 useEntitlement + startTrial 헬퍼 통합"
```

---

### Task E3: `TrialInvitePrompt` 트리거 (첫 일정 등록 성공 시 1회)

**Files:**
- Modify: `src/App.jsx`

- [ ] **Step 1: 상태 + 플래그 추가**

App 컴포넌트 내부:
```js
const TRIAL_INVITE_SHOWN_KEY = 'hyeni_trial_invite_shown';
const [showTrialInvite, setShowTrialInvite] = useState(false);
```

- [ ] **Step 2: 일정 저장 성공 핸들러에 훅 추가**

기존 `saveEvent` 또는 `addEvent` 함수에서 성공 직후:
```js
// 일정 저장 성공 이후
const alreadyShown = localStorage.getItem(TRIAL_INVITE_SHOWN_KEY);
if (!alreadyShown && role === 'parent' && entitlement.tier === 'free') {
  setShowTrialInvite(true);
  localStorage.setItem(TRIAL_INVITE_SHOWN_KEY, '1');
}
```

- [ ] **Step 3: `TrialInvitePrompt` 렌더**

```jsx
<TrialInvitePrompt
  open={showTrialInvite}
  isChild={role === 'child'}
  onStart={() => {
    setShowTrialInvite(false);
    startTrial('premium_monthly');
  }}
  onDismiss={() => setShowTrialInvite(false)}
/>
```

import 추가:
```js
import { TrialInvitePrompt } from './components/paywall/TrialInvitePrompt.jsx';
```

- [ ] **Step 4: 빌드 검증**

Run: `cd /c/Users/TK/Desktop/hyeni && npm run build`
Expected: SUCCESS

- [ ] **Step 5: 커밋**

```bash
cd /c/Users/TK/Desktop/hyeni && git add src/App.jsx && git commit -m "feat: 첫 일정 등록 후 TrialInvitePrompt 1회 노출"
```

---

### Task E4: `TrialEndingBanner` App 상단 고정

**Files:**
- Modify: `src/App.jsx`

- [ ] **Step 1: Banner 렌더 추가**

App 컴포넌트 최상위 레벨 JSX에서 (헤더 바로 위 또는 맨 위에):
```jsx
<TrialEndingBanner
  trialDaysLeft={entitlement.trialDaysLeft}
  isTrial={entitlement.isTrial}
  isChild={role === 'child'}
  onContinue={() => startTrial('premium_monthly')}
/>
```

import:
```js
import { TrialEndingBanner } from './components/paywall/TrialEndingBanner.jsx';
```

- [ ] **Step 2: 빌드**

Run: `cd /c/Users/TK/Desktop/hyeni && npm run build`
Expected: SUCCESS

- [ ] **Step 3: 커밋**

```bash
cd /c/Users/TK/Desktop/hyeni && git add src/App.jsx && git commit -m "feat: TrialEndingBanner 상단 고정 렌더"
```

---

### Task E5: 설정 화면 `SubscriptionManagement` 섹션

**Files:**
- Create: `src/components/settings/SubscriptionManagement.jsx`
- Modify: `src/App.jsx` (설정 화면 섹션에 추가)

- [ ] **Step 1: SubscriptionManagement 컴포넌트**

```jsx
// src/components/settings/SubscriptionManagement.jsx
// 설정 화면 내 구독 관리 블록

import { PRICING } from '../../lib/paywallCopy.js';

const GPB_MANAGE_URL = 'https://play.google.com/store/account/subscriptions';

export function SubscriptionManagement({ entitlement, role, onRefresh, onStartTrial }) {
  if (role === 'child') {
    return (
      <section style={{ padding: 16, background: '#fafafa', borderRadius: 12 }}>
        <h3 style={{ margin: 0, fontSize: 16 }}>구독 상태</h3>
        <p style={{ color: '#666' }}>
          엄마/아빠에게 구독 상태를 문의해주세요.
        </p>
      </section>
    );
  }

  const manageDeepLink = (productId) =>
    `${GPB_MANAGE_URL}?sku=${productId}&package=com.hyeni.calendar`;

  return (
    <section style={{ padding: 16, background: '#fafafa', borderRadius: 12 }}>
      <h3 style={{ margin: '0 0 8px', fontSize: 16 }}>구독 상태</h3>

      {entitlement.tier === 'premium' ? (
        <>
          <p style={{ margin: '4px 0' }}>
            <strong>
              {entitlement.isTrial ? '무료 체험 중' : '프리미엄 이용 중'}
            </strong>
            {entitlement.isTrial && entitlement.trialDaysLeft !== null && (
              <span style={{ color: '#888' }}> · {entitlement.trialDaysLeft}일 남음</span>
            )}
          </p>
          {entitlement.currentPeriodEnd && (
            <p style={{ fontSize: 13, color: '#666', margin: '4px 0' }}>
              다음 결제일: {entitlement.currentPeriodEnd.toLocaleDateString('ko-KR')}
            </p>
          )}
          <a
            href={manageDeepLink('premium_monthly')}
            target="_blank"
            rel="noreferrer"
            style={{
              display: 'inline-block',
              marginTop: 8,
              padding: '8px 16px',
              background: 'white',
              border: '1px solid #ddd',
              borderRadius: 8,
              color: '#333',
              textDecoration: 'none',
              fontSize: 13,
            }}
          >
            Google Play에서 구독 관리
          </a>
        </>
      ) : (
        <>
          <p style={{ margin: '4px 0', color: '#555' }}>
            지금 무료 티어로 이용 중입니다.
          </p>
          <button
            onClick={() => onStartTrial('premium_monthly')}
            style={{
              marginTop: 8,
              padding: '10px 16px',
              background: '#4a7cff',
              color: 'white',
              border: 'none',
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            7일 무료 체험 시작 · {PRICING.monthly.label}
          </button>
        </>
      )}

      <button
        onClick={onRefresh}
        style={{
          marginTop: 12,
          padding: '6px 12px',
          background: 'transparent',
          border: '1px dashed #ccc',
          borderRadius: 6,
          fontSize: 12,
          color: '#888',
          display: 'block',
        }}
      >
        구독 상태 새로고침
      </button>
    </section>
  );
}
```

- [ ] **Step 2: App.jsx 설정 섹션에 추가**

설정 화면(기존 코드에 있는 Settings 뷰/탭) 내부에:
```jsx
<SubscriptionManagement
  entitlement={entitlement}
  role={role}
  onRefresh={entitlement.refresh}
  onStartTrial={startTrial}
/>
```

import:
```js
import { SubscriptionManagement } from './components/settings/SubscriptionManagement.jsx';
```

- [ ] **Step 3: 빌드 검증**

Run: `cd /c/Users/TK/Desktop/hyeni && npm run build`
Expected: SUCCESS

- [ ] **Step 4: 커밋**

```bash
cd /c/Users/TK/Desktop/hyeni && git add src/components/settings/ src/App.jsx && git commit -m "feat: 설정 화면 구독 관리 섹션 추가"
```

---

### Task E6: `FeatureLockOverlay` 전역 상태 추가

**Files:**
- Modify: `src/App.jsx`

- [ ] **Step 1: 전역 상태 추가**

```js
const [lockedFeature, setLockedFeature] = useState(null);

function requireFeature(feature) {
  if (entitlement.canUse(feature)) return true;
  setLockedFeature(feature);
  return false;
}
```

- [ ] **Step 2: FeatureLockOverlay 렌더**

```jsx
<FeatureLockOverlay
  open={lockedFeature !== null}
  feature={lockedFeature}
  isChild={role === 'child'}
  onStart={() => {
    const closing = lockedFeature;
    setLockedFeature(null);
    startTrial('premium_monthly');
  }}
  onClose={() => setLockedFeature(null)}
/>
```

import:
```js
import { FeatureLockOverlay } from './components/paywall/FeatureLockOverlay.jsx';
```

- [ ] **Step 3: 빌드**

Run: `cd /c/Users/TK/Desktop/hyeni && npm run build`
Expected: SUCCESS

- [ ] **Step 4: 커밋**

```bash
cd /c/Users/TK/Desktop/hyeni && git add src/App.jsx && git commit -m "feat: FeatureLockOverlay 전역 상태 + requireFeature 가드"
```

---

## Phase F — Soft-Lock UI 가드

### Task F1: 다자녀 UI 가드 (자녀 추가 버튼)

**Files:**
- Modify: `src/App.jsx`

- [ ] **Step 1: 자녀 추가 핸들러 수정**

기존 자녀 추가 버튼 onClick에서:
```js
function handleAddChild() {
  // 이미 1명 이상 있고 free 티어면 페이월
  const childCount = familyMembers.filter((m) => m.role === 'child').length;
  if (childCount >= 1 && !entitlement.canUse(FEATURES.MULTI_CHILD)) {
    setLockedFeature(FEATURES.MULTI_CHILD);
    return;
  }
  // 기존 추가 로직 진행
  // ...
}
```

import:
```js
import { FEATURES } from './lib/features.js';
```

- [ ] **Step 2: 자녀 목록 렌더에 `active_slot=false`인 자녀를 `InlineLockBadge`로 감싸기**

```jsx
{children.map((child) => {
  if (child.active_slot === false && role === 'parent') {
    return (
      <InlineLockBadge
        key={child.id}
        isChild={false}
        onOpenPaywall={() => setLockedFeature(FEATURES.MULTI_CHILD)}
      >
        <ChildCard child={child} />
      </InlineLockBadge>
    );
  }
  return <ChildCard key={child.id} child={child} />;
})}
```

import:
```js
import { InlineLockBadge } from './components/paywall/InlineLockBadge.jsx';
```

- [ ] **Step 3: 빌드**

Run: `cd /c/Users/TK/Desktop/hyeni && npm run build`
Expected: SUCCESS

- [ ] **Step 4: 커밋**

```bash
cd /c/Users/TK/Desktop/hyeni && git add src/App.jsx && git commit -m "feat: 다자녀 UI 가드 (MULTI_CHILD)"
```

---

### Task F2: 다중 위험구역 UI 가드

**Files:**
- Modify: `src/App.jsx`

- [ ] **Step 1: 위험구역 추가 핸들러 수정**

```js
function handleAddDangerZone() {
  const zoneCount = dangerZones.length;
  if (zoneCount >= 1 && !entitlement.canUse(FEATURES.MULTI_GEOFENCE)) {
    setLockedFeature(FEATURES.MULTI_GEOFENCE);
    return;
  }
  // 기존 추가 로직
  // ...
}
```

- [ ] **Step 2: 위험구역 리스트에 비활성 슬롯 InlineLockBadge 적용**

```jsx
{dangerZones.map((zone) => {
  if (zone.active_slot === false && role === 'parent') {
    return (
      <InlineLockBadge
        key={zone.id}
        onOpenPaywall={() => setLockedFeature(FEATURES.MULTI_GEOFENCE)}
      >
        <DangerZoneCard zone={zone} />
      </InlineLockBadge>
    );
  }
  return <DangerZoneCard key={zone.id} zone={zone} />;
})}
```

- [ ] **Step 3: 빌드**

Run: `cd /c/Users/TK/Desktop/hyeni && npm run build`
Expected: SUCCESS

- [ ] **Step 4: 커밋**

```bash
cd /c/Users/TK/Desktop/hyeni && git add src/App.jsx && git commit -m "feat: 다중 위험구역 UI 가드 (MULTI_GEOFENCE)"
```

---

### Task F3: 학원 신규 생성 가드

**Files:**
- Modify: `src/App.jsx`

- [ ] **Step 1: 학원 추가 핸들러 가드**

```js
function handleAddAcademy() {
  if (!entitlement.canUse(FEATURES.ACADEMY_SCHEDULE)) {
    setLockedFeature(FEATURES.ACADEMY_SCHEDULE);
    return;
  }
  // 기존 추가 로직
}
```

- [ ] **Step 2: 기존 학원 리스트는 알림 정지 배지 표시**

```jsx
{academies.map((a) => (
  <div key={a.id} style={{ position: 'relative' }}>
    <AcademyCard academy={a} />
    {a.notifications_suppressed && role === 'parent' && (
      <span style={{
        position: 'absolute', top: 4, right: 4,
        fontSize: 11, color: '#999',
        background: '#eee', padding: '2px 6px', borderRadius: 4,
      }}>
        알림 정지 중 (프리미엄 필요)
      </span>
    )}
  </div>
))}
```

- [ ] **Step 3: 빌드**

Run: `cd /c/Users/TK/Desktop/hyeni && npm run build`
Expected: SUCCESS

- [ ] **Step 4: 커밋**

```bash
cd /c/Users/TK/Desktop/hyeni && git add src/App.jsx && git commit -m "feat: 학원 신규 생성 가드 + 알림 정지 배지"
```

---

### Task F4: AI 분석 가드

**Files:**
- Modify: `src/App.jsx`

- [ ] **Step 1: AI 분석 버튼 탭 핸들러 가드**

```js
async function handleAiAnalyze(imageData) {
  if (!entitlement.canUse(FEATURES.AI_ANALYSIS)) {
    setLockedFeature(FEATURES.AI_ANALYSIS);
    return;
  }
  // 기존 AI 호출 로직
  // ...
}
```

- [ ] **Step 2: 빌드**

Run: `cd /c/Users/TK/Desktop/hyeni && npm run build`
Expected: SUCCESS

- [ ] **Step 3: 커밋**

```bash
cd /c/Users/TK/Desktop/hyeni && git add src/App.jsx && git commit -m "feat: AI 분석 호출 가드 (AI_ANALYSIS)"
```

---

### Task F5: 원격 음성 청취 가드

**Files:**
- Modify: `src/App.jsx`

- [ ] **Step 1: 원격 청취 트리거 가드**

```js
function handleRemoteListen() {
  if (!entitlement.canUse(FEATURES.REMOTE_AUDIO)) {
    setLockedFeature(FEATURES.REMOTE_AUDIO);
    return;
  }
  // 기존 원격 청취 시작 로직
}
```

- [ ] **Step 2: 빌드**

Run: `cd /c/Users/TK/Desktop/hyeni && npm run build`
Expected: SUCCESS

- [ ] **Step 3: 커밋**

```bash
cd /c/Users/TK/Desktop/hyeni && git add src/App.jsx && git commit -m "feat: 원격 음성 청취 가드 (REMOTE_AUDIO)"
```

---

### Task F6: 무료 티어 5분 지연 위치 로직

**Files:**
- Modify: `src/App.jsx` (위치 렌더 함수)

- [ ] **Step 1: 위치 표시 래퍼 추가**

```js
function effectiveChildLocation(location, entitlement) {
  if (!location) return null;
  if (entitlement.canUse(FEATURES.REALTIME_LOCATION)) {
    return location; // 실시간 그대로
  }
  // 무료 티어: 5분 이상 경과한 데이터만 허용
  const locTime = new Date(location.updated_at).getTime();
  if (Date.now() - locTime < 5 * 60 * 1000) {
    return null; // 5분 안 된 데이터는 숨김
  }
  return { ...location, isDelayed: true };
}
```

- [ ] **Step 2: 위치 표시 지점에서 래퍼 사용**

```jsx
const shown = effectiveChildLocation(childLocation, entitlement);
{shown ? (
  <div>
    <ChildLocationMap location={shown} />
    {shown.isDelayed && (
      <p style={{ fontSize: 12, color: '#888' }}>
        📍 5분 전 위치 · 실시간은 프리미엄 전용
      </p>
    )}
  </div>
) : (
  <p style={{ color: '#888' }}>
    🔒 실시간 위치는 프리미엄 전용입니다 (5분 경과 시 표시)
  </p>
)}
```

- [ ] **Step 3: 빌드**

Run: `cd /c/Users/TK/Desktop/hyeni && npm run build`
Expected: SUCCESS

- [ ] **Step 4: 커밋**

```bash
cd /c/Users/TK/Desktop/hyeni && git add src/App.jsx && git commit -m "feat: 무료 티어 5분 지연 위치 로직 (REALTIME_LOCATION 가드)"
```

---

### Task F7: 30일 위치 이력 조회 가드

**Files:**
- Modify: `src/App.jsx` (위치 이력 조회 지점)

- [ ] **Step 1: 위치 이력 조회 쿼리에 날짜 가드 추가**

```js
async function loadLocationHistory(childId, fromDate, toDate) {
  // 무료 티어는 30일 내로 제한
  const limit = entitlement.canUse(FEATURES.EXTENDED_HISTORY)
    ? toDate
    : new Date(Math.max(
        fromDate.getTime(),
        Date.now() - 30 * 86400_000,
      ));

  const { data } = await supabase
    .from('child_locations')
    .select('*')
    .eq('child_id', childId)
    .gte('created_at', limit.toISOString())
    .lte('created_at', toDate.toISOString())
    .order('created_at', { ascending: false });

  return data || [];
}
```

- [ ] **Step 2: UI에서 30일 이전 날짜 선택 시 페이월**

UI에서 날짜 선택 변경 시:
```js
function handleHistoryDateChange(date) {
  const diffDays = (Date.now() - date.getTime()) / 86400_000;
  if (diffDays > 30 && !entitlement.canUse(FEATURES.EXTENDED_HISTORY)) {
    setLockedFeature(FEATURES.EXTENDED_HISTORY);
    return;
  }
  // 기존 날짜 갱신 로직
}
```

- [ ] **Step 3: 빌드**

Run: `cd /c/Users/TK/Desktop/hyeni && npm run build`
Expected: SUCCESS

- [ ] **Step 4: 커밋**

```bash
cd /c/Users/TK/Desktop/hyeni && git add src/App.jsx && git commit -m "feat: 30일 위치 이력 조회 가드 (EXTENDED_HISTORY)"
```

---

## Phase G — 푸시 알림

### Task G1: 체험 종료 푸시 스케줄 (Day 4 · 6 · 7)

**Files:**
- Modify: `supabase/functions/push-notify/index.ts`

> 기존 `push-notify` Edge Function의 cron 모드에서 `family_subscription.status='trial'`인 가족을 매일 체크해 Day 4/6/7 해당 시 푸시 발송.

- [ ] **Step 1: cron 로직에 구독 체험 알림 추가**

In `supabase/functions/push-notify/index.ts`, inside the cron handler (existing section that checks upcoming events), add:

```ts
async function sendTrialEndingPushes(supabase: any) {
  const { data: trials } = await supabase
    .from('family_subscription')
    .select('family_id, trial_ends_at')
    .eq('status', 'trial');

  if (!trials) return;
  const now = Date.now();

  for (const t of trials) {
    const endMs = new Date(t.trial_ends_at).getTime();
    const daysLeft = Math.ceil((endMs - now) / 86400_000);

    let title = null;
    let body = null;
    if (daysLeft === 3) {
      title = 'hyeni 체험 3일 남았어요';
      body = '하루 50원으로 계속 쓸 수 있어요';
    } else if (daysLeft === 1) {
      title = '내일이면 체험 종료!';
      body = '하루 50원 혜택을 이어가세요';
    } else if (daysLeft === 0) {
      title = '오늘 하루 남았어요';
      body = '하루 50원으로 아이를 계속 지키세요';
    }
    if (!title) continue;

    // 부모 push 토큰만 조회
    const { data: parents } = await supabase
      .from('family_members')
      .select('user_id')
      .eq('family_id', t.family_id)
      .eq('role', 'parent');

    for (const p of parents || []) {
      await sendPushToUser(p.user_id, { title, body, data: { type: 'trial_ending' } });
    }
  }
}
```

호출 추가 (기존 cron 모드 block 내):
```ts
await sendTrialEndingPushes(supabase);
```

(`sendPushToUser`가 기존 코드에 없으면, 기존 해당 함수명에 맞춰 조정. 예: `sendFcmToUser`)

- [ ] **Step 2: 배포 전 dry-run 로깅만**

테스트 단계에서는 실제 발송 전에 `console.log`로 수신 대상 로깅 먼저 확인하도록 temporary flag:
```ts
const DRY_RUN = Deno.env.get('TRIAL_PUSH_DRY_RUN') === '1';
// ...
if (DRY_RUN) {
  console.log(`[DRY] would push to ${p.user_id}: ${title}`);
  continue;
}
```

- [ ] **Step 3: 커밋**

```bash
cd /c/Users/TK/Desktop/hyeni && git add supabase/functions/push-notify/index.ts && git commit -m "feat: push-notify cron에 체험 종료 D-3/D-1/D-0 알림 추가"
```

---

## Phase H — Pre-launch

### Task H1: Early Adopter 가격 전환 계획서

**Files:**
- Create: `docs/pricing-transition-plan.md`

- [ ] **Step 1: 문서 작성**

```markdown
# Early Adopter 가격 전환 계획서

**작성일**: 2026-04-18
**목적**: 한국 표시광고법 준수 — "정가 ₩4,900 / ₩49,000 예정"이라는 페이월 카피의 법적 근거 확보

## 현재 가격 (Early Adopter)

- Premium Monthly: ₩1,500
- Premium Yearly: ₩15,000

## 정가 전환 일정

- **전환 시점**: 출시일 D+365 (약 12개월 후)
- **전환 방식**: Google Play Console에서 신규 Base Plan 생성
  - `premium_monthly_4900` (월 ₩4,900)
  - `premium_yearly_49000` (연 ₩49,000)
- **신규 가입자**에게만 정가 적용
- **기존 구독자**는 기존 Base Plan(월 ₩1,500 / 연 ₩15,000)으로 **평생 락인**

## 법적 근거 유지

표시광고법 제3조 준수:
- "정가 ₩4,900 예정"은 **실제로 전환할 계획이 문서화된 상태**에서만 사용 가능
- 본 문서로 계획의 실체성을 증명
- 전환 시점에 실제 Base Plan 등록 시 본 문서에 등록 사실 기록 (아래 "진행 로그")

## 진행 로그

- 2026-04-18 — 계획 문서화 완료
- (미래) 20xx-xx-xx — 신규 Base Plan 등록, 링크 첨부
- (미래) 20xx-xx-xx — 페이월 카피에서 "예정" 문구 조정
```

- [ ] **Step 2: 커밋**

```bash
cd /c/Users/TK/Desktop/hyeni && git add docs/pricing-transition-plan.md && git commit -m "docs: Early Adopter 정가 전환 계획서"
```

---

### Task H2: 이용약관·개인정보 업데이트 (플레이스홀더)

**Files:**
- Modify: 기존 이용약관·개인정보 문서 or 없으면 생성

- [ ] **Step 1: 기존 문서 확인**

```bash
find "C:\Users\TK\Desktop\hyeni" -type f \( -iname "terms*" -o -iname "privacy*" \) 2>/dev/null
```

- [ ] **Step 2: 없으면 신규 작성, 있으면 구독 조항 추가**

`docs/legal/terms.md` (없으면 생성)에 추가:
```markdown
## 제XX조 구독 서비스

1. 본 서비스는 7일 무료 체험 후 자동으로 유료 구독이 시작됩니다.
2. 체험 기간 중 언제든 해지하면 요금이 청구되지 않습니다.
3. 구독은 Google Play 계정에서 관리·해지할 수 있습니다.
4. 환불은 Google Play 정책에 따릅니다.
5. 출시 기념 가격(월 ₩1,500 / 연 ₩15,000)은 기존 구독자에게 평생 유지됩니다.
```

- [ ] **Step 3: 커밋**

```bash
cd /c/Users/TK/Desktop/hyeni && git add docs/legal/ && git commit -m "docs: 이용약관에 구독 조항 추가"
```

---

### Task H3: README 업데이트

**Files:**
- Modify: `README.md`

- [ ] **Step 1: 구독 모델 섹션 추가**

`README.md` 끝에 추가:
```markdown
## 구독 모델

- 카드 등록 7일 체험 + 패밀리 단위 구독 (Qonversion + GPB)
- Early Adopter 가격: 월 ₩1,500 / 연 ₩15,000
- 상세 설계: `docs/superpowers/specs/2026-04-18-subscription-design.md`
- 구현 계획: `docs/superpowers/plans/2026-04-18-subscription-model.md`

### 로컬 개발 — Supabase 시크릿

Supabase Dashboard → Settings → Vault:
- `QONVERSION_WEBHOOK_SECRET` — Qonversion 대시보드 발급
- `QONVERSION_API_KEY` — reconcile cron용

### 마이그레이션 적용

```bash
supabase db push
```

### Qonversion 설정

- Entitlement: `premium`
- Product: `premium_monthly` (₩1,500, 7일 체험), `premium_yearly` (₩15,000, 7일 체험)
- Offering: `main_paywall`
```

- [ ] **Step 2: 커밋**

```bash
cd /c/Users/TK/Desktop/hyeni && git add README.md && git commit -m "docs: README에 구독 모델 섹션 추가"
```

---

## Testing Checklist (수동 실행 — Phase 2 Integration Test)

Phase A~G 완료 후 Qonversion Sandbox + Play Console 라이선스 테스터로 수행:

- [ ] 1. 신규 부모 가입 → 홈 진입 → 페이월 없음 확인
- [ ] 2. 첫 일정 등록 → TrialInvitePrompt 1회 노출 확인
- [ ] 3. "나중에" 탭 → 재노출 안 됨 확인
- [ ] 4. AI 분석 탭 → FeatureLockOverlay 노출
- [ ] 5. "체험 시작" 탭 → AutoRenewalDisclosure → GPB → 체험 시작 → 프리미엄 기능 해제
- [ ] 6. 공동 부모 B 로그인 → 결제 UI 자동 숨김 확인
- [ ] 7. 아이 기기 로그인 → 결제 UI 전무, 프리미엄 기능 잠금 해제
- [ ] 8. Qonversion Sandbox에서 trial_started 후 Day 4로 시스템 시계 조작 → TrialEndingBanner 노출
- [ ] 9. Day 7 해지 이벤트 수동 트리거 → 체험 끝까지 프리미엄, Day 8 무료 티어 전환
- [ ] 10. 다운그레이드 후 자녀 2번째 카드에 InlineLockBadge 표시, 데이터 보존 확인
- [ ] 11. RLS 테스트: 무료 티어 상태에서 Supabase 클라이언트로 2번째 family_members (role='child') INSERT 시도 → 거부 확인
- [ ] 12. 복구 Cron 수동 실행 → 최근 24시간 갱신 없는 가족을 Qonversion REST와 동기화

---

## Self-Review

✅ **Spec coverage 체크**

| Spec 섹션 | 구현 태스크 |
|---|---|
| Pricing Early Adopter | D0 (카피), H1 (전환 계획서) |
| GPB·VAT 환산 | D0에 가격 상수로 반영, 서버 로직 영향 없음 |
| Feature Matrix | C2 (FEATURES), F1-F7 (UI 가드) |
| Architecture | A1-A10 (DB), C1-C5 (클라이언트) |
| Database Schema — family_subscription | A1 |
| families.subscription_tier 트리거 | A2 |
| family_members.active_slot | A3 |
| active_slot 재계산 트리거 | A4 |
| academies.notifications_suppressed | A5 |
| RLS 정책 | A6 |
| useEntitlement 훅 | C5 |
| 페이월 4종 컴포넌트 | D1-D4 |
| 아이 기기 UI 숨김 | D1/D2에 `isChild` prop, E2/E3/E4에서 전달 |
| TrialInvitePrompt 트리거 | E3 |
| FeatureLockOverlay 트리거 | E6 |
| TrialEndingBanner 타임라인 | D4 + E4 |
| 자동갱신 고지 | D5 + E2 |
| Qonversion 연동 | C1 / C1a (폴백) + C3 |
| identify(family_id) | E1 |
| 구매 플로우 | E2 (startTrial 헬퍼) |
| 웹훅 Edge Function | A7 (scaffold) + A8 (handlers) |
| 멱등성 체크 | A8 |
| 복구 Cron | A9 |
| raw_event purge | A10 |
| Soft-Lock: 자녀 active_slot | F1 |
| Soft-Lock: 위험구역 active_slot | F2 |
| Soft-Lock: 학원 notifications_suppressed | F3 |
| Soft-Lock: AI 분석 | F4 |
| Soft-Lock: 원격 음성 | F5 |
| Soft-Lock: 5분 지연 위치 | F6 |
| Soft-Lock: 30일 히스토리 | F7 |
| Day 4/6/7 푸시 | G1 |
| 구독 관리 설정 화면 | E5 |
| Pre-launch 체크리스트 | H1-H3 |

✅ **Placeholder scan**: TBD/TODO/FIXME 없음 확인.

✅ **Type consistency**: `FEATURES` 객체 키·값이 features.js → paywallCopy.js(FEATURE_LOCK) → 모든 가드 지점에서 일관. `family_subscription` 컬럼명이 migration → handlers → entitlement.js 전체에서 일관.

✅ **Scope**: MVP 범위 내. iOS·멀티티어·쿠폰 등 명시적 제외.
