-- ==========================================
-- 혜니 포인트 시스템 MVP
-- ==========================================

-- 1. 혜니 지갑 (가족당 1개)
CREATE TABLE IF NOT EXISTS point_wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE UNIQUE,
  balance INTEGER NOT NULL DEFAULT 0 CHECK (balance >= 0),
  total_earned INTEGER NOT NULL DEFAULT 0,
  streak_days INTEGER NOT NULL DEFAULT 0,
  streak_updated_at DATE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. 혜니 거래 내역
CREATE TABLE IF NOT EXISTS point_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id UUID NOT NULL REFERENCES point_wallets(id) ON DELETE CASCADE,
  family_id UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  member_id UUID REFERENCES family_members(id),
  type TEXT NOT NULL CHECK (type IN ('earn', 'spend', 'expire')),
  category TEXT NOT NULL CHECK (category IN (
    'attendance', 'arrival', 'arrival_early', 'arrival_streak',
    'event_create', 'gguk', 'memo', 'academy_register',
    'referral_invite', 'referral_welcome', 'referral_milestone'
  )),
  amount INTEGER NOT NULL,
  balance_after INTEGER NOT NULL,
  description TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pt_wallet ON point_transactions(wallet_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pt_daily ON point_transactions(family_id, category, (created_at::date));
CREATE INDEX IF NOT EXISTS idx_pt_meta ON point_transactions USING GIN (metadata);

-- 3. 추천 코드
CREATE TABLE IF NOT EXISTS referral_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE UNIQUE,
  code TEXT NOT NULL UNIQUE,
  total_referrals INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rc_code ON referral_codes(code);

-- 4. 추천 완료 기록
CREATE TABLE IF NOT EXISTS referral_completions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referral_code_id UUID NOT NULL REFERENCES referral_codes(id),
  referrer_family_id UUID NOT NULL REFERENCES families(id),
  referee_family_id UUID NOT NULL REFERENCES families(id),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'qualified', 'rewarded')),
  qualified_at TIMESTAMPTZ,
  rewarded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(referrer_family_id, referee_family_id)
);

-- 5. families 컬럼 추가
ALTER TABLE families ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE;
ALTER TABLE families ADD COLUMN IF NOT EXISTS referred_by_family_id UUID REFERENCES families(id);

-- 6. 일일 한도 체크 함수
CREATE OR REPLACE FUNCTION check_daily_limit(
  p_family_id UUID,
  p_category TEXT,
  p_today DATE DEFAULT CURRENT_DATE
) RETURNS INT AS $$
DECLARE
  v_count INT;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM point_transactions
  WHERE family_id = p_family_id
    AND category = p_category
    AND created_at::date = p_today;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- 7. 일일 전체 적립 합산 체크 함수 (추천 제외)
CREATE OR REPLACE FUNCTION check_daily_total(
  p_family_id UUID,
  p_today DATE DEFAULT CURRENT_DATE
) RETURNS INT AS $$
DECLARE
  v_total INT;
BEGIN
  SELECT COALESCE(SUM(amount), 0) INTO v_total
  FROM point_transactions
  WHERE family_id = p_family_id
    AND type = 'earn'
    AND category NOT IN ('referral_invite', 'referral_welcome', 'referral_milestone')
    AND created_at::date = p_today;
  RETURN v_total;
END;
$$ LANGUAGE plpgsql;

-- 8. 혜니 적립 RPC (한도 체크 포함)
CREATE OR REPLACE FUNCTION earn_points(
  p_family_id UUID,
  p_member_id UUID,
  p_category TEXT,
  p_amount INT,
  p_description TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'
) RETURNS JSONB AS $$
DECLARE
  v_wallet point_wallets%ROWTYPE;
  v_new_balance INT;
  v_daily_count INT;
  v_daily_total INT;
  v_daily_limit INT;
  v_is_referral BOOLEAN;
