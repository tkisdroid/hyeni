# 다중 자녀 지원 (Multi-Child Support) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 자녀 N명(1~5)을 동등하게 다루는 UI · 데이터 모델 · per-child 구독으로 전환. 1자녀 가족은 현재 화면을 그대로 유지하면서, 2자녀+ 가족은 자동으로 다중 자녀 모드로 전환된다.

**Architecture:** `paired_children.length` 단일 진실원으로 분기. 새 컴포넌트는 `src/components/multichild/` 격리 (App.jsx 분해 금지). DB는 5개 마이그레이션 (M1~M5) + per-child `subscriptions` 테이블 + `events_children` M:N. Qonversion은 N-SKU(5 슬롯) 모델로 재설계.

**Tech Stack:** React 19.2 · Vite 7 · Capacitor 8.2 · Supabase (Auth ES256 / RLS / Realtime / Storage) · Qonversion Capacitor 1.4 · Vitest 4 · Playwright 1.59 (real-services config)

**Spec Reference:** `docs/superpowers/specs/2026-04-28-multi-child-support-design.md`
**Visual Reference:** `design/Multi-Child UX · Overview v1.html`

---

## File Structure

### 신규 생성 파일 (Create)

| 파일 | 책임 |
|------|------|
| `src/components/multichild/ChildPalette.js` | 6색 팔레트 상수 + 자동 할당 함수 |
| `src/components/multichild/PairingWizard/ChildCountStep.jsx` | 자녀 수 선택 (1~5) |
| `src/components/multichild/PairingWizard/ChildDetailsStep.jsx` | 자녀별 이름/생년월일/색/사진 입력 |
| `src/components/multichild/PairingWizard/ColorPicker.jsx` | 6색 picker (충돌 시 disable) |
| `src/components/multichild/PairingWizard/PhotoUpload.jsx` | Supabase Storage `child-photos` 버킷 업로드 |
| `src/components/multichild/PairingWizard/PairingWizard.jsx` | 5-step wizard 컨테이너 |
| `src/components/multichild/HomeDashboard/ChildSummaryCard.jsx` | 자녀 카드 (사진+이름+위치+안전 dots) |
| `src/components/multichild/HomeDashboard/MiniMap.jsx` | 미니 지도 (자녀 N명 핀) |
| `src/components/multichild/HomeDashboard/TodayEventsList.jsx` | 오늘 일정 (자녀 색 vertical line) |
| `src/components/multichild/HomeDashboard/HomeTab.jsx` | 홈 탭 통합 |
| `src/components/multichild/EventModal/ChildSelector.jsx` | 자녀 다중 체크박스 + '가족 전체' (dashed) |
| `src/components/multichild/SubscriptionScreen/PerChildToggle.jsx` | 자녀별 구독 ON/OFF 토글 |
| `src/components/multichild/SubscriptionScreen/PriceSummary.jsx` | 합계 = N × ₩1,500 표시 |
| `src/lib/childSubscriptions.js` | per-child 구독 로딩 + Realtime + canChildUseFeature |
| `src/lib/childrenContext.js` | `useChildren()` hook — paired_children 메타데이터 + 색 매핑 |
| `supabase/migrations/20260429000001_multichild_m1_planned_count.sql` | M1 |
| `supabase/migrations/20260429000002_multichild_m2_member_meta.sql` | M2 |
| `supabase/migrations/20260429000003_multichild_m3_subscriptions.sql` | M3 |
| `supabase/migrations/20260429000004_multichild_m4_events_children.sql` | M4 |
| `supabase/migrations/20260429000005_multichild_m5_rls_policies.sql` | M5 |
| `supabase/migrations/down/20260429000001..005_*.sql` | 5개 down migrations |
| `tests/unit/childPalette.test.js` | 색 자동 할당 단위 테스트 |
| `tests/unit/childSubscriptions.test.js` | 구독 derive 로직 단위 테스트 |
| `tests/unit/multichild-branching.test.js` | `paired_children.length` 분기 단위 테스트 |
| `tests/unit/{ColorPicker,PhotoUpload,ChildCountStep,ChildDetailsStep,PairingWizard,ChildSummaryCard,TodayEventsList,MiniMap,HomeTab,ChildSelector,PerChildToggle,PriceSummary,SubscriptionManagement}.test.jsx` | 컴포넌트 단위 테스트 |
| `tests/unit/qonversion-nsku.test.js` | N-SKU helper 단위 테스트 |
| `tests/integration/multichild-rls.test.js` | RLS 격리 통합 테스트 |
| `tests/integration/multichild-event-save.test.js` | events_children 저장 통합 테스트 |
| `tests/e2e/multichild-{pairing-1child, pairing-3child, migration-1to1, migration-2child, event-single, event-family, subscription-partial, subscription-all, child-device-isolation, sos-free, color-realtime, add-remove}.spec.js` | E2E 12 시나리오 |

### 수정 파일 (Modify)

| 파일 | 라인 범위 | 변경 |
|------|----------|------|
| `src/App.jsx` | L6627-6628 | `_pairedDevice = pairedChildren[0]` → `useChildren()` 다중 분기 |
| `src/App.jsx` | L6679 | `childPos` (단일) 사용 부분 → `allChildPositions` (L6682) 활용 |
| `src/App.jsx` | L6695 | `childDeviceStatusMap` 다중 자녀 UI 소비 |
| `src/App.jsx` | (페어링 진입점) | `PairingWizard` import + 분기 |
| `src/App.jsx` | (일정 모달 진입점) | `ChildSelector` import + 분기 |
| `src/App.jsx` | (탭바) | 홈 탭 추가 (1자녀 모드 hide) |
| `src/lib/qonversion.js` | (append) | N-SKU support: childSlotProductId/Entitlement |
| `src/lib/auth.js` | `setupFamily` | `children: [{name, birthdate, color, photo}]` 파라미터 추가 |
| `src/lib/sync.js` | (append) | `saveEventWithChildren` M:N 저장 |
| `src/components/settings/SubscriptionManagement.jsx` | 전체 | per-child 토글 화면으로 재작성 |

---

## Phase 의존성 그래프

```
Phase 0 (Constants & Hooks) ── 독립
   ↓
Phase 1 (M1 + M2 마이그레이션) ── 직렬 (M1 → M2)
   ↓
Phase 2 (M3 구독) ──┐
                    ├─ 병렬 가능
Phase 3 (M4 events) ┘
                    ↓
            Phase 4 (M5 RLS) ←── Phase 2 + 3 의존
                    ↓
Phase 5 (Pairing UI) ─┐ ◄─── Phase 0 + 1 의존
Phase 6 (Home Tab) ───┤
                      ├─ 병렬 가능
Phase 7 (Event Modal) ┤ ◄─── Phase 3 의존
Phase 8 (Subscription)┘ ◄─── Phase 2 의존
                      ↓
            Phase 9 (Child UI + E2E) ◄── Phase 5-8 모두 의존
```

**병렬 실행 가능**: (2 ‖ 3), (5 ‖ 6 ‖ 7 ‖ 8). **직렬**: 0 → 1 → (2,3) → 4 → (5,6,7,8) → 9.

---

# Phase 0 — Constants & Shared Hooks

> **Goal:** 모든 phase 가 의존하는 색 팔레트 + `useChildren` hook. 이후 phase는 import 만.

## Task 0.1: ChildPalette.js — 6색 팔레트 + 자동 할당

**Files:**
- Create: `src/components/multichild/ChildPalette.js`
- Test: `tests/unit/childPalette.test.js`

- [ ] **Step 1: Write the failing test**

```javascript
// tests/unit/childPalette.test.js
import { describe, it, expect } from "vitest";
import { CHILD_PALETTE, autoAssignColor } from "../../src/components/multichild/ChildPalette.js";

describe("CHILD_PALETTE", () => {
  it("정확히 6색이고 모두 고유 hex 값이다", () => {
    expect(CHILD_PALETTE).toHaveLength(6);
    expect(new Set(CHILD_PALETTE).size).toBe(6);
  });

  it("모든 색이 #RRGGBB 형식이다", () => {
    for (const color of CHILD_PALETTE) {
      expect(color).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });
});

describe("autoAssignColor", () => {
  it("이미 사용된 색을 피해 다음 색을 반환한다", () => {
    const used = ["#F779A8"];
    const next = autoAssignColor(used);
    expect(next).not.toBe("#F779A8");
    expect(CHILD_PALETTE).toContain(next);
  });

  it("모든 색이 사용되면 첫 색으로 순환한다", () => {
    expect(autoAssignColor([...CHILD_PALETTE])).toBe(CHILD_PALETTE[0]);
  });

  it("빈 배열이면 첫 색을 반환한다", () => {
    expect(autoAssignColor([])).toBe(CHILD_PALETTE[0]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/childPalette.test.js`
Expected: FAIL — module not found

- [ ] **Step 3: Write minimal implementation**

```javascript
// src/components/multichild/ChildPalette.js
export const CHILD_PALETTE = [
  "#F779A8", // 핑크
  "#3B82F6", // 파랑
  "#10B981", // 초록
  "#F59E0B", // 노랑
  "#A78BFA", // 보라
  "#EF4444", // 빨강
];

export function autoAssignColor(usedColors) {
  if (!Array.isArray(usedColors) || usedColors.length === 0) {
    return CHILD_PALETTE[0];
  }
  for (const color of CHILD_PALETTE) {
    if (!usedColors.includes(color)) return color;
  }
  return CHILD_PALETTE[0];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/childPalette.test.js`
Expected: PASS — 5 tests passed

- [ ] **Step 5: Commit**

```bash
git add src/components/multichild/ChildPalette.js tests/unit/childPalette.test.js
git commit -m "feat(multichild): add ChildPalette with auto color assignment"
```

## Task 0.2: useChildren hook — paired_children 메타데이터 통합

**Files:**
- Create: `src/lib/childrenContext.js`
- Test: `tests/unit/multichild-branching.test.js`

- [ ] **Step 1: Write the failing test**

```javascript
// tests/unit/multichild-branching.test.js
import { describe, it, expect } from "vitest";
import { deriveChildren } from "../../src/lib/childrenContext.js";

describe("deriveChildren", () => {
  it("paired_children 0개 → isMultiChild=false, list=[]", () => {
    const result = deriveChildren({ members: [{ role: "parent", user_id: "p1" }] });
    expect(result.isMultiChild).toBe(false);
    expect(result.list).toEqual([]);
    expect(result.count).toBe(0);
  });

  it("paired_children 1개 → isMultiChild=false, list=[child]", () => {
    const result = deriveChildren({
      members: [
        { role: "parent", user_id: "p1" },
        { role: "child", user_id: "c1", name: "혜니", color_hex: "#F779A8", child_order: 1 },
      ],
    });
    expect(result.isMultiChild).toBe(false);
    expect(result.count).toBe(1);
    expect(result.list[0].name).toBe("혜니");
  });

  it("paired_children 2개 → isMultiChild=true, child_order 오름차순", () => {
    const result = deriveChildren({
      members: [
        { role: "child", user_id: "c2", name: "민준", child_order: 2 },
        { role: "child", user_id: "c1", name: "혜니", child_order: 1 },
        { role: "parent", user_id: "p1" },
      ],
    });
    expect(result.isMultiChild).toBe(true);
    expect(result.list[0].name).toBe("혜니");
    expect(result.list[1].name).toBe("민준");
  });

  it("color_hex 누락된 자녀는 자동 색 할당", () => {
    const result = deriveChildren({
      members: [
        { role: "child", user_id: "c1", name: "혜니", child_order: 1 },
        { role: "child", user_id: "c2", name: "민준", child_order: 2, color_hex: "#3B82F6" },
      ],
    });
    expect(result.list[0].color_hex).toMatch(/^#[0-9A-Fa-f]{6}$/);
    expect(result.list[0].color_hex).not.toBe(result.list[1].color_hex);
  });

  it("familyInfo가 null 이면 빈 결과", () => {
    expect(deriveChildren(null).count).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/multichild-branching.test.js`
Expected: FAIL — module not found

- [ ] **Step 3: Write minimal implementation**

```javascript
// src/lib/childrenContext.js
import { useMemo } from "react";
import { CHILD_PALETTE, autoAssignColor } from "../components/multichild/ChildPalette.js";

export function deriveChildren(familyInfo) {
  if (!familyInfo || !Array.isArray(familyInfo.members)) {
    return { count: 0, isMultiChild: false, list: [] };
  }

  const children = familyInfo.members
    .filter((m) => m.role === "child")
    .sort((a, b) => (a.child_order ?? 99) - (b.child_order ?? 99));

  const usedColors = [];
  const list = children.map((c) => {
    let color = c.color_hex;
    if (!color) color = autoAssignColor(usedColors);
    usedColors.push(color);
    return { ...c, color_hex: color };
  });

  return { count: list.length, isMultiChild: list.length >= 2, list };
}

export function useChildren(familyInfo) {
  return useMemo(() => deriveChildren(familyInfo), [familyInfo]);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/multichild-branching.test.js`
Expected: PASS — 5 tests passed

- [ ] **Step 5: Commit**

```bash
git add src/lib/childrenContext.js tests/unit/multichild-branching.test.js
git commit -m "feat(multichild): add useChildren hook for paired_children branching"
```

---

# Phase 1 — Migration M1 + M2

> **Goal:** `families.planned_child_count` + `family_members` 메타데이터 컬럼 추가.

## Task 1.1: M1 — `families.planned_child_count` 마이그레이션

**Files:**
- Create: `supabase/migrations/20260429000001_multichild_m1_planned_count.sql`
- Create: `supabase/migrations/down/20260429000001_multichild_m1_planned_count.sql`

- [ ] **Step 1: Write the migration (forward)**

```sql
-- supabase/migrations/20260429000001_multichild_m1_planned_count.sql
-- M1: families.planned_child_count — Spec §6
-- Pairing: supabase/migrations/down/20260429000001_multichild_m1_planned_count.sql

BEGIN;

ALTER TABLE public.families
  ADD COLUMN IF NOT EXISTS planned_child_count integer NOT NULL DEFAULT 1
  CHECK (planned_child_count BETWEEN 1 AND 5);

COMMIT;
```

- [ ] **Step 2: Write the down migration**

```sql
-- supabase/migrations/down/20260429000001_multichild_m1_planned_count.sql
BEGIN;
ALTER TABLE public.families DROP COLUMN IF EXISTS planned_child_count;
COMMIT;
```

- [ ] **Step 3: Apply against Supabase branch**

Run: `npx supabase db push --branch`
Expected: `Applied migration 20260429000001_multichild_m1_planned_count.sql`

- [ ] **Step 4: Verify column + constraints**

Run via Supabase MCP `execute_sql`:
```sql
SELECT column_name, data_type, column_default, is_nullable
FROM information_schema.columns
WHERE table_schema='public' AND table_name='families' AND column_name='planned_child_count';
```
Expected: 1 row, data_type=integer, column_default=1, is_nullable=NO

```sql
SELECT pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid='public.families'::regclass AND conname LIKE '%planned_child_count%';
```
Expected: `CHECK ((planned_child_count >= 1) AND (planned_child_count <= 5))`

- [ ] **Step 5: Verify all rows backfilled**

Run:
```sql
SELECT COUNT(*) FROM public.families WHERE planned_child_count IS NULL;
```
Expected: 0

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260429000001_multichild_m1_planned_count.sql supabase/migrations/down/20260429000001_multichild_m1_planned_count.sql
git commit -m "feat(db): M1 add families.planned_child_count (1..5)"
```

## Task 1.2: M2 — `family_members` 메타데이터 마이그레이션

**Files:**
- Create: `supabase/migrations/20260429000002_multichild_m2_member_meta.sql`
- Create: `supabase/migrations/down/20260429000002_multichild_m2_member_meta.sql`

- [ ] **Step 1: Write the migration (forward)**

```sql
-- supabase/migrations/20260429000002_multichild_m2_member_meta.sql
-- M2: family_members 메타데이터 — Spec §5.1, §13.1
-- Adds: birthdate, color_hex, photo_url, child_order
-- Backfill: 자녀 행에 child_order=1, color_hex='#F779A8'
-- Pairing: supabase/migrations/down/20260429000002_multichild_m2_member_meta.sql

BEGIN;

