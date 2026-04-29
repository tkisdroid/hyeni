-- Extend public.user_profiles with gender + birthdate captured during the
-- SMS parent signup flow (Task 7, co-parent SMS auth plan).
--
-- Verbatim user instruction:
-- "task 7 에서는 회원가입시 다음의 정보를 필수로 받습니다.
--  이름 성별(엄마/아빠) 생년월일 전화번호(인증)"
--
-- Callers:
--   - src/lib/accountAuth.js requestPhoneSignupCode + syncAuthProfile upsert
--     into public.user_profiles
--   - src/App.jsx ParentAuthScreen signup form (gender radio, birthdate input)
--
-- gender values are stored as 'mom'/'dad' (DB internal). UI labels them
-- '엄마'/'아빠'. Existing rows (Kakao-only signups) keep NULL — only the
-- SMS signup path collects these fields. Idempotent ADD COLUMN IF NOT EXISTS.

BEGIN;

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS gender text,
  ADD COLUMN IF NOT EXISTS birthdate date;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'user_profiles_gender_check'
       AND conrelid = 'public.user_profiles'::regclass
  ) THEN
    ALTER TABLE public.user_profiles
      ADD CONSTRAINT user_profiles_gender_check
      CHECK (gender IS NULL OR gender IN ('mom', 'dad'));
  END IF;
END $$;

COMMIT;