BEGIN
  v_is_referral := p_category IN ('referral_invite', 'referral_welcome', 'referral_milestone');

  IF NOT v_is_referral THEN
    v_daily_limit := CASE p_category
      WHEN 'attendance' THEN 1
      WHEN 'arrival' THEN 5
      WHEN 'arrival_early' THEN 5
      WHEN 'event_create' THEN 3
      WHEN 'gguk' THEN 5
      WHEN 'memo' THEN 3
      WHEN 'academy_register' THEN 1
      WHEN 'arrival_streak' THEN 2
      ELSE 999
    END;

    IF p_category IN ('arrival', 'arrival_early') THEN
      SELECT COUNT(*) INTO v_daily_count
      FROM point_transactions
      WHERE family_id = p_family_id
        AND category IN ('arrival', 'arrival_early')
        AND created_at::date = CURRENT_DATE;
    ELSE
      v_daily_count := check_daily_limit(p_family_id, p_category);
    END IF;

    IF v_daily_count >= v_daily_limit THEN
      RETURN jsonb_build_object('success', false, 'error', 'daily_limit_reached');
    END IF;

    v_daily_total := check_daily_total(p_family_id);
    IF v_daily_total + p_amount > 50 THEN
      RETURN jsonb_build_object('success', false, 'error', 'daily_cap_reached');
    END IF;
  END IF;

  INSERT INTO point_wallets (family_id)
  VALUES (p_family_id)
  ON CONFLICT (family_id) DO NOTHING;

  SELECT * INTO v_wallet
  FROM point_wallets WHERE family_id = p_family_id FOR UPDATE;

  v_new_balance := v_wallet.balance + p_amount;

  UPDATE point_wallets SET
    balance = v_new_balance,
    total_earned = total_earned + p_amount,
    updated_at = now()
  WHERE id = v_wallet.id;

  INSERT INTO point_transactions
    (wallet_id, family_id, member_id, type, category,
     amount, balance_after, description, metadata)
  VALUES
    (v_wallet.id, p_family_id, p_member_id, 'earn',
     p_category, p_amount, v_new_balance, p_description, p_metadata);

  RETURN jsonb_build_object('success', true, 'balance', v_new_balance, 'earned', p_amount);
END;
$$ LANGUAGE plpgsql;

-- 9. 스트릭 업데이트 RPC
CREATE OR REPLACE FUNCTION update_streak(
  p_family_id UUID,
  p_today DATE DEFAULT CURRENT_DATE
) RETURNS INT AS $$
DECLARE
  v_wallet point_wallets%ROWTYPE;
  v_new_streak INT;
BEGIN
  SELECT * INTO v_wallet
  FROM point_wallets WHERE family_id = p_family_id FOR UPDATE;
  IF v_wallet IS NULL THEN RETURN 0; END IF;

  IF v_wallet.streak_updated_at = p_today THEN
    RETURN v_wallet.streak_days;
  ELSIF v_wallet.streak_updated_at = p_today - 1 THEN
    v_new_streak := v_wallet.streak_days + 1;
  ELSE
    v_new_streak := 1;
  END IF;

  UPDATE point_wallets SET
    streak_days = v_new_streak,
    streak_updated_at = p_today,
    updated_at = now()
  WHERE id = v_wallet.id;

  RETURN v_new_streak;
END;
$$ LANGUAGE plpgsql;

-- 10. 추천 코드 생성 RPC
CREATE OR REPLACE FUNCTION get_or_create_referral_code(
  p_family_id UUID
) RETURNS TEXT AS $$
DECLARE
  v_code TEXT;
BEGIN
  SELECT code INTO v_code FROM referral_codes WHERE family_id = p_family_id;
  IF v_code IS NOT NULL THEN RETURN v_code; END IF;

  v_code := 'HYENI-' ||
    upper(substr(md5(random()::text), 1, 4)) || '-' ||
    upper(substr(md5(random()::text), 1, 4));

  INSERT INTO referral_codes (family_id, code)
  VALUES (p_family_id, v_code)
  ON CONFLICT (family_id) DO UPDATE SET code = referral_codes.code
  RETURNING code INTO v_code;

  UPDATE families SET referral_code = v_code WHERE id = p_family_id;
  RETURN v_code;
END;
$$ LANGUAGE plpgsql;