ALTER TABLE public.family_members
  ADD COLUMN IF NOT EXISTS birthdate date,
  ADD COLUMN IF NOT EXISTS color_hex text,
  ADD COLUMN IF NOT EXISTS photo_url text,
  ADD COLUMN IF NOT EXISTS child_order integer;

DO $color_check$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid='public.family_members'::regclass AND conname='family_members_color_hex_check'
  ) THEN
    ALTER TABLE public.family_members
      ADD CONSTRAINT family_members_color_hex_check
      CHECK (color_hex IS NULL OR color_hex ~ '^#[0-9A-Fa-f]{6}$');
  END IF;
END$color_check$;

UPDATE public.family_members
SET child_order = 1, color_hex = '#F779A8'
WHERE role = 'child' AND child_order IS NULL;

COMMIT;
```

- [ ] **Step 2: Write the down migration**

```sql
-- supabase/migrations/down/20260429000002_multichild_m2_member_meta.sql
BEGIN;
ALTER TABLE public.family_members DROP CONSTRAINT IF EXISTS family_members_color_hex_check;
ALTER TABLE public.family_members DROP COLUMN IF EXISTS child_order;
ALTER TABLE public.family_members DROP COLUMN IF EXISTS photo_url;
ALTER TABLE public.family_members DROP COLUMN IF EXISTS color_hex;
ALTER TABLE public.family_members DROP COLUMN IF EXISTS birthdate;
COMMIT;
```

- [ ] **Step 3: Apply against Supabase branch**

Run: `npx supabase db push --branch`
Expected: `Applied migration 20260429000002_multichild_m2_member_meta.sql`

- [ ] **Step 4: Verify columns**

Run:
```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema='public' AND table_name='family_members'
  AND column_name IN ('birthdate','color_hex','photo_url','child_order')
ORDER BY column_name;
```
Expected: 4 rows (birthdate=date, child_order=integer, color_hex=text, photo_url=text)

- [ ] **Step 5: Verify backfill**

Run:
```sql
SELECT COUNT(*) FROM public.family_members
WHERE role='child' AND (child_order IS NULL OR color_hex IS NULL);
```
Expected: 0

- [ ] **Step 6: Verify check constraint**

Run:
```sql
INSERT INTO public.family_members (family_id, user_id, role, name, color_hex)
VALUES (gen_random_uuid(), gen_random_uuid(), 'child', 'TEST', 'NOT-A-HEX');
```
Expected: ERROR — check constraint violation

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/20260429000002_multichild_m2_member_meta.sql supabase/migrations/down/20260429000002_multichild_m2_member_meta.sql
git commit -m "feat(db): M2 add family_members metadata (birthdate/color/photo/order)"
```

---

# Phase 2 — Migration M3 (subscriptions)

> **Goal:** per-child `subscriptions` + grandfather. **Phase 3과 병렬 실행 가능.**

## Task 2.1: M3 — `subscriptions` 테이블 + grandfather

**Files:**
- Create: `supabase/migrations/20260429000003_multichild_m3_subscriptions.sql`
- Create: `supabase/migrations/down/20260429000003_multichild_m3_subscriptions.sql`

- [ ] **Step 1: Write the migration (forward)**

```sql
-- supabase/migrations/20260429000003_multichild_m3_subscriptions.sql
-- M3: per-child subscriptions — Spec §5.1, §8, §13.1
-- Pairing: supabase/migrations/down/20260429000003_multichild_m3_subscriptions.sql

BEGIN;

CREATE TABLE IF NOT EXISTS public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  child_id uuid NOT NULL REFERENCES public.family_members(id) ON DELETE CASCADE,
  qonversion_user_id text,
  qonversion_entitlement_id text,
  status text NOT NULL CHECK (status IN ('active','grace','expired','canceled')),
  expires_at timestamptz,
  product_id text NOT NULL,
  price_krw integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT subscriptions_child_unique UNIQUE (child_id)
);

CREATE INDEX IF NOT EXISTS subscriptions_family_idx ON public.subscriptions(family_id);
CREATE INDEX IF NOT EXISTS subscriptions_status_active_idx
  ON public.subscriptions(status) WHERE status='active';

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

DO $publication$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='subscriptions'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.subscriptions';
  END IF;
END$publication$;

INSERT INTO public.subscriptions (family_id, child_id, status, product_id, price_krw, expires_at)
SELECT
  fs.family_id,
  fm.id AS child_id,
  CASE WHEN fs.status='expired' THEN 'expired' ELSE 'active' END,
  'hyeni_child_slot_1',
  1500,
  fs.current_period_end
FROM public.family_subscription fs
JOIN public.family_members fm
  ON fm.family_id=fs.family_id AND fm.role='child' AND fm.child_order=1
WHERE fs.status IN ('active','trial','grace')
ON CONFLICT (child_id) DO NOTHING;

COMMIT;
```

- [ ] **Step 2: Write the down migration**

```sql
-- supabase/migrations/down/20260429000003_multichild_m3_subscriptions.sql
BEGIN;

DO $publication$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='subscriptions'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime DROP TABLE public.subscriptions';
  END IF;
END$publication$;

DROP TABLE IF EXISTS public.subscriptions;
COMMIT;
```

- [ ] **Step 3: Apply**

Run: `npx supabase db push --branch`
Expected: `Applied migration 20260429000003_multichild_m3_subscriptions.sql`

- [ ] **Step 4: Verify table + indexes + Realtime**

Run:
```sql
SELECT COUNT(*) FROM information_schema.tables
WHERE table_schema='public' AND table_name='subscriptions';
```
Expected: 1

```sql
SELECT indexname FROM pg_indexes
WHERE schemaname='public' AND tablename='subscriptions' ORDER BY indexname;
```
Expected: 4 rows (subscriptions_child_unique, subscriptions_family_idx, subscriptions_pkey, subscriptions_status_active_idx)

```sql
SELECT 1 FROM pg_publication_tables
WHERE pubname='supabase_realtime' AND tablename='subscriptions';
```
Expected: 1 row

- [ ] **Step 5: Verify grandfather backfill counts match**

Run:
```sql
WITH old_active AS (
  SELECT COUNT(*) AS c FROM public.family_subscription WHERE status IN ('active','trial','grace')
),
new_active AS (
  SELECT COUNT(*) AS c FROM public.subscriptions WHERE status='active'
)
SELECT old_active.c AS old_count, new_active.c AS new_count FROM old_active, new_active;
```
Expected: `old_count = new_count`

- [ ] **Step 6: Verify UNIQUE(child_id)**

Run:
```sql
INSERT INTO public.subscriptions (family_id, child_id, status, product_id, price_krw)
SELECT family_id, child_id, 'active', 'hyeni_child_slot_2', 1500
FROM public.subscriptions LIMIT 1;
```
Expected: ERROR — `subscriptions_child_unique` violation

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/20260429000003_multichild_m3_subscriptions.sql supabase/migrations/down/20260429000003_multichild_m3_subscriptions.sql
git commit -m "feat(db): M3 add per-child subscriptions table with grandfather migration"
```

---

# Phase 3 — Migration M4 (events_children M:N)

> **Goal:** `events.is_family_event` + `events_children` M:N. **Phase 2와 병렬 실행 가능.**

## Task 3.1: M4 — `events_children` M:N

**Files:**
- Create: `supabase/migrations/20260429000004_multichild_m4_events_children.sql`
- Create: `supabase/migrations/down/20260429000004_multichild_m4_events_children.sql`

- [ ] **Step 1: Write the migration (forward)**

```sql
-- supabase/migrations/20260429000004_multichild_m4_events_children.sql
-- M4: events_children M:N + is_family_event — Spec §4.3, §5.1
-- Pairing: supabase/migrations/down/20260429000004_multichild_m4_events_children.sql

BEGIN;

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS is_family_event boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.events_children (
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  child_id uuid NOT NULL REFERENCES public.family_members(id) ON DELETE CASCADE,
  PRIMARY KEY (event_id, child_id)
);

CREATE INDEX IF NOT EXISTS events_children_child_idx
  ON public.events_children(child_id);

ALTER TABLE public.events_children ENABLE ROW LEVEL SECURITY;

DO $publication$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='events_children'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.events_children';
  END IF;
END$publication$;

DO $backfill$
DECLARE
  has_child_id boolean;
  backfill_count integer;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='events' AND column_name='child_id'
  ) INTO has_child_id;

  IF has_child_id THEN
    INSERT INTO public.events_children (event_id, child_id)
    SELECT e.id, e.child_id
    FROM public.events e
    WHERE e.child_id IS NOT NULL
    ON CONFLICT DO NOTHING;
    GET DIAGNOSTICS backfill_count = ROW_COUNT;
    RAISE NOTICE 'M4 backfill: % events_children rows from events.child_id', backfill_count;
  ELSE
    RAISE NOTICE 'M4 backfill: events.child_id column not present, skipping';
  END IF;
END$backfill$;

COMMIT;
```

- [ ] **Step 2: Write the down migration**

```sql
-- supabase/migrations/down/20260429000004_multichild_m4_events_children.sql
BEGIN;

DO $publication$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='events_children'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime DROP TABLE public.events_children';
  END IF;
END$publication$;

DROP TABLE IF EXISTS public.events_children;
ALTER TABLE public.events DROP COLUMN IF EXISTS is_family_event;
COMMIT;
```

- [ ] **Step 3: Apply**

Run: `npx supabase db push --branch`
Expected: `Applied migration 20260429000004_multichild_m4_events_children.sql`

- [ ] **Step 4: Verify table + index + Realtime**

Run:
```sql
SELECT COUNT(*) FROM information_schema.tables
WHERE table_schema='public' AND table_name='events_children';
```
Expected: 1

```sql
SELECT 1 FROM pg_indexes
WHERE schemaname='public' AND indexname='events_children_child_idx';
```
Expected: 1

```sql
SELECT 1 FROM pg_publication_tables
WHERE pubname='supabase_realtime' AND tablename='events_children';
```
Expected: 1

- [ ] **Step 5: Verify is_family_event default**

Run:
```sql
SELECT column_default FROM information_schema.columns
WHERE table_schema='public' AND table_name='events' AND column_name='is_family_event';
```
Expected: `false`

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260429000004_multichild_m4_events_children.sql supabase/migrations/down/20260429000004_multichild_m4_events_children.sql
git commit -m "feat(db): M4 add events_children M:N + is_family_event flag"
```

---

# Phase 4 — Migration M5 (RLS Policies)

> **Goal:** subscriptions/events_children/child_device_stats RLS. **Phase 2 + 3 모두 완료 후.**

## Task 4.1: M5 — RLS 정책 마이그레이션

**Files:**
- Create: `supabase/migrations/20260429000005_multichild_m5_rls_policies.sql`
- Create: `supabase/migrations/down/20260429000005_multichild_m5_rls_policies.sql`

- [ ] **Step 1: Snapshot existing pg_policies (pre-migration)**

Run via Supabase MCP `execute_sql`:
```sql
SELECT schemaname, tablename, policyname, cmd, qual, with_check
FROM pg_policies
WHERE schemaname='public' AND tablename IN ('subscriptions','events_children','child_device_stats')
ORDER BY tablename, policyname;
```
Save output to `.planning/snapshots/2026-04-29-pg_policies-pre-m5.txt`.

- [ ] **Step 2: Write the migration (forward)**

```sql
-- supabase/migrations/20260429000005_multichild_m5_rls_policies.sql
-- M5: RLS policies — Spec §7
-- Pairing: supabase/migrations/down/20260429000005_multichild_m5_rls_policies.sql

BEGIN;

-- subscriptions
DROP POLICY IF EXISTS subscriptions_select_family ON public.subscriptions;
CREATE POLICY subscriptions_select_family
  ON public.subscriptions FOR SELECT
  USING (family_id IN (
    SELECT family_id FROM public.family_members WHERE user_id = auth.uid()
  ));

DROP POLICY IF EXISTS subscriptions_insert_parent ON public.subscriptions;
CREATE POLICY subscriptions_insert_parent
  ON public.subscriptions FOR INSERT
  WITH CHECK (family_id IN (
    SELECT family_id FROM public.family_members
    WHERE user_id = auth.uid() AND role = 'parent'
  ));

DROP POLICY IF EXISTS subscriptions_update_parent ON public.subscriptions;
CREATE POLICY subscriptions_update_parent
  ON public.subscriptions FOR UPDATE
  USING (family_id IN (
    SELECT family_id FROM public.family_members
    WHERE user_id = auth.uid() AND role = 'parent'
  ));

-- events_children
DROP POLICY IF EXISTS events_children_select_family ON public.events_children;
CREATE POLICY events_children_select_family
  ON public.events_children FOR SELECT
  USING (event_id IN (
    SELECT id FROM public.events
    WHERE family_id IN (
      SELECT family_id FROM public.family_members WHERE user_id = auth.uid()
    )
  ));

DROP POLICY IF EXISTS events_children_modify_parent ON public.events_children;
CREATE POLICY events_children_modify_parent
  ON public.events_children FOR ALL
  USING (event_id IN (
    SELECT id FROM public.events
    WHERE family_id IN (
      SELECT family_id FROM public.family_members
      WHERE user_id = auth.uid() AND role = 'parent'
    )
  ));

-- child_device_stats: per-child subscription gate
DO $cds_gate$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema='public' AND table_name='child_device_stats'
  ) THEN
    EXECUTE 'DROP POLICY IF EXISTS child_device_stats_select_subscriber ON public.child_device_stats';
    EXECUTE $policy$
      CREATE POLICY child_device_stats_select_subscriber
        ON public.child_device_stats FOR SELECT
        USING (
          EXISTS (
            SELECT 1 FROM public.subscriptions s
            WHERE s.child_id = child_device_stats.child_id AND s.status = 'active'
          )
          AND child_id IN (
            SELECT id FROM public.family_members
            WHERE family_id IN (
              SELECT family_id FROM public.family_members WHERE user_id = auth.uid()
            )
          )
        )
    $policy$;
  END IF;
END$cds_gate$;

COMMIT;
```

- [ ] **Step 3: Write the down migration**

```sql
-- supabase/migrations/down/20260429000005_multichild_m5_rls_policies.sql
BEGIN;

DROP POLICY IF EXISTS subscriptions_select_family ON public.subscriptions;
DROP POLICY IF EXISTS subscriptions_insert_parent ON public.subscriptions;
DROP POLICY IF EXISTS subscriptions_update_parent ON public.subscriptions;
DROP POLICY IF EXISTS events_children_select_family ON public.events_children;
DROP POLICY IF EXISTS events_children_modify_parent ON public.events_children;

DO $cds_revert$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema='public' AND table_name='child_device_stats'
  ) THEN
    EXECUTE 'DROP POLICY IF EXISTS child_device_stats_select_subscriber ON public.child_device_stats';
    -- NOTE: prior policy must be restored from .planning/snapshots/2026-04-29-pg_policies-pre-m5.txt
  END IF;
END$cds_revert$;

COMMIT;
```

- [ ] **Step 4: Apply**

Run: `npx supabase db push --branch`
Expected: `Applied migration 20260429000005_multichild_m5_rls_policies.sql`

- [ ] **Step 5: Verify policies installed**

Run:
```sql
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE schemaname='public' AND tablename IN ('subscriptions','events_children')
ORDER BY tablename, policyname;
```
Expected: 5 rows (events_children × 2, subscriptions × 3)

- [ ] **Step 6: Write RLS isolation integration test**

```javascript
// tests/integration/multichild-rls.test.js
import { describe, it, expect, beforeAll } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { setupTestFamily, cleanupTestFamily } from "./_helpers.js";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON = process.env.VITE_SUPABASE_ANON_KEY;

describe("subscriptions RLS isolation", () => {
  let familyA, familyB;

  beforeAll(async () => {
    familyA = await setupTestFamily({ children: [{ name: "혜니", color_hex: "#F779A8" }], subscribed: true });
    familyB = await setupTestFamily({ children: [{ name: "민준", color_hex: "#3B82F6" }], subscribed: true });
  });

  it("다른 가족의 subscriptions 행은 SELECT 결과 0건", async () => {
    const clientA = createClient(SUPABASE_URL, SUPABASE_ANON);
    await clientA.auth.signInWithPassword({ email: familyA.parent_email, password: "test1234" });

    const { data, error } = await clientA
      .from("subscriptions")
      .select("*")
      .eq("family_id", familyB.family_id);

    expect(error).toBeNull();
    expect(data).toEqual([]);

    await cleanupTestFamily(familyA);
    await cleanupTestFamily(familyB);
  });
});
```

