-- supabase/migrations/20260512000000_ai_chat_feature.sql
-- 아이모드 AI 캐릭터 채팅 기능
-- - ai_chat_settings: 가족별 활성화 / 일일 제한 / (미래) 크레딧 잔액
-- - ai_chat_usage   : 자녀(user_id) × 날짜(date) 단위 사용량 카운터
-- - ai_chat_messages: 메시지 로그(부모 가시성 + 컨텍스트 윈도우용)
-- Pair: supabase/migrations/down/20260512000000_ai_chat_feature.sql

BEGIN;

-- ───────────────────────────────────────────────────────────────────────────
-- 1) ai_chat_settings — 가족 단위 설정 (부모만 변경 가능)
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ai_chat_settings (
  family_id      uuid PRIMARY KEY REFERENCES public.families(id) ON DELETE CASCADE,
  enabled        boolean NOT NULL DEFAULT false,
  daily_limit    integer NOT NULL DEFAULT 10 CHECK (daily_limit BETWEEN 0 AND 100),
  credit_balance integer NOT NULL DEFAULT 0  CHECK (credit_balance >= 0),
  updated_by     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_chat_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ai_chat_settings_select_family ON public.ai_chat_settings;
CREATE POLICY ai_chat_settings_select_family
  ON public.ai_chat_settings FOR SELECT
  USING (family_id IN (
    SELECT family_id FROM public.family_members WHERE user_id = auth.uid()
  ));

DROP POLICY IF EXISTS ai_chat_settings_insert_parent ON public.ai_chat_settings;
CREATE POLICY ai_chat_settings_insert_parent
  ON public.ai_chat_settings FOR INSERT
  WITH CHECK (family_id IN (
    SELECT family_id FROM public.family_members
    WHERE user_id = auth.uid() AND role = 'parent'
  ));

DROP POLICY IF EXISTS ai_chat_settings_update_parent ON public.ai_chat_settings;
CREATE POLICY ai_chat_settings_update_parent
  ON public.ai_chat_settings FOR UPDATE
  USING (family_id IN (
    SELECT family_id FROM public.family_members
    WHERE user_id = auth.uid() AND role = 'parent'
  ));

-- ───────────────────────────────────────────────────────────────────────────
-- 2) ai_chat_usage — 자녀별 일자별 사용량
--    (자정 KST 리셋은 클라이언트가 사용하는 date 컬럼으로 자연 분리)
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ai_chat_usage (
  family_id     uuid NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  child_user_id uuid NOT NULL REFERENCES auth.users(id)      ON DELETE CASCADE,
  usage_date    date NOT NULL,
  count         integer NOT NULL DEFAULT 0 CHECK (count >= 0),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (family_id, child_user_id, usage_date)
);

CREATE INDEX IF NOT EXISTS ai_chat_usage_family_date_idx
  ON public.ai_chat_usage (family_id, usage_date DESC);

ALTER TABLE public.ai_chat_usage ENABLE ROW LEVEL SECURITY;

-- 같은 가족 구성원은 사용량을 볼 수 있음(부모가 자녀별 확인 가능)
DROP POLICY IF EXISTS ai_chat_usage_select_family ON public.ai_chat_usage;
CREATE POLICY ai_chat_usage_select_family
  ON public.ai_chat_usage FOR SELECT
  USING (family_id IN (
    SELECT family_id FROM public.family_members WHERE user_id = auth.uid()
  ));

-- 쓰기는 서버(Edge Function: service_role) 전담 — 클라이언트 직접 INSERT/UPDATE 금지

-- ───────────────────────────────────────────────────────────────────────────
-- 3) ai_chat_messages — 대화 로그
--    role: 'user'(아이) | 'assistant'(AI 캐릭터) | 'system'(가드 메시지)
--    flagged: 자해·학대 키워드 감지 시 true → 부모 모니터링 대상
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ai_chat_messages (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id       uuid NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  child_user_id   uuid NOT NULL REFERENCES auth.users(id)      ON DELETE CASCADE,
  role            text NOT NULL CHECK (role IN ('user','assistant','system')),
  content         text NOT NULL,
  animal_character text,
  flagged         boolean NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_chat_messages_child_idx
  ON public.ai_chat_messages (family_id, child_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS ai_chat_messages_flagged_idx
  ON public.ai_chat_messages (family_id, created_at DESC)
  WHERE flagged = true;

ALTER TABLE public.ai_chat_messages ENABLE ROW LEVEL SECURITY;

-- 가족 구성원만 조회 가능(아이 본인 + 부모 모두 같은 family_id 행 열람)
DROP POLICY IF EXISTS ai_chat_messages_select_family ON public.ai_chat_messages;
CREATE POLICY ai_chat_messages_select_family
  ON public.ai_chat_messages FOR SELECT
  USING (family_id IN (
    SELECT family_id FROM public.family_members WHERE user_id = auth.uid()
  ));

-- INSERT 는 service_role(Edge Function)만 수행 → 별도 클라이언트 정책 없음

COMMIT;