-- 11. 추천 코드 적용 RPC
CREATE OR REPLACE FUNCTION apply_referral_code(
  p_referee_family_id UUID,
  p_code TEXT
) RETURNS JSONB AS $$
DECLARE
  v_rc referral_codes%ROWTYPE;
  v_already BOOLEAN;
BEGIN
  SELECT * INTO v_rc FROM referral_codes WHERE code = upper(trim(p_code));
  IF v_rc IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_code');
  END IF;

  IF v_rc.family_id = p_referee_family_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'self_referral');
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM referral_completions WHERE referee_family_id = p_referee_family_id
  ) INTO v_already;
  IF v_already THEN
    RETURN jsonb_build_object('success', false, 'error', 'already_referred');
  END IF;

  INSERT INTO referral_completions
    (referral_code_id, referrer_family_id, referee_family_id, status)
  VALUES (v_rc.id, v_rc.family_id, p_referee_family_id, 'pending');

  UPDATE families SET referred_by_family_id = v_rc.family_id
  WHERE id = p_referee_family_id;

  RETURN jsonb_build_object('success', true, 'referrer_family_id', v_rc.family_id);
END;
$$ LANGUAGE plpgsql;

-- 12. 추천 보상 지급 RPC (3일 리텐션 후)
CREATE OR REPLACE FUNCTION complete_referral_reward(
  p_completion_id UUID
) RETURNS JSONB AS $$
DECLARE
  v_comp referral_completions%ROWTYPE;
  v_referrer_count INT;
  v_milestone_bonus INT := 0;
BEGIN
  SELECT * INTO v_comp
  FROM referral_completions WHERE id = p_completion_id FOR UPDATE;

  IF v_comp IS NULL OR v_comp.status != 'pending' THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid');
  END IF;

  UPDATE referral_completions SET
    status = 'rewarded', qualified_at = now(), rewarded_at = now()
  WHERE id = p_completion_id;

  PERFORM earn_points(
    v_comp.referrer_family_id, NULL,
    'referral_invite', 50,
    '친구 추천 보상',
    jsonb_build_object('referee_family_id', v_comp.referee_family_id)
  );

  PERFORM earn_points(
    v_comp.referee_family_id, NULL,
    'referral_welcome', 50,
    '추천 가입 환영 보상',
    jsonb_build_object('referrer_family_id', v_comp.referrer_family_id)
  );

  UPDATE referral_codes SET total_referrals = total_referrals + 1
  WHERE id = v_comp.referral_code_id;

  SELECT total_referrals INTO v_referrer_count
  FROM referral_codes WHERE id = v_comp.referral_code_id;

  IF v_referrer_count = 5 THEN v_milestone_bonus := 100;
  ELSIF v_referrer_count = 10 THEN v_milestone_bonus := 200;
  ELSIF v_referrer_count = 20 THEN v_milestone_bonus := 500;
  END IF;

  IF v_milestone_bonus > 0 THEN
    PERFORM earn_points(
      v_comp.referrer_family_id, NULL,
      'referral_milestone', v_milestone_bonus,
      v_referrer_count || '명 추천 달성 보너스',
      jsonb_build_object('milestone', v_referrer_count)
    );
  END IF;

  RETURN jsonb_build_object('success', true, 'milestone_bonus', v_milestone_bonus);
END;
$$ LANGUAGE plpgsql;

-- 13. RLS
ALTER TABLE point_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE point_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE referral_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE referral_completions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "wallet_read" ON point_wallets FOR SELECT
  USING (family_id IN (SELECT family_id FROM family_members WHERE user_id = auth.uid()));

CREATE POLICY "tx_read" ON point_transactions FOR SELECT
  USING (family_id IN (SELECT family_id FROM family_members WHERE user_id = auth.uid()));

CREATE POLICY "rc_read" ON referral_codes FOR SELECT
  USING (family_id IN (SELECT family_id FROM family_members WHERE user_id = auth.uid()));

CREATE POLICY "rcomp_read" ON referral_completions FOR SELECT
  USING (
    referrer_family_id IN (SELECT family_id FROM family_members WHERE user_id = auth.uid())
    OR referee_family_id IN (SELECT family_id FROM family_members WHERE user_id = auth.uid())
  );