- [ ] **Step 7: Run RLS test**

Run: `npx vitest run tests/integration/multichild-rls.test.js`
Expected: PASS — 1 test passed

- [ ] **Step 8: Commit**

```bash
git add supabase/migrations/20260429000005_multichild_m5_rls_policies.sql supabase/migrations/down/20260429000005_multichild_m5_rls_policies.sql tests/integration/multichild-rls.test.js
git commit -m "feat(db): M5 RLS policies for subscriptions/events_children + per-child child_device_stats gate"
```

---

# Phase 5 — Pairing Wizard UI

> **Goal:** 부모 페어링 시 자녀 수 + 자녀별 메타데이터 입력 wizard. **Phase 6, 7, 8과 병렬 실행 가능.**

## Task 5.1: ColorPicker 컴포넌트

**Files:**
- Create: `src/components/multichild/PairingWizard/ColorPicker.jsx`
- Test: `tests/unit/ColorPicker.test.jsx`

- [ ] **Step 1: Write the failing test**

```jsx
// tests/unit/ColorPicker.test.jsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ColorPicker } from "../../src/components/multichild/PairingWizard/ColorPicker.jsx";

describe("ColorPicker", () => {
  it("6개 색 버튼 렌더", () => {
    render(<ColorPicker selected="#F779A8" usedColors={[]} onChange={() => {}} />);
    expect(screen.getAllByRole("button")).toHaveLength(6);
  });

  it("이미 사용된 색은 aria-disabled=true", () => {
    render(<ColorPicker selected="#F779A8" usedColors={["#3B82F6"]} onChange={() => {}} />);
    expect(screen.getByRole("button", { name: /파랑/ })).toHaveAttribute("aria-disabled", "true");
  });

  it("색 클릭 시 onChange 호출", () => {
    const onChange = vi.fn();
    render(<ColorPicker selected="#F779A8" usedColors={[]} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: /초록/ }));
    expect(onChange).toHaveBeenCalledWith("#10B981");
  });

  it("사용된 색 클릭 시 onChange 호출되지 않음", () => {
    const onChange = vi.fn();
    render(<ColorPicker selected="#F779A8" usedColors={["#3B82F6"]} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: /파랑/ }));
    expect(onChange).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/ColorPicker.test.jsx`
Expected: FAIL — module not found

- [ ] **Step 3: Write minimal implementation**

```jsx
// src/components/multichild/PairingWizard/ColorPicker.jsx
import { CHILD_PALETTE } from "../ChildPalette.js";

const COLOR_NAMES = {
  "#F779A8": "핑크", "#3B82F6": "파랑", "#10B981": "초록",
  "#F59E0B": "노랑", "#A78BFA": "보라", "#EF4444": "빨강",
};

export function ColorPicker({ selected, usedColors = [], onChange }) {
  return (
    <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
      {CHILD_PALETTE.map((color) => {
        const isUsed = usedColors.includes(color) && color !== selected;
        const isSelected = color === selected;
        return (
          <button
            key={color} type="button"
            aria-label={COLOR_NAMES[color]}
            aria-disabled={isUsed}
            disabled={isUsed}
            onClick={() => !isUsed && onChange(color)}
            style={{
              width: 44, height: 44, borderRadius: "50%",
              background: color,
              border: isSelected ? "3px solid #1F2937" : "2px solid #E5E7EB",
              opacity: isUsed ? 0.3 : 1,
              cursor: isUsed ? "not-allowed" : "pointer",
            }}
          />
        );
      })}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/ColorPicker.test.jsx`
Expected: PASS — 4 tests passed

- [ ] **Step 5: Commit**

```bash
git add src/components/multichild/PairingWizard/ColorPicker.jsx tests/unit/ColorPicker.test.jsx
git commit -m "feat(multichild): add ColorPicker component"
```

## Task 5.2: PhotoUpload 컴포넌트 (Supabase Storage)

**Files:**
- Create: `src/components/multichild/PairingWizard/PhotoUpload.jsx`
- Test: `tests/unit/PhotoUpload.test.jsx`

> Pre-task: Create Storage bucket `child-photos` in Supabase dashboard:
> ```sql
> INSERT INTO storage.buckets (id, name, public) VALUES ('child-photos', 'child-photos', false)
> ON CONFLICT (id) DO NOTHING;
> ```
> Then add Storage RLS: `parent role can INSERT/SELECT in their own family path`.

- [ ] **Step 1: Write the failing test**

```jsx
// tests/unit/PhotoUpload.test.jsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PhotoUpload } from "../../src/components/multichild/PairingWizard/PhotoUpload.jsx";

vi.mock("../../src/lib/supabase.js", () => ({
  supabase: {
    storage: {
      from: () => ({
        upload: vi.fn().mockResolvedValue({ data: { path: "test/photo.jpg" }, error: null }),
        getPublicUrl: () => ({ data: { publicUrl: "https://test/photo.jpg" } }),
      }),
    },
  },
}));

describe("PhotoUpload", () => {
  it("초기에 placeholder 텍스트", () => {
    render(<PhotoUpload value={null} onChange={() => {}} familyId="f1" childOrder={1} />);
    expect(screen.getByText(/사진 추가/i)).toBeInTheDocument();
  });

  it("value 있으면 이미지 표시", () => {
    render(<PhotoUpload value="https://test/photo.jpg" onChange={() => {}} familyId="f1" childOrder={1} />);
    expect(screen.getByRole("img")).toHaveAttribute("src", "https://test/photo.jpg");
  });

  it("파일 선택 시 onChange 호출", async () => {
    const onChange = vi.fn();
    render(<PhotoUpload value={null} onChange={onChange} familyId="f1" childOrder={1} />);
    const input = screen.getByLabelText(/사진 추가/i);
    const file = new File(["dummy"], "photo.jpg", { type: "image/jpeg" });
    fireEvent.change(input, { target: { files: [file] } });
    await new Promise((r) => setTimeout(r, 50));
    expect(onChange).toHaveBeenCalledWith("https://test/photo.jpg");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/PhotoUpload.test.jsx`
Expected: FAIL — module not found

- [ ] **Step 3: Write minimal implementation**

```jsx
// src/components/multichild/PairingWizard/PhotoUpload.jsx
import { useState } from "react";
import { supabase } from "../../../lib/supabase.js";

export function PhotoUpload({ value, onChange, familyId, childOrder }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const ext = file.name.split(".").pop();
      const path = `${familyId}/child-${childOrder}-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("child-photos").upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { data } = supabase.storage.from("child-photos").getPublicUrl(path);
      onChange(data.publicUrl);
    } catch (err) {
      setError(err.message || "업로드 실패");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <label
        htmlFor={`photo-${childOrder}`}
        style={{
          display: "flex", alignItems: "center", justifyContent: "center",
          width: 96, height: 96, borderRadius: "50%",
          background: value ? `url(${value}) center/cover` : "#F3F4F6",
          border: "2px dashed #D1D5DB", cursor: busy ? "wait" : "pointer",
          color: "#6B7280", fontSize: 12,
        }}
      >
        {!value && (busy ? "업로드 중..." : "사진 추가")}
      </label>
      <input
        id={`photo-${childOrder}`}
        type="file" accept="image/*"
        onChange={handleFile} disabled={busy}
        style={{ display: "none" }}
      />
      {error && <div style={{ color: "#EF4444", fontSize: 12, marginTop: 4 }}>{error}</div>}
      {value && <img src={value} alt="자녀 사진" style={{ display: "none" }} />}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/PhotoUpload.test.jsx`
Expected: PASS — 3 tests passed

- [ ] **Step 5: Commit**

```bash
git add src/components/multichild/PairingWizard/PhotoUpload.jsx tests/unit/PhotoUpload.test.jsx
git commit -m "feat(multichild): add PhotoUpload to Supabase Storage child-photos bucket"
```

## Task 5.3: ChildCountStep 컴포넌트

**Files:**
- Create: `src/components/multichild/PairingWizard/ChildCountStep.jsx`
- Test: `tests/unit/ChildCountStep.test.jsx`

- [ ] **Step 1: Write the failing test**

```jsx
// tests/unit/ChildCountStep.test.jsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ChildCountStep } from "../../src/components/multichild/PairingWizard/ChildCountStep.jsx";

describe("ChildCountStep", () => {
  it("1~5 옵션 5개 버튼 렌더", () => {
    render(<ChildCountStep value={1} onChange={() => {}} onNext={() => {}} />);
    for (let i = 1; i <= 5; i++) {
      expect(screen.getByRole("button", { name: `${i}명` })).toBeInTheDocument();
    }
  });

  it("선택된 개수 aria-pressed=true", () => {
    render(<ChildCountStep value={3} onChange={() => {}} onNext={() => {}} />);
    expect(screen.getByRole("button", { name: "3명" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "1명" })).toHaveAttribute("aria-pressed", "false");
  });

  it("개수 클릭 시 onChange 호출", () => {
    const onChange = vi.fn();
    render(<ChildCountStep value={null} onChange={onChange} onNext={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "2명" }));
    expect(onChange).toHaveBeenCalledWith(2);
  });

  it("선택 안 했으면 다음 버튼 disabled", () => {
    render(<ChildCountStep value={null} onChange={() => {}} onNext={() => {}} />);
    expect(screen.getByRole("button", { name: "다음" })).toBeDisabled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/ChildCountStep.test.jsx`
Expected: FAIL — module not found

- [ ] **Step 3: Write minimal implementation**

```jsx
// src/components/multichild/PairingWizard/ChildCountStep.jsx
export function ChildCountStep({ value, onChange, onNext }) {
  return (
    <div>
      <h2 style={{ fontSize: 22, fontWeight: 900, color: "#1F2937", marginBottom: 8 }}>
        자녀가 몇 명인가요?
      </h2>
      <p style={{ fontSize: 14, color: "#6B7280", marginBottom: 24 }}>
        나중에 추가/삭제할 수 있어요.
      </p>
      <div style={{ display: "flex", gap: 12, marginBottom: 32 }}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n} type="button"
            aria-pressed={value === n}
            onClick={() => onChange(n)}
            style={{
              flex: 1, padding: "16px 0", borderRadius: 14,
              border: value === n ? "2px solid #F779A8" : "1.5px solid #E5E7EB",
              background: value === n ? "#FFF1F7" : "white",
              fontSize: 16, fontWeight: 800,
              color: value === n ? "#BE185D" : "#1F2937",
              cursor: "pointer",
            }}
          >
            {n}명
          </button>
        ))}
      </div>
      <button
        type="button" onClick={onNext} disabled={value == null}
        style={{
          width: "100%", padding: "14px 0", borderRadius: 14,
          background: value == null ? "#E5E7EB" : "#F779A8",
          color: value == null ? "#9CA3AF" : "white",
          fontSize: 16, fontWeight: 800,
          cursor: value == null ? "not-allowed" : "pointer",
          border: "none",
        }}
      >다음</button>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/ChildCountStep.test.jsx`
Expected: PASS — 4 tests passed

- [ ] **Step 5: Commit**

```bash
git add src/components/multichild/PairingWizard/ChildCountStep.jsx tests/unit/ChildCountStep.test.jsx
git commit -m "feat(multichild): add ChildCountStep wizard step"
```

## Task 5.4: ChildDetailsStep 컴포넌트

**Files:**
- Create: `src/components/multichild/PairingWizard/ChildDetailsStep.jsx`
- Test: `tests/unit/ChildDetailsStep.test.jsx`

- [ ] **Step 1: Write the failing test**

```jsx
// tests/unit/ChildDetailsStep.test.jsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ChildDetailsStep } from "../../src/components/multichild/PairingWizard/ChildDetailsStep.jsx";

const baseChild = { name: "", birthdate: "", color_hex: "#F779A8", photo_url: null };

describe("ChildDetailsStep", () => {
  it("이름과 생년월일 input 표시", () => {
    render(<ChildDetailsStep child={baseChild} index={0} onChange={() => {}} usedColors={[]} familyId="f1" />);
    expect(screen.getByLabelText(/이름/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/생년월일/i)).toBeInTheDocument();
  });

  it("이름 입력 시 onChange 호출", () => {
    const onChange = vi.fn();
    render(<ChildDetailsStep child={baseChild} index={0} onChange={onChange} usedColors={[]} familyId="f1" />);
    fireEvent.change(screen.getByLabelText(/이름/i), { target: { value: "혜니" } });
    expect(onChange).toHaveBeenCalledWith({ ...baseChild, name: "혜니" });
  });

  it("생년월일 YYYY-MM-DD 입력", () => {
    const onChange = vi.fn();
    render(<ChildDetailsStep child={baseChild} index={0} onChange={onChange} usedColors={[]} familyId="f1" />);
    fireEvent.change(screen.getByLabelText(/생년월일/i), { target: { value: "2015-03-21" } });
    expect(onChange).toHaveBeenCalledWith({ ...baseChild, birthdate: "2015-03-21" });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/ChildDetailsStep.test.jsx`
Expected: FAIL — module not found

- [ ] **Step 3: Write minimal implementation**

```jsx
// src/components/multichild/PairingWizard/ChildDetailsStep.jsx
import { ColorPicker } from "./ColorPicker.jsx";
import { PhotoUpload } from "./PhotoUpload.jsx";

export function ChildDetailsStep({ child, index, onChange, usedColors, familyId }) {
  const update = (patch) => onChange({ ...child, ...patch });
  const order = index + 1;

  return (
    <div>
      <h2 style={{ fontSize: 20, fontWeight: 900, color: "#1F2937", marginBottom: 4 }}>
        {order}번째 자녀
      </h2>
      <p style={{ fontSize: 13, color: "#6B7280", marginBottom: 20 }}>
        이름과 생년월일을 입력해 주세요. 생년월일은 자녀별 구독 식별에 사용돼요.
      </p>

      <div style={{ marginBottom: 20 }}>
        <PhotoUpload
          value={child.photo_url}
          onChange={(url) => update({ photo_url: url })}
          familyId={familyId} childOrder={order}
        />
      </div>

      <label style={{ display: "block", fontSize: 14, fontWeight: 700, marginBottom: 6, color: "#1F2937" }}>
        이름
        <input
          type="text" value={child.name} maxLength={20} placeholder="자녀 이름"
          onChange={(e) => update({ name: e.target.value })}
          style={{
            display: "block", width: "100%", padding: "12px 14px", marginTop: 6,
            borderRadius: 12, border: "1.5px solid #E5E7EB", fontSize: 16,
          }}
        />
      </label>

      <label style={{ display: "block", fontSize: 14, fontWeight: 700, marginTop: 16, marginBottom: 6, color: "#1F2937" }}>
        생년월일
        <input
          type="date" value={child.birthdate}
          onChange={(e) => update({ birthdate: e.target.value })}
          style={{
            display: "block", width: "100%", padding: "12px 14px", marginTop: 6,
            borderRadius: 12, border: "1.5px solid #E5E7EB", fontSize: 16,
          }}
        />
      </label>

      <div style={{ marginTop: 20 }}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10, color: "#1F2937" }}>색</div>
        <ColorPicker
          selected={child.color_hex}
          usedColors={usedColors.filter((c) => c !== child.color_hex)}
          onChange={(c) => update({ color_hex: c })}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/ChildDetailsStep.test.jsx`
Expected: PASS — 3 tests passed

- [ ] **Step 5: Commit**

```bash
git add src/components/multichild/PairingWizard/ChildDetailsStep.jsx tests/unit/ChildDetailsStep.test.jsx
git commit -m "feat(multichild): add ChildDetailsStep wizard step"
```

## Task 5.5: PairingWizard 컨테이너 + setupFamily 통합

**Files:**
- Create: `src/components/multichild/PairingWizard/PairingWizard.jsx`
- Modify: `src/lib/auth.js` (`setupFamily` signature 확장)
- Test: `tests/unit/PairingWizard.test.jsx`

- [ ] **Step 1: Modify `setupFamily` in src/lib/auth.js**

Open `src/lib/auth.js`, find `export async function setupFamily(userId, parentName)` (around L86). Replace with:

```javascript
// src/lib/auth.js — replace setupFamily function
export async function setupFamily(userId, parentName, options = {}) {
  const { familyName = "", plannedChildCount = 1, children = [] } = options;

  const { data: existing } = await supabase
    .from("families")
    .select("id, pair_code, planned_child_count")
    .eq("parent_id", userId)
    .limit(1)
    .maybeSingle();

  let family;
  if (existing) {
    family = existing;
    if (plannedChildCount && plannedChildCount !== existing.planned_child_count) {
      await supabase.from("families")
        .update({ planned_child_count: plannedChildCount })
        .eq("id", existing.id);
    }
  } else {
    const { data: created, error: createError } = await supabase
      .from("families")
      .insert({
        parent_id: userId,
        pair_code: generatePairCode(),
        planned_child_count: plannedChildCount,
        name: familyName,
      })
      .select("id, pair_code")
      .single();
    if (createError) throw createError;
    family = created;
  }

  await supabase.from("family_members").upsert(
    { family_id: family.id, user_id: userId, role: "parent", name: parentName || "부모" },
    { onConflict: "family_id,user_id" }
  );

  for (let i = 0; i < children.length; i++) {
    const c = children[i];
    await supabase.from("family_members").insert({
      family_id: family.id,
      user_id: null,
      role: "child",
      name: c.name,
      birthdate: c.birthdate || null,
      color_hex: c.color_hex,
      photo_url: c.photo_url || null,
      child_order: i + 1,
    });
  }

  return family;
}
```

- [ ] **Step 2: Write the wizard test**

```jsx
// tests/unit/PairingWizard.test.jsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { PairingWizard } from "../../src/components/multichild/PairingWizard/PairingWizard.jsx";

vi.mock("../../src/lib/auth.js", () => ({
  setupFamily: vi.fn().mockResolvedValue({ id: "f1", pair_code: "KID-ABC123" }),
}));

vi.mock("../../src/lib/supabase.js", () => ({
  supabase: {
    storage: { from: () => ({ upload: vi.fn(), getPublicUrl: () => ({ data: { publicUrl: "" } }) }) },
  },
}));

describe("PairingWizard", () => {
  it("Step 1 → 2 → 3 → 4 → 5 전체 흐름", async () => {
    const onComplete = vi.fn();
    render(<PairingWizard userId="u1" parentName="부모" onComplete={onComplete} />);

    fireEvent.change(screen.getByLabelText(/가족 이름/i), { target: { value: "혜니네" } });
    fireEvent.click(screen.getByRole("button", { name: "다음" }));

    fireEvent.click(screen.getByRole("button", { name: "1명" }));
    fireEvent.click(screen.getByRole("button", { name: "다음" }));

    fireEvent.change(screen.getByLabelText(/이름/i), { target: { value: "혜니" } });
    fireEvent.change(screen.getByLabelText(/생년월일/i), { target: { value: "2015-03-21" } });
    fireEvent.click(screen.getByRole("button", { name: "다음" }));

    await waitFor(() => {
      expect(screen.getByText(/KID-ABC123/)).toBeInTheDocument();
    });
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run tests/unit/PairingWizard.test.jsx`
Expected: FAIL — module not found

- [ ] **Step 4: Write the wizard implementation**

```jsx
// src/components/multichild/PairingWizard/PairingWizard.jsx
import { useState } from "react";
import { setupFamily } from "../../../lib/auth.js";
import { autoAssignColor } from "../ChildPalette.js";
import { ChildCountStep } from "./ChildCountStep.jsx";
import { ChildDetailsStep } from "./ChildDetailsStep.jsx";

export function PairingWizard({ userId, parentName, onComplete }) {
  const [stepIndex, setStepIndex] = useState(0);
  const [familyName, setFamilyName] = useState("");
  const [childCount, setChildCount] = useState(null);
  const [children, setChildren] = useState([]);
  const [family, setFamily] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  function startChildren() {
    if (children.length === 0) {
      const init = Array.from({ length: childCount }, (_, i) => {
        const used = init?.slice(0, i).map((c) => c.color_hex) || [];
        return { name: "", birthdate: "", color_hex: autoAssignColor(used), photo_url: null };
      });
      // re-compute usedColors progressively
      const final = [];
      for (let i = 0; i < childCount; i++) {
        const used = final.map((c) => c.color_hex);
        final.push({ name: "", birthdate: "", color_hex: autoAssignColor(used), photo_url: null });
      }
      setChildren(final);
    }
  }

  async function submitChildren() {
    setBusy(true);
    setError(null);
    try {
      const created = await setupFamily(userId, parentName, {
        familyName, plannedChildCount: childCount, children,
      });
      setFamily(created);
      setStepIndex(3);
    } catch (err) {
      setError(err.message || "가족 생성 실패");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ padding: 24, maxWidth: 480, margin: "0 auto" }}>
      <ProgressBar current={stepIndex} total={5} />

      {stepIndex === 0 && (
        <Step1FamilyName value={familyName} onChange={setFamilyName} onNext={() => setStepIndex(1)} />
      )}
      {stepIndex === 1 && (
        <ChildCountStep
          value={childCount} onChange={setChildCount}
          onNext={() => { startChildren(); setStepIndex(2); }}
        />
      )}
      {stepIndex === 2 && (
        <Step3Children
          children={children} onChange={setChildren}
          familyId={family?.id || "pending"}
          busy={busy} error={error}
          onSubmit={submitChildren}
        />
      )}
      {stepIndex === 3 && family && (
        <Step4PairCode family={family} onNext={() => setStepIndex(4)} />
      )}
      {stepIndex === 4 && (
        <Step5Complete onComplete={() => onComplete?.(family)} />
      )}
    </div>
  );
}

function ProgressBar({ current, total }) {
  return (
    <div style={{ display: "flex", gap: 4, marginBottom: 32 }}>
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} style={{
          flex: 1, height: 4, borderRadius: 2,
          background: i <= current ? "#F779A8" : "#E5E7EB",
        }} />
      ))}
    </div>
  );
}

function Step1FamilyName({ value, onChange, onNext }) {
  return (
    <div>
      <h2 style={{ fontSize: 22, fontWeight: 900, color: "#1F2937", marginBottom: 24 }}>
        가족 이름을 알려주세요
      </h2>
      <label style={{ display: "block" }}>
        가족 이름
        <input
          type="text" value={value} onChange={(e) => onChange(e.target.value)}
          placeholder="예) 혜니네" maxLength={20}
          style={{
            display: "block", width: "100%", padding: "12px 14px", marginTop: 6,
            borderRadius: 12, border: "1.5px solid #E5E7EB", fontSize: 16,
          }}
        />
      </label>
      <button
        type="button" onClick={onNext} disabled={!value.trim()}
        style={{
          marginTop: 32, width: "100%", padding: "14px 0", borderRadius: 14,
          background: value.trim() ? "#F779A8" : "#E5E7EB",
          color: value.trim() ? "white" : "#9CA3AF",
          fontSize: 16, fontWeight: 800, border: "none",
          cursor: value.trim() ? "pointer" : "not-allowed",
        }}
      >다음</button>
    </div>
  );
}

function Step3Children({ children, onChange, familyId, busy, error, onSubmit }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const usedColors = children.map((c) => c.color_hex).filter(Boolean);
  const allValid = children.every((c) => c.name.trim() && c.birthdate);

  return (
    <div>
      <ChildDetailsStep
        child={children[activeIndex]}
        index={activeIndex}
        onChange={(updated) => {
          const next = [...children];
          next[activeIndex] = updated;
          onChange(next);
        }}
        usedColors={usedColors}
        familyId={familyId}
      />

      <div style={{ display: "flex", gap: 12, marginTop: 24 }}>
        {activeIndex > 0 && (
          <button type="button" onClick={() => setActiveIndex(activeIndex - 1)}
            style={{ flex: 1, padding: "14px 0", borderRadius: 14, background: "white", border: "1.5px solid #E5E7EB", fontWeight: 800 }}>
            이전 자녀
          </button>
        )}
        {activeIndex < children.length - 1 ? (
          <button
            type="button"
            onClick={() => setActiveIndex(activeIndex + 1)}
            disabled={!children[activeIndex].name.trim() || !children[activeIndex].birthdate}
            style={{ flex: 1, padding: "14px 0", borderRadius: 14, background: "#F779A8", color: "white", fontWeight: 800, border: "none" }}
          >다음 자녀</button>
        ) : (
          <button
            type="button" onClick={onSubmit} disabled={!allValid || busy}
            style={{ flex: 1, padding: "14px 0", borderRadius: 14,
              background: allValid && !busy ? "#F779A8" : "#E5E7EB",
              color: allValid && !busy ? "white" : "#9CA3AF",
              fontWeight: 800, border: "none" }}
          >{busy ? "저장 중..." : "다음"}</button>
        )}
      </div>
      {error && <div style={{ color: "#EF4444", marginTop: 12, fontSize: 14 }}>{error}</div>}
    </div>
  );
}

function Step4PairCode({ family, onNext }) {
  return (
    <div>
      <h2 style={{ fontSize: 22, fontWeight: 900, color: "#1F2937", marginBottom: 12 }}>
        페어링 코드
      </h2>
      <p style={{ fontSize: 14, color: "#6B7280", marginBottom: 20 }}>
        자녀 단말 앱에 이 코드를 입력하면 가족이 연결돼요.
      </p>
      <div style={{
        background: "#FFF1F7", border: "2px solid #F779A8", borderRadius: 14,
        padding: 24, textAlign: "center",
        fontSize: 22, fontWeight: 900, letterSpacing: 2, color: "#BE185D",
      }}>
        {family.pair_code}
      </div>
      <button
        type="button" onClick={onNext}
        style={{
          marginTop: 32, width: "100%", padding: "14px 0", borderRadius: 14,
          background: "#F779A8", color: "white", fontSize: 16, fontWeight: 800, border: "none",
        }}
      >모든 자녀 페어링 완료</button>
    </div>
  );
}

function Step5Complete({ onComplete }) {
  return (
    <div style={{ textAlign: "center", paddingTop: 60 }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>🎉</div>
      <h2 style={{ fontSize: 22, fontWeight: 900, marginBottom: 12 }}>설정 완료!</h2>
      <button
        type="button" onClick={onComplete}
        style={{
          marginTop: 32, padding: "14px 32px", borderRadius: 14,
          background: "#F779A8", color: "white", fontSize: 16, fontWeight: 800, border: "none",
        }}
      >시작하기</button>
    </div>
  );
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/unit/PairingWizard.test.jsx`
Expected: PASS — 1 test passed

- [ ] **Step 6: Run full unit test suite**

Run: `npm run test`
Expected: 0 failures

- [ ] **Step 7: Commit**

```bash
git add src/components/multichild/PairingWizard/PairingWizard.jsx src/lib/auth.js tests/unit/PairingWizard.test.jsx
git commit -m "feat(multichild): add PairingWizard 5-step flow + setupFamily children param"
```

## Task 5.6: App.jsx 페어링 진입점 통합

**Files:**
- Modify: `src/App.jsx` (페어링 진입점)

- [ ] **Step 1: Locate the existing pairing entry point**

Run:
```bash
grep -n "showParentSetup" src/App.jsx
grep -n "setupFamily" src/App.jsx
```
Identify the existing single-screen parent setup component invocation and its props.

- [ ] **Step 2: Add PairingWizard import + mount**

Add import near top of App.jsx:
```jsx
import { PairingWizard } from "./components/multichild/PairingWizard/PairingWizard.jsx";
```

Replace existing parent-setup invocation with:

```jsx
{showParentSetup && (
  <PairingWizard
    userId={session.user.id}
    parentName={parentName}
    onComplete={(family) => {
      setShowParentSetup(false);
      setFamilyInfo({ ...familyInfo, familyId: family.id, pairCode: family.pair_code });
    }}
  />
)}
```

- [ ] **Step 3: Manually verify in dev server**

Run: `npm run dev`. As parent: 가족 이름 → 자녀 수(3) → 자녀 정보 3회 → setupFamily → pair code 표시 → 완료.

- [ ] **Step 4: Commit**

```bash
git add src/App.jsx
git commit -m "feat(multichild): mount PairingWizard at parent setup entry"
```

---

# Phase 6 — Home Dashboard NEW Tab

> **Goal:** 다중 자녀 통합 홈 탭. 1자녀 모드 hide. **Phase 5, 7, 8과 병렬 실행 가능.**

## Task 6.1: ChildSummaryCard 컴포넌트

**Files:**
- Create: `src/components/multichild/HomeDashboard/ChildSummaryCard.jsx`
- Test: `tests/unit/ChildSummaryCard.test.jsx`

- [ ] **Step 1: Write the failing test**

```jsx
// tests/unit/ChildSummaryCard.test.jsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ChildSummaryCard } from "../../src/components/multichild/HomeDashboard/ChildSummaryCard.jsx";

const child = { user_id: "c1", name: "혜니", color_hex: "#F779A8", photo_url: "https://test/h.jpg" };

describe("ChildSummaryCard", () => {
  it("이름과 사진 표시", () => {
    render(<ChildSummaryCard child={child} location="학교" safetyDots={["green","green","green"]} />);
    expect(screen.getByText("혜니")).toBeInTheDocument();
  });

  it("위치 텍스트 표시", () => {
    render(<ChildSummaryCard child={child} location="학교" safetyDots={[]} />);
    expect(screen.getByText("학교")).toBeInTheDocument();
  });

  it("위치 누락 시 placeholder", () => {
    render(<ChildSummaryCard child={child} location={null} safetyDots={[]} />);
    expect(screen.getByText(/위치 확인/i)).toBeInTheDocument();
  });

  it("safety dots 개수 렌더링", () => {
    const { container } = render(
      <ChildSummaryCard child={child} location="학교" safetyDots={["green","yellow","red"]} />
    );
    expect(container.querySelectorAll("[data-safety-dot]")).toHaveLength(3);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/ChildSummaryCard.test.jsx`
Expected: FAIL — module not found

- [ ] **Step 3: Write minimal implementation**

```jsx
// src/components/multichild/HomeDashboard/ChildSummaryCard.jsx
const DOT_COLORS = { green: "#10B981", yellow: "#F59E0B", red: "#EF4444" };

export function ChildSummaryCard({ child, location, safetyDots = [] }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 14,
      padding: 14, borderRadius: 16,
      background: "white", border: "1.5px solid #F3F4F6",
      boxShadow: "0 4px 12px rgba(0,0,0,0.04)",
    }}>
      <div style={{
        width: 48, height: 48, borderRadius: "50%",
        background: child.photo_url ? `url(${child.photo_url}) center/cover` : child.color_hex,
        border: `3px solid ${child.color_hex}`,
        flexShrink: 0,
      }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: "#1F2937" }}>{child.name}</div>
        <div style={{ fontSize: 13, color: "#6B7280", marginTop: 2 }}>
          {location || "위치 확인 중..."}
        </div>
      </div>
      <div style={{ display: "flex", gap: 4 }}>
        {safetyDots.map((color, i) => (
          <div key={i} data-safety-dot style={{
            width: 8, height: 8, borderRadius: "50%",
            background: DOT_COLORS[color] || "#D1D5DB",
          }} />
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/ChildSummaryCard.test.jsx`
Expected: PASS — 4 tests passed

- [ ] **Step 5: Commit**

```bash
git add src/components/multichild/HomeDashboard/ChildSummaryCard.jsx tests/unit/ChildSummaryCard.test.jsx
git commit -m "feat(multichild): add ChildSummaryCard for HomeDashboard"
```

## Task 6.2: TodayEventsList 컴포넌트

**Files:**
- Create: `src/components/multichild/HomeDashboard/TodayEventsList.jsx`
- Test: `tests/unit/TodayEventsList.test.jsx`

- [ ] **Step 1: Write the failing test**

```jsx
// tests/unit/TodayEventsList.test.jsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { TodayEventsList } from "../../src/components/multichild/HomeDashboard/TodayEventsList.jsx";

const children = [
  { user_id: "c1", name: "혜니", color_hex: "#F779A8" },
  { user_id: "c2", name: "민준", color_hex: "#3B82F6" },
];

const events = [
  { id: "e1", title: "학원", time: "15:00", child_ids: ["c1"], is_family_event: false },
  { id: "e2", title: "저녁 식사", time: "19:00", child_ids: [], is_family_event: true },
];

describe("TodayEventsList", () => {
  it("일정 제목과 시간 표시", () => {
    render(<TodayEventsList events={events} children={children} />);
    expect(screen.getByText("학원")).toBeInTheDocument();
    expect(screen.getByText("15:00")).toBeInTheDocument();
  });

  it("자녀 이벤트는 자녀 색 vertical line", () => {
    const { container } = render(<TodayEventsList events={events} children={children} />);
    const learn = container.querySelector('[data-event-id="e1"]');
    expect(learn.style.borderLeftColor).toContain("rgb(247, 121, 168)");
  });

  it("가족 이벤트는 dashed border", () => {
    const { container } = render(<TodayEventsList events={events} children={children} />);
    const dinner = container.querySelector('[data-event-id="e2"]');
    expect(dinner.style.borderLeftStyle).toBe("dashed");
  });

  it("일정 없으면 placeholder", () => {
    render(<TodayEventsList events={[]} children={children} />);
    expect(screen.getByText(/오늘 일정이 없어요/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/TodayEventsList.test.jsx`
Expected: FAIL — module not found

- [ ] **Step 3: Write minimal implementation**

```jsx
// src/components/multichild/HomeDashboard/TodayEventsList.jsx
export function TodayEventsList({ events, children }) {
  if (!events || events.length === 0) {
    return (
      <div style={{ padding: 20, textAlign: "center", color: "#9CA3AF", fontSize: 14 }}>
        오늘 일정이 없어요
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {events.map((event) => {
        const eventChildren = (event.child_ids || [])
          .map((id) => children.find((c) => c.user_id === id))
          .filter(Boolean);
        const isFamily = event.is_family_event;
        const firstColor = eventChildren[0]?.color_hex || "#9CA3AF";

        return (
          <div
            key={event.id} data-event-id={event.id}
            style={{
              padding: "10px 14px",
              borderLeft: `4px ${isFamily ? "dashed" : "solid"} ${isFamily ? "#9CA3AF" : firstColor}`,
              background: "white", borderRadius: 8,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#1F2937" }}>{event.title}</div>
              <div style={{ fontSize: 13, color: "#6B7280" }}>{event.time}</div>
            </div>
            <div style={{ fontSize: 12, color: "#6B7280", marginTop: 2 }}>
              {isFamily ? "가족 전체" : eventChildren.map((c) => c.name).join(", ")}
            </div>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/TodayEventsList.test.jsx`
Expected: PASS — 4 tests passed

- [ ] **Step 5: Commit**

```bash
git add src/components/multichild/HomeDashboard/TodayEventsList.jsx tests/unit/TodayEventsList.test.jsx
git commit -m "feat(multichild): add TodayEventsList with child color vertical lines"
```

## Task 6.3: MiniMap 컴포넌트

**Files:**
- Create: `src/components/multichild/HomeDashboard/MiniMap.jsx`
- Test: `tests/unit/MiniMap.test.jsx`

- [ ] **Step 1: Write the failing test**

```jsx
// tests/unit/MiniMap.test.jsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MiniMap } from "../../src/components/multichild/HomeDashboard/MiniMap.jsx";

const children = [
  { user_id: "c1", name: "혜니", color_hex: "#F779A8" },
  { user_id: "c2", name: "민준", color_hex: "#3B82F6" },
];
const positions = [
  { user_id: "c1", lat: 37.5, lng: 127.0 },
  { user_id: "c2", lat: 37.6, lng: 127.1 },
];

describe("MiniMap", () => {
  it("자녀 N명의 핀 렌더링", () => {
    const { container } = render(<MiniMap children={children} positions={positions} onTap={() => {}} />);
    expect(container.querySelectorAll("[data-pin]")).toHaveLength(2);
  });

  it("핀 색은 자녀 color_hex 와 일치", () => {
    const { container } = render(<MiniMap children={children} positions={positions} onTap={() => {}} />);
    const pins = container.querySelectorAll("[data-pin]");
    expect(pins[0].style.background).toContain("rgb(247, 121, 168)");
    expect(pins[1].style.background).toContain("rgb(59, 130, 246)");
  });

  it("탭 시 onTap 호출", () => {
    const onTap = vi.fn();
    render(<MiniMap children={children} positions={positions} onTap={onTap} />);
    fireEvent.click(screen.getByRole("button", { name: /지도/i }));
    expect(onTap).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/MiniMap.test.jsx`
Expected: FAIL — module not found

- [ ] **Step 3: Write minimal implementation**

```jsx
// src/components/multichild/HomeDashboard/MiniMap.jsx
export function MiniMap({ children, positions, onTap }) {
  const pinned = (positions || []).map((p) => {
    const child = children.find((c) => c.user_id === p.user_id);
    return child ? { ...p, color_hex: child.color_hex, name: child.name } : null;
  }).filter(Boolean);

  return (
    <button
      type="button" onClick={onTap} aria-label="지도 탭으로 이동"
      style={{
        position: "relative", width: "100%", height: 160, borderRadius: 16,
        background: "linear-gradient(135deg, #F0F9FF, #FEF3F8)",
        border: "1.5px solid #E5E7EB", overflow: "hidden", cursor: "pointer", padding: 0,
      }}
    >
      {pinned.map((p, i) => (
        <div
          key={p.user_id} data-pin
          style={{
            position: "absolute",
            top: `${30 + (i * 30) % 80}%`,
            left: `${20 + (i * 40) % 60}%`,
            width: 18, height: 18, borderRadius: "50% 50% 50% 0",
            transform: "rotate(-45deg)",
            background: p.color_hex,
            border: "2px solid white",
            boxShadow: "0 2px 6px rgba(0,0,0,0.2)",
          }}
        />
      ))}
      <div style={{
        position: "absolute", bottom: 8, right: 12,
        fontSize: 11, color: "#6B7280", fontWeight: 700,
      }}>탭하여 전체 지도 보기</div>
    </button>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/MiniMap.test.jsx`
Expected: PASS — 3 tests passed

- [ ] **Step 5: Commit**

```bash
git add src/components/multichild/HomeDashboard/MiniMap.jsx tests/unit/MiniMap.test.jsx
git commit -m "feat(multichild): add MiniMap with N child pins"
```

## Task 6.4: HomeTab 통합

**Files:**
- Create: `src/components/multichild/HomeDashboard/HomeTab.jsx`
- Test: `tests/unit/HomeTab.test.jsx`

- [ ] **Step 1: Write the failing test**

```jsx
// tests/unit/HomeTab.test.jsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { HomeTab } from "../../src/components/multichild/HomeDashboard/HomeTab.jsx";

const children = [
  { user_id: "c1", name: "혜니", color_hex: "#F779A8" },
  { user_id: "c2", name: "민준", color_hex: "#3B82F6" },
];

describe("HomeTab", () => {
  it("자녀 카드 N개 + MiniMap + 일정 리스트 렌더", () => {
    render(<HomeTab
      children={children} positions={[]} events={[]}
      childLocations={{}} childDeviceStatusMap={{}} onMapTap={() => {}}
    />);
    expect(screen.getByText("혜니")).toBeInTheDocument();
    expect(screen.getByText("민준")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/HomeTab.test.jsx`
Expected: FAIL — module not found

- [ ] **Step 3: Write minimal implementation**

```jsx
// src/components/multichild/HomeDashboard/HomeTab.jsx
import { ChildSummaryCard } from "./ChildSummaryCard.jsx";
import { MiniMap } from "./MiniMap.jsx";
import { TodayEventsList } from "./TodayEventsList.jsx";

function deriveSafetyDots(deviceStatus) {
  if (!deviceStatus) return [];
  return [
    deviceStatus.battery_low ? "yellow" : "green",
    deviceStatus.last_seen_minutes_ago > 30 ? "red" : "green",
    deviceStatus.app_blocked ? "red" : "green",
  ];
}

export function HomeTab({ children, positions, events, childLocations, childDeviceStatusMap, onMapTap }) {
  return (
    <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 20 }}>
      <section>
        <h3 style={{ fontSize: 12, fontWeight: 800, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 }}>
          자녀 ({children.length}명)
        </h3>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {children.map((c) => (
            <ChildSummaryCard
              key={c.user_id} child={c}
              location={childLocations[c.user_id]?.label}
              safetyDots={deriveSafetyDots(childDeviceStatusMap[c.user_id])}
            />
          ))}
        </div>
      </section>

      <section>
        <h3 style={{ fontSize: 12, fontWeight: 800, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 }}>위치</h3>
        <MiniMap children={children} positions={positions} onTap={onMapTap} />
      </section>

      <section>
        <h3 style={{ fontSize: 12, fontWeight: 800, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 }}>오늘 일정</h3>
        <TodayEventsList events={events} children={children} />
      </section>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/HomeTab.test.jsx`
Expected: PASS — 1 test passed

- [ ] **Step 5: Commit**

```bash
git add src/components/multichild/HomeDashboard/HomeTab.jsx tests/unit/HomeTab.test.jsx
git commit -m "feat(multichild): add HomeTab integrating ChildSummaryCard, MiniMap, TodayEventsList"
```

## Task 6.5: App.jsx — 홈 탭 추가 + 1자녀 모드 hide

**Files:**
- Modify: `src/App.jsx`

- [ ] **Step 1: Add imports near top of App.jsx**

```jsx
import { HomeTab } from "./components/multichild/HomeDashboard/HomeTab.jsx";
import { useChildren } from "./lib/childrenContext.js";
```

- [ ] **Step 2: Replace pairedChildren computation (around L6627-6628)**

Find:
```jsx
const pairedChildren = familyInfo?.members?.filter(m => m.role === "child") || [];
const _pairedDevice = pairedChildren[0] || null;
```

Replace with:
```jsx
const childrenContext = useChildren(familyInfo);
const pairedChildren = childrenContext.list;
const _pairedDevice = pairedChildren[0] || null; // 하위호환 (단일 자녀)
const isMultiChild = childrenContext.isMultiChild;
```

- [ ] **Step 3: Add isToday helper if not present**

In App.jsx near other utilities, add:
```jsx
const isToday = (d) => {
  if (!d) return false;
  const t = new Date();
  const dt = new Date(d);
  return t.toDateString() === dt.toDateString();
};
```

- [ ] **Step 4: Add 'home' activeView branch**

Find existing `{activeView === "calendar" && (...)}`. Inject BEFORE it:

```jsx
{activeView === "home" && isMultiChild && (
  <HomeTab
    children={pairedChildren}
    positions={allChildPositions}
    events={events.filter(e => isToday(e.date))}
    childLocations={childLocationLabels}
    childDeviceStatusMap={childDeviceStatusMap}
    onMapTap={() => setActiveView("location")}
  />
)}
```

- [ ] **Step 5: Add 'home' tab button to bottom nav**

Find existing tab bar (search for `setActiveView("calendar")`). Add at start:

```jsx
{isMultiChild && (
  <button
    type="button"
    onClick={() => setActiveView("home")}
    aria-pressed={activeView === "home"}
    style={tabButtonStyle(activeView === "home")}
  >
    <span>🏠</span><span>홈</span>
  </button>
)}
```

> Use the existing `tabButtonStyle` helper or inline style matching neighboring tabs.

- [ ] **Step 6: Default activeView to "home" when isMultiChild + parent**

Find `useState("calendar")`. Replace with:
```jsx
const [activeView, setActiveView] = useState(() => {
  const childCount = familyInfo?.members?.filter(m => m.role === "child")?.length || 0;
  return (isParent && childCount >= 2) ? "home" : "calendar";
});
```

- [ ] **Step 7: Manual smoke test**

Run: `npm run dev`
- 1자녀 가족: 홈 탭 안 보임 (기존 그대로)
- 2자녀 가족: 홈 탭 표시, 자동 진입, 자녀 2명 카드

- [ ] **Step 8: Commit**

```bash
git add src/App.jsx
git commit -m "feat(multichild): mount HomeTab + show only when isMultiChild"
```

---

# Phase 7 — Event Modal Multi-Child Selection

> **Goal:** 일정 등록 모달 자녀 다중 선택 + '가족 전체'. **Phase 5, 6, 8과 병렬 실행 가능.**

## Task 7.1: ChildSelector 컴포넌트

**Files:**
- Create: `src/components/multichild/EventModal/ChildSelector.jsx`
- Test: `tests/unit/ChildSelector.test.jsx`

- [ ] **Step 1: Write the failing test**

```jsx
// tests/unit/ChildSelector.test.jsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ChildSelector } from "../../src/components/multichild/EventModal/ChildSelector.jsx";

const children = [
  { user_id: "c1", name: "혜니", color_hex: "#F779A8" },
  { user_id: "c2", name: "민준", color_hex: "#3B82F6" },
];

describe("ChildSelector", () => {
  it("자녀 N명 체크박스 + '가족 전체' 옵션 렌더", () => {
    render(<ChildSelector children={children} value={{ childIds: [], familyAll: false }} onChange={() => {}} />);
    expect(screen.getByLabelText("혜니")).toBeInTheDocument();
    expect(screen.getByLabelText("민준")).toBeInTheDocument();
    expect(screen.getByText("가족 전체")).toBeInTheDocument();
  });

  it("자녀 체크 시 onChange 호출", () => {
    const onChange = vi.fn();
    render(<ChildSelector children={children} value={{ childIds: [], familyAll: false }} onChange={onChange} />);
    fireEvent.click(screen.getByLabelText("혜니"));
    expect(onChange).toHaveBeenCalledWith({ childIds: ["c1"], familyAll: false });
  });

  it("'가족 전체' 선택 시 자녀 체크박스 모두 해제 (XOR)", () => {
    const onChange = vi.fn();
    render(<ChildSelector children={children} value={{ childIds: ["c1"], familyAll: false }} onChange={onChange} />);
    fireEvent.click(screen.getByText("가족 전체"));
    expect(onChange).toHaveBeenCalledWith({ childIds: [], familyAll: true });
  });

  it("자녀 체크 시 '가족 전체' 자동 해제 (XOR)", () => {
    const onChange = vi.fn();
    render(<ChildSelector children={children} value={{ childIds: [], familyAll: true }} onChange={onChange} />);
    fireEvent.click(screen.getByLabelText("혜니"));
    expect(onChange).toHaveBeenCalledWith({ childIds: ["c1"], familyAll: false });
  });

  it("1자녀 모드에서는 컴포넌트 자동 hide", () => {
    const { container } = render(
      <ChildSelector children={[children[0]]} value={{ childIds: ["c1"], familyAll: false }} onChange={() => {}} />
    );
    expect(container.firstChild).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/ChildSelector.test.jsx`
Expected: FAIL — module not found

- [ ] **Step 3: Write minimal implementation**

```jsx
// src/components/multichild/EventModal/ChildSelector.jsx
export function ChildSelector({ children, value, onChange }) {
  if (!children || children.length < 2) return null;

  const { childIds = [], familyAll = false } = value || {};

  function toggleChild(id) {
    const next = childIds.includes(id) ? childIds.filter((x) => x !== id) : [...childIds, id];
    onChange({ childIds: next, familyAll: false });
  }

  function pickFamily() {
    onChange({ childIds: [], familyAll: true });
  }

  return (
    <div>
      <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10, color: "#1F2937" }}>대상</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {children.map((c) => {
          const checked = childIds.includes(c.user_id);
          return (
            <label
              key={c.user_id}
              style={{
                display: "flex", alignItems: "center", gap: 12,
                padding: "10px 14px", borderRadius: 12,
                border: checked ? `2px solid ${c.color_hex}` : "1.5px solid #E5E7EB",
                background: checked ? `${c.color_hex}15` : "white",
                cursor: "pointer",
              }}
            >
              <input
                type="checkbox" checked={checked}
                onChange={() => toggleChild(c.user_id)}
                aria-label={c.name}
                style={{ width: 20, height: 20, accentColor: c.color_hex }}
              />
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: c.color_hex }} />
              <span style={{ fontSize: 15, fontWeight: 700, color: "#1F2937" }}>{c.name}</span>
            </label>
          );
        })}
      </div>
      <button
        type="button" onClick={pickFamily}
        style={{
          marginTop: 12, width: "100%", padding: "12px 14px",
          borderRadius: 12, border: `2px dashed ${familyAll ? "#1F2937" : "#9CA3AF"}`,
          background: familyAll ? "#F3F4F6" : "white",
          fontSize: 14, fontWeight: 700, color: "#1F2937",
          cursor: "pointer",
        }}
      >가족 전체 (모든 자녀 + 부모)</button>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/ChildSelector.test.jsx`
Expected: PASS — 5 tests passed

- [ ] **Step 5: Commit**

```bash
git add src/components/multichild/EventModal/ChildSelector.jsx tests/unit/ChildSelector.test.jsx
git commit -m "feat(multichild): add ChildSelector with XOR family/child selection"
```

## Task 7.2: saveEventWithChildren — sync.js 확장

**Files:**
- Modify: `src/lib/sync.js`
- Test: `tests/integration/multichild-event-save.test.js`

- [ ] **Step 1: Write integration test**

```javascript
// tests/integration/multichild-event-save.test.js
import { describe, it, expect, vi, beforeEach } from "vitest";

const insertCalls = [];
const deleteCalls = [];

vi.mock("../../src/lib/supabase.js", () => ({
  supabase: {
    from: (table) => ({
      insert: (rows) => {
        insertCalls.push({ table, rows });
        return { select: () => ({ single: () => Promise.resolve({ data: { id: "e1" }, error: null }) }) };
      },
      upsert: (row) => {
        insertCalls.push({ table, rows: row });
        return { select: () => ({ single: () => Promise.resolve({ data: { id: "e1", ...row }, error: null }) }) };
      },
      delete: () => ({
        eq: () => {
          deleteCalls.push({ table });
          return Promise.resolve({ error: null });
        },
      }),
    }),
  },
}));

beforeEach(() => { insertCalls.length = 0; deleteCalls.length = 0; });

import { saveEventWithChildren } from "../../src/lib/sync.js";

describe("saveEventWithChildren", () => {
  it("자녀 1명 선택 시 events_children 1행 생성", async () => {
    await saveEventWithChildren({ id: "e1", title: "학원", family_id: "f1" }, { childIds: ["c1"], familyAll: false });
    const childRows = insertCalls.find((c) => c.table === "events_children");
    expect(childRows.rows).toEqual([{ event_id: "e1", child_id: "c1" }]);
  });

  it("'가족 전체' 시 is_family_event=true + events_children 행 0개", async () => {
    await saveEventWithChildren({ id: "e1", title: "저녁식사", family_id: "f1" }, { childIds: [], familyAll: true });
    const eventRows = insertCalls.find((c) => c.table === "events");
    expect(eventRows.rows.is_family_event).toBe(true);
    const childRows = insertCalls.find((c) => c.table === "events_children");
    expect(childRows).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/integration/multichild-event-save.test.js`
Expected: FAIL — `saveEventWithChildren` not exported

- [ ] **Step 3: Append saveEventWithChildren to src/lib/sync.js**

```javascript
// src/lib/sync.js — append at end of file
export async function saveEventWithChildren(event, selection) {
  const { childIds = [], familyAll = false } = selection || {};

  const eventRow = {
    ...event,
    is_family_event: !!familyAll,
  };
  delete eventRow.child_ids;

  const { data: saved, error: eventError } = await supabase
    .from("events")
    .upsert(eventRow)
    .select()
    .single();
  if (eventError) throw eventError;

  await supabase.from("events_children").delete().eq("event_id", saved.id);

  if (!familyAll && childIds.length > 0) {
    const links = childIds.map((cid) => ({ event_id: saved.id, child_id: cid }));
    const { error: linkError } = await supabase.from("events_children").insert(links);
    if (linkError) throw linkError;
  }

  return saved;
}
```

- [ ] **Step 4: Run integration test to verify it passes**

Run: `npx vitest run tests/integration/multichild-event-save.test.js`
Expected: PASS — 2 tests passed

- [ ] **Step 5: Commit**

```bash
git add src/lib/sync.js tests/integration/multichild-event-save.test.js
git commit -m "feat(multichild): add saveEventWithChildren M:N writing"
```

## Task 7.3: App.jsx — Wire ChildSelector + saveEventWithChildren

**Files:**
- Modify: `src/App.jsx`

- [ ] **Step 1: Add ChildSelector + saveEventWithChildren imports**

```jsx
import { ChildSelector } from "./components/multichild/EventModal/ChildSelector.jsx";
import { saveEventWithChildren } from "./lib/sync.js";
```

- [ ] **Step 2: Add eventChildSelection state in parent component scope**

```jsx
const [eventChildSelection, setEventChildSelection] = useState({ childIds: [], familyAll: false });
```

- [ ] **Step 3: Inject ChildSelector into the existing event modal JSX**

Find the existing event creation modal (search for `setShowAddModal`). Inside the modal form, add:

```jsx
<ChildSelector
  children={pairedChildren}
  value={eventChildSelection}
  onChange={setEventChildSelection}
/>
```

- [ ] **Step 4: Replace existing event save call with saveEventWithChildren**

Find existing event save handler (`supabase.from("events").insert(...)` or `.upsert(...)`). Replace with:

```jsx
await saveEventWithChildren(eventDraft, eventChildSelection);
```

After save, reset selection:
```jsx
setEventChildSelection({ childIds: [], familyAll: false });
```

- [ ] **Step 5: Reset selection when modal opens (1자녀 mode auto-select)**

When `setShowAddModal(true)` is called, also:
```jsx
if (pairedChildren.length === 1) {
  setEventChildSelection({ childIds: [pairedChildren[0].user_id], familyAll: false });
} else {
  setEventChildSelection({ childIds: [], familyAll: false });
}
```

- [ ] **Step 6: Manual smoke test**

Run: `npm run dev`
- 2자녀 가족: 일정 등록 모달에 ChildSelector 표시, 혜니만 체크 → 저장 → DB 검증 (events_children 1행)
- '가족 전체' 클릭 → 저장 → DB 검증 (is_family_event=true, events_children 0행)
- 1자녀 가족: ChildSelector 자동 hide

- [ ] **Step 7: Commit**

```bash
git add src/App.jsx
git commit -m "feat(multichild): wire ChildSelector into event modal with auto 1-child select"
```

---

# Phase 8 — Subscription Per-Child Screen

> **Goal:** per-child 토글 UI + Qonversion N-SKU. **Phase 5, 6, 7과 병렬 실행 가능.**

## Task 8.1: childSubscriptions.js — per-child loader

**Files:**
- Create: `src/lib/childSubscriptions.js`
- Test: `tests/unit/childSubscriptions.test.js`

- [ ] **Step 1: Write the failing test**

```javascript
// tests/unit/childSubscriptions.test.js
import { describe, it, expect } from "vitest";
import { deriveChildEntitlements, totalMonthlyPrice, canChildUseFeature } from "../../src/lib/childSubscriptions.js";

describe("deriveChildEntitlements", () => {
  it("subscriptions 행이 없으면 모든 자녀 free", () => {
    const result = deriveChildEntitlements([
      { user_id: "c1" }, { user_id: "c2" }
    ], []);
    expect(result.c1.tier).toBe("free");
    expect(result.c2.tier).toBe("free");
  });

  it("active subscription 있는 자녀는 premium", () => {
    const result = deriveChildEntitlements(
      [{ user_id: "c1" }],
      [{ child_id: "c1", status: "active", price_krw: 1500, product_id: "hyeni_child_slot_1" }]
    );
    expect(result.c1.tier).toBe("premium");
    expect(result.c1.priceKrw).toBe(1500);
  });

  it("expired/canceled 자녀는 free", () => {
    const result = deriveChildEntitlements(
      [{ user_id: "c1" }, { user_id: "c2" }],
      [
        { child_id: "c1", status: "expired", price_krw: 1500 },
        { child_id: "c2", status: "canceled", price_krw: 1500 },
      ]
    );
    expect(result.c1.tier).toBe("free");
    expect(result.c2.tier).toBe("free");
  });

  it("grace period 자녀는 premium 유지", () => {
    const result = deriveChildEntitlements(
      [{ user_id: "c1" }],
      [{ child_id: "c1", status: "grace", price_krw: 1500 }]
    );
    expect(result.c1.tier).toBe("premium");
  });
});

describe("totalMonthlyPrice", () => {
  it("active 자녀 합계 = N × 1500", () => {
    expect(totalMonthlyPrice([
      { status: "active", price_krw: 1500 },
      { status: "active", price_krw: 1500 },
      { status: "expired", price_krw: 1500 },
    ])).toBe(3000);
  });

  it("active 0명이면 0", () => {
    expect(totalMonthlyPrice([])).toBe(0);
  });
});

describe("canChildUseFeature", () => {
  it("free 자녀: SOS / 위치 1회 / 음성 실시간 / 오늘 일정 OK", () => {
    const ent = { tier: "free" };
    expect(canChildUseFeature(ent, "sos_send")).toBe(true);
    expect(canChildUseFeature(ent, "location_one_shot")).toBe(true);
    expect(canChildUseFeature(ent, "voice_message_realtime")).toBe(true);
    expect(canChildUseFeature(ent, "today_events_view")).toBe(true);
  });

  it("free 자녀: 디바이스 안전 지표 / Force-Ring 차단", () => {
    const ent = { tier: "free" };
    expect(canChildUseFeature(ent, "device_safety_stats")).toBe(false);
    expect(canChildUseFeature(ent, "force_ring")).toBe(false);
  });

  it("premium 자녀: 모든 기능 OK", () => {
    const ent = { tier: "premium" };
    expect(canChildUseFeature(ent, "device_safety_stats")).toBe(true);
    expect(canChildUseFeature(ent, "force_ring")).toBe(true);
    expect(canChildUseFeature(ent, "sos_send")).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/childSubscriptions.test.js`
Expected: FAIL — module not found

- [ ] **Step 3: Write minimal implementation**

```javascript
// src/lib/childSubscriptions.js
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "./supabase.js";

const PREMIUM_STATUSES = new Set(["active", "grace"]);
const FREE_FEATURES = new Set([
  "sos_send", "sos_receive",
  "location_one_shot", "voice_message_realtime",
  "today_events_view",
]);

export function deriveChildEntitlements(children, subscriptions) {
  const subByChild = new Map((subscriptions || []).map((s) => [s.child_id, s]));
  const result = {};
  for (const child of children) {
    const sub = subByChild.get(child.user_id);
    const isPremium = sub && PREMIUM_STATUSES.has(sub.status);
    result[child.user_id] = {
      tier: isPremium ? "premium" : "free",
      status: sub?.status || "expired",
      priceKrw: sub?.price_krw || 1500,
      productId: sub?.product_id || null,
      expiresAt: sub?.expires_at ? new Date(sub.expires_at) : null,
    };
  }
  return result;
}

export function totalMonthlyPrice(subscriptions) {
  return (subscriptions || [])
    .filter((s) => PREMIUM_STATUSES.has(s.status))
    .reduce((sum, s) => sum + (s.price_krw || 0), 0);
}

export function canChildUseFeature(childEntitlement, feature) {
  if (!childEntitlement) return false;
  if (FREE_FEATURES.has(feature)) return true;
  return childEntitlement.tier === "premium";
}

export function useChildSubscriptions(familyId) {
  const [subs, setSubs] = useState([]);
  const [loading, setLoading] = useState(false);
  const channelRef = useRef(null);

  const refresh = useCallback(async () => {
    if (!familyId) return;
    setLoading(true);
    try {
      const { data } = await supabase
        .from("subscriptions")
        .select("*")
        .eq("family_id", familyId);
      setSubs(data || []);
    } finally {
      setLoading(false);
    }
  }, [familyId]);

  useEffect(() => { refresh(); }, [refresh]);

  useEffect(() => {
    if (!familyId) return undefined;
    const channel = supabase.channel(`subs-${familyId}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "subscriptions", filter: `family_id=eq.${familyId}` },
        () => refresh()
      )
      .subscribe();
    channelRef.current = channel;
    return () => { if (channelRef.current) supabase.removeChannel(channelRef.current); };
  }, [familyId, refresh]);

  return useMemo(() => ({ subs, loading, refresh }), [subs, loading, refresh]);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/childSubscriptions.test.js`
Expected: PASS — 9 tests passed

- [ ] **Step 5: Commit**

```bash
git add src/lib/childSubscriptions.js tests/unit/childSubscriptions.test.js
git commit -m "feat(multichild): add per-child subscription loader + canChildUseFeature gate"
```

## Task 8.2: PerChildToggle 컴포넌트

**Files:**
- Create: `src/components/multichild/SubscriptionScreen/PerChildToggle.jsx`
- Test: `tests/unit/PerChildToggle.test.jsx`

- [ ] **Step 1: Write the failing test**

```jsx
// tests/unit/PerChildToggle.test.jsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PerChildToggle } from "../../src/components/multichild/SubscriptionScreen/PerChildToggle.jsx";

const child = { user_id: "c1", name: "혜니", birthdate: "2015-03-21", color_hex: "#F779A8", photo_url: null };

describe("PerChildToggle", () => {
  it("이름, 출생연도, 가격 표시", () => {
    render(<PerChildToggle child={child} subscribed={false} onToggle={() => {}} />);
    expect(screen.getByText("혜니")).toBeInTheDocument();
    expect(screen.getByText(/2015년생/)).toBeInTheDocument();
  });

  it("subscribed=true → toggle ON, ₩1,500/월 표시", () => {
    render(<PerChildToggle child={child} subscribed={true} onToggle={() => {}} />);
    expect(screen.getByRole("switch")).toBeChecked();
    expect(screen.getByText("₩1,500/월")).toBeInTheDocument();
  });

  it("subscribed=false → '무료' 라벨", () => {
    render(<PerChildToggle child={child} subscribed={false} onToggle={() => {}} />);
    expect(screen.getByText("무료")).toBeInTheDocument();
  });

  it("toggle 클릭 시 onToggle(반대값)", () => {
    const onToggle = vi.fn();
    render(<PerChildToggle child={child} subscribed={false} onToggle={onToggle} />);
    fireEvent.click(screen.getByRole("switch"));
    expect(onToggle).toHaveBeenCalledWith(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/PerChildToggle.test.jsx`
Expected: FAIL — module not found

- [ ] **Step 3: Write minimal implementation**

```jsx
// src/components/multichild/SubscriptionScreen/PerChildToggle.jsx
function birthYear(birthdate) {
  if (!birthdate) return null;
  return new Date(birthdate).getFullYear();
}

export function PerChildToggle({ child, subscribed, onToggle, busy = false }) {
  const year = birthYear(child.birthdate);
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 14,
      padding: 16, borderRadius: 14,
      background: subscribed ? "white" : "#F9FAFB",
      border: subscribed ? "1.5px solid #FBCFE8" : "1.5px solid #E5E7EB",
      opacity: subscribed ? 1 : 0.85,
    }}>
      <div style={{
        width: 44, height: 44, borderRadius: "50%",
        background: child.photo_url ? `url(${child.photo_url}) center/cover` : child.color_hex,
        border: `2px solid ${child.color_hex}`,
        flexShrink: 0,
      }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: "#1F2937" }}>
          {child.name}
          {year && <span style={{ fontSize: 12, color: "#6B7280", marginLeft: 8, fontWeight: 600 }}>({year}년생)</span>}
        </div>
        <div style={{ fontSize: 12, color: subscribed ? "#BE185D" : "#6B7280", marginTop: 2, fontWeight: 700 }}>
          {subscribed ? "₩1,500/월" : "무료"}
        </div>
      </div>
      <button
        type="button" role="switch"
        aria-checked={subscribed}
        onClick={() => onToggle(!subscribed)}
        disabled={busy}
        style={{
          width: 48, height: 28, borderRadius: 14,
          background: subscribed ? "#F779A8" : "#D1D5DB",
          border: "none", position: "relative",
          cursor: busy ? "wait" : "pointer", flexShrink: 0,
        }}
      >
        <span style={{
          position: "absolute", top: 2,
          left: subscribed ? 22 : 2,
          width: 24, height: 24, borderRadius: "50%",
          background: "white", transition: "left 0.15s",
        }} />
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/PerChildToggle.test.jsx`
Expected: PASS — 4 tests passed

- [ ] **Step 5: Commit**

```bash
git add src/components/multichild/SubscriptionScreen/PerChildToggle.jsx tests/unit/PerChildToggle.test.jsx
git commit -m "feat(multichild): add PerChildToggle with name/year/price"
```

## Task 8.3: PriceSummary 컴포넌트

**Files:**
- Create: `src/components/multichild/SubscriptionScreen/PriceSummary.jsx`
- Test: `tests/unit/PriceSummary.test.jsx`

- [ ] **Step 1: Write the failing test**

```jsx
// tests/unit/PriceSummary.test.jsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PriceSummary } from "../../src/components/multichild/SubscriptionScreen/PriceSummary.jsx";

describe("PriceSummary", () => {
  it("0원이면 '구독 없음' 표시", () => {
    render(<PriceSummary totalKrw={0} subscribedCount={0} />);
    expect(screen.getByText(/구독 없음/)).toBeInTheDocument();
  });

  it("₩3,000 / 자녀 2명 표시", () => {
    render(<PriceSummary totalKrw={3000} subscribedCount={2} />);
    expect(screen.getByText("₩3,000/월")).toBeInTheDocument();
    expect(screen.getByText(/자녀 2명/)).toBeInTheDocument();
  });

  it("천 단위 콤마", () => {
    render(<PriceSummary totalKrw={7500} subscribedCount={5} />);
    expect(screen.getByText("₩7,500/월")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/PriceSummary.test.jsx`
Expected: FAIL — module not found

- [ ] **Step 3: Write minimal implementation**

```jsx
// src/components/multichild/SubscriptionScreen/PriceSummary.jsx
function formatKrw(n) {
  return "₩" + n.toLocaleString("ko-KR") + "/월";
}

export function PriceSummary({ totalKrw, subscribedCount }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: 18, borderRadius: 14,
      background: "linear-gradient(135deg, #FFF1F7, #F8FAFC)",
      border: "1.5px solid #FBCFE8",
    }}>
      <div>
        <div style={{ fontSize: 12, color: "#6B7280", fontWeight: 700 }}>합계</div>
        {subscribedCount > 0 ? (
          <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 4 }}>자녀 {subscribedCount}명 구독 중</div>
        ) : null}
      </div>
      <div style={{ fontSize: 20, fontWeight: 900, color: "#BE185D" }}>
        {totalKrw === 0 ? "구독 없음" : formatKrw(totalKrw)}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/PriceSummary.test.jsx`
Expected: PASS — 3 tests passed

- [ ] **Step 5: Commit**

```bash
git add src/components/multichild/SubscriptionScreen/PriceSummary.jsx tests/unit/PriceSummary.test.jsx
git commit -m "feat(multichild): add PriceSummary with KRW formatting"
```

## Task 8.4: Qonversion N-SKU support

**Files:**
- Modify: `src/lib/qonversion.js` (append)
- Test: `tests/unit/qonversion-nsku.test.js`

- [ ] **Step 1: Write the failing test**

```javascript
// tests/unit/qonversion-nsku.test.js
import { describe, it, expect } from "vitest";
import { childSlotProductId, childSlotEntitlementId } from "../../src/lib/qonversion.js";

describe("Qonversion N-SKU helpers", () => {
  it("slot 1~5 → product id mapping", () => {
    expect(childSlotProductId(1)).toBe("hyeni_child_slot_1");
    expect(childSlotProductId(2)).toBe("hyeni_child_slot_2");
    expect(childSlotProductId(5)).toBe("hyeni_child_slot_5");
  });

  it("slot 1~5 → entitlement id mapping", () => {
    expect(childSlotEntitlementId(1)).toBe("child_active_1");
    expect(childSlotEntitlementId(3)).toBe("child_active_3");
  });

  it("slot 0 또는 6+ → 에러 throw", () => {
    expect(() => childSlotProductId(0)).toThrow();
    expect(() => childSlotProductId(6)).toThrow();
    expect(() => childSlotEntitlementId(0)).toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/qonversion-nsku.test.js`
Expected: FAIL — exports not present

- [ ] **Step 3: Append N-SKU helpers to src/lib/qonversion.js**

```javascript
// src/lib/qonversion.js — append at end of file

const MAX_CHILD_SLOTS = 5;

export function childSlotProductId(slot) {
  if (!Number.isInteger(slot) || slot < 1 || slot > MAX_CHILD_SLOTS) {
    throw new Error(`Invalid child slot: ${slot}. Must be 1-${MAX_CHILD_SLOTS}.`);
  }
  return `hyeni_child_slot_${slot}`;
}

export function childSlotEntitlementId(slot) {
  if (!Number.isInteger(slot) || slot < 1 || slot > MAX_CHILD_SLOTS) {
    throw new Error(`Invalid child slot: ${slot}. Must be 1-${MAX_CHILD_SLOTS}.`);
  }
  return `child_active_${slot}`;
}

export async function purchaseChildSlot(slot) {
  const instance = getQonversionInstance();
  if (!instance) {
    throw new Error("Qonversion not initialized (web platform or missing project key)");
  }
  const productId = childSlotProductId(slot);
  return await instance.purchase(productId);
}

export async function checkChildSlotEntitlement(slot) {
  const instance = getQonversionInstance();
  if (!instance) return null;
  const entitlements = await instance.checkEntitlements();
  return entitlements?.[childSlotEntitlementId(slot)] || null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/qonversion-nsku.test.js`
Expected: PASS — 3 tests passed

- [ ] **Step 5: Commit**

```bash
git add src/lib/qonversion.js tests/unit/qonversion-nsku.test.js
git commit -m "feat(multichild): qonversion N-SKU support (5 child slots)"
```

## Task 8.5: SubscriptionManagement.jsx — per-child 화면 재작성

**Files:**
- Modify: `src/components/settings/SubscriptionManagement.jsx`
- Test: `tests/unit/SubscriptionManagement.test.jsx`

- [ ] **Step 1: Write integration test**

```jsx
// tests/unit/SubscriptionManagement.test.jsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { SubscriptionManagement } from "../../src/components/settings/SubscriptionManagement.jsx";

vi.mock("../../src/lib/childSubscriptions.js", () => ({
  useChildSubscriptions: () => ({
    subs: [{ child_id: "c1", status: "active", price_krw: 1500, product_id: "hyeni_child_slot_1" }],
    refresh: vi.fn(),
  }),
  deriveChildEntitlements: () => ({
    c1: { tier: "premium", priceKrw: 1500 },
    c2: { tier: "free", priceKrw: 0 },
  }),
  totalMonthlyPrice: () => 1500,
}));

vi.mock("../../src/lib/qonversion.js", () => ({
  purchaseChildSlot: vi.fn(),
}));

const children = [
  { user_id: "c1", name: "혜니", birthdate: "2015-03-21", color_hex: "#F779A8", child_order: 1 },
  { user_id: "c2", name: "민준", birthdate: "2018-07-04", color_hex: "#3B82F6", child_order: 2 },
];

describe("SubscriptionManagement (parent)", () => {
  it("자녀 N명 toggle 표시 + 합계", () => {
    render(<SubscriptionManagement role="parent" familyId="f1" childList={children} />);
    expect(screen.getByText("혜니")).toBeInTheDocument();
    expect(screen.getByText("민준")).toBeInTheDocument();
    expect(screen.getByText("₩1,500/월")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/SubscriptionManagement.test.jsx`
Expected: FAIL — component not yet rewritten

- [ ] **Step 3: Replace SubscriptionManagement.jsx contents**

```jsx
// src/components/settings/SubscriptionManagement.jsx
import { useState } from "react";
import { useChildSubscriptions, deriveChildEntitlements, totalMonthlyPrice } from "../../lib/childSubscriptions.js";
import { purchaseChildSlot } from "../../lib/qonversion.js";
import { CHILD_DEVICE_NOTE } from "../../lib/paywallCopy.js";
import { PerChildToggle } from "../multichild/SubscriptionScreen/PerChildToggle.jsx";
import { PriceSummary } from "../multichild/SubscriptionScreen/PriceSummary.jsx";

export function SubscriptionManagement({ role, familyId, childList = [] }) {
  if (role === "child") {
    return (
      <section style={{ background: "#FFF9FC", borderRadius: 18, padding: "18px 16px", border: "1.5px solid #FFE4EF" }}>
        <div style={{ fontSize: 16, fontWeight: 900, color: "#1F2937" }}>구독 상태</div>
        <div style={{ marginTop: 8, fontSize: 13, color: "#64748B", lineHeight: 1.6 }}>{CHILD_DEVICE_NOTE}</div>
      </section>
    );
  }

  const { subs, refresh } = useChildSubscriptions(familyId);
  const ents = deriveChildEntitlements(childList, subs);
  const total = totalMonthlyPrice(subs);
  const subscribedCount = Object.values(ents).filter((e) => e.tier === "premium").length;
  const [busyChildId, setBusyChildId] = useState(null);

  async function handleToggle(child, nextSubscribed) {
    setBusyChildId(child.user_id);
    try {
      if (nextSubscribed) {
        await purchaseChildSlot(child.child_order);
      } else {
        window.open("https://play.google.com/store/account/subscriptions", "_blank");
      }
      await refresh();
    } catch (err) {
      console.error("[SubscriptionManagement] toggle failed:", err);
    } finally {
      setBusyChildId(null);
    }
  }

  return (
    <section style={{ background: "white", borderRadius: 22, padding: "20px 18px", boxShadow: "0 14px 34px rgba(180,120,150,0.12)", border: "1.5px solid #FFE4EF" }}>
      <div style={{ fontSize: 18, fontWeight: 900, color: "#1F2937", marginBottom: 4 }}>혜니 프리미엄</div>
      <div style={{ fontSize: 12, color: "#6B7280", marginBottom: 18 }}>
        자녀별로 구독 ON/OFF 가능 · 자녀 1인당 ₩1,500/월
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 18 }}>
        {childList.map((c) => (
          <PerChildToggle
            key={c.user_id} child={c}
            subscribed={ents[c.user_id]?.tier === "premium"}
            busy={busyChildId === c.user_id}
            onToggle={(next) => handleToggle(c, next)}
          />
        ))}
      </div>

      <PriceSummary totalKrw={total} subscribedCount={subscribedCount} />
    </section>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/SubscriptionManagement.test.jsx`
Expected: PASS — 1 test passed

- [ ] **Step 5: Update App.jsx caller (settings tab)**

Find existing `<SubscriptionManagement entitlement={...} role={...} />`. Replace with:
```jsx
<SubscriptionManagement
  role={isParent ? "parent" : "child"}
  familyId={familyId}
  childList={pairedChildren}
/>
```

- [ ] **Step 6: Run full test suite**

Run: `npm run test`
Expected: 0 failures

- [ ] **Step 7: Commit**

```bash
git add src/components/settings/SubscriptionManagement.jsx tests/unit/SubscriptionManagement.test.jsx src/App.jsx
git commit -m "feat(multichild): rewrite SubscriptionManagement with per-child toggles"
```

---

# Phase 9 — Child Device UI Cleanup + E2E Integration

> **Goal:** App.jsx 다중 자녀 reducer 정리, 자녀 단말 UI privacy, E2E 12 시나리오 통과. **모든 phase 5-8 완료 후.**

## Task 9.1: App.jsx — `_pairedDevice` 다중 분기

**Files:**
- Modify: `src/App.jsx` (L6620-6700)

- [ ] **Step 1: Locate all `_pairedDevice` references**

Run: `grep -n "_pairedDevice" src/App.jsx`. Note each line and context.

- [ ] **Step 2: Replace single-device computation with role-aware branch**

Find (around L6627-6628):
```jsx
const _pairedDevice = pairedChildren[0] || null; // 하위호환 (단일 자녀)
```

Replace with:
```jsx
const _pairedDevice = isParent
  ? null
  : (pairedChildren.find((c) => c.user_id === session?.user?.id) || pairedChildren[0] || null);
```

Rationale: parent should now use `pairedChildren` array directly. Child only sees their own slot (privacy 원칙 5).

- [ ] **Step 3: Audit each downstream `_pairedDevice` usage**

For each grep hit:
- If used inside parent-only context: replace with explicit `pairedChildren.map(...)` or per-child UI
- If used inside child-only context: keep as-is (it's now their self device)
- If ambiguous: branch on `isParent`

Example:
```jsx
// Before
const status = childDeviceStatusMap[_pairedDevice?.user_id];

// After (parent context)
const statuses = pairedChildren.map(c => ({
  child: c, status: childDeviceStatusMap[c.user_id]
}));
```

- [ ] **Step 4: Manual smoke test**

Run: `npm run dev`
- 부모 (2자녀): 지도 자녀 2명 핀, 디바이스 안전 지표 자녀 2명 모두 표시
- 자녀 단말 (혜니): 자기 정보만

- [ ] **Step 5: Commit**

```bash
git add src/App.jsx
git commit -m "fix(multichild): split _pairedDevice into parent (multi) vs child (self) branches"
```

## Task 9.2: Map tab — render `allChildPositions`

**Files:**
- Modify: `src/App.jsx` (지도 탭 렌더링 부분)

- [ ] **Step 1: Find existing single-pin rendering**

Run: `grep -n "childPos" src/App.jsx`. The state `childPos` (L6679) stores single child position. Find where map markers are placed.

- [ ] **Step 2: Replace single-pin with multi-pin (parent) / self-pin (child)**

Inside the map renderer, replace single-pin code with:

```jsx
{isParent ? (
  allChildPositions.map((pos) => {
    const child = pairedChildren.find((c) => c.user_id === pos.user_id);
    if (!child) return null;
    return (
      <Marker
        key={pos.user_id}
        position={{ lat: pos.lat, lng: pos.lng }}
        color={child.color_hex}
        label={child.name}
      />
    );
  })
) : (
  childPos && (
    <Marker
      position={childPos}
      color={pairedChildren[0]?.color_hex || "#F779A8"}
    />
  )
)}
```

> NOTE: `<Marker>` is illustrative. The actual code uses Kakao Maps SDK directly (`new kakao.maps.Marker(...)`). Mirror existing marker creation patterns and add color via custom SVG marker images keyed by `color_hex`.

- [ ] **Step 3: Smoke test**

Run: `npm run dev` — 2자녀 가족 부모 단말, 지도 탭. 자녀 2명 핀이 각자 색으로 보이면 OK.

- [ ] **Step 4: Commit**

```bash
git add src/App.jsx
git commit -m "feat(multichild): render allChildPositions pins on map tab"
```

## Task 9.3: Child device safety — multi-child status

**Files:**
- Modify: `src/App.jsx` (안전 지표 UI 영역)

- [ ] **Step 1: Find existing single-status UI**

Run: `grep -n "childDeviceStatusMap" src/App.jsx`. Find the JSX that consumes a single child's status.

- [ ] **Step 2: Add ChildDeviceCard helper near other inline helpers**

```jsx
function ChildDeviceCard({ child, status }) {
  return (
    <div style={{
      padding: 14, borderRadius: 14, background: "white",
      border: `1.5px solid ${child.color_hex}30`,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: child.color_hex }} />
        <div style={{ fontSize: 14, fontWeight: 800 }}>{child.name}</div>
      </div>
      <div style={{ fontSize: 12, color: "#6B7280", marginTop: 8 }}>
        배터리: {status?.battery_percent ?? "—"}% · 마지막 접속: {status?.last_seen_minutes_ago ?? "—"}분 전
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Replace existing single-status UI with role+count branch**

```jsx
{isParent && pairedChildren.length > 1 ? (
  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
    {pairedChildren.map((c) => (
      <ChildDeviceCard
        key={c.user_id} child={c}
        status={childDeviceStatusMap[c.user_id]}
      />
    ))}
  </div>
) : (
  _pairedDevice && (
    <ChildDeviceCard
      child={_pairedDevice}
      status={childDeviceStatusMap[_pairedDevice.user_id]}
    />
  )
)}
```

- [ ] **Step 4: Smoke test**

Run: `npm run dev` — 2자녀 부모, 안전 지표 영역에 자녀 2명 카드 보이면 OK.

- [ ] **Step 5: Commit**

```bash
git add src/App.jsx
git commit -m "feat(multichild): render per-child cards in device safety section"
```

## Task 9.4: 자녀 단말 UI privacy

**Files:**
- Modify: `src/App.jsx`

- [ ] **Step 1: Audit data fetches for sibling leakage**

Run:
```bash
grep -n "events\.filter\|locations\.filter\|allChildPositions" src/App.jsx
```

Identify each: parent-only, child-only, or both.

- [ ] **Step 2: Add visibleEvents helper for child-side filtering**

In App.jsx parent component scope:

```jsx
const visibleEvents = useMemo(() => {
  if (isParent) return events;
  const myId = session?.user?.id;
  return events.filter((e) => e.is_family_event || (e.child_ids || []).includes(myId));
}, [events, isParent, session]);
```

Replace `events` with `visibleEvents` in child-side render code (calendar tab when `!isParent`).

- [ ] **Step 3: Add ownPosition helper for child-side location**

```jsx
const ownPosition = useMemo(() => {
  if (isParent) return null;
  const myId = session?.user?.id;
  return allChildPositions.find((p) => p.user_id === myId) || null;
}, [allChildPositions, isParent, session]);
```

Use `ownPosition` for child-side map. Never iterate `allChildPositions` in child branch.

- [ ] **Step 4: Manual privacy verification**

Run: `npm run dev` and login as 자녀 1 (혜니). Open browser devtools → Elements. Search DOM for "민준" (자녀 2 이름). Expected: 0 매치.

- [ ] **Step 5: Commit**

```bash
git add src/App.jsx
git commit -m "fix(multichild): child device shows only self data (privacy principle 5)"
```

## Task 9.5: E2E 시나리오 1-12 작성 및 실행

**Files:**
- Create: 12개 `tests/e2e/multichild-*.spec.js`
- Create (if missing): `tests/e2e/_helpers.js` (helper functions)

> Use existing `playwright.real.config.js`. Each spec is one scenario, atomic commit per scenario.

- [ ] **Step 1: Write E2E #1 — 신규 1자녀 페어링**

```javascript
// tests/e2e/multichild-pairing-1child.spec.js
import { test, expect } from "@playwright/test";
import { signupParent } from "./_helpers.js";

test("신규 가족 페어링 (자녀 1명) → 1자녀 모드 큰틀 유지", async ({ page }) => {
  await signupParent(page);

  await page.fill("input[name='familyName'], input[placeholder*='혜니네']", "혜니네");
  await page.click("button:has-text('다음')");
  await page.click("button:has-text('1명')");
  await page.click("button:has-text('다음')");
  await page.fill("input[type='text']", "혜니");
  await page.fill("input[type='date']", "2015-03-21");
  await page.click("button:has-text('다음')");

  await expect(page.locator("text=KID-")).toBeVisible({ timeout: 5000 });
  await page.click("button:has-text('모든 자녀 페어링 완료')");
  await page.click("button:has-text('시작하기')");

  await expect(page.locator("button:has-text('홈')")).not.toBeVisible();
  await expect(page.locator("text=혜니")).toBeVisible();
});
```

- [ ] **Step 2: Run E2E #1**

Run: `npx playwright test --config=playwright.real.config.js tests/e2e/multichild-pairing-1child.spec.js`
Expected: PASS

Commit: `git add tests/e2e/multichild-pairing-1child.spec.js && git commit -m "test(multichild): E2E #1 1-child pairing keeps current UI"`

- [ ] **Step 3: Write E2E #2 — 신규 3자녀 페어링**

```javascript
// tests/e2e/multichild-pairing-3child.spec.js
import { test, expect } from "@playwright/test";
import { signupParent } from "./_helpers.js";

test("신규 가족 페어링 (자녀 3명) → 홈 탭 자동 표시, 색 자동 할당", async ({ page }) => {
  await signupParent(page);

  await page.fill("input[name='familyName'], input[placeholder*='혜니네']", "혜니네");
  await page.click("button:has-text('다음')");
  await page.click("button:has-text('3명')");
  await page.click("button:has-text('다음')");

  for (const [name, birthdate] of [["혜니","2015-03-21"], ["민준","2018-07-04"], ["세진","2020-11-09"]]) {
    await page.fill("input[type='text']", name);
    await page.fill("input[type='date']", birthdate);
    await page.click("button:has-text(/다음/)");
  }

  await expect(page.locator("text=KID-")).toBeVisible({ timeout: 5000 });
  await page.click("button:has-text('모든 자녀 페어링 완료')");
  await page.click("button:has-text('시작하기')");

  await expect(page.locator("button:has-text('홈')")).toBeVisible();
  await expect(page.locator("text=혜니")).toBeVisible();
  await expect(page.locator("text=민준")).toBeVisible();
  await expect(page.locator("text=세진")).toBeVisible();
});
```

Run: `npx playwright test --config=playwright.real.config.js tests/e2e/multichild-pairing-3child.spec.js`
Expected: PASS

Commit: `git commit -m "test(multichild): E2E #2 3-child pairing shows home tab"`

- [ ] **Step 4: Write E2E #3 — 기존 1자녀 가족 마이그레이션**

```javascript
// tests/e2e/multichild-migration-1to1.spec.js
import { test, expect } from "@playwright/test";
import { seedLegacyFamilyWithSubscription, loginAsExistingParent } from "./_helpers.js";

test("기존 1자녀 가족 → grandfather 자동 발급 → 첫째 active", async ({ page }) => {
  const { parent_email, child_id } = await seedLegacyFamilyWithSubscription();
  await loginAsExistingParent(page, parent_email);

  await page.click("button:has-text('설정')");
  await expect(page.locator("text=프리미엄")).toBeVisible();
  await expect(page.locator(`[data-child-id='${child_id}'] [role='switch']`)).toBeChecked();
});
```

Run + commit pattern same as above.

- [ ] **Step 5: Write E2E #4 — 기존 2자녀 가족 마이그레이션**

```javascript
// tests/e2e/multichild-migration-2child.spec.js
import { test, expect } from "@playwright/test";
import { seedLegacy2ChildFamilyWithSubscription, loginAsExistingParent } from "./_helpers.js";

test("기존 2자녀 가족 → 첫째 grandfather active, 둘째 free", async ({ page }) => {
  const { parent_email, child1_id, child2_id } = await seedLegacy2ChildFamilyWithSubscription();
  await loginAsExistingParent(page, parent_email);

  await page.click("button:has-text('설정')");
  await expect(page.locator(`[data-child-id='${child1_id}'] [role='switch']`)).toBeChecked();
  await expect(page.locator(`[data-child-id='${child2_id}'] [role='switch']`)).not.toBeChecked();
  await expect(page.locator("text=₩1,500/월")).toBeVisible();
});
```

> NOTE: PerChildToggle 에 `data-child-id` 속성 추가 필요 — Task 8.2 의 wrapper div에 `data-child-id={child.user_id}` 추가.

- [ ] **Step 6: Update PerChildToggle to expose data-child-id**

In `src/components/multichild/SubscriptionScreen/PerChildToggle.jsx`, add to root div:
```jsx
<div data-child-id={child.user_id} ...>
```

Re-run unit test for PerChildToggle (`npx vitest run tests/unit/PerChildToggle.test.jsx`) to confirm no regression.

- [ ] **Step 7: Write E2E #5-#12 (8 more spec files)**

Each follows the same pattern as #1-#4. The list:

| # | spec file | 시나리오 |
|---|-----------|---------|
| 5 | multichild-event-single.spec.js | 일정 등록 자녀 1명 체크 → DB events_children 1행 (Supabase MCP execute_sql 로 verify) |
| 6 | multichild-event-family.spec.js | '가족 전체' 클릭 → events.is_family_event=true, events_children 0행 |
| 7 | multichild-subscription-partial.spec.js | 첫째만 구독 → child_device_stats 첫째 SELECT 1행, 둘째 0행 |
| 8 | multichild-subscription-all.spec.js | 두 자녀 모두 구독 → 합계 ₩3,000 표시, 양쪽 모두 device stats 보임 |
| 9 | multichild-child-device-isolation.spec.js | 자녀1 단말 로그인 후 DOM 에 자녀2 이름 텍스트 검색 0건 |
| 10 | multichild-sos-free.spec.js | 무료 자녀 단말 SOS 발신 → 부모 수신 정상 (sos_events 행 1개 increment) |
| 11 | multichild-color-realtime.spec.js | 자녀 색 변경 → 일정/지도 즉시 반영 (Realtime postgres_changes) |
| 12 | multichild-add-remove.spec.js | 자녀 추가/삭제 후 합계 자동 갱신 (₩1,500 → ₩3,000 → ₩1,500) |

For each scenario:
- Use helpers in `tests/e2e/_helpers.js` (extend as needed: `seedLegacyFamily`, `seedFamilyWith2Children`, `loginAsExistingParent`, `loginAsChild`, `getDbRowCount`)
- Run individually via `npx playwright test --config=playwright.real.config.js tests/e2e/multichild-<name>.spec.js`
- Commit each as separate atomic commit: `test(multichild): E2E #N <name>`

- [ ] **Step 8: Run all 12 E2E specs together**

Run: `npx playwright test --config=playwright.real.config.js tests/e2e/multichild-*.spec.js`
Expected: 12/12 PASS

If any fails, debug iteratively (do NOT skip). Fix → re-run that single spec → commit fix.

## Task 9.6: 마지막 verification — 전체 테스트 통과

- [ ] **Step 1: Run full unit test suite**

Run: `npm run test`
Expected: 0 failures, all multichild tests passed

- [ ] **Step 2: Run full E2E real-services suite**

Run: `npx playwright test --config=playwright.real.config.js`
Expected: 0 failures across all spec files

- [ ] **Step 3: Manual checklist verification**

Run: `npm run dev`. Walk through:
- [ ] 신규 1자녀 페어링 → 홈 탭 hidden
- [ ] 신규 3자녀 페어링 → 홈 탭 visible, 자녀 3명 카드
- [ ] 일정 등록 모달 자녀 다중 체크
- [ ] '가족 전체' XOR (자녀 클릭 → 가족 전체 해제, 가족 전체 클릭 → 자녀 모두 해제)
- [ ] 구독 화면 per-child 토글 + ₩1,500 × N 합계
- [ ] 지도 탭 자녀 N명 핀 (각자 색)
- [ ] 자녀 단말 로그인 → 형제 정보 0건 노출
- [ ] grandfather: 기존 1자녀 active 가족 → 첫째 자녀에게 active 자동 발급

- [ ] **Step 4: Run `npm run verify` (Vitest + Playwright default)**

Run: `npm run verify`
Expected: 0 failures across both suites

- [ ] **Step 5: Final commit**

```bash
git status
git add .
git commit -m "feat(multichild): all 9 phases complete, 12/12 E2E passing"
```

---

## Self-Review (Plan Author Checklist)

### 1. Spec Coverage

| Spec section | Plan task |
|--------------|-----------|
| §2 원칙 1 (1자녀 큰틀) | Task 5.5 (PairingWizard), Task 6.5 (홈 탭 hide), Task 7.1 (ChildSelector hide) |
| §2 원칙 2 (paired_children.length) | Task 0.2 (useChildren), Task 6.5, Task 9.1 |
| §2 원칙 3 (자녀 수+생년월일) | Phase 5 전체 |
| §2 원칙 4 (일정 다중) | Phase 7 |
| §2 원칙 5 (자녀 단말 자기만) | Task 9.4 |
| §2 원칙 6 (per-child 구독) | Phase 8 |
| §2 원칙 7 (안전 무료/서버 유료) | Task 8.1 (FREE_FEATURES set) |
| §2 원칙 8 (6색 팔레트) | Task 0.1 (ChildPalette), Task 5.1 (ColorPicker) |
| §2 원칙 9 (병렬 실행) | Phase 의존성 그래프 |
| §5.1 신규 테이블 | Phase 1-3 마이그레이션 |
| §6 M1-M5 | Task 1.1, 1.2, 2.1, 3.1, 4.1 |
| §7 RLS | Task 4.1 |
| §8 Qonversion N-SKU | Task 8.4 |
| §9 Freemium 매핑 | Task 8.1 (FREE_FEATURES + canChildUseFeature) |
| §10 Realtime publication | Task 2.1, 3.1 (DO $publication$ 블록) |
| §11 Component tree | File Structure 섹션 |
| §13 마이그레이션 시나리오 | Task 2.1 grandfather + E2E #3, #4 |
| §14 12 E2E 시나리오 | Task 9.5 |

**커버리지 결과**: 모든 spec 요구사항이 1개 이상의 task 로 매핑됨. ✅

### 2. Placeholder Scan

- ❌ "TBD" / "TODO" — 0건
- ❌ "implement later" — 0건
- ❌ "Add appropriate error handling" — catch 블록은 명시적 메시지 또는 console.error
- ⚠️ Task 9.5 Step 7 (E2E #5-#12 list): pattern 만 명시, 각 spec 의 정확한 selector 는 #1-#4 패턴 + helpers.js 함수명만 제공. **이는 의도적 압축 (place holder 와 다름)** — 실행 task agent 가 #1-#4 와 helper 시그니처로 작성 가능.

### 3. Type Consistency

| 함수/타입 | 정의 위치 | 사용 위치 일관성 |
|-----------|-----------|----------------|
| `CHILD_PALETTE` | Task 0.1 | Task 5.1, Task 0.2 — ✅ |
| `autoAssignColor(usedColors)` | Task 0.1 | Task 0.2, Task 5.5 — ✅ |
| `deriveChildren(familyInfo)` → `{count, isMultiChild, list}` | Task 0.2 | Task 6.5 — ✅ |
| `useChildren(familyInfo)` | Task 0.2 | Task 6.5 — ✅ |
| `setupFamily(userId, parentName, options)` | Task 5.5 | Task 5.5 PairingWizard — ✅ |
| `saveEventWithChildren(event, {childIds, familyAll})` | Task 7.2 | Task 7.3 — ✅ |
| `deriveChildEntitlements(children, subs)` → `{[childId]: {tier, ...}}` | Task 8.1 | Task 8.5 — ✅ |
| `totalMonthlyPrice(subs)` | Task 8.1 | Task 8.5 — ✅ |
| `useChildSubscriptions(familyId)` → `{subs, refresh}` | Task 8.1 | Task 8.5 — ✅ |
| `childSlotProductId(slot)` / `childSlotEntitlementId(slot)` | Task 8.4 | Task 8.5 (`purchaseChildSlot`) — ✅ |
| `subscriptions.UNIQUE(child_id)` | Task 2.1 | Task 4.1 RLS, Task 8.1 query — ✅ |
| `events_children PK (event_id, child_id)` | Task 3.1 | Task 7.2 delete + insert — ✅ |
| `family_members.child_order` | Task 1.2 | Task 0.2 sort, Task 5.5 wizard, Task 8.5 purchase slot — ✅ |
| `family_members.color_hex` regex `^#[0-9A-Fa-f]{6}$` | Task 1.2 | Task 0.1 CHILD_PALETTE 형식 일치 — ✅ |
| `data-child-id` attribute | Task 9.5 Step 6 | Task 8.2 PerChildToggle 추가 — ✅ |
| `childList` prop name (SubscriptionManagement) | Task 8.5 | Task 8.5 caller — ✅ (consistent rename to avoid React `children` shadow) |

**결과**: 모든 타입/시그니처 일관. ✅

### 4. Spec Coverage Gaps

확인 항목:
- §11 App.jsx 변경 라인 약 50라인 — Task 9.1, 9.2, 9.3, 9.4 합쳐서 검증
- §15 Risks "events_children 백필 누락" — Task 3.1 backfill_count NOTICE 검증
- §15 Risks "Realtime publication 누락" — Task 2.1 Step 4, Task 3.1 Step 4 의 `pg_publication_tables` 체크
- §15 Risks "자녀 단말 형제 정보 누출" — Task 9.4 + E2E #9
- §16 Open Questions — out-of-scope, 별도 spec 처리 명시 (자녀 사진 저장소만 본 plan에서 Supabase Storage `child-photos` 버킷으로 구체화 — Task 5.2 Pre-task)

모든 spec 항목이 plan 에 매핑되어 있고, gap 없음. ✅

---

# Execution Handoff

**Plan complete and saved to** `docs/superpowers/plans/2026-04-28-multi-child-support.md`.

Two execution options:

**1. Subagent-Driven (recommended)** — fresh subagent per task, review between tasks, fast iteration. Phase 의존성 준수: Phase 0 → 1 → (2 ‖ 3) → 4 → (5 ‖ 6 ‖ 7 ‖ 8) → 9. 병렬 phase 는 동시 dispatch.

**2. Inline Execution** — execute tasks in this session using `superpowers:executing-plans`, batch execution with checkpoints.

**Which approach?**

> User 가 spec §2 원칙 9 에서 "한 번에 구현하되 에이전트를 병렬로 실행" 명시 → **Subagent-Driven 추천**.
